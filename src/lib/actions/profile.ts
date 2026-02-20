'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { HeightSchema, LocationSchema } from '@/lib/validators/onboarding'

// ==================== TYPES ====================

export interface ShadowProfile {
    id: string
    shadow_name: string
    avatar_id: string
    interests: string[]
    pronouns: string | null
    social_energy: string | null
    bio: string | null
    sound_of_week_url: string | null
    created_at: string
}

export interface UserProfile {
    id: string
    name: string
    dob: string
    height_cm: number | null
    gender: string
    location_city: string | null
    location_country: string | null
    profile_picture_url: string | null
    voice_note_url: string | null
    habits: Record<string, string>
    intent: string | null
    onboarding_complete: boolean
}

// ==================== FETCH SHADOW PROFILE ====================

export async function fetchShadowProfile(userId?: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const targetId = userId || user.id

    const { data, error } = await supabase
        .from('shadow_profiles')
        .select('*')
        .eq('id', targetId)
        .single()

    if (error) {
        // PGRST116 means record not found, which is expected during onboarding
        if (error.code !== 'PGRST116') {
            console.error('Fetch shadow profile error:', error)
        }
        return { error: 'Failed to fetch shadow profile' }
    }

    return { data: data as ShadowProfile }
}

// ==================== FETCH CURRENT USER PROFILE ====================

export async function fetchUserProfile() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        // PGRST116 means record not found, which is expected during onboarding
        if (error.code !== 'PGRST116') {
            console.error('Fetch user profile error:', error)
        }
        return { error: 'Failed to fetch profile' }
    }

    return { data: data as UserProfile }
}

// ==================== UPDATE SHADOW PROFILE ====================

export async function updateShadowProfile(updates: Partial<ShadowProfile>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Only allow updating specific fields
    const allowedUpdates: Record<string, unknown> = {}
    const allowedFields: (keyof ShadowProfile)[] = [
        'shadow_name', 'avatar_id', 'interests', 'pronouns',
        'social_energy', 'bio', 'sound_of_week_url',
    ]

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            allowedUpdates[field] = updates[field]
        }
    }

    if (Object.keys(allowedUpdates).length === 0) {
        return { error: 'No valid fields to update' }
    }

    // Validate shadow_name if being updated
    if (allowedUpdates.shadow_name) {
        const name = allowedUpdates.shadow_name as string
        if (name.trim().length < 3 || name.trim().length > 20) {
            return { error: 'Shadow name must be 3-20 characters' }
        }
    }

    // Validate bio length
    if (allowedUpdates.bio) {
        const bio = allowedUpdates.bio as string
        if (bio.length > 500) {
            return { error: 'Bio must be 500 characters or less' }
        }
    }

    const { error } = await supabase
        .from('shadow_profiles')
        .update(allowedUpdates)
        .eq('id', user.id)

    if (error) {
        console.error('Update shadow profile error:', error)
        // Handle unique constraint violation for shadow_name
        if (error.code === '23505') {
            return { error: 'That shadow name is already taken' }
        }
        return { error: 'Failed to update profile' }
    }

    revalidatePath('/you')
    return { success: true }
}

// ==================== UPDATE REAL PROFILE ====================

export async function updateUserProfile(updates: Partial<UserProfile>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // 1. Strict Immutability Check
    const FORBIDDEN_FIELDS = ['name', 'dob', 'gender']
    for (const field of FORBIDDEN_FIELDS) {
        if (updates[field as keyof UserProfile] !== undefined) {
            return { error: `Cannot update ${field}. Please contact support.` }
        }
    }

    // 2. Prepare allowed updates & Validation
    const allowedUpdates: any = {}
    
    try {
        if (updates.location_city !== undefined) {
            allowedUpdates.location_city = LocationSchema.parse(updates.location_city)
        }
        if (updates.location_country !== undefined) {
            allowedUpdates.location_country = LocationSchema.parse(updates.location_country)
        }
        if (updates.height_cm !== undefined) {
            allowedUpdates.height_cm = HeightSchema.parse(updates.height_cm)
        }
        
        // Pass-through fields (validated by UI mostly, or add simple checks)
        if (updates.habits !== undefined) allowedUpdates.habits = updates.habits
        if (updates.intent !== undefined) allowedUpdates.intent = updates.intent
        if (updates.profile_picture_url !== undefined) allowedUpdates.profile_picture_url = updates.profile_picture_url
        if (updates.voice_note_url !== undefined) allowedUpdates.voice_note_url = updates.voice_note_url
        
    } catch (e: any) {
        return { error: e.errors?.[0]?.message || 'Validation failed' }
    }

    if (Object.keys(allowedUpdates).length === 0) {
        return { error: 'No valid fields to update' }
    }

    const { error } = await supabase
        .from('profiles')
        .update(allowedUpdates)
        .eq('id', user.id)

    if (error) {
        console.error('Update user profile error:', error)
        return { error: 'Failed to update profile' }
    }

    revalidatePath('/you')
    return { success: true }
}

// ==================== LOVE SOUL ====================

export interface LoveSoul {
    id: string
    q1_overwhelmed: string
    q2_seen_appreciated: string
    q3_disagreement: string
    q_final_love: string
    attachment_style: string | null
    love_language: string | null
    conflict_style: string | null
}

export async function fetchLoveSoul(userId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const targetId = userId || user.id

    const { data, error } = await supabase
        .from('love_soul')
        .select('*')
        .eq('id', targetId)
        .single()

    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('Fetch love soul error:', error)
        }
        return { error: 'Failed to fetch love soul' }
    }

    return { data: data as LoveSoul }
}

// ==================== SIGN OUT ====================

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    return { success: true }
}
