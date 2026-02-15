'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { fetchPendingIncomingCount } from '@/lib/actions/connections'
import { createClient } from '@/lib/supabase/client'
import styles from './BottomNav.module.css'

const navItems = [
    { href: '/feed', label: 'Feed', icon: '📰' },
    { href: '/connect', label: 'Connect', icon: '🔗', hasBadge: true },
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/you', label: 'You', icon: '👤' },
]

export default function BottomNav() {
    const pathname = usePathname()
    const [requestCount, setRequestCount] = useState(0)

    // Hide bottom nav inside chat rooms (but not on /chat list) AND on compose page
    const isChatRoom = (pathname.startsWith('/chat/') && pathname !== '/chat') || pathname === '/feed/compose'

    const loadCount = useCallback(async () => {
        const count = await fetchPendingIncomingCount()
        setRequestCount(count)
    }, [])

    useEffect(() => {
        if (isChatRoom) return // Skip subscription when hidden

        loadCount()

        const supabase = createClient()
        const channel = supabase
            .channel('bottomnav-badge')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
                loadCount()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [loadCount, isChatRoom])

    if (isChatRoom) return null

    return (
        <nav className="bottom-nav">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                >
                    <span className="nav-icon" style={{ position: 'relative', display: 'inline-block' }}>
                        {item.icon}
                        {item.hasBadge && requestCount > 0 && (
                            <span className={styles.badge}>
                                {requestCount > 9 ? '9+' : requestCount}
                            </span>
                        )}
                    </span>
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    )
}
