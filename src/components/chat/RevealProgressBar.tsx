'use client'

import styles from './RevealProgressBar.module.css'

const STAGES = [
    { key: 'shadow', label: 'Shadow', icon: '🎭', threshold: 0 },
    { key: 'whisper', label: 'Whisper', icon: '🤫', threshold: 20 },
    { key: 'glimpse', label: 'Glimpse', icon: '👁️', threshold: 50 },
    { key: 'soul', label: 'Soul', icon: '💫', threshold: 100 },
    { key: 'unfold', label: 'Unfold', icon: '🦋', threshold: null },
]

interface RevealProgressBarProps {
    currentStage: string
    messageCount: number
}

export default function RevealProgressBar({ currentStage, messageCount }: RevealProgressBarProps) {
    const currentIndex = STAGES.findIndex(s => s.key === currentStage)

    // Calculate progress to next stage
    const nextStage = STAGES[currentIndex + 1]
    const currentThreshold = STAGES[currentIndex]?.threshold ?? 0
    const nextThreshold = nextStage?.threshold

    let progress = 100
    if (nextThreshold !== null && nextThreshold !== undefined) {
        progress = Math.min(100, Math.round(((messageCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    }

    return (
        <div className={styles.container}>
            <div className={styles.stages}>
                {STAGES.map((stage, i) => (
                    <div
                        key={stage.key}
                        className={`${styles.stage} ${i <= currentIndex ? styles.active :
                                i === currentIndex + 1 ? styles.next : styles.locked
                            }`}
                    >
                        <span className={styles.icon}>{stage.icon}</span>
                    </div>
                ))}
            </div>

            {nextThreshold !== null && nextThreshold !== undefined && (
                <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
            )}

            {nextStage && nextThreshold && (
                <div className={styles.label}>
                    {messageCount}/{nextThreshold} messages to {nextStage.label}
                </div>
            )}
        </div>
    )
}
