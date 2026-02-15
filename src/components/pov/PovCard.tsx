'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type PovCard, toggleLikeCard, toggleSaveCard, deletePovCard } from '@/lib/actions/pov-cards'
import { CARD_TEMPLATES } from '@/lib/constants'
import styles from './PovCard.module.css'

interface PovCardProps {
    card: PovCard
    onUpdate?: () => void
}

function getTimeRemaining(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
}

export default function PovCardComponent({ card, onUpdate }: PovCardProps) {
    const [likeLoading, setLikeLoading] = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [localLiked, setLocalLiked] = useState(card.user_has_liked || false)
    const [localLikes, setLocalLikes] = useState(card.likes_count)
    const [localSaved, setLocalSaved] = useState(card.is_saved)

    const template = CARD_TEMPLATES.find((t) => t.id === card.template) || CARD_TEMPLATES[0]

    const handleLike = async () => {
        if (card.is_own_card || likeLoading) return

        // Optimistic update
        setLocalLiked(!localLiked)
        setLocalLikes((prev) => localLiked ? prev - 1 : prev + 1)
        setLikeLoading(true)

        const result = await toggleLikeCard(card.id)
        if (result.error) {
            // Revert
            setLocalLiked(localLiked)
            setLocalLikes(card.likes_count)
        }
        setLikeLoading(false)
        onUpdate?.()
    }

    const handleSave = async () => {
        if (!card.is_own_card || saveLoading) return

        setLocalSaved(!localSaved)
        setSaveLoading(true)

        const result = await toggleSaveCard(card.id)
        if (result.error) {
            setLocalSaved(localSaved)
        }
        setSaveLoading(false)
        onUpdate?.()
    }

    const handleDelete = async () => {
        if (!card.is_own_card) return

        await deletePovCard(card.id)
        onUpdate?.()
    }

    return (
        <div className={styles['pov-card']} style={{ background: template.gradient }}>
            {/* Header */}
            <div className={styles['card-header']}>
                <div className={styles['card-author']}>
                    {!card.is_own_card && card.shadow_profile ? (
                        <Link
                            href={`/connect/profile/${card.creator_id}`}
                            className={styles['author-link']}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className={styles['card-avatar']}>
                                {card.shadow_profile.avatar_id || '🎭'}
                            </span>
                            <span className={styles['card-name']}>
                                {card.shadow_profile.shadow_name || 'Unknown'}
                            </span>
                        </Link>
                    ) : (
                        <>
                            <span className={styles['card-avatar']}>
                                {card.shadow_profile?.avatar_id || '🎭'}
                            </span>
                            <span className={styles['card-name']}>
                                {card.shadow_profile?.shadow_name || 'Unknown'}
                            </span>
                        </>
                    )}
                </div>
                <div className={styles['card-timer']}>
                    {card.is_saved ? (
                        <span className={styles['saved-badge']}>💾 Saved</span>
                    ) : (
                        <span>⏱ {getTimeRemaining(card.expires_at)}</span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={styles['card-content']}>
                <p>{card.content}</p>
            </div>

            {/* Footer */}
            <div className={styles['card-footer']}>
                <div className={styles['card-actions']}>
                    {/* Like — hidden on own card */}
                    {!card.is_own_card && (
                        <button
                            className={`${styles['action-btn']} ${localLiked ? styles.liked : ''}`}
                            onClick={handleLike}
                            disabled={likeLoading}
                        >
                            {localLiked ? '❤️' : '🤍'} {localLikes > 0 ? localLikes : ''}
                        </button>
                    )}

                    {/* Like count for own card */}
                    {card.is_own_card && localLikes > 0 && (
                        <span className={styles['like-count']}>
                            ❤️ {localLikes}
                        </span>
                    )}

                    {/* Save — only on own card */}
                    {card.is_own_card && (
                        <button
                            className={`${styles['action-btn']} ${localSaved ? styles.saved : ''}`}
                            onClick={handleSave}
                            disabled={saveLoading}
                        >
                            {localSaved ? '💾' : '🔖'} {localSaved ? 'Saved' : 'Save'}
                        </button>
                    )}

                    {/* Share Button (everyone) */}
                    <button
                        className={styles['action-btn']}
                        onClick={async (e) => {
                            e.stopPropagation()
                            const url = `${window.location.origin}/pov/${card.id}`
                            // The Next.js OG image route is at /pov/[id]/opengraph-image
                            // We fetch it to share as a file
                            const imageUrl = `${window.location.origin}/pov/${card.id}/opengraph-image`

                            // 1. Try native share (mobile) with File
                            if (navigator.share) {
                                try {
                                    // Attempt to share with image
                                    const imageUrl = `${window.location.origin}/pov/${card.id}/opengraph-image`
                                    const response = await fetch(imageUrl)
                                    const blob = await response.blob()
                                    const file = new File([blob], 'pov-card.png', { type: 'image/png' })

                                    const shareData: ShareData = {
                                        title: 'UnfoldYou POV',
                                        text: `Check out this POV on UnfoldYou!\n\n"${card.content.slice(0, 50)}..."`,
                                        url: url
                                    }

                                    // Only add files if supported
                                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                        shareData.files = [file]
                                    }

                                    await navigator.share(shareData)
                                    return
                                } catch (err) {
                                    // If file share fails (e.g. not supported), try generic text share
                                    try {
                                        await navigator.share({
                                            title: 'UnfoldYou POV',
                                            text: `Check out this POV on UnfoldYou!\n\n"${card.content.slice(0, 50)}..."`,
                                            url: url
                                        })
                                        return
                                    } catch (retryErr) {
                                        // Ignore, fall through to clipboard
                                    }
                                }
                            }

                            // 2. Try Clipboard API (secure contexts)
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                try {
                                    await navigator.clipboard.writeText(url)
                                    alert('Link copied to clipboard!')
                                    return
                                } catch (err) {
                                    // Fall through to legacy
                                }
                            }

                            // 3. Fallback: textarea hack (non-secure contexts like HTTP IP)
                            try {
                                const textArea = document.createElement("textarea")
                                textArea.value = url

                                // Avoid scrolling to bottom
                                textArea.style.top = "0"
                                textArea.style.left = "0"
                                textArea.style.position = "fixed"
                                textArea.style.opacity = "0"

                                document.body.appendChild(textArea)
                                textArea.focus()
                                textArea.select()

                                const successful = document.execCommand('copy')
                                document.body.removeChild(textArea)

                                if (successful) {
                                    alert('Link copied to clipboard!')
                                } else {
                                    alert('Could not copy link. Please copy manually: ' + url)
                                }
                            } catch (err) {
                                alert('Could not copy link. Please copy manually: ' + url)
                            }
                        }}
                    >
                        🔗
                    </button>

                    {/* Delete — only on own card */}
                    {card.is_own_card && (
                        <>
                            {deleteConfirm ? (
                                <div className={styles['delete-confirm']}>
                                    <button
                                        className={`${styles['action-btn']} ${styles.danger}`}
                                        onClick={handleDelete}
                                    >
                                        Yes, delete
                                    </button>
                                    <button
                                        className={styles['action-btn']}
                                        onClick={() => setDeleteConfirm(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={styles['action-btn']}
                                    onClick={() => setDeleteConfirm(true)}
                                >
                                    🗑️
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className={styles['card-meta']}>
                    <span className={styles['card-watermark']}>unfold</span>
                    <span className={styles['card-time']}>{formatDate(card.created_at)}</span>
                </div>
            </div>
        </div>
    )
}
