'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
        console.error('Fetch shadow profile error:', error)
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
        console.error('Fetch user profile error:', error)
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
        if (bio.length > 150) {
            return { error: 'Bio must be 150 characters or less' }
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

// ==================== SIGN OUT ====================

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    return { success: true }
}
