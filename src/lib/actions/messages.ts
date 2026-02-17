'use server'

import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'

// ==================== CONSTANTS ====================

const MESSAGE_MIN_LENGTH = 5
const MESSAGE_RATE_LIMIT_MS = 3000

// ==================== TYPES ====================

export interface Message {
    id: string
    connection_id: string
    sender_id: string
    content: string
    message_type: 'text' | 'emoji' | 'voice' | 'image' | 'system'
    media_url: string | null
    is_read: boolean
    read_at: string | null
    created_at: string
}

export interface ChatData {
    connection: {
        id: string
        requester_id: string
        recipient_id: string
        connection_type: 'stranger' | 'known'
        status: string
        reveal_stage: string
        message_count: number
        unfold_requester: boolean
        unfold_recipient: boolean
        connected_at: string | null
    }
    otherUser: {
        id: string
        shadow_name: string
        avatar_id: string
        real_name?: string | null
        profile_photo?: string | null
        pronouns?: string | null
        social_energy?: string | null
        bio?: string | null
        interests?: string[]
        love_soul?: {
            q1_answer: string | null
            q2_answer: string | null
            q3_answer: string | null
            q4_answer: string | null
            attachment_style: string | null
            love_language: string | null
        } | null
    }
    messages: Message[]
    currentUserId: string
}

// ==================== SEND MESSAGE ====================

export async function sendMessage(
    connectionId: string,
    content: string,
    type: 'text' | 'emoji' | 'voice' | 'image' = 'text',
    mediaUrl?: string
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Validate connection exists and is accepted
    const { data: connection } = await supabase
        .from('connections')
        .select('id, requester_id, recipient_id, status, reveal_stage')
        .eq('id', connectionId)
        .single()

    if (!connection) return { error: 'Connection not found' }
    if (connection.status !== 'accepted') return { error: 'Connection not accepted' }
    if (connection.requester_id !== user.id && connection.recipient_id !== user.id) {
        return { error: 'Not a participant' }
    }

    // Anti-gaming: minimum length for text messages (affects reveal count)
    if (type === 'text' && content.trim().length < MESSAGE_MIN_LENGTH) {
        return { error: `Messages must be at least ${MESSAGE_MIN_LENGTH} characters` }
    }

    // Anti-gaming: no consecutive duplicate messages
    if (type === 'text') {
        const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('connection_id', connectionId)
            .eq('sender_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (lastMsg && lastMsg.content === content.trim()) {
            return { error: 'Cannot send duplicate consecutive messages' }
        }
    }

    // Anti-gaming: rate limit (1 message per 3 seconds)
    const { data: recentMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('connection_id', connectionId)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (recentMsg) {
        const timeSince = Date.now() - new Date(recentMsg.created_at).getTime()
        if (timeSince < MESSAGE_RATE_LIMIT_MS) {
            return { error: 'Sending too fast. Please wait a moment.' }
        }
    }

    // Image sharing check: disabled until Glimpse stage for stranger connections
    if (type === 'image' && connection.reveal_stage !== 'glimpse' &&
        connection.reveal_stage !== 'soul' && connection.reveal_stage !== 'unfold') {
        // Check if it's a stranger connection (known connections always allow images)
        const { data: connType } = await supabase
            .from('connections')
            .select('connection_type')
            .eq('id', connectionId)
            .single()

        if (connType?.connection_type === 'stranger') {
            return { error: 'Image sharing is available at Glimpse stage' }
        }
    }

    // Insert message — the check_reveal_progression() trigger fires automatically
    const { data: message, error } = await supabase
        .from('messages')
        .insert({
            connection_id: connectionId,
            sender_id: user.id,
            content: content.trim(),
            message_type: type,
            media_url: mediaUrl || null,
        })
        .select('*')
        .single()

    if (error) {
        console.error('Send message error:', error)
        return { error: 'Failed to send message' }
    }

    // Trigger Notification for the OTHER user
    const recipientId = connection.requester_id === user.id ? connection.recipient_id : connection.requester_id

    // Don't await strictly if we want speed, but V1 safety first -> wait or fire-and-forget?
    // Fire-and-forget logic for speed:
    // We assume the user is still 'user.id'
    createNotification(
        recipientId,
        'new_message',
        connectionId,
        { snippet: type === 'text' ? content.substring(0, 50) : `Sent a ${type}` }
    ).catch(err => console.error('Notification trigger failed', err))

    return { data: message as Message }
}

// ==================== FETCH MESSAGES ====================

export async function fetchMessages(
    connectionId: string,
    cursor?: string,
    limit: number = 50
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    let query = supabase
        .from('messages')
        .select('*')
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: false })
        .limit(limit)

    // Cursor-based pagination: load older messages
    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
        console.error('Fetch messages error:', error)
        return { error: 'Failed to fetch messages', data: [] }
    }

    // Reverse so oldest is first (for display)
    return { data: (data || []).reverse() as Message[] }
}

