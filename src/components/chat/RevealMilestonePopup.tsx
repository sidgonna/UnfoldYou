'use client'

import styles from './RevealMilestonePopup.module.css'

const STAGE_INFO: Record<string, { icon: string; title: string; description: string }> = {
    whisper: {
        icon: '🤫',
        title: 'Whisper Unlocked',
        description: 'You can now hear their voice note!',
    },
    glimpse: {
        icon: '👁️',
        title: 'Glimpse Unlocked',
        description: 'You can see their intent and lifestyle habits. Image sharing is now available!',
    },
    soul: {
        icon: '💫',
        title: 'Soul Unlocked',
        description: 'You can now see their Love Soul — deep values, attachment style, and love language.',
    },
    unfold: {
        icon: '🦋',
        title: 'Unfolded!',
        description: 'Real identities revealed. Your authentic connection begins.',
    },
}

interface RevealMilestonePopupProps {
    stage: string
    revealedData: Record<string, unknown> | null
    onClose: () => void
}

export default function RevealMilestonePopup({ stage, onClose }: RevealMilestonePopupProps) {
    const info = STAGE_INFO[stage]
    if (!info) return null

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
                <div className={styles.iconBig}>{info.icon}</div>
                <h3 className={styles.title}>{info.title}</h3>
                <p className={styles.description}>{info.description}</p>
                <button className={styles.continueBtn} onClick={onClose}>
                    Continue chatting →
                </button>
            </div>
        </div>
    )
}
