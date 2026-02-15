'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, type Notification } from '@/lib/actions/notifications'
import { useRouter } from 'next/navigation'

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false) // UI state for the dropdown/panel
    const router = useRouter()

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

        // Realtime subscription
        const supabase = createClient()
        const channel = supabase
            .channel('notifications_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    // We can't verify recipient_id purely on client filter for 'INSERT' securely without Row Level Security checking
                    // But Supabase Realtime respects RLS constraints if configured (which we did: "Users can view their own notifications")
                    // Wait, Realtime broadcasts do NOT filter by RLS automatically unless using "Broadcast" mode which is public. 
                    // Postgres Changes listens to the *database* changelog.
                    // However, we can just filter client-side or re-fetch.
                    // Best practice: Re-fetch or simplistic filter if payload has recipient_id (it does).

                    const newNotif = payload.new as Notification
                    // Check if *I* am the recipient? 
                    // We need to know my user ID. 
                    // Actually, fetching "user" async inside this callback is tricky.
                    // Simplest approach: Just trigger a refresh.
                    loadNotifications()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [loadNotifications])

    const markRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))

        await markNotificationRead(id)
    }

    const markAllRead = async () => {
        // Optimistic
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
