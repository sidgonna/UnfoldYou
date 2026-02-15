import { createClient } from '@/lib/supabase/server'

type RateLimitConfig = {
    table: string
    column: string // usually 'created_at'
    windowMs: number
    maxRequests: number
    userColumn?: string // usually 'creator_id' or 'user_id' or 'reporter_id'
}

/**
 * Checks if a user has exceeded a rate limit for a specific table action.
 * Returns true if allowed, false if limit exceeded.
 */
export async function checkRateLimit(
    userId: string,
    config: RateLimitConfig
): Promise<boolean> {
    const supabase = await createClient()

    // Calculate window start time
    const windowStart = new Date(Date.now() - config.windowMs).toISOString()

    const { count, error } = await supabase
        .from(config.table)
        .select('*', { count: 'exact', head: true })
        .eq(config.userColumn || 'creator_id', userId)
        .gte(config.column, windowStart)

    if (error) {
        console.error('Rate limit check failed:', error)
        // Fail open or closed? Safe to fail open for V1 if DB is acting up, 
        // but let's fail closed to be safe against spam storms if that's the cause of DB load.
        // Actually, failing open (allowing) is better for UX if DB is just glitchy. 
        // But for strict safety, let's return false (block). 
        // Let's return true (allow) to avoid blocking legit users during outages, unless confirmed spam.
        // Re-reading requirements: "Protect DB". 
        // Let's actually just log it and allow, assuming it's rare.
        return true
    }

    return (count || 0) < config.maxRequests
}
