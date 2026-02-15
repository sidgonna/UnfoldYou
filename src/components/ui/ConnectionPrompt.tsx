'use client'

import { useState } from 'react'
import styles from './ConnectionPrompt.module.css'

interface ConnectionPromptProps {
    shadowName: string
    avatarId: string
    onSelect: (type: 'stranger' | 'known') => void
    onClose: () => void
}

export default function ConnectionPrompt({
    shadowName,
    avatarId,
    onSelect,
    onClose,
}: ConnectionPromptProps) {
    const [selected, setSelected] = useState<'stranger' | 'known' | null>(null)

    const handleSelect = (type: 'stranger' | 'known') => {
        setSelected(type)
        // Brief visual feedback before triggering
        setTimeout(() => onSelect(type), 200)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.avatar}>{avatarId}</span>
                    <h2 className={styles.title}>Connect with {shadowName}</h2>
                    <p className={styles.subtitle}>How do you know this person?</p>
                </div>

                {/* Options */}
                <div className={styles.options}>
                    <button
                        className={`${styles.option} ${selected === 'stranger' ? styles.selected : ''}`}
                        onClick={() => handleSelect('stranger')}
                    >
                        <span className={styles['option-icon']}>✨</span>
                        <div className={styles['option-info']}>
                            <span className={styles['option-title']}>Stranger</span>
                            <span className={styles['option-desc']}>
                                Send a connection request. Chat starts anonymously with progressive reveal.
                            </span>
                        </div>
                    </button>

                    <button
                        className={`${styles.option} ${selected === 'known' ? styles.selected : ''}`}
                        onClick={() => handleSelect('known')}
                    >
                        <span className={styles['option-icon']}>👋</span>
                        <div className={styles['option-info']}>
                            <span className={styles['option-title']}>Someone I Know</span>
                            <span className={styles['option-desc']}>
                                Generate a secret code to share with them. Full chat unlocks immediately.
                            </span>
                        </div>
                    </button>
                </div>

                {/* Close */}
                <button className={styles.close} onClick={onClose}>
                    Not now
                </button>
            </div>
        </div>
    )
}
