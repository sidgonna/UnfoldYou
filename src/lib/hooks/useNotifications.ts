'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, type Notification } from '@/lib/actions/notifications'
import { usePathname } from 'next/navigation'

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false) 
    
    const pathname = usePathname()
    const pathnameRef = useRef(pathname)

    useEffect(() => {
        pathnameRef.current = pathname
    }, [pathname])

    // Initial Load
    const loadNotifications = useCallback(async () => {
        const [notifsResult, countResult] = await Promise.all([
            fetchNotifications(20),
            getUnreadNotificationCount()
        ])

        if (notifsResult.data) setNotifications(notifsResult.data)
        if (countResult.count !== undefined) setUnreadCount(countResult.count)
        setLoading(false)
    }, [])

    useEffect(() => {
        loadNotifications()

        const supabase = createClient()
        const channel = supabase
            .channel('notifications_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                async (payload) => {
                    const newNotif = payload.new as Notification
                    
                    // 1. Identify context (Are we in this chat?)
                    const currentPath = pathnameRef.current || ''
                    const match = currentPath.match(/\/chat\/([0-9a-fA-F-]{36})/)
                    const currentChatId = match ? match[1]?.toLowerCase() : null
                    
                    const isForCurrentChat = 
                        newNotif.type === 'new_message' && 
                        newNotif.resource_id && 
                        currentChatId === newNotif.resource_id.toLowerCase()

                    // 2. State-First Update (Optimistic)
                    if (isForCurrentChat) {
                        // Mark read in DB and keep local as read
                        markNotificationRead(newNotif.id)
                        const processedNotif = { ...newNotif, is_read: true }
                        setNotifications(prev => [processedNotif, ...prev].slice(0, 20))
                        // Count stays the same
                    } else {
                        // Normal unread notification
                        setNotifications(prev => [newNotif, ...prev].slice(0, 20))
                        setUnreadCount(prev => prev + 1)
                    }

                    // 3. (Optional but recommended) Re-fetch profile for the actor 
                    // since raw postgres_changes doesn't join 'actor'
                    // We'll just trigger a refresh for now to get clean data + joins
                    loadNotifications()
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    const updated = payload.new as Notification
                    const old = payload.old as Partial<Notification>

                    setNotifications(prev => {
                        const exists = prev.find(n => n.id === updated.id)
                        if (!exists) return prev

                        // If it became read, adjust count
                        if (updated.is_read && !exists.is_read) {
                            setUnreadCount(c => Math.max(0, c - 1))
                        } else if (!updated.is_read && exists.is_read) {
                            setUnreadCount(c => c + 1)
                        }

                        return prev.map(n => n.id === updated.id ? { ...n, ...updated } : n)
                    })
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [loadNotifications])

    const markRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
        await markNotificationRead(id)
    }

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
        await markAllNotificationsRead()
    }

    return {
        notifications,
        unreadCount,
        loading,
        isOpen,
        setIsOpen,
        markRead,
        markAllRead,
        refresh: loadNotifications
    }
}
