import { createClient } from '@/lib/supabase/client'

type RateLimitType = 'pov_creation' | 'connection_request' | 'report' | 'auth_attempt'

interface RateLimitConfig {
    limit: number
    window: number // in seconds
}

const LIMITS: Record<RateLimitType, RateLimitConfig> = {
    pov_creation: { limit: 5, window: 3600 }, // 5 per hour
    connection_request: { limit: 20, window: 86400 }, // 20 per day
    report: { limit: 10, window: 86400 }, // 10 per day
    auth_attempt: { limit: 5, window: 300 }, // 5 per 5 mins
}

/**
 * Checks if a user has exceeded a rate limit.
 * Uses a dedicated 'rate_limits' table or just counts rows in the target table if applicable.
 * For V1, simple row counting on the target table is often easiest if we have timestamps.
 * BUT, for generic rate limiting (like auth attempts or generic actions), a redis or dedicated table is best.
 * 
 * Since we don't have Redis, we'll use a `rate_limits` table in Postgres for generic tracking,
 * OR for things like POVs, we can just Count(*) the user's posts in the last hour.
 * 
 * strategy: 'table_count' | 'dedicated_tracking'
 */
export async function checkRateLimit(
    userId: string,
    type: RateLimitType,
    strategy: 'table_count' | 'dedicated_tracking' = 'dedicated_tracking'
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const config = LIMITS[type]
    const since = new Date(Date.now() - config.window * 1000).toISOString()

    if (strategy === 'table_count') {
        // This strategy assumes we are counting actual inserted rows in a specific table
        // This is strictly for "how many X did I create".
        let table = ''
        let userCol = ''

        switch (type) {
            case 'pov_creation': table = 'pov_cards'; userCol = 'creator_id'; break;
            case 'connection_request': table = 'connections'; userCol = 'requester_id'; break;
            case 'report': table = 'reports'; userCol = 'reporter_id'; break;
            default: return { success: true } // cannot count table for others
        }

        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq(userCol, userId)
            .gte('created_at', since)

        if (error) return { success: true } // fail open on DB error? or fail closed? fail open for MVP UX.

        if ((count || 0) >= config.limit) {
            return { success: false, error: `Rate limit exceeded. Try again later.` }
        }

        return { success: true }
    } else {
        // Dedicated tracking table logic would go here (requires create table rate_limits)
        // For V1 MVP, table_count is sufficient for the core features we listed.
        // We will stick to table_count for now to avoid schema changes if possible, 
        // essentially "Activity Limiting".
        return { success: true }
    }
}
