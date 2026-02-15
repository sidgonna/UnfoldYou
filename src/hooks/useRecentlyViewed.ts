import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RecentProfile {
    id: string
    shadow_name: string
    avatar_id: string
    viewed_at: number
}

const MAX_RECENT_ITEMS = 10
const SUBSCRIPTION_KEY_PREFIX = 'unfold_recent_views_'

export function useRecentlyViewed() {
    const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([])
    const [loaded, setLoaded] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    // Load user ID once
    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) {
                setUserId(data.user.id)
            }
        })
    }, [])

    // Load from local storage when userId is available
    useEffect(() => {
        if (!userId) return

        const key = `${SUBSCRIPTION_KEY_PREFIX}${userId}`
        const stored = localStorage.getItem(key)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                setRecentProfiles(parsed)
            } catch (e) {
                console.error('Failed to parse recent views', e)
                localStorage.removeItem(key)
            }
        }
        setLoaded(true)
    }, [userId])

    const saveToStorage = useCallback((profiles: RecentProfile[]) => {
        if (!userId) return
        const key = `${SUBSCRIPTION_KEY_PREFIX}${userId}`
        localStorage.setItem(key, JSON.stringify(profiles))
    }, [userId])

    const addProfile = useCallback((profile: Omit<RecentProfile, 'viewed_at'>) => {
        if (!userId) return

        setRecentProfiles(prev => {
            // Remove if already exists (to move to top)
            const filtered = prev.filter(p => p.id !== profile.id)

            const newProfile = {
                ...profile,
                viewed_at: Date.now()
            }

            // Add to beginning, limit to MAX
            const next = [newProfile, ...filtered].slice(0, MAX_RECENT_ITEMS)

            saveToStorage(next)
            return next
        })
    }, [userId, saveToStorage])

    const removeProfile = useCallback((profileId: string) => {
        if (!userId) return

        setRecentProfiles(prev => {
            const next = prev.filter(p => p.id !== profileId)
            saveToStorage(next)
            return next
        })
    }, [userId, saveToStorage])

    const clearHistory = useCallback(() => {
        if (!userId) return
        setRecentProfiles([])
        saveToStorage([])
    }, [userId, saveToStorage])

    return {
        recentProfiles,
        addProfile,
        removeProfile,
        clearHistory,
        loaded
    }
}
