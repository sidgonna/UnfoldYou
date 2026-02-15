'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { reportContent, blockUser } from '@/lib/actions/safety'
import styles from './ReportModal.module.css'

interface ReportModalProps {
    isOpen: boolean
    onClose: () => void
    userId?: string
    cardId?: string
    shadowName?: string // For display
}

export default function ReportModal({ isOpen, onClose, userId, cardId, shadowName = 'this user' }: ReportModalProps) {
    const [reason, setReason] = useState('')
    const [details, setDetails] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [step, setStep] = useState<'reason' | 'details' | 'block' | 'done'>('reason')
    const [blockChecked, setBlockChecked] = useState(false)

    if (!isOpen) return null

    const reasons = [
        'Harassment',
        'Spam',
        'Inappropriate Content',
        'Impersonation',
        'Other'
    ]

    const handleSubmit = async () => {
        setIsSubmitting(true)

        // 1. Submit Report
        const reportResult = await reportContent({
            reported_user_id: userId,
            reported_card_id: cardId,
            reason,
            details
        })

        if (reportResult.error) {
            alert(reportResult.error)
            setIsSubmitting(false)
            return
        }

        // 2. Block if checked
        if (blockChecked && userId) {
            await blockUser(userId)
        }

        setStep('done')
        setIsSubmitting(false)
    }

    const renderContent = () => {
        switch (step) {
            case 'reason':
                return (
                    <>
                        <h2 className={styles.title}>Report {shadowName}</h2>
                        <p className={styles.subtitle}>Why are you reporting this?</p>
                        <div className={styles.options}>
                            {reasons.map(r => (
                                <button
                                    key={r}
                                    className={`${styles.option} ${reason === r ? styles.selected : ''}`}
                                    onClick={() => {
                                        setReason(r)
                                        setStep('details')
                                    }}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <button className={styles.cancelLink} onClick={onClose}>Cancel</button>
                    </>
                )
            case 'details':
                return (
                    <>
                        <h2 className={styles.title}>Add Details (Optional)</h2>
                        <textarea
                            className={styles.textarea}
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Please provide more context..."
                            rows={4}
                        />
                        <div className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                id="block-user"
                                checked={blockChecked}
                                onChange={(e) => setBlockChecked(e.target.checked)}
                            />
                            <label htmlFor="block-user">Also block {shadowName}</label>
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.secondaryBtn} onClick={() => setStep('reason')}>Back</button>
                            <button
                                className={styles.primaryBtn}
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </>
                )
            case 'done':
                return (
                    <div className={styles.doneState}>
                        <div className={styles.icon}>✅</div>
                        <h2 className={styles.title}>Thanks for letting us know</h2>
                        <p className={styles.text}>Your report has been submitted. We will review it shortly.</p>
                        {blockChecked && <p className={styles.text}>You have also blocked {shadowName}.</p>}
                        <button className={styles.primaryBtn} onClick={onClose}>Done</button>
                    </div>
                )
        }
    }

    return createPortal(
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {renderContent()}
            </div>
        </div>,
        document.body
    )
}
