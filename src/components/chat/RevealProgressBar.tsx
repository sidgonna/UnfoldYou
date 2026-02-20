'use client'

import styles from './RevealProgressBar.module.css'

// Hardcoded thresholds for normal vs test mode
const NORMAL_THRESHOLDS = {
    shadow: 0,
    whisper: 25,
    glimpse: 50,
    soul: 100,
    unfold: null
}

const TEST_THRESHOLDS = {
    shadow: 0,
    whisper: 10,
    glimpse: 15,
    soul: 20,
    unfold: null
}

const STAGES_META = [
    { key: 'shadow', label: 'Shadow', icon: '🎭' },
    { key: 'whisper', label: 'Whisper', icon: '🤫' },
    { key: 'glimpse', label: 'Glimpse', icon: '👁️' },
    { key: 'soul', label: 'Soul', icon: '💫' },
    { key: 'unfold', label: 'Unfold', icon: '🦋' },
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
    isTestConnection?: boolean
}

export default function RevealProgressBar({ 
    currentStage, 
    messageCount, 
    onUnlockRequest,
    consentStatus,
    currentUserId,
    lastConsentRequest,
    isTestConnection = false
}: RevealProgressBarProps) {
    const thresholds = isTestConnection ? TEST_THRESHOLDS : NORMAL_THRESHOLDS
    const currentIndex = STAGES_META.findIndex(s => s.key === currentStage)

    // Calculate progress to next stage
    const nextStageIndex = currentIndex + 1
    const nextStageKey = STAGES_META[nextStageIndex]?.key
    const currentStageKey = STAGES_META[currentIndex]?.key
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentThreshold = (thresholds as any)[currentStageKey] ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextThreshold = nextStageKey ? (thresholds as any)[nextStageKey] : null

    let progress = 100
    let statusMessage = ''
    let isReadyToUnlock = false
    let isWaiting = false
    let isCooldown = false
    let cooldownRemaining = 0
    const nextStageLabel = STAGES_META[nextStageIndex]?.label

    if (nextThreshold !== null && nextThreshold !== undefined) {
        // Standard progress calculation
        const rawProgress = ((messageCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100
        progress = Math.min(100, Math.max(0, Math.round(rawProgress)))

        // Logic for "stuck" state 
        if (messageCount >= nextThreshold) {
            progress = 100 // Cap visual bar at 100%
            isReadyToUnlock = true
            
            // Check consent status
            if (consentStatus?.target_stage === nextStageKey) {
                const myStatus = consentStatus.requests?.[currentUserId || '']
                const otherStatus = Object.values(consentStatus.requests || {}).find((s, i) => 
                    Object.keys(consentStatus.requests || {})[i] !== currentUserId
                )

                if (myStatus === 'accept') {
                    isReadyToUnlock = false 
                    isWaiting = true
                    statusMessage = 'Waiting for stranger...'
                } else if (otherStatus === 'accept') {
                    statusMessage = `Stranger wants to unlock ${nextStageLabel}!`
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
                    ? `Tap to unlock ${nextStageLabel}` 
                    : `Waiting for ${nextStageLabel}`
            }

        } else {
            statusMessage = `${messageCount}/${nextThreshold} messages to ${nextStageLabel}`
        }
    } else {
        statusMessage = 'Fully Unfolded'
    }

    return (
        <div className={styles.container}>
            <div className={styles.stages}>
                {STAGES_META.map((stage, i) => (
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
                        onClick={() => nextStageKey && onUnlockRequest?.(nextStageKey)}
                    >
                        Unlock
                    </button>
                )}
            </div>
        </div>
    )
}
