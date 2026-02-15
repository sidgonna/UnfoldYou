'use client'

import styles from './UnfoldRequestModal.module.css'

interface UnfoldRequestModalProps {
    shadowName: string
    onConfirm: () => void
    onClose: () => void
}

export default function UnfoldRequestModal({ shadowName, onConfirm, onClose }: UnfoldRequestModalProps) {
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <span className={styles.icon}>🦋</span>
                <h3 className={styles.title}>Ready to Unfold?</h3>
                <p className={styles.description}>
                    You&apos;re about to reveal your real identity to <strong>{shadowName}</strong>.
                    This requires mutual consent — they must also choose to unfold.
                </p>

                <div className={styles.whatHappens}>
                    <p className={styles.whatTitle}>What gets revealed:</p>
                    <ul className={styles.list}>
                        <li>Your real name</li>
                        <li>Your profile photo</li>
                        <li>Your age, height, and location</li>
                    </ul>
                </div>

                <div className={styles.actions}>
                    <button className={styles.unfoldBtn} onClick={onConfirm}>
                        Yes, I&apos;m ready 🦋
                    </button>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        Not yet
                    </button>
                </div>
            </div>
        </div>
    )
}
