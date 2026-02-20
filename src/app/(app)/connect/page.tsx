'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { searchShadowProfiles, type ShadowProfileResult } from '@/lib/actions/search'
import { fetchPendingIncomingCount } from '@/lib/actions/connections'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/ui/SearchBar'
import NotificationBell from '@/components/notifications/NotificationBell'
import styles from './connect.module.css'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import RecentlyViewed from '@/components/connect/RecentlyViewed'

const INTEREST_FILTERS = [
    'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Jazz', 'Classical', 'Electronic', 'Indie',
    'Sci-Fi', 'Romance', 'Thriller', 'Comedy', 'Anime', 'Drama',
    'Fiction', 'Poetry', 'Philosophy',
    'Travel', 'Cooking', 'Gaming', 'Fitness', 'Art', 'Photography', 'Fashion', 'Tech',
    'Nature', 'Astrology', 'Psychology', 'Writing',
]

export default function ConnectPage() {
    const [results, setResults] = useState<ShadowProfileResult[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedInterests, setSelectedInterests] = useState<string[]>([])
    const [requestCount, setRequestCount] = useState(0)

    const { recentProfiles, addProfile, removeProfile, clearHistory, loaded: historyLoaded } = useRecentlyViewed()

    // Fetch pending request count
    useEffect(() => {
        async function loadCount() {
            const count = await fetchPendingIncomingCount()
            setRequestCount(count)
        }
        loadCount()

        // Realtime subscription for count updates
        const supabase = createClient()
        const channel = supabase
            .channel('connect-badge')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
                loadCount()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const doSearch = useCallback(async (searchQuery: string, interests: string[]) => {
        // If clearing all filters, reset to initial state
        if (!searchQuery.trim() && interests.length === 0) {
            setSearched(false)
            setResults([])
            setLoading(false)
            return
        }

        setLoading(true)
        setSearched(true)
        const filters = interests.length > 0 ? { interests } : undefined
        const result = await searchShadowProfiles(searchQuery, filters)
        setResults(result.data || [])
        setLoading(false)
    }, [])

    const handleSearch = useCallback((q: string) => {
        setQuery(q)
        doSearch(q, selectedInterests)
    }, [doSearch, selectedInterests])

    const toggleInterest = (interest: string) => {
        const next = selectedInterests.includes(interest)
            ? selectedInterests.filter((i) => i !== interest)
            : [...selectedInterests, interest]

        setSelectedInterests(next)
        doSearch(query, next)
    }

    return (
        <div className="page page-with-header">
            <div className={styles['connect-page']}>
                {/* Header */}
                <div className={styles['connect-header']}>
                    <h1>Connect</h1>
                    <Link href="/requests?from=connect" className={styles['request-badge-link']}>
                        <span className={styles['request-badge-icon']}>📬</span>
                        {requestCount > 0 && (
                            <span className={styles['request-badge-count']}>{requestCount}</span>
                        )}
                    </Link>
                </div>

                {/* Search bar */}
                <SearchBar
                    placeholder="Search shadow names..."
                    onSearch={handleSearch}
                />

                {/* Interest filters */}
                <div className={styles['interest-filters']} style={{ marginTop: 'var(--space-md)' }}>
                    {INTEREST_FILTERS.map((interest) => (
                        <button
                            key={interest}
                            className={`${styles['filter-chip']} ${selectedInterests.includes(interest) ? styles.active : ''}`}
                            onClick={() => toggleInterest(interest)}
                        >
                            {interest}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {loading && (
                    <div className={styles['search-loading']}>
                        <div className="spinner" />
                    </div>
                )}

                {/* Results */}
                {!loading && searched && results.length > 0 && (
                    <div className={styles['results-list']}>
                        {results.map((profile) => (
                            <Link
                                key={profile.id}
                                href={`/connect/profile/${profile.id}`}
                                className={styles['profile-card']}
                                onClick={() => addProfile({
                                    id: profile.id,
                                    shadow_name: profile.shadow_name,
                                    avatar_id: profile.avatar_id
                                })}
                            >
                                <span className={styles['profile-card-avatar']}>
                                    {profile.avatar_id}
                                </span>
                                <div className={styles['profile-card-info']}>
                                    <div className={styles['profile-card-name']}>
                                        {profile.shadow_name}
                                    </div>
                                    {profile.bio && (
                                        <div className={styles['profile-card-bio']}>
                                            {profile.bio}
                                        </div>
                                    )}
                                </div>
                                <span className={styles['profile-card-badge']}>
                                    {profile.interests?.length || 0} interests
                                </span>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Empty results */}
                {!loading && searched && results.length === 0 && (
                    <div className={styles['search-empty']}>
                        <div className={styles['search-empty-icon']}>🔍</div>
                        <div className={styles['search-empty-title']}>No matches found</div>
                        <div className={styles['search-empty-desc']}>
                            Try different interests or names
                        </div>
                    </div>
                )}

                {/* Initial state */}
                {!loading && !searched && (
                    <>
                        {historyLoaded && recentProfiles.length > 0 ? (
                            <RecentlyViewed
                                profiles={recentProfiles}
                                onRemove={removeProfile}
                                onClear={clearHistory}
                            />
                        ) : (
                            <div className={styles['search-empty']}>
                                <div className={styles['search-empty-icon']}>🌍</div>
                                <div className={styles['search-empty-title']}>Find your people</div>
                                <div className={styles['search-empty-desc']}>
                                    Search by shadow name or pick interests to discover others.
                                    Tap a profile to connect — the app will ask how you know them.
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
