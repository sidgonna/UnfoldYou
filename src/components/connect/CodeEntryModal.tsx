'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { redeemKnownConnectionCode, incrementCodeAttempts } from '@/lib/actions/connections'
import styles from './CodeEntryModal.module.css'

interface CodeEntryModalProps {
    connectionId: string
    requesterName: string
    onClose: () => void
    onSuccess: (connectionId: string) => void
}

const MAX_CODE_ATTEMPTS = 3
const CODE_LENGTH = 6

export default function CodeEntryModal({
    connectionId,
    requesterName,
    onClose,
    onSuccess,
}: CodeEntryModalProps) {
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
    const [error, setError] = useState<string | null>(null)
    const [shaking, setShaking] = useState(false)
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success'>('idle')
    const [attemptsLeft, setAttemptsLeft] = useState(MAX_CODE_ATTEMPTS)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    const handleInputChange = useCallback((index: number, value: string) => {
        const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!char && value !== '') return

        const newCode = [...code]
        newCode[index] = char
        setCode(newCode)
        setError(null)

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
            const attemptResult = await incrementCodeAttempts(connectionId)
            const remaining = attemptResult.data?.attemptsLeft ?? attemptsLeft - 1
            setAttemptsLeft(remaining)

            if (remaining <= 0 || attemptResult.data?.expired) {
                setError('Maximum attempts exceeded. Code expired.')
                setTimeout(onClose, 2000)
            } else {
                setStatus('idle')
                setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.`)
                triggerShake()
            }
            return
        }

        setStatus('success')
        setTimeout(() => {
            onSuccess(result.data?.connectionId || connectionId)
        }, 600)
    }

    function triggerShake() {
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.icon}>🔑</span>
                    <h3 className={styles.title}>Enter Code</h3>
                </div>

                <p className={styles.subtitle}>
                    Enter the 6-character code shared by <strong>{requesterName}</strong> to connect.
                </p>

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
                            disabled={status === 'verifying' || status === 'success'}
                        />
                    ))}
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.connectBtn}
                        onClick={handleSubmit}
                        disabled={status === 'verifying' || code.some(c => !c)}
                    >
                        {status === 'verifying' ? 'Verifying...' : status === 'success' ? 'Verified ✓' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    )
}
