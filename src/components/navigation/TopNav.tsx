'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'
import styles from './TopNav.module.css'

export default function TopNav() {
    const pathname = usePathname()

    // Hide on chat room (specific connection)
    const isChatRoom = pathname.startsWith('/chat/') && pathname !== '/chat'
    if (isChatRoom) return null

    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <Link href="/feed">UnfoldYou</Link>
            </div>
            <div className={styles.actions}>
                <NotificationBell />
            </div>
        </header>
    )
}
