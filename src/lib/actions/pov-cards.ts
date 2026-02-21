'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CARD_TEMPLATES } from '@/lib/constants'
import { createNotification } from '@/lib/actions/notifications'

// ==================== TYPES ====================

export interface PovCard {
    id: string
    creator_id: string
    content: string
    template: string
    is_saved: boolean
    saved_at: string | null
    likes_count: number
    expires_at: string
    created_at: string
    shadow_profile?: {
        shadow_name: string
        avatar_id: string
    }
    user_has_liked?: boolean
    is_own_card?: boolean
}

export interface CreateCardInput {
    content: string
    template: string
}

// ==================== CREATE ====================

export async function createPovCard(input: CreateCardInput) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'Not authenticated' }
    }

    // Validate content
    const content = input.content.trim()
    if (!content) return { error: 'Content is required' }
    if (content.length > 500) return { error: 'Content must be 500 characters or less' }

    // Validate template
    const validTemplates = CARD_TEMPLATES.map((t) => t.id)
    if (!validTemplates.includes(input.template)) {
        return { error: 'Invalid template' }
    }

    // Check limit (5 cards per hour) using shared utility
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const allowed = await checkRateLimit(user.id, {
        table: 'pov_cards',
        column: 'created_at',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,
        userColumn: 'creator_id'
    })

    if (!allowed) {
        return { error: 'Rate limit exceeded: You can only post 5 cards per hour.' }
    }

    // Insert card
    const { data, error } = await supabase
        .from('pov_cards')
        .insert({
            creator_id: user.id,
            content,
            template: input.template,
        })
        .select('id')
        .single()

    if (error) {
        console.error('Create card error:', error)
        return { error: 'Failed to create card' }
    }

    revalidatePath('/feed')
    return { data: { id: data.id } }
}

// ==================== FETCH FEED ====================

