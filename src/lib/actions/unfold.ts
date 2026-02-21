'use server'

import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'
import { revalidatePath } from 'next/cache'

// ==================== TYPES ====================

export interface RevealedData {
    stage: string
    data: Record<string, unknown>
}

// ==================== REQUEST UNFOLD ====================

// ==================== CONSENT LOGIC ====================

export async function submitStageConsent(connectionId: string, stage: string, action: 'accept' | 'decline') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Fetch current state
    const { data: conn } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionId)
        .single()

    if (!conn) return { error: 'Connection not found' }

    // Confirm user is participant
    const isRequester = conn.requester_id === user.id
    const isRecipient = conn.recipient_id === user.id
    if (!isRequester && !isRecipient) return { error: 'Not a participant' }

    // --- VALIDATION: Thresholds ---
    // Determine thresholds (Test vs Normal)
    const isTestMode = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true'
    
    // Limits
    const thresholds = isTestMode 
        ? { shadow: 0, whisper: 10, glimpse: 15, soul: 20 }
        : { shadow: 0, whisper: 25, glimpse: 50, soul: 100 }

    const nextStage = stage
    // Determine required count for the *requested* stage
    const requiredCount = (thresholds as any)[nextStage] || 9999
    
    if (conn.message_count < requiredCount) {
        return { error: `Not enough messages! You need ${requiredCount} to unlock ${stage}.` }
    }

    // --- VALIDATION: Mutual Participation ---
    // Count messages from EACH user
    if (action === 'accept') {
        const { count: myCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('connection_id', connectionId)
            .eq('sender_id', user.id)
            
        const otherUserId = isRequester ? conn.recipient_id : conn.requester_id
        const { count: theirCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('connection_id', connectionId)
            .eq('sender_id', otherUserId)

        // Rule: Each must send at least 1 message (or ~10% balance?)
        // Let's go with strict mutual engagement: > 0 for everyone
        if ((myCount || 0) < 1) {
            return { error: "You haven't sent any messages yet! Chat to unfold." }
        }
        if ((theirCount || 0) < 1) {
             return { error: "The other person hasn't spoken yet. Wait for a reply!" }
        }
    }

    // Cooldown check (2 minutes)
    const now = new Date()
    const lastRequest = conn.last_consent_request ? new Date(conn.last_consent_request) : null
    
    // Only enforce cooldown if previously REJECTED
    // If it's a fresh request or accepting a pending one, ignore cooldown
    const currentStatus = conn.consent_status || {}
    const myStatus = currentStatus.requests?.[user.id]

    if (action === 'accept' && myStatus === 'declined' && lastRequest) {
        const diffMs = now.getTime() - lastRequest.getTime()
        if (diffMs < 2 * 60 * 1000) {
             const remaining = Math.ceil((120000 - diffMs) / 1000)
             return { error: `Please wait ${remaining}s before requesting again.` }
        }
    }

    // Update status
    let newStatus = { ...currentStatus }
    
    // If target stage changed (new level), reset requests
    // But verify we aren't skipping levels? (UI handles this, but good to know)
    if (newStatus.target_stage !== stage) {
        newStatus = {
            target_stage: stage,
            requests: {}
        }
    }

    // Set my status
    newStatus.requests = {
        ...newStatus.requests,
        [user.id]: action
    }

    const updates: any = {
        consent_status: newStatus,
        updated_at: now.toISOString()
    }

    if (action === 'accept') {
        // Check if BOTH accepted
        const otherUserId = conn.requester_id === user.id ? conn.recipient_id : conn.requester_id
        const otherStatus = newStatus.requests?.[otherUserId]

        if (otherStatus === 'accept') {
            // UNLOCK!
            updates.reveal_stage = stage
            
            // Notify other user of unlock
             createNotification(
                otherUserId, 
                'reveal_milestone', 
                connectionId, 
                { stage }
            ).catch(console.error)
        }
    } else {
        // Decline -> Set timestamp for cooldown
        updates.last_consent_request = now.toISOString()
    }

    const { error } = await supabase
        .from('connections')
        .update(updates)
        .eq('id', connectionId)

    if (error) {
        console.error('Consent error:', error)
        return { error: 'Failed to update consent' }
    }

    revalidatePath('/chat/[connectionId]', 'page')
    return { success: true, status: action }
}

export async function fetchConsentStatus(connectionId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('connections')
        .select('consent_status, last_consent_request, reveal_stage')
        .eq('id', connectionId)
        .single()
    
    return { data }
}

export async function requestUnfold(connectionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Fetch connection
    const { data: connection } = await supabase
        .from('connections')
        .select('id, requester_id, recipient_id, status, reveal_stage, unfold_requester, unfold_recipient, connection_type')
        .eq('id', connectionId)
        .single()

    if (!connection) return { error: 'Connection not found' }
    if (connection.status !== 'accepted') return { error: 'Connection not accepted' }
    if (connection.connection_type === 'known') return { error: 'Known connections are already unfolded' }
    if (connection.reveal_stage !== 'soul') return { error: 'Unfold requires Soul stage' }

    // Determine role
    const isRequester = connection.requester_id === user.id
    const isRecipient = connection.recipient_id === user.id
    if (!isRequester && !isRecipient) return { error: 'Not a participant' }

    // Check if already requested
    if (isRequester && connection.unfold_requester) return { error: 'Already requested unfold' }
    if (isRecipient && connection.unfold_recipient) return { error: 'Already requested unfold' }

    // Set the flag for this user
    const updateData = isRequester
        ? { unfold_requester: true }
        : { unfold_recipient: true }

    await supabase
        .from('connections')
        .update(updateData)
        .eq('id', connectionId)

    // Check if BOTH parties have now agreed
    const bothAgreed = isRequester
        ? connection.unfold_recipient === true // Other side already agreed
        : connection.unfold_requester === true

    if (bothAgreed) {
        // Advance to unfold stage!
        await supabase
            .from('connections')
            .update({ reveal_stage: 'unfold' })
            .eq('id', connectionId)

        // Insert system messages
        await supabase.from('messages').insert([
            {
                connection_id: connectionId,
                sender_id: user.id,
                content: '🦋 Both of you have unfolded! Real identities are now shared.',
                message_type: 'system',
            },
        ])

        // Notify both parties (or just the other one? System event)
        // Let's notify the OTHER person that "You unfolded!"
        await createNotification(
            isRequester ? connection.recipient_id : connection.requester_id,
            'reveal_milestone',
            connectionId,
            { stage: 'unfold' }
        )

        return { data: { status: 'unfolded' as const } }
    }

    // Insert system message about waiting
    const { data: shadowProfile } = await supabase
        .from('shadow_profiles')
        .select('shadow_name')
        .eq('id', isRequester ? connection.recipient_id : connection.requester_id)
        .single()

    await supabase.from('messages').insert([
        {
            connection_id: connectionId,
            sender_id: user.id,
            content: `🦋 Ready to unfold. Waiting for ${shadowProfile?.shadow_name ?? 'them'}...`,
            message_type: 'system',
        },
    ])

    return { data: { status: 'waiting' as const } }
}

// ==================== FETCH REVEALED DATA ====================

export async function fetchRevealedData(connectionId: string, stage: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Fetch connection to find other user
    const { data: connection } = await supabase
        .from('connections')
        .select('requester_id, recipient_id, reveal_stage')
        .eq('id', connectionId)
        .single()

    if (!connection) return { error: 'Connection not found' }

    const otherUserId = connection.requester_id === user.id
        ? connection.recipient_id
        : connection.requester_id

    // Validate stage access
    const stageOrder = ['shadow', 'whisper', 'glimpse', 'soul', 'unfold']
    const currentStageIndex = stageOrder.indexOf(connection.reveal_stage)
    const requestedStageIndex = stageOrder.indexOf(stage)

    if (requestedStageIndex > currentStageIndex) {
        return { error: 'Stage not yet unlocked' }
    }

    switch (stage) {
        case 'whisper': {
            const { data: profile } = await supabase
                .from('profiles')
                .select('voice_note_url')
                .eq('id', otherUserId)
                .single()

            return {
                data: {
                    stage: 'whisper',
                    data: { voice_note_url: profile?.voice_note_url ?? null },
                },
            }
        }

        case 'glimpse': {
            const { data: profile } = await supabase
                .from('profiles')
                .select('intent, habits')
                .eq('id', otherUserId)
                .single()

            return {
                data: {
                    stage: 'glimpse',
                    data: {
                        intent: profile?.intent ?? null,
                        habits: profile?.habits ?? [],
                    },
                },
            }
        }

        case 'soul': {
            const { data: loveSoul } = await supabase
                .from('love_soul')
                .select('q1_answer, q2_answer, q3_answer, q4_answer, attachment_style, love_language')
                .eq('id', otherUserId)
                .single()

            return {
                data: {
                    stage: 'soul',
                    data: {
                        q1: loveSoul?.q1_answer ?? null,
                        q2: loveSoul?.q2_answer ?? null,
                        q3: loveSoul?.q3_answer ?? null,
                        q4: loveSoul?.q4_answer ?? null,
                        attachment_style: loveSoul?.attachment_style ?? null,
                        love_language: loveSoul?.love_language ?? null,
                    },
                },
            }
        }

        case 'unfold': {
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, profile_picture_url, dob, height_cm, location_city, location_country')
                .eq('id', otherUserId)
                .single()

            return {
                data: {
                    stage: 'unfold',
                    data: {
                        full_name: profile?.name ?? null,
                        profile_photo_url: profile?.profile_picture_url ?? null,
                        dob: profile?.dob ?? null,
                        height: profile?.height_cm ?? null,
                        location: profile ? `${profile.location_city}, ${profile.location_country}` : null,
                    },
                },
            }
        }

        default:
            return { error: 'Invalid stage' }
    }
}
