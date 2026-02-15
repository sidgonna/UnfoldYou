'use server'

import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'

// ==================== CONSTANTS ====================

const MAX_REQUESTS_PER_DAY = 20
const MAX_ACTIVE_STRANGER_CONNECTIONS = 50
const CODE_EXPIRY_MINUTES = 30
const MAX_CODE_ATTEMPTS = 3

// ==================== TYPES ====================

export interface ConnectionRequest {
    id: string
    requester_id: string
    recipient_id: string
    connection_type: 'stranger' | 'known'
    status: 'pending' | 'accepted' | 'declined' | 'expired'
    request_message: string | null
    verification_code: string | null
    code_expires_at: string | null
    code_attempts: number
    reveal_stage: string
    message_count: number
    unfold_requester: boolean
    unfold_recipient: boolean
    connected_at: string | null
    created_at: string
    updated_at: string
    shadow_profile?: {
        shadow_name: string
        avatar_id: string
    }
}

export interface ConnectionWithProfile {
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
    created_at: string
    other_user_id: string
    shadow_name: string
    avatar_id: string
    last_message?: string | null
    last_message_at?: string | null
    unread_count?: number
}

// ==================== HELPERS ====================

function generateAlphanumericCode(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude I/O/1/0 for clarity
    let code = ''
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// ==================== STRANGER FLOW ====================

export async function sendConnectionRequest(recipientId: string, message?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Validate: no self-connect
    if (recipientId === user.id) return { error: 'Cannot connect with yourself' }

    // Check if blocked
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${user.id})`)
        .limit(1)

    if (blocked && blocked.length > 0) return { error: 'Cannot connect with this user' }

    // Check for duplicate connection (either direction)
    const { data: existing } = await supabase
        .from('connections')
        .select('id, status')
        .or(
            `and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),` +
            `and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`
        )
        .in('status', ['pending', 'accepted'])
        .limit(1)

    if (existing && existing.length > 0) {
        return { error: existing[0].status === 'pending' ? 'Request already pending' : 'Already connected' }
    }

    // Rate limit: max requests per day
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('requester_id', user.id)
        .gte('created_at', today.toISOString())

    if ((todayCount ?? 0) >= MAX_REQUESTS_PER_DAY) {
        return { error: `Maximum ${MAX_REQUESTS_PER_DAY} requests per day` }
    }

    // Rate limit: max active stranger connections
    const { count: activeCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('connection_type', 'stranger')
        .eq('status', 'accepted')

    if ((activeCount ?? 0) >= MAX_ACTIVE_STRANGER_CONNECTIONS) {
        return { error: `Maximum ${MAX_ACTIVE_STRANGER_CONNECTIONS} active stranger connections` }
    }

    // Create connection request
    const { data, error } = await supabase
        .from('connections')
        .insert({
            requester_id: user.id,
            recipient_id: recipientId,
            connection_type: 'stranger',
            status: 'pending',
            request_message: message?.trim() || null,
        })
        .select('id')
        .single()

    if (error) {
        console.error('Send connection request error:', error)
        return { error: 'Failed to send request' }
    }

    // Trigger Notification
    await createNotification(
        recipientId,
        'connection_request',
        data.id,
        { message: message?.trim() }
    )

    return { data: { id: data.id } }
}

// ==================== KNOWN FLOW ====================

export async function generateKnownConnectionCode(recipientId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    if (recipientId === user.id) return { error: 'Cannot connect with yourself' }

    // Check for existing connection (either direction)
    const { data: existing } = await supabase
        .from('connections')
        .select('id, status')
        .or(
            `and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),` +
            `and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`
        )
        .in('status', ['pending', 'accepted'])
        .limit(1)

    if (existing && existing.length > 0) {
        return { error: existing[0].status === 'pending' ? 'Request already pending' : 'Already connected' }
    }

    const code = generateAlphanumericCode()
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    const { data, error } = await supabase
        .from('connections')
        .insert({
            requester_id: user.id,
            recipient_id: recipientId,
            connection_type: 'known',
            status: 'pending',
            verification_code: code,
            code_expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single()

    if (error) {
        console.error('Generate known code error:', error)
        return { error: 'Failed to generate code' }
    }

    return {
        data: {
            connectionId: data.id,
            code,
            expiresAt: expiresAt.toISOString(),
        },
    }
}

export async function redeemKnownConnectionCode(code: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const normalizedCode = code.toUpperCase().replace(/\s/g, '')

    // Find matching pending known connection where current user is recipient
    const { data: connection, error: findError } = await supabase
        .from('connections')
        .select('*')
        .eq('verification_code', normalizedCode)
        .eq('recipient_id', user.id)
        .eq('connection_type', 'known')
        .eq('status', 'pending')
        .single()

    if (findError || !connection) {
        return { error: 'Invalid code' }
    }

    // Check expiry
    if (connection.code_expires_at && new Date(connection.code_expires_at) < new Date()) {
        await supabase
            .from('connections')
            .update({ status: 'expired' })
            .eq('id', connection.id)
        return { error: 'Code has expired' }
    }

    // Check attempts
    if (connection.code_attempts >= MAX_CODE_ATTEMPTS) {
        return { error: 'Maximum attempts exceeded' }
    }

    // Success — accept the connection
    const { error: updateError } = await supabase
        .from('connections')
        .update({
            status: 'accepted',
            connected_at: new Date().toISOString(),
            verification_code: null, // Clear code after use
        })
        .eq('id', connection.id)

    if (updateError) {
        console.error('Redeem code error:', updateError)
        return { error: 'Failed to connect' }
    }

    // Notify the requester that their code was accepted
    await createNotification(
        connection.requester_id,
        'connection_accepted',
        connection.id,
        {}
    )

    return { data: { connectionId: connection.id } }
}

export async function incrementCodeAttempts(connectionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: connection } = await supabase
        .from('connections')
        .select('code_attempts, recipient_id')
        .eq('id', connectionId)
        .single()

    if (!connection || connection.recipient_id !== user.id) {
        return { error: 'Not authorized' }
    }

    const newAttempts = (connection.code_attempts || 0) + 1

    await supabase
        .from('connections')
        .update({
            code_attempts: newAttempts,
            ...(newAttempts >= MAX_CODE_ATTEMPTS ? { status: 'expired' } : {}),
        })
        .eq('id', connectionId)

    return {
        data: {
            attemptsLeft: MAX_CODE_ATTEMPTS - newAttempts,
            expired: newAttempts >= MAX_CODE_ATTEMPTS,
        },
    }
}

// ==================== REQUEST MANAGEMENT ====================

export async function respondToConnectionRequest(
    connectionId: string,
    action: 'accept' | 'decline'
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: connection } = await supabase
        .from('connections')
        .select('recipient_id, requester_id, status, connection_type')
        .eq('id', connectionId)
        .single()

    if (!connection) return { error: 'Connection not found' }
    if (connection.recipient_id !== user.id) return { error: 'Not authorized' }
    if (connection.status !== 'pending') return { error: 'Request is no longer pending' }
    if (connection.connection_type === 'known') return { error: 'Known connections use code verification' }

    const updateData = action === 'accept'
        ? { status: 'accepted', connected_at: new Date().toISOString() }
        : { status: 'declined' }

    const { error } = await supabase
        .from('connections')
        .update(updateData)
        .eq('id', connectionId)

    if (error) {
        console.error('Respond to request error:', error)
        return { error: 'Failed to update request' }
    }

    if (action === 'accept') {
        await createNotification(
            connection.recipient_id === user.id ? connection.requester_id : connection.recipient_id, // Notify the OTHER person
            'connection_accepted',
            connectionId,
            {}
        )
    }

    return { data: { status: action === 'accept' ? 'accepted' : 'declined', connectionId } }
}

export async function fetchPendingRequests() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: { incoming: [], outgoing: [] } }

    // Exclude blocked users
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    const blockedIds = (blocked || []).map(b => b.blocked_id)
    const blockedParams = blockedIds.length > 0 ? `(${blockedIds.join(',')})` : null

    // Incoming requests (I'm the recipient)
    let incomingQuery = supabase
        .from('connections')
        .select('id, requester_id, connection_type, status, request_message, created_at, verification_code, code_expires_at, code_attempts')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (blockedParams) {
        incomingQuery = incomingQuery.not('requester_id', 'in', blockedParams)
    }

    const { data: incoming } = await incomingQuery

    // Outgoing requests (I'm the requester)
    let outgoingQuery = supabase
        .from('connections')
        .select('id, recipient_id, connection_type, status, request_message, created_at')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (blockedParams) {
        outgoingQuery = outgoingQuery.not('recipient_id', 'in', blockedParams)
    }

    const { data: outgoing } = await outgoingQuery

    // Get shadow profiles for all other users
    const incomingUserIds = (incoming || []).map(r => r.requester_id)
    const outgoingUserIds = (outgoing || []).map(r => r.recipient_id)
    const allUserIds = [...new Set([...incomingUserIds, ...outgoingUserIds])]

    let profileMap = new Map<string, { shadow_name: string; avatar_id: string }>()

    if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
            .from('shadow_profiles')
            .select('id, shadow_name, avatar_id')
            .in('id', allUserIds)

        profileMap = new Map((profiles || []).map(p => [p.id, { shadow_name: p.shadow_name, avatar_id: p.avatar_id }]))
    }

    return {
        data: {
            incoming: (incoming || []).map(r => ({
                ...r,
                shadow_profile: profileMap.get(r.requester_id) || { shadow_name: 'Unknown', avatar_id: '👤' },
            })),
            outgoing: (outgoing || []).map(r => ({
                ...r,
                shadow_profile: profileMap.get(r.recipient_id) || { shadow_name: 'Unknown', avatar_id: '👤' },
            })),
        },
    }
}

export async function fetchPendingIncomingCount() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('status', 'pending')

    return count ?? 0
}

export async function fetchConnections(includeLastMessage: boolean = false) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    // Exclude blocked users
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    const blockedIds = (blocked || []).map(b => b.blocked_id)
    // Also get users who blocked ME? (Usually we hide them too)
    // For V1, simplest is: if I blocked them, I don't see requests.
    // If they blocked me, I shouldn't see them either, but RLS might handle that or we assume 'connections' logic handles it.
    // Let's stick to: I don't see requests from people I blocked.

    let query = supabase
        .from('connections')
        .select('id, requester_id, recipient_id, connection_type, status, reveal_stage, message_count, unfold_requester, unfold_recipient, connected_at, created_at')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'accepted')
        .order('updated_at', { ascending: false })

    if (blockedIds.length > 0) {
        // We need to filter where requester_id is NOT in blockedIds
        // But .not() with 'in' filter on related table is tricky in simple syntax.
        // It's easier to fetch and filter in JS for small N, or use a complex query.
        // Given Supabase headers, let's try mapping.
        // Actually, we can use the 'not' filter on the top level column.

        // Wait, 'requests' implies someone sent it TO me. So requester_id is the other person.
        // So we filter requester_id NOT IN blockedIds.
        query = query.not('requester_id', 'in', `(${blockedIds.join(',')})`)
        // Also filter recipient_id if the current user is the recipient and the other user is blocked
        query = query.not('recipient_id', 'in', `(${blockedIds.join(',')})`)
    }

    const { data: connections, error } = await query

    if (error) {
        console.error('Fetch connections error:', error)
        return { error: 'Failed to fetch connections', data: [] }
    }

    if (!connections || connections.length === 0) return { data: [] }

    // Get other user IDs
    const otherUserIds = connections.map(c =>
        c.requester_id === user.id ? c.recipient_id : c.requester_id
    )

    // Get shadow profiles
    const { data: profiles } = await supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id')
        .in('id', otherUserIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    // Optionally get last message for each connection
    let lastMessageMap = new Map<string, { content: string; created_at: string }>()
    let unreadMap = new Map<string, number>()

    if (includeLastMessage) {
        const connectionIds = connections.map(c => c.id)

        // Fetch last message per connection
        for (const connId of connectionIds) {
            const { data: lastMsg } = await supabase
                .from('messages')
                .select('content, created_at')
                .eq('connection_id', connId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (lastMsg) {
                lastMessageMap.set(connId, lastMsg)
            }

            // Unread count
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('connection_id', connId)
                .neq('sender_id', user.id)
                .eq('is_read', false)

            unreadMap.set(connId, count ?? 0)
        }
    }

    const results: ConnectionWithProfile[] = connections.map(c => {
        const otherUserId = c.requester_id === user.id ? c.recipient_id : c.requester_id
        const profile = profileMap.get(otherUserId)
        const lastMsg = lastMessageMap.get(c.id)

        return {
            id: c.id,
            requester_id: c.requester_id,
            recipient_id: c.recipient_id,
            connection_type: c.connection_type as 'stranger' | 'known',
            status: c.status,
            reveal_stage: c.reveal_stage,
            message_count: c.message_count,
            unfold_requester: c.unfold_requester,
            unfold_recipient: c.unfold_recipient,
            connected_at: c.connected_at,
            created_at: c.created_at,
            other_user_id: otherUserId,
            shadow_name: profile?.shadow_name ?? 'Unknown',
            avatar_id: profile?.avatar_id ?? '👤',
            last_message: lastMsg?.content ?? null,
            last_message_at: lastMsg?.created_at ?? null,
            unread_count: unreadMap.get(c.id) ?? 0,
        }
    })

    // Sort by last message time (most recent first), fall back to connected_at
    results.sort((a, b) => {
        const timeA = a.last_message_at || a.connected_at || a.created_at
        const timeB = b.last_message_at || b.connected_at || b.created_at
        return new Date(timeB).getTime() - new Date(timeA).getTime()
    })

    return { data: results }
}

export async function cancelConnectionRequest(connectionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId)
        .eq('requester_id', user.id)
        .eq('status', 'pending')

    if (error) {
        console.error('Cancel request error:', error)
        return { error: 'Failed to cancel request' }
    }

    return { data: { success: true } }
}

// ==================== CONNECTION STATUS CHECK ====================

export interface ConnectionStatus {
    status: 'pending' | 'accepted' | 'declined' | 'expired'
    connectionId: string
    direction: 'sent' | 'received'
    connectionType: 'stranger' | 'known'
}

export async function getConnectionStatus(otherUserId: string): Promise<{ data: ConnectionStatus | null; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: null }

    const { data, error } = await supabase
        .from('connections')
        .select('id, status, connection_type, requester_id, recipient_id')
        .or(
            `and(requester_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
            `and(requester_id.eq.${otherUserId},recipient_id.eq.${user.id})`
        )
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return { data: null }

    return {
        data: {
            status: data.status,
            connectionId: data.id,
            direction: data.requester_id === user.id ? 'sent' : 'received',
            connectionType: data.connection_type,
        },
    }
}