export async function fetchFeedCards(page: number = 0, pageSize: number = 20) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    const from = page * pageSize
    const to = from + pageSize - 1

    // Fetch active cards (not expired OR saved)

    // Check for blocked users (Optimization: We could do this in the query with a NOT IN, 
    // but building the list of ALL blocked IDs might be heavy if user blocks many. 
    // For V1, let's fetch blocked IDs first and filter.)
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    const blockedIds = (blocked || []).map(b => b.blocked_id)

    // Modification to query:
    let query = supabase
        .from('pov_cards')
        .select(`
            id,
            creator_id,
            content,
            template,
            is_saved,
            saved_at,
            likes_count,
            expires_at,
            created_at
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(from, to)

    if (blockedIds.length > 0) {
        query = query.not('creator_id', 'in', `(${blockedIds.join(',')})`)
    }

    const { data: cards, error } = await query

    if (error) {
        console.error('Fetch feed error:', error)
        return { error: 'Failed to fetch feed', data: [] }
    }

    if (!cards || cards.length === 0) {
        return { data: [] }
    }

    // Enrich with profiles and check likes in parallel
    const creatorIds = [...new Set(cards.map((c) => c.creator_id))]
    const cardIds = cards.map((c) => c.id)

    const [shadowProfilesResult, userLikesResult] = await Promise.all([
        supabase
            .from('shadow_profiles')
            .select('id, shadow_name, avatar_id')
            .in('id', creatorIds),
        supabase
            .from('pov_likes')
            .select('card_id')
            .eq('user_id', user.id)
            .in('card_id', cardIds)
    ])

    const shadowProfiles = shadowProfilesResult.data
    const userLikes = userLikesResult.data

    const shadowMap = new Map(
        (shadowProfiles || []).map((sp) => [sp.id, sp])
    )

    const likedCardIds = new Set((userLikes || []).map((l) => l.card_id))

    // Combine data
    const enrichedCards: PovCard[] = cards.map((card) => ({
        ...card,
        shadow_profile: shadowMap.get(card.creator_id) || {
            shadow_name: 'Unknown',
            avatar_id: '🎭',
        },
        user_has_liked: likedCardIds.has(card.id),
        is_own_card: card.creator_id === user.id,
    }))

    return { data: enrichedCards }
}

// ==================== FETCH NEW CARDS (POLLING) ====================

export async function fetchNewPovCards(afterTimestamp: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [] }

    // Check blocked users
    const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

    const blockedIds = (blocked || []).map(b => b.blocked_id)

    let query = supabase
        .from('pov_cards')
        .select(`
            id,
            creator_id,
            content,
            template,
            is_saved,
            saved_at,
            likes_count,
            expires_at,
            created_at
        `)
        .gt('created_at', afterTimestamp)
        .gt('expires_at', new Date().toISOString()) // Must not be expired
        .order('created_at', { ascending: false })

    if (blockedIds.length > 0) {
        query = query.not('creator_id', 'in', `(${blockedIds.join(',')})`)
    }

    const { data: cards, error } = await query

    if (error || !cards || cards.length === 0) {
        return { data: [] }
    }

    // Enrich with profiles and check likes in parallel
    const creatorIds = [...new Set(cards.map((c) => c.creator_id))]
    const cardIds = cards.map((c) => c.id)

    const [shadowProfilesResult, userLikesResult] = await Promise.all([
        supabase
            .from('shadow_profiles')
            .select('id, shadow_name, avatar_id')
            .in('id', creatorIds),
        supabase
            .from('pov_likes')
            .select('card_id')
            .eq('user_id', user.id)
            .in('card_id', cardIds)
    ])

    const shadowProfiles = shadowProfilesResult.data
    const userLikes = userLikesResult.data

    const shadowMap = new Map((shadowProfiles || []).map((sp) => [sp.id, sp]))
    const likedCardIds = new Set((userLikes || []).map((l) => l.card_id))

    const enrichedCards: PovCard[] = cards.map((card) => ({
        ...card,
        shadow_profile: shadowMap.get(card.creator_id) || {
            shadow_name: 'Unknown',
            avatar_id: '🎭',
        },
        user_has_liked: likedCardIds.has(card.id),
        is_own_card: card.creator_id === user.id,
    }))

    return { data: enrichedCards }
}

// ==================== LIKE / UNLIKE ====================

export async function toggleLikeCard(cardId: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    // Check if already liked
    const { data: existing } = await supabase
        .from('pov_likes')
        .select('id')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .single()

    if (existing) {
        // Unlike
        const { error } = await supabase
            .from('pov_likes')
            .delete()
            .eq('card_id', cardId)
            .eq('user_id', user.id)

        if (error) return { error: 'Failed to unlike' }
        revalidatePath('/feed')
        return { liked: false }
    } else {
        // Like
        const { error } = await supabase
            .from('pov_likes')
            .insert({ card_id: cardId, user_id: user.id })

        if (error) return { error: 'Failed to like' }

        // Notify creator
        // Fetch card creator info first
        const { data: card } = await supabase.from('pov_cards').select('creator_id, content').eq('id', cardId).single()
        if (card && card.creator_id !== user.id) {
            createNotification(
                card.creator_id,
                'pov_like',
                cardId,
                { snippet: card.content.substring(0, 30) }
            ).catch(console.error)
        }

        revalidatePath('/feed')
        return { liked: true }
    }
}

// ==================== SAVE / UNSAVE ====================

export async function toggleSaveCard(cardId: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    // Verify ownership
    const { data: card } = await supabase
        .from('pov_cards')
        .select('id, is_saved, creator_id')
        .eq('id', cardId)
        .single()

    if (!card) return { error: 'Card not found' }
    if (card.creator_id !== user.id) return { error: 'Only the creator can save a card' }

    const newSaved = !card.is_saved
    const { error } = await supabase
        .from('pov_cards')
        .update({
            is_saved: newSaved,
            saved_at: newSaved ? new Date().toISOString() : null,
        })
        .eq('id', cardId)

    if (error) return { error: 'Failed to update card' }

    revalidatePath('/feed')
    revalidatePath('/you')
    return { saved: newSaved }
}

// ==================== DELETE ====================

export async function deletePovCard(cardId: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    // Verify ownership
    const { data: card } = await supabase
        .from('pov_cards')
        .select('id, creator_id')
        .eq('id', cardId)
        .single()

    if (!card) return { error: 'Card not found' }
    if (card.creator_id !== user.id) return { error: 'Only the creator can delete a card' }

    const { error } = await supabase
        .from('pov_cards')
        .delete()
        .eq('id', cardId)

    if (error) return { error: 'Failed to delete card' }

    revalidatePath('/feed')
    revalidatePath('/you')
    return { success: true }
}

// ==================== FETCH USER'S SAVED CARDS ====================

export async function fetchSavedCards() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', data: [] }

    const { data: cards, error } = await supabase
        .from('pov_cards')
        .select('id, content, template, likes_count, created_at, saved_at')
        .eq('creator_id', user.id)
        .eq('is_saved', true)
        .order('saved_at', { ascending: false })

    if (error) {
        console.error('Fetch saved cards error:', error)
        return { error: 'Failed to fetch saved cards', data: [] }
    }

    return { data: cards || [] }
}
// ==================== FETCH SINGLE CARD ====================

export async function fetchPovCard(cardId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    // Allow public access? For now, require auth as per V1 rules.
    if (!user) return { error: 'Not authenticated' }

    // Fetch card
    const { data: card, error } = await supabase
        .from('pov_cards')
        .select(`
            id,
            creator_id,
            content,
            template,
            is_saved,
            saved_at,
            likes_count,
            expires_at,
            created_at
        `)
        .eq('id', cardId)
        .single()

    if (error || !card) {
        return { error: 'Card not found' }
    }

    // Fetch creator shadow profile
    const { data: shadowProfile } = await supabase
        .from('shadow_profiles')
        .select('id, shadow_name, avatar_id')
        .eq('id', card.creator_id)
        .single()

    // Check if liked
    const { data: like } = await supabase
        .from('pov_likes')
        .select('id')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .single()

    const enrichedCard: PovCard = {
        ...card,
        shadow_profile: shadowProfile || {
            shadow_name: 'Unknown',
            avatar_id: '🎭',
        },
        user_has_liked: !!like,
        is_own_card: card.creator_id === user.id,
    }

    return { data: enrichedCard }
}
