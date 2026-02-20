'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { respondToConnectionRequest } from '@/lib/actions/connections'
import styles from './StrangerRequestCard.module.css'

interface StrangerRequestCardProps {
    connectionId: string
    requesterId: string
    shadowName: string
    avatarId: string
    message?: string | null
    createdAt: string
    onHandled?: () => void
}

export default function StrangerRequestCard({
    connectionId,
    requesterId,
    shadowName,
    avatarId,
    message,
    createdAt,
    onHandled,
}: StrangerRequestCardProps) {
    const router = useRouter()
    const [status, setStatus] = useState<'idle' | 'accepting' | 'declining' | 'accepted' | 'declined'>('idle')

    const timeAgo = getTimeAgo(createdAt)

    async function handleAccept() {
        setStatus('accepting')
        const result = await respondToConnectionRequest(connectionId, 'accept')
        if (result.error) {
            setStatus('idle')
            return
        }
        setStatus('accepted')
        setTimeout(() => {
            onHandled?.()
            router.push(`/connect/profile/${requesterId}`)
        }, 600)
    }

    async function handleDecline() {
        setStatus('declining')
        const result = await respondToConnectionRequest(connectionId, 'decline')
        if (result.error) {
            setStatus('idle')
            return
        }
        setStatus('declined')
        setTimeout(() => onHandled?.(), 400)
    }

    return (
        <div
            className={`${styles.card} ${status === 'accepted' ? styles.accepted :
                status === 'declined' ? styles.declined : ''
                }`}
        >
            <div className={styles.typeBadge}>✨ Stranger</div>

            <Link
                href={`/connect/profile/${requesterId}`}
                className={`${styles.header} ${styles.tappable}`}
            >
                <span className={styles.avatar}>
                    {avatarId}
                </span>
                <div className={styles.info}>
                    <span className={styles.name}>
                        {shadowName}
                    </span>
                    <span className={styles.time}>{timeAgo}</span>
                </div>
            </Link>

            {message && (
                <div className={styles.message}>
                    &ldquo;{message}&rdquo;
                </div>
            )}

            <div className={styles.actions}>
                <button
                    className={styles.declineBtn}
                    onClick={handleDecline}
                    disabled={status !== 'idle'}
                >
                    Decline
                </button>
                <button
                    className={styles.acceptBtn}
                    onClick={handleAccept}
                    disabled={status !== 'idle'}
                >
                    {status === 'accepting' ? 'Accepting...' : 'Accept ✓'}
                </button>
            </div>
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
