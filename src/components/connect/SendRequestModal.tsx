'use client'

import { useState } from 'react'
import { sendConnectionRequest } from '@/lib/actions/connections'
import styles from './SendRequestModal.module.css'

interface SendRequestModalProps {
    recipientId: string
    shadowName: string
    avatarId: string
    onClose: () => void
    onSent?: () => void
}

const MAX_MESSAGE_LENGTH = 200

export default function SendRequestModal({
    recipientId,
    shadowName,
    avatarId,
    onClose,
    onSent,
}: SendRequestModalProps) {
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    async function handleSend(withMessage: boolean) {
        setSending(true)
        setError(null)

        const result = await sendConnectionRequest(
            recipientId,
            withMessage ? message.trim() : undefined
        )

        if (result.error) {
            setError(result.error)
            setSending(false)
            return
        }

        setSuccess(true)
        setTimeout(() => {
            onSent?.()
            onClose()
        }, 1200)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {success ? (
                    <div className={styles.successState}>
                        <span className={styles.successIcon}>✨</span>
                        <h3 className={styles.successTitle}>Request Sent!</h3>
                        <p className={styles.successText}>
                            {shadowName} will see your request
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={styles.header}>
                            <span className={styles.avatar}>{avatarId}</span>
                            <h3 className={styles.title}>Connect with {shadowName}</h3>
                            <p className={styles.subtitle}>
                                Send a connection request. Add a message to stand out!
                            </p>
                        </div>

                        <div className={styles.messageSection}>
                            <label className={styles.label} htmlFor="request-message">
                                Personal message <span className={styles.optional}>(optional)</span>
                            </label>
                            <textarea
                                id="request-message"
                                className={styles.textarea}
                                placeholder="Hey, I liked your POV about..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                                rows={3}
                                disabled={sending}
                            />
                            <span className={styles.charCount}>
                                {message.length}/{MAX_MESSAGE_LENGTH}
                            </span>
                        </div>

                        {error && <p className={styles.error}>{error}</p>}

                        <div className={styles.actions}>
                            <button
                                className={styles.sendBtn}
                                onClick={() => handleSend(message.trim().length > 0)}
                                disabled={sending}
                            >
                                {sending ? 'Sending...' : 'Send Request →'}
                            </button>
                            {message.trim().length > 0 && (
                                <button
                                    className={styles.skipBtn}
                                    onClick={() => handleSend(false)}
                                    disabled={sending}
                                >
                                    Skip message
                                </button>
                            )}
                        </div>

                        <button className={styles.closeBtn} onClick={onClose}>
                            Not now
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
