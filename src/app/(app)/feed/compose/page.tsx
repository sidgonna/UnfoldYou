'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPovCard } from '@/lib/actions/pov-cards'
import { CARD_TEMPLATES } from '@/lib/constants'
import styles from './compose.module.css'

export default function ComposePovPage() {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [template, setTemplate] = useState('midnight')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const selectedTemplate = CARD_TEMPLATES.find((t) => t.id === template)

    const handlePost = async () => {
        if (!content.trim()) {
            setError('Write something first')
            return
        }

        setLoading(true)
        setError('')

        const result = await createPovCard({ content: content.trim(), template })

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        setSuccess(true)
        setTimeout(() => {
            router.push('/feed')
        }, 1500)
    }

    if (success) {
        return (
            <div className={styles['success-overlay']}>
                <div className={styles['success-icon']}>🎉</div>
                <div className={styles['success-text']}>Your POV is live!</div>
                <div className={styles['success-sub']}>24 hours and counting...</div>
            </div>
        )
    }

    return (
        <div className={styles.compose}>
            {/* Header */}
            <div className={styles['compose-header']}>
                <button
                    className={styles['compose-cancel']}
                    onClick={() => router.back()}
                >
                    Cancel
                </button>
                <h1>New POV</h1>
                <div style={{ width: 60 }} />
            </div>

            {/* Template picker */}
            <div className={styles['template-section']}>
                <div className={styles['template-label']}>Template</div>
                <div className={styles['template-row']}>
                    {CARD_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            className={`${styles['template-swatch']} ${template === t.id ? styles.active : ''}`}
                            style={{ background: t.gradient }}
                            onClick={() => setTemplate(t.id)}
                            title={t.label}
                        />
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && <div className={styles['error-bar']}>{error}</div>}

            {/* Card preview with embedded textarea */}
            <div className={styles['preview-area']}>
                <div
                    className={styles['card-preview']}
                    style={{ background: selectedTemplate?.gradient }}
                >
                    <textarea
                        className={styles['card-preview-textarea']}
                        placeholder="What's on your mind?&#10;&#10;Share a thought, a feeling, a POV..."
                        value={content}
                        onChange={(e) => {
                            if (e.target.value.length <= 500) {
                                setContent(e.target.value)
                                setError('')
                            }
                        }}
                        autoFocus
                    />
                    <div className={styles['card-preview-footer']}>
                        <span className={styles['card-watermark']}>unfold</span>
                        <span
                            className={`${styles['char-count']} ${content.length > 480
                                ? styles.danger
                                : content.length > 400
                                    ? styles.warning
                                    : ''
                                }`}
                        >
                            {content.length}/500
                        </span>
                    </div>
                </div>
            </div>

            {/* Post button */}
            <div className={styles['compose-actions']}>
                <button
                    className={styles['post-btn']}
                    onClick={handlePost}
                    disabled={loading || !content.trim()}
                >
                    {loading ? 'Posting...' : 'Post POV'}
                </button>
            </div>
        </div>
    )
}
