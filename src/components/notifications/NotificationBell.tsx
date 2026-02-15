'use client'

import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import NotificationList from './NotificationList'
import styles from './notifications.module.css'

export default function NotificationBell() {
    const { unreadCount, isOpen, setIsOpen, markAllRead, notifications, loading, markRead } = useNotifications()
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [setIsOpen])

    const handleToggle = () => {
        if (!isOpen && unreadCount > 0) {
            // Optional: Mark read immediately on open? 
            // Better UX: Mark read when user interacts or after a delay. 
            // For V1 simpler: We'll keep them unread until user clicks "Mark all read" or individual items.
        }
        setIsOpen(!isOpen)
    }

    return (
        <div className={styles.container} ref={containerRef}>
            <button
                className={styles.bellBtn}
                onClick={handleToggle}
                aria-label="Notifications"
            >
                🔔
                {unreadCount > 0 && (
                    <span className={styles.badge}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <NotificationList
                        onClose={() => setIsOpen(false)}
                        notifications={notifications}
                        loading={loading}
                        markRead={markRead}
                        markAllRead={markAllRead}
                    />
                </div>
            )}
        </div>
    )
}
