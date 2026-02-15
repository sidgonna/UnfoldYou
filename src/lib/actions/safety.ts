'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ==================== REPORTING ====================

export interface ReportInput {
    reported_user_id?: string
    reported_card_id?: string
    reason: string
    details?: string
}

export async function reportContent(input: ReportInput) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    if (!input.reported_user_id && !input.reported_card_id) {
        return { error: 'Must report either a user or a card' }
    }

    // Check limit (10 reports per day) using shared utility
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const allowed = await checkRateLimit(user.id, {
        table: 'reports',
        column: 'created_at',
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 10,
        userColumn: 'reporter_id'
    })

    if (!allowed) {
        return { error: 'Daily report limit reached.' }
    }

    const { error } = await supabase
        .from('reports')
        .insert({
            reporter_id: user.id,
            reported_user_id: input.reported_user_id,
            reported_card_id: input.reported_card_id,
            reason: input.reason,
            details: input.details,
            status: 'pending'
        })

    if (error) {
        console.error('Report error:', error)
        return { error: 'Failed to submit report' }
    }

    return { success: true }
}

// ==================== BLOCKING ====================

export async function blockUser(userIdToBlock: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    if (user.id === userIdToBlock) return { error: 'You cannot block yourself' }

    // Check if already blocked
    const { data: existing } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userIdToBlock)
        .single()

    if (existing) return { success: true } // Already blocked

    const { error } = await supabase
        .from('blocked_users')
        .insert({
            blocker_id: user.id,
            blocked_id: userIdToBlock
        })

    if (error) {
        console.error('Block error:', error)
        return { error: 'Failed to block user' }
    }

    revalidatePath('/feed')
    revalidatePath('/connect')
    revalidatePath(`/chat`)
    return { success: true }
}

export async function unblockUser(userIdToUnblock: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userIdToUnblock)

    if (error) {
        console.error('Unblock error:', error)
        return { error: 'Failed to unblock user' }
    }

    revalidatePath('/you/settings') // Assuming unblocking happens in settings
    return { success: true }
}

export async function fetchBlockedUsers() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    const { data: blocked, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    if (error) {
        console.error('Fetch blocked error:', error)
        return { error: 'Failed to fetch blocked users', data: [] }
    }

    const blockedIds = blocked.map(b => b.blocked_id)

    if (blockedIds.length === 0) return { data: [] }

    // Fetch details of blocked users
    const { data: details } = await supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id')
        .in('id', blockedIds)

    return { data: details || [] }
}
