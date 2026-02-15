'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './CodeShareModal.module.css'

interface CodeShareModalProps {
    code: string
    expiresAt: string
    shadowName: string
    onClose: () => void
}

export default function CodeShareModal({
    code,
    expiresAt,
    shadowName,
    onClose,
}: CodeShareModalProps) {
    const [copied, setCopied] = useState(false)
    const [timeLeft, setTimeLeft] = useState('')

    const updateTimer = useCallback(() => {
        const diff = new Date(expiresAt).getTime() - Date.now()
        if (diff <= 0) {
            setTimeLeft('Expired')
            return
        }
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, [expiresAt])

    useEffect(() => {
        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [updateTimer])

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback
            const textArea = document.createElement('textarea')
            textArea.value = code
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.title}>Share this code</h3>
                <p className={styles.subtitle}>
                    {shadowName} enters this code to connect with you.
                </p>

                <div className={styles.codeDisplay}>
                    {code.split('').map((char, i) => (
                        <span key={i} className={styles.codeChar}>{char}</span>
                    ))}
                </div>

                <button
                    className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
                    onClick={handleCopy}
                >
                    {copied ? '✓ Copied!' : 'Copy Code 📋'}
                </button>

                <div className={styles.timer}>
                    <span className={styles.timerIcon}>⏳</span>
                    Expires in {timeLeft}
                </div>

                <p className={styles.shareHint}>
                    Share via WhatsApp, SMS, or in person.
                </p>

                <button className={styles.doneBtn} onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    )
}
