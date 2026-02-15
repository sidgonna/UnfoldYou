'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cancelConnectionRequest } from '@/lib/actions/connections'
import styles from './SentRequestCard.module.css'

interface SentRequestCardProps {
    connectionId: string
    targetUserId: string
    shadowName: string
    avatarId: string
    connectionType: string
    createdAt: string
    onCancelled?: () => void
}

export default function SentRequestCard({
    connectionId,
    targetUserId,
    shadowName,
    avatarId,
    connectionType,
    createdAt,
    onCancelled,
}: SentRequestCardProps) {
    const [cancelling, setCancelling] = useState(false)
    const [cancelled, setCancelled] = useState(false)

    const timeAgo = getTimeAgo(createdAt)

    async function handleCancel() {
        setCancelling(true)
        const result = await cancelConnectionRequest(connectionId)
        if (result.error) {
            setCancelling(false)
            return
        }
        setCancelled(true)
        setTimeout(() => onCancelled?.(), 400)
    }

    return (
        <div className={`${styles.card} ${cancelled ? styles.cancelled : ''}`}>
            <Link
                href={`/connect/profile/${targetUserId}`}
                className={`${styles.header} ${styles.tappable}`}
            >
                <span className={styles.avatar}>{avatarId}</span>
                <div className={styles.info}>
                    <span className={styles.name}>{shadowName}</span>
                    <div className={styles.meta}>
                        <span className={styles.badge}>
                            {connectionType === 'known' ? '🔑' : '✨'} ⏳ Pending
                        </span>
                        <span className={styles.time}>{timeAgo}</span>
                    </div>
                </div>
            </Link>

            <button
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={cancelling}
            >
                {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </button>
        </div>
    )
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}
