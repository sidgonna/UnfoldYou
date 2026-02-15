'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificationType =
    | 'connection_request'
    | 'connection_accepted'
    | 'new_message'
    | 'pov_like'
    | 'reveal_milestone'

export interface Notification {
    id: string
    recipient_id: string
    actor_id: string | null
    type: NotificationType
    resource_id: string | null
    metadata: Record<string, any>
    is_read: boolean
    read_at: string | null
    created_at: string
    actor?: {
        shadow_name: string
        avatar_id: string
    }
}

// Create a notification (Internal use mainly)
export async function createNotification(
    recipientId: string,
    type: NotificationType,
    resourceId?: string,
    metadata: Record<string, any> = {}
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }
    if (recipientId === user.id) return { error: 'Cannot notify self' } // Optional: depending on use case

    const { error } = await supabase
        .from('notifications')
        .insert({
            recipient_id: recipientId,
            actor_id: user.id,
            type,
            resource_id: resourceId,
            metadata
        })

    if (error) {
        console.error('Create notification error:', error)
        return { error: 'Failed to create notification' }
    }

    return { success: true }
}

// Fetch notifications for the current user
export async function fetchNotifications(limit = 20) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated', data: [] }

    // 1. Fetch raw notifications
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Fetch notifications error:', error)
        return { error: 'Failed to fetch notifications', data: [] }
    }

    if (!notifications || notifications.length === 0) {
        return { data: [] }
    }

    // 2. Fetch actors (Shadow Profiles)
    const actorIds = [...new Set(notifications.map(n => n.actor_id).filter(Boolean))] as string[]

    let actorMap = new Map<string, { shadow_name: string; avatar_id: string }>()

    if (actorIds.length > 0) {
        const { data: profiles } = await supabase
            .from('shadow_profiles')
            .select('id, shadow_name, avatar_id')
            .in('id', actorIds)

        if (profiles) {
            actorMap = new Map(profiles.map(p => [p.id, p]))
        }
    }

    // 3. Combine
    const formatted: Notification[] = notifications.map((n: any) => ({
        ...n,
        actor: n.actor_id ? (actorMap.get(n.actor_id) || { shadow_name: 'Unknown', avatar_id: '👤' }) : undefined
    }))

    return { data: formatted }
}

// Mark a single notification as read
export async function markNotificationRead(notificationId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_id', user.id)

    if (error) return { error: 'Failed to update notification' }
    return { success: true }
}

// Mark all as read
export async function markAllNotificationsRead() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('is_read', false)

    if (error) return { error: 'Failed to update notifications' }
    return { success: true }
}

// Get unread count
export async function getUnreadNotificationCount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { count: 0 }

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false)

    if (error) return { count: 0 }
    return { count: count || 0 }
}
