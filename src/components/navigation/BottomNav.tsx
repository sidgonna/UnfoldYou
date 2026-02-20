'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

const navItems = [
    { href: '/feed', label: 'Feed', icon: '📰' },
    { href: '/connect', label: 'Connect', icon: '🔗' },
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/you', label: 'You', icon: '👤' },
]

export default function BottomNav() {
    const pathname = usePathname()

    // Hide bottom nav inside chat rooms (but not on /chat list) AND on compose page
    const isChatRoom = (pathname.startsWith('/chat/') && pathname !== '/chat') || pathname === '/feed/compose'

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
                    </span>
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    )
}
