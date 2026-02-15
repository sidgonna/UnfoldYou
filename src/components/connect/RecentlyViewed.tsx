'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import styles from './RecentlyViewed.module.css'
import type { RecentProfile } from '@/hooks/useRecentlyViewed'

interface RecentlyViewedProps {
    profiles: RecentProfile[]
    onRemove: (id: string) => void
    onClear: () => void
}

export default function RecentlyViewed({ profiles, onRemove, onClear }: RecentlyViewedProps) {
    if (profiles.length === 0) return null

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>Recently Viewed</span>
                <button className={styles.clearBtn} onClick={onClear}>
                    Clear all
                </button>
            </div>

            <div className={styles.list}>
                {profiles.map((profile) => (
                    <div key={profile.id} className={styles.cardWrapper}>
                        <Link href={`/connect/profile/${profile.id}`} className={styles.card}>
                            <div className={styles.avatar}>{profile.avatar_id}</div>
                            <div className={styles.name}>{profile.shadow_name}</div>
                        </Link>
                        <button
                            className={styles.removeBtn}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onRemove(profile.id)
                            }}
                            aria-label="Remove from history"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
