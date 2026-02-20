'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fetchConnections, type ConnectionWithProfile, type ConnectionRequest } from '@/lib/actions/connections'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/ui/SearchBar'
import NotificationBell from '@/components/notifications/NotificationBell'
import styles from './chat.module.css'

const REVEAL_ICONS: Record<string, string> = {
    shadow: '🎭',
    whisper: '🤫',
    glimpse: '👁️',
    soul: '💫',
    unfold: '🦋',
}

interface ChatListProps {
    initialConversations: ConnectionWithProfile[]
    incomingRequests: ConnectionRequest[]
}

export default function ChatList({ initialConversations, incomingRequests }: ChatListProps) {
    const router = useRouter()
    const [conversations, setConversations] = useState<ConnectionWithProfile[]>(initialConversations)
    const [filtered, setFiltered] = useState<ConnectionWithProfile[]>(initialConversations)
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    
    const chatIncomingRequests = incomingRequests.filter(req => 
        req.connection_type !== 'stranger' || !!req.request_message
    )

    useEffect(() => {
        setMounted(true)
    }, [])

    const loadConversations = useCallback(async () => {
        const result = await fetchConnections(true)
        const data = result.data || []
        setConversations(data)
        setFiltered(data)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('chat-list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
                loadConversations()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [loadConversations])

    const handleSearch = (query: string) => {
        if (!query.trim()) {
            setFiltered(conversations)
            return
        }
        const q = query.toLowerCase()
        setFiltered(
            conversations.filter(c =>
                c.shadow_name.toLowerCase().includes(q)
            )
        )
    }

    // Function to format time for client
    function formatTime(dateStr: string): string {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / 86400000)
    
        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' })
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <div className="page page-with-header">
            <div className={styles.chatPage}>
                <div className={styles.topBar}>
                    <h1 className={styles.title}>Chat</h1>
                    <button onClick={() => router.push('/requests?from=chat')} className={styles.connectionsLink}>
                        Requests {chatIncomingRequests.length > 0 && `(${chatIncomingRequests.length})`}
                    </button>
                </div>

                <SearchBar
                    placeholder="Search conversations..."
                    onSearch={handleSearch}
                />

                {loading && (
                    <div className={styles.loading}>
                        <div className="spinner" />
                    </div>
                )}


                {!loading && filtered.length > 0 && (
                    <div className={styles.chatList}>
                        {filtered.length > 0 && <h3 className={styles.sectionTitle}>Messages</h3>}
                        {filtered.map((conv) => (
                            <button
                                key={conv.id}
                                className={styles.chatRow}
                                onClick={() => router.push(`/chat/${conv.id}`)}
                            >
                                <div className={styles.avatarWrap}>
                                    <span className={styles.avatar}>{conv.avatar_id}</span>
                                    {conv.connection_type === 'stranger' && (
                                        <span className={styles.stageIcon}>
                                            {REVEAL_ICONS[conv.reveal_stage] || '🎭'}
                                        </span>
                                    )}
                                </div>

                                <div className={styles.chatInfo}>
                                    <div className={styles.chatName}>{conv.shadow_name}</div>
                                    {conv.last_message && (
                                        <div className={styles.lastMessage}>
                                            {conv.last_message.length > 40
                                                ? conv.last_message.slice(0, 40) + '...'
                                                : conv.last_message}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.chatMeta}>
                                    {mounted && conv.last_message_at && (
                                        <span className={styles.chatTime}>
                                            {formatTime(conv.last_message_at)}
                                        </span>
                                    )}
                                    {(conv.unread_count ?? 0) > 0 && (
                                        <span className={styles.unreadBadge}>
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {!loading && conversations.length === 0 && (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>💬</span>
                        <h3 className={styles.emptyTitle}>No conversations yet</h3>
                        <p className={styles.emptyText}>Connect with someone to start chatting!</p>
                    </div>
                )}

                {!loading && conversations.length > 0 && filtered.length === 0 && (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>🔍</span>
                        <h3 className={styles.emptyTitle}>No matches</h3>
                        <p className={styles.emptyText}>Try a different search</p>
                    </div>
                )}
            </div>
        </div>
    )
}
