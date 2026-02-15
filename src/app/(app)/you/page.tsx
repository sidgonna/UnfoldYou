'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShadowProfile, signOut, type ShadowProfile } from '@/lib/actions/profile'
import { fetchSavedCards } from '@/lib/actions/pov-cards'
import { CARD_TEMPLATES } from '@/lib/constants'
import styles from './you.module.css'

interface SavedCard {
    id: string
    content: string
    template: string
    likes_count: number
    created_at: string
    saved_at: string | null
}

export default function YouPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<ShadowProfile | null>(null)
    const [savedCards, setSavedCards] = useState<SavedCard[]>([])
    const [loading, setLoading] = useState(true)
    const [signingOut, setSigningOut] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        const [profileResult, cardsResult] = await Promise.all([
            fetchShadowProfile(),
            fetchSavedCards(),
        ])

        if (profileResult.data) setProfile(profileResult.data)
        if (cardsResult.data) setSavedCards(cardsResult.data as SavedCard[])
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleSignOut = async () => {
        setSigningOut(true)
        await signOut()
        router.push('/auth')
    }

    if (loading) {
        return (
            <div className="page page-with-header">
                <div className={styles['loading-profile']}>
                    <div className="spinner spinner-lg" />
                    <span className="text-muted">Loading profile...</span>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="page page-with-header">
                <div className={styles['loading-profile']}>
                    <p className="text-muted">Profile not found</p>
                    <button className="btn btn-primary" onClick={() => router.push('/onboarding')}>
                        Complete Onboarding
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="page page-with-header">
            <div className={styles['profile-page']}>
                {/* Shadow Profile Card */}
                <div className={styles['profile-card']}>
                    <div className={styles['profile-avatar']}>{profile.avatar_id}</div>
                    <div className={styles['profile-name']}>{profile.shadow_name}</div>

                    {/* Badges */}
                    <div className={styles['profile-badges']}>
                        {profile.pronouns && (
                            <span className={styles.badge}>{profile.pronouns}</span>
                        )}
                        {profile.social_energy && (
                            <span className={styles.badge}>{profile.social_energy}</span>
                        )}
                    </div>

                    {/* Bio */}
                    {profile.bio && (
                        <p className={styles['profile-bio']}>&ldquo;{profile.bio}&rdquo;</p>
                    )}

                    {/* Interests */}
                    {profile.interests && profile.interests.length > 0 && (
                        <div className={styles['interests-section']}>
                            <div className={styles['section-label']}>Interests</div>
                            <div className={styles['interest-tags']}>
                                {profile.interests.map((interest) => (
                                    <span key={interest} className={styles['interest-tag']}>
                                        {interest}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles['profile-actions']}>
                        <button
                            className={`${styles['action-link']} ${styles.danger}`}
                            onClick={handleSignOut}
                            disabled={signingOut}
                        >
                            {signingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                    </div>
                </div>

                {/* Saved POV Cards */}
                <div className={styles['saved-section']}>
                    <div className={styles['saved-header']}>
                        <h2>Saved POVs</h2>
                        <span className={styles['saved-count']}>{savedCards.length}</span>
                    </div>

                    {savedCards.length === 0 ? (
                        <div className={styles['saved-empty']}>
                            <div className={styles['saved-empty-icon']}>💾</div>
                            <p>No saved POVs yet. Save your favorites before they expire!</p>
                        </div>
                    ) : (
                        <div className={styles['saved-cards-grid']}>
                            {savedCards.map((card) => {
                                const tmpl = CARD_TEMPLATES.find((t) => t.id === card.template) || CARD_TEMPLATES[0]
                                return (
                                    <div
                                        key={card.id}
                                        className={styles['saved-card']}
                                        style={{ background: tmpl.gradient }}
                                    >
                                        <div className={styles['saved-card-content']}>
                                            {card.content}
                                        </div>
                                        <div className={styles['saved-card-meta']}>
                                            <span className={styles['saved-card-likes']}>
                                                {card.likes_count > 0 ? `❤️ ${card.likes_count}` : ''}
                                            </span>
                                            <span className={styles['saved-card-watermark']}>
                                                unfold
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
