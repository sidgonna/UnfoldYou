'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fetchConnections, type ConnectionWithProfile } from '@/lib/actions/connections'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/ui/SearchBar'
import styles from './chat.module.css'

const REVEAL_ICONS: Record<string, string> = {
    shadow: '🎭',
    whisper: '🤫',
    glimpse: '👁️',
    soul: '💫',
    unfold: '🦋',
}

export default function ChatPage() {
    const router = useRouter()
    const [conversations, setConversations] = useState<ConnectionWithProfile[]>([])
    const [filtered, setFiltered] = useState<ConnectionWithProfile[]>([])
    const [loading, setLoading] = useState(true)

    const loadConversations = useCallback(async () => {
        const result = await fetchConnections(true)
        const data = result.data || []
        setConversations(data)
        setFiltered(data)
        setLoading(false)
    }, [])

    useEffect(() => {
        loadConversations()

        // Realtime subscription for new messages (updates last message / unread)
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

    return (
        <div className="page page-with-header">
            <div className={styles.chatPage}>
                <div className={styles.topBar}>
                    <h1 className={styles.title}>Chat</h1>
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
                                    {conv.last_message_at && (
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
