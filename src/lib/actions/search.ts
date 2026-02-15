'use server'

import { createClient } from '@/lib/supabase/server'

// ==================== TYPES ====================

export interface ShadowProfileResult {
    id: string
    shadow_name: string
    avatar_id: string
    interests: string[]
    pronouns: string | null
    social_energy: string | null
    bio: string | null
}

export interface SearchFilters {
    interests?: string[]
}

// ==================== SEARCH SHADOW PROFILES ====================

export async function searchShadowProfiles(
    query: string,
    filters?: SearchFilters,
    limit: number = 30
) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    let dbQuery = supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id, interests, pronouns, social_energy, bio')
        .neq('id', user.id) // exclude self
        .limit(limit)
        .order('shadow_name', { ascending: true })

    // Fuzzy name search
    const trimmed = query.trim()
    if (trimmed.length > 0) {
        dbQuery = dbQuery.ilike('shadow_name', `%${trimmed}%`)
    }

    // Interest filter (containment: profile must have ALL selected interests)
    if (filters?.interests && filters.interests.length > 0) {
        dbQuery = dbQuery.overlaps('interests', filters.interests)
    }

    const { data, error } = await dbQuery

    if (error) {
        console.error('Search error:', error)
        return { error: 'Search failed', data: [] }
    }

    // Filter out blocked users (client-side since blocked_users table
    // may not have an RLS policy that makes this automatic in the query)
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    const blockedIds = new Set((blocked || []).map((b) => b.blocked_id))

    const filtered = (data || []).filter(
        (profile) => !blockedIds.has(profile.id)
    )

    return { data: filtered as ShadowProfileResult[] }
}

// ==================== FETCH OTHER USER'S PROFILE ====================

export async function fetchOtherShadowProfile(userId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    if (userId === user.id) return { error: 'Cannot view own profile here' }

    const { data, error } = await supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id, interests, pronouns, social_energy, bio')
        .eq('id', userId)
        .single()

    if (error || !data) {
        return { error: 'Profile not found' }
    }

    // Also fetch their saved POV cards (public)
    const { data: savedCards } = await supabase
        .from('pov_cards')
        .select('id, content, template, likes_count, created_at')
        .eq('creator_id', userId)
        .eq('is_saved', true)
        .order('saved_at', { ascending: false })
        .limit(20)

    return {
        data: {
            profile: data as ShadowProfileResult,
            savedCards: savedCards || [],
        },
    }
}

// ==================== SEARCH CONVERSATIONS ====================

export async function searchConversations(query: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    // Get all connections for the current user
    const { data: connections, error } = await supabase
        .from('connections')
        .select('id, requester_id, recipient_id, status, connection_type')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'accepted')

    if (error) {
        console.error('Search conversations error:', error)
        return { error: 'Search failed', data: [] }
    }

    if (!connections || connections.length === 0) {
        return { data: [] }
    }

    // Get the other user's IDs
    const otherUserIds = connections.map((c) =>
        c.requester_id === user.id ? c.recipient_id : c.requester_id
    )

    // Search shadow profiles of connected users
    let profileQuery = supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id')
        .in('id', otherUserIds)

    const trimmed = query.trim()
    if (trimmed.length > 0) {
        profileQuery = profileQuery.ilike('shadow_name', `%${trimmed}%`)
    }

    const { data: profiles } = await profileQuery

    // Map connections to results with profile info
    const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
    )

    const results = connections
        .filter((c) => {
            const otherId = c.requester_id === user.id ? c.recipient_id : c.requester_id
            return profileMap.has(otherId)
        })
        .map((c) => {
            const otherId = c.requester_id === user.id ? c.recipient_id : c.requester_id
            const profile = profileMap.get(otherId)!
            return {
                connectionId: c.id,
                userId: otherId,
                shadowName: profile.shadow_name,
                avatarId: profile.avatar_id,
                connectionType: c.connection_type,
            }
        })

    return { data: results }
}
