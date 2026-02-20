'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getUnreadNotificationCount } from '@/lib/actions/notifications'
import styles from './NotificationBell.module.css'

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        // Initial count
        async function fetchCount() {
            const { count } = await getUnreadNotificationCount()
            setUnreadCount(count)
        }
        fetchCount()

        // Realtime updates
        const supabase = createClient()
        
        const channel = supabase
            .channel('notifications-badge')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications'
                },
                () => {
                    fetchCount()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <Link href="/notifications" className={styles.bellWrapper}>
            <div className={styles.bellIcon}>🔔</div>
            {unreadCount > 0 && (
                <span className={styles.badge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    )
}
