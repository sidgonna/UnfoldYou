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
    onUnlockRequest?: (stage: string) => void
    consentStatus?: {
        target_stage?: string
        requests?: Record<string, string>
        startTime?: string
    }
    currentUserId?: string
    lastConsentRequest?: string | null
}

export default function RevealProgressBar({ 
    currentStage, 
    messageCount, 
    onUnlockRequest,
    consentStatus,
    currentUserId,
    lastConsentRequest
}: RevealProgressBarProps) {
    const currentIndex = STAGES.findIndex(s => s.key === currentStage)

    // Calculate progress to next stage
    const nextStage = STAGES[currentIndex + 1]
    const currentThreshold = STAGES[currentIndex]?.threshold ?? 0
    const nextThreshold = nextStage?.threshold

    let progress = 100
    let statusMessage = ''
    let isReadyToUnlock = false
    let isWaiting = false
    let isCooldown = false
    let cooldownRemaining = 0

    if (nextThreshold !== null && nextThreshold !== undefined) {
        // Standard progress calculation
        const rawProgress = ((messageCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100
        progress = Math.min(100, Math.max(0, Math.round(rawProgress)))

        // Logic for "stuck" state 
        if (messageCount >= nextThreshold) {
            progress = 100 // Cap visual bar at 100%
            isReadyToUnlock = true
            
            // Check consent status
            if (consentStatus?.target_stage === nextStage.key) {
                const myStatus = consentStatus.requests?.[currentUserId || '']
                const otherStatus = Object.values(consentStatus.requests || {}).find((s, i) => 
                    Object.keys(consentStatus.requests || {})[i] !== currentUserId
                )

                if (myStatus === 'accept') {
                    isReadyToUnlock = false 
                    isWaiting = true
                    statusMessage = 'Waiting for stranger...'
                } else if (otherStatus === 'accept') {
                    statusMessage = `Stranger wants to unlock ${nextStage.label}!`
                } else if (myStatus === 'declined') {
                    // Check cooldown
                    if (lastConsentRequest) {
                        const diff = Date.now() - new Date(lastConsentRequest).getTime()
                        if (diff < 120000) { // 2 mins
                            isCooldown = true
                            isReadyToUnlock = false
                            cooldownRemaining = Math.ceil((120000 - diff) / 1000)
                            statusMessage = `Stranger needs time. Wait ${cooldownRemaining}s`
                        }
                    }
                }
            }

            if (!statusMessage) {
                statusMessage = isReadyToUnlock 
                    ? `Tap to unlock ${nextStage.label}` 
                    : `Waiting for ${nextStage.label}`
            }

        } else {
            statusMessage = `${messageCount}/${nextThreshold} messages to ${nextStage.label}`
        }
    } else {
        statusMessage = 'Fully Unfolded'
    }

    return (
        <div className={styles.container}>
            <div className={styles.stages}>
                {STAGES.map((stage, i) => (
                    <div
                        key={stage.key}
                        className={`${styles.stage} ${i <= currentIndex ? styles.active :
                                i === currentIndex + 1 ? styles.next : styles.locked
                            } ${isReadyToUnlock && i === currentIndex + 1 ? styles.pulsing : ''}`}
                        onClick={() => {
                            if (isReadyToUnlock && i === currentIndex + 1 && onUnlockRequest) {
                                onUnlockRequest(stage.key)
                            }
                        }}
                        style={{ cursor: isReadyToUnlock && i === currentIndex + 1 ? 'pointer' : 'default' }}
                    >
                        <span className={styles.icon}>{stage.icon}</span>
                    </div>
                ))}
            </div>

            {nextThreshold !== null && nextThreshold !== undefined && (
                <div className={styles.progressTrack}>
                    <div 
                        className={`${styles.progressFill} ${isReadyToUnlock ? styles.ready : ''}`} 
                        style={{ width: `${progress}%` }} 
                    />
                </div>
            )}

            <div className={styles.label}>
                {statusMessage}
                {isReadyToUnlock && (
                    <button 
                        className={styles.unlockBtn}
                        onClick={() => onUnlockRequest?.(nextStage.key)}
                    >
                        Unlock
                    </button>
                )}
            </div>
        </div>
    )
}