// ==================== MARK MESSAGES READ ====================

export async function markMessagesRead(connectionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Use the RPC function for atomic batch update
    const { data, error } = await supabase.rpc('mark_messages_read', {
        p_connection_id: connectionId,
        p_user_id: user.id,
    })

    if (error) {
        console.error('Mark read error:', error)
        return { error: 'Failed to mark messages as read' }
    }

    // ALSO mark notifications as read for this connection
    // This ensures the bell icon clears when the user opens the chat
    await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('resource_id', connectionId)
        .eq('type', 'new_message')
        .eq('is_read', false)

    return { data: { count: data ?? 0 } }
}

// ==================== FETCH CHAT DATA ====================

export async function fetchChatData(connectionId: string): Promise<{ error?: string; data?: ChatData }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Fetch connection
    const { data: connection, error: connError } = await supabase
        .from('connections')
        .select('id, requester_id, recipient_id, connection_type, status, reveal_stage, message_count, unfold_requester, unfold_recipient, connected_at')
        .eq('id', connectionId)
        .single()

    if (connError || !connection) return { error: 'Connection not found' }
    if (connection.status !== 'accepted') return { error: 'Connection not accepted' }
    if (connection.requester_id !== user.id && connection.recipient_id !== user.id) {
        return { error: 'Not a participant' }
    }

    const otherUserId = connection.requester_id === user.id
        ? connection.recipient_id
        : connection.requester_id

    // Always fetch shadow profile
    const { data: shadowProfile } = await supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id, pronouns, social_energy, bio, interests')
        .eq('id', otherUserId)
        .single()

    if (!shadowProfile) return { error: 'Profile not found' }

    // Build other user data
    const otherUser: ChatData['otherUser'] = {
        id: shadowProfile.id,
        shadow_name: shadowProfile.shadow_name,
        avatar_id: shadowProfile.avatar_id,
        pronouns: shadowProfile.pronouns,
        social_energy: shadowProfile.social_energy,
        bio: shadowProfile.bio,
        interests: shadowProfile.interests,
    }

    // Conditionally fetch real profile (known connection or unfolded)
    const isFullAccess = connection.connection_type === 'known' || connection.reveal_stage === 'unfold'
    if (isFullAccess) {
        const { data: realProfile } = await supabase
            .from('profiles')
            .select('full_name, profile_photo_url')
            .eq('id', otherUserId)
            .single()

        if (realProfile) {
            otherUser.real_name = realProfile.full_name
            otherUser.profile_photo = realProfile.profile_photo_url
        }
    }

    // Conditionally fetch love_soul (soul or unfold stage)
    if (connection.reveal_stage === 'soul' || connection.reveal_stage === 'unfold') {
        const { data: loveSoul } = await supabase
            .from('love_soul')
            .select('q1_answer, q2_answer, q3_answer, q4_answer, attachment_style, love_language')
            .eq('id', otherUserId)
            .single()

        if (loveSoul) {
            otherUser.love_soul = loveSoul
        }
    }

    // Check if the OTHER person in this connection is blocked.
    // We need to know who the other person is.
    // First, fetch the connection to identify valid participants.
    // (connection is already fetched above)

    // Check if I blocked them
    const { data: blockedByMe } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', otherUserId)
        .single()

    if (blockedByMe) {
        return { error: 'You have blocked this user.' }
    }

    // Check if they blocked me
    const { data: blockedByThem } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', otherUserId)
        .eq('blocked_id', user.id)
        .single()

    if (blockedByThem) {
        return { error: 'This user has blocked you.' }
    }

    // Fetch last 50 messages
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: false })
        .limit(50)

    return {
        data: {
            connection: {
                id: connection.id,
                requester_id: connection.requester_id,
                recipient_id: connection.recipient_id,
                connection_type: connection.connection_type as 'stranger' | 'known',
                status: connection.status,
                reveal_stage: connection.reveal_stage,
                message_count: connection.message_count,
                unfold_requester: connection.unfold_requester,
                unfold_recipient: connection.unfold_recipient,
                connected_at: connection.connected_at,
            },
            otherUser,
            messages: ((messages || []).reverse()) as Message[],
            currentUserId: user.id,
        },
    }
}
