'use server'

import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'

// ==================== TYPES ====================

export interface RevealedData {
    stage: string
    data: Record<string, unknown>
}

// ==================== REQUEST UNFOLD ====================

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
                .select('full_name, profile_photo_url, age, height, location')
                .eq('id', otherUserId)
                .single()

            return {
                data: {
                    stage: 'unfold',
                    data: {
                        full_name: profile?.full_name ?? null,
                        profile_photo_url: profile?.profile_photo_url ?? null,
                        age: profile?.age ?? null,
                        height: profile?.height ?? null,
                        location: profile?.location ?? null,
                    },
                },
            }
        }

        default:
            return { error: 'Invalid stage' }
    }
}
