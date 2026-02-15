'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { redeemKnownConnectionCode, incrementCodeAttempts } from '@/lib/actions/connections'
import styles from './KnownRequestCard.module.css'

interface KnownRequestCardProps {
    connectionId: string
    requesterId: string
    shadowName: string
    avatarId: string
    codeExpiresAt: string | null
    codeAttempts: number
    onHandled?: () => void
}

const MAX_CODE_ATTEMPTS = 3
const CODE_LENGTH = 6

export default function KnownRequestCard({
    connectionId,
    requesterId,
    shadowName,
    avatarId,
    codeExpiresAt,
    codeAttempts,
    onHandled,
}: KnownRequestCardProps) {
    const router = useRouter()
    const [expanded, setExpanded] = useState(false)
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
    const [error, setError] = useState<string | null>(null)
    const [shaking, setShaking] = useState(false)
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'expired'>('idle')
    const [attemptsLeft, setAttemptsLeft] = useState(MAX_CODE_ATTEMPTS - codeAttempts)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Check expiry
    const isExpired = codeExpiresAt ? new Date(codeExpiresAt) < new Date() : false

    const handleInputChange = useCallback((index: number, value: string) => {
        const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!char && value !== '') return

        const newCode = [...code]
        newCode[index] = char
        setCode(newCode)
        setError(null)

        // Auto-advance to next input
        if (char && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus()
        }
    }, [code])

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const chars = pasted.slice(0, CODE_LENGTH).split('')
        const newCode = [...code]
        chars.forEach((char, i) => {
            newCode[i] = char
        })
        setCode(newCode)
        // Focus the next empty or last input
        const nextEmpty = newCode.findIndex(c => !c)
        inputRefs.current[nextEmpty >= 0 ? nextEmpty : CODE_LENGTH - 1]?.focus()
    }

    async function handleSubmit() {
        const fullCode = code.join('')
        if (fullCode.length !== CODE_LENGTH) {
            setError('Enter all 6 characters')
            return
        }

        setStatus('verifying')
        setError(null)

        const result = await redeemKnownConnectionCode(fullCode)

        if (result.error) {
            // Increment attempts
            const attemptResult = await incrementCodeAttempts(connectionId)
            const remaining = attemptResult.data?.attemptsLeft ?? attemptsLeft - 1
            setAttemptsLeft(remaining)

            if (remaining <= 0 || attemptResult.data?.expired) {
                setStatus('expired')
                setError('Maximum attempts exceeded. Code expired.')
            } else {
                setStatus('idle')
                setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.`)
                triggerShake()
            }
            return
        }

        setStatus('success')
        setTimeout(() => {
            onHandled?.()
            router.push(`/chat/${result.data?.connectionId}`)
        }, 600)
    }

    function triggerShake() {
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
    }

    if (isExpired || status === 'expired') {
        return (
            <div className={`${styles.card} ${styles.expired}`}>
                <div className={styles.typeBadge}>🔑 Known</div>
                <Link
                    href={`/connect/profile/${requesterId}`}
                    className={`${styles.header} ${styles.tappable}`}
                >
                    <span className={styles.avatar}>{avatarId}</span>
                    <div className={styles.info}>
                        <span className={styles.name}>{shadowName}</span>
                        <span className={styles.expiredText}>Code expired</span>
                    </div>
                </Link>
            </div>
        )
    }

    return (
        <div className={`${styles.card} ${status === 'success' ? styles.success : ''}`}>
            <div className={styles.typeBadge}>🔑 Known</div>

            <Link
                href={`/connect/profile/${requesterId}`}
                className={`${styles.header} ${styles.tappable}`}
            >
                <span className={styles.avatar}>{avatarId}</span>
                <div className={styles.info}>
                    <span className={styles.name}>{shadowName}</span>
                    <span className={styles.subtitle}>wants to connect with a code</span>
                </div>
            </Link>

            {!expanded ? (
                <button
                    className={styles.expandBtn}
                    onClick={() => setExpanded(true)}
                >
                    Enter the code they shared with you →
                </button>
            ) : (
                <div className={styles.codeSection}>
                    <p className={styles.codeLabel}>Enter 6-character code:</p>

                    <div className={`${styles.codeInputs} ${shaking ? styles.shake : ''}`}>
                        {code.map((char, i) => (
                            <input
                                key={i}
                                ref={el => { inputRefs.current[i] = el }}
                                className={styles.codeBox}
                                type="text"
                                maxLength={1}
                                value={char}
                                onChange={(e) => handleInputChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                autoFocus={i === 0}
                                disabled={status === 'verifying'}
                            />
                        ))}
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button
                        className={styles.connectBtn}
                        onClick={handleSubmit}
                        disabled={status === 'verifying' || code.some(c => !c)}
                    >
                        {status === 'verifying' ? 'Verifying...' : 'Connect →'}
                    </button>
                </div>
            )}
        </div>
    )
}
