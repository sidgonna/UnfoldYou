'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { fetchFeedCards, type PovCard } from '@/lib/actions/pov-cards'
import { createClient } from '@/lib/supabase/client'
import PovCardComponent from '@/components/pov/PovCard'
import NotificationBell from '@/components/notifications/NotificationBell'
import styles from './feed.module.css'

interface FeedListProps {
    initialCards: PovCard[]
}

export default function FeedList({ initialCards }: FeedListProps) {
    const [cards, setCards] = useState<PovCard[]>(initialCards)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const loadCards = useCallback(async () => {
        setLoading(true)
        const result = await fetchFeedCards(0, 50)
        if (result.error) {
            setError(result.error)
        } else {
            setCards(result.data || [])
        }
        setLoading(false)
    }, [])

    // Polling login
    const [newCards, setNewCards] = useState<PovCard[]>([])

    // Check for new cards every 2 minutes
    useEffect(() => {
        if (loading || cards.length === 0) return

        const interval = setInterval(async () => {
            // Get the timestamp of the newest card we have
            // (Assuming cards are ordered desc, so index 0 is newest)
            const newestCard = cards[0]
            if (!newestCard) return

            // Dynamically import to avoid server/client issues if any, 
            // though standard import works fine here usually.
            const { fetchNewPovCards } = await import('@/lib/actions/pov-cards')

            const result = await fetchNewPovCards(newestCard.created_at)

            if (result.data && result.data.length > 0) {
                // We found new cards! 
                // Only add ones we don't already have in newCards state
                setNewCards(prev => {
                    const existingIds = new Set(prev.map(c => c.id))
                    const reallyNew = result.data.filter(c => !existingIds.has(c.id))
                    if (reallyNew.length === 0) return prev
                    return [...reallyNew, ...prev]
                })
            }
        }, 120_000) // 2 minutes

        return () => clearInterval(interval)
    }, [cards, loading])

    // Realtime Likes Subscription
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('feed-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'pov_cards',
                },
                (payload) => {
                    const updated = payload.new as PovCard
                    setCards((current) => 
                        current.map((card) => {
                            if (card.id === updated.id) {
                                // Update dynamic counts, keep user-specific state (liked/saved/profile)
                                return {
                                    ...card,
                                    likes_count: updated.likes_count,
                                    // potentially comment_count later
                                }
                            }
                            return card
                        })
                    )
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleShowNewPosts = () => {
        if (newCards.length === 0) return

        // Merge new cards at top
        setCards(prev => [...newCards, ...prev])
        setNewCards([])

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div className="page page-with-header">
            {/* Header */}
            <div className={styles['feed-header']}>
                <h1>Feed</h1>
            </div>

            {/* New Posts Badge */}
            {newCards.length > 0 && (
                <button className={styles['new-posts-badge']} onClick={handleShowNewPosts}>
                    <span>↑</span>
                    <span>{newCards.length} New Post{newCards.length > 1 ? 's' : ''}</span>
                </button>
            )}

            {/* Loading (only for manual refreshes now) */}
            {loading && (
                <div className={styles['loading-state']}>
                    <div className="spinner spinner-lg" />
                    <span className="text-muted">Loading POVs...</span>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className={styles['error-state']}>
                    <p>{error}</p>
                    <button
                        className="btn btn-secondary"
                        onClick={loadCards}
                        style={{ marginTop: 'var(--space-md)' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && cards.length === 0 && (
                <div className={styles['empty-feed']}>
                    <div className={styles['empty-icon']}>📝</div>
                    <div className={styles['empty-title']}>No POVs yet</div>
                    <div className={styles['empty-desc']}>
                        Be the first to share your perspective.
                        Your POV lives for 24 hours — make it count.
                    </div>
                    <div className={styles['empty-cta']}>
                        <Link href="/feed/compose">
                            <button className="btn btn-primary">Create your first POV</button>
                        </Link>
                    </div>
                </div>
            )}

            {/* Card list */}
            {!loading && !error && cards.length > 0 && (
                <div className={styles['card-list']}>
                    {cards.map((card) => (
                        <PovCardComponent
                            key={card.id}
                            card={card}
                            onUpdate={(action, id) => {
                                if (action === 'delete') {
                                    setCards(prev => prev.filter(c => c.id !== id))
                                } else {
                                    loadCards()
                                }
                            }}
                        />
                    ))}
                </div>
            )}
            {/* Floating Compose Button */}
            <Link href="/feed/compose" className={styles['floating-compose']}>
                <button>+</button>
            </Link>
        </div>
    )
}
