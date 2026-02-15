'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { fetchOtherShadowProfile } from '@/lib/actions/search'
import {
    generateKnownConnectionCode,
    getConnectionStatus,
    respondToConnectionRequest,
    cancelConnectionRequest,
    type ConnectionStatus,
} from '@/lib/actions/connections'
import { CARD_TEMPLATES } from '@/lib/constants'
import ConnectionPrompt from '@/components/ui/ConnectionPrompt'
import ReportModal from '@/components/safety/ReportModal'
import SendRequestModal from '@/components/connect/SendRequestModal'
import CodeShareModal from '@/components/connect/CodeShareModal'
import CodeEntryModal from '@/components/connect/CodeEntryModal'
import styles from './profile.module.css'

interface ProfileData {
    profile: {
        id: string
        shadow_name: string
        avatar_id: string
        interests: string[]
        pronouns: string | null
        social_energy: string | null
        bio: string | null
    }
    savedCards: {
        id: string
        content: string
        template: string
        likes_count: number
        created_at: string
    }[]
}

export default function OtherProfilePage() {
    const router = useRouter()
    const params = useParams()
    const userId = params.id as string

    const [data, setData] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [reportModalOpen, setReportModalOpen] = useState(false)
    const [showSendRequest, setShowSendRequest] = useState(false)
    const [showCodeShare, setShowCodeShare] = useState(false)
    const [codeData, setCodeData] = useState<{ code: string; expiresAt: string } | null>(null)
    const [showCodeEntry, setShowCodeEntry] = useState(false)

    // Connection status state
    const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [showPostAccept, setShowPostAccept] = useState(false)
    const [acceptedConnectionId, setAcceptedConnectionId] = useState<string | null>(null)

    const loadProfile = useCallback(async () => {
        setLoading(true)
        const [profileResult, statusResult] = await Promise.all([
            fetchOtherShadowProfile(userId),
            getConnectionStatus(userId),
        ])
        if (profileResult.error) {
            setError(profileResult.error)
        } else if (profileResult.data) {
            setData(profileResult.data)
        }
        if (statusResult.data) {
            setConnStatus(statusResult.data)
        }
        setLoading(false)
    }, [userId])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    const handleConnectionType = async (type: 'stranger' | 'known') => {
        setShowPrompt(false)

        if (type === 'stranger') {
            setShowSendRequest(true)
        } else {
            const result = await generateKnownConnectionCode(userId)
            if (result.error) {
                alert(result.error)
                return
            }
            if (result.data) {
                setCodeData({
                    code: result.data.code,
                    expiresAt: result.data.expiresAt,
                })
                setShowCodeShare(true)
            }
        }
    }

    const handleRequestSent = () => {
        setShowSendRequest(false)
        // Update status to reflect sent request
        setConnStatus({
            status: 'pending',
            connectionId: '',
            direction: 'sent',
            connectionType: 'stranger',
        })
    }

    const handleAccept = async () => {
        if (!connStatus) return
        setActionLoading(true)
        const result = await respondToConnectionRequest(connStatus.connectionId, 'accept')
        setActionLoading(false)
        if (result.error) return

        setAcceptedConnectionId(connStatus.connectionId)
        setShowPostAccept(true)
        setConnStatus({
            ...connStatus,
            status: 'accepted',
        })
    }

    const handleDecline = async () => {
        if (!connStatus) return
        setActionLoading(true)
        const result = await respondToConnectionRequest(connStatus.connectionId, 'decline')
        setActionLoading(false)
        if (result.error) return

        // Revert to no connection
        setConnStatus(null)
    }

    const handleCodeSuccess = (cid: string) => {
        setShowCodeEntry(false)
        setAcceptedConnectionId(cid)
        setShowPostAccept(true)
        setConnStatus({
            status: 'accepted',
            connectionId: cid,
            direction: 'received',
            connectionType: 'known',
        })
    }

    const handleCancelRequest = async () => {
        if (!connStatus) return
        setActionLoading(true)
        const result = await cancelConnectionRequest(connStatus.connectionId)
        setActionLoading(false)
        if (result.error) return

        setConnStatus(null)
    }

    if (loading) {
        return (
            <div className="page page-with-header">
                <div className={styles['profile-loading']}>
                    <div className="spinner" />
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="page page-with-header">
                <div className={styles['profile-error']}>
                    <p style={{ fontSize: '3rem' }}>😔</p>
                    <p>{error || 'Profile not found'}</p>
                    <button className={styles['profile-back']} onClick={() => router.back()}>
                        ← Go back
                    </button>
                </div>
            </div>
        )
    }

    const { profile, savedCards } = data

    // ---- Render the CTA button based on connection status ----
    function renderCTA() {
        // Already accepted → Message button
        if (connStatus?.status === 'accepted') {
            return (
                <button
                    className={`${styles['connect-btn']} ${styles['message-btn']}`}
                    onClick={() => router.push(`/chat/${connStatus.connectionId}`)}
                >
                    💬 Message
                </button>
            )
        }

        // Pending — you sent it
        if (connStatus?.status === 'pending' && connStatus.direction === 'sent') {
            return (
                <div className={styles['cta-group']}>
                    <button
                        className={`${styles['connect-btn']} ${styles['sent-btn']}`}
                        disabled
                    >
                        ⏳ Request Sent
                    </button>
                    <button
                        className={styles['cancel-link']}
                        onClick={handleCancelRequest}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                </div>
            )
        }

        // Pending — they sent it to you
        if (connStatus?.status === 'pending' && connStatus.direction === 'received') {

            // Special case for KNOWN requests
            if (connStatus.connectionType === 'known') {
                return (
                    <div className={styles['cta-group']}>
                        <div className={styles['accept-decline-row']}>
                            <button
                                className={styles['decline-btn']}
                                onClick={handleDecline}
                                disabled={actionLoading}
                            >
                                Decline
                            </button>
                            <button
                                className={styles['accept-btn']}
                                onClick={() => setShowCodeEntry(true)}
                                style={{ background: '#F5A623', color: '#1A1A2E' }} // Honey color to differentiate
                            >
                                🔑 Enter Code
                            </button>
                        </div>
                    </div>
                )
            }

            return (
                <div className={styles['cta-group']}>
                    <div className={styles['accept-decline-row']}>
                        <button
                            className={styles['decline-btn']}
                            onClick={handleDecline}
                            disabled={actionLoading}
                        >
                            Decline
                        </button>
                        <button
                            className={styles['accept-btn']}
                            onClick={handleAccept}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Accepting...' : 'Accept ✓'}
                        </button>
                    </div>
                </div>
            )
        }

        // No connection → show Connect
        return (
            <button
                className={styles['connect-btn']}
                onClick={() => setShowPrompt(true)}
            >
                🔗 Connect
            </button>
        )
    }

    return (
        <div className="page page-with-header">
            <div className={styles['profile-page']}>
                {/* Back */}
                <button className={styles['profile-back']} onClick={() => router.back()}>
                    ← Back
                </button>

                {/* Header */}
                <div className={styles['profile-header']}>
                    <div className={styles['profile-avatar']}>
                        {profile.avatar_id}
                    </div>
                    <h1 className={styles['profile-name']}>{profile.shadow_name}</h1>
                    <div className={styles['profile-badges']}>
                        {profile.pronouns && (
                            <span className={styles['profile-badge']}>{profile.pronouns}</span>
                        )}
                        {profile.social_energy && (
                            <span className={styles['profile-badge']}>{profile.social_energy}</span>
                        )}
                    </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                    <div className={styles['profile-section']}>
                        <div className={styles['profile-section-title']}>About</div>
                        <div className={styles['profile-bio']}>{profile.bio}</div>
                    </div>
                )}

                {/* Interests */}
                {profile.interests && profile.interests.length > 0 && (
                    <div className={styles['profile-section']}>
                        <div className={styles['profile-section-title']}>Interests</div>
                        <div className={styles['profile-interests']}>
                            {profile.interests.map((interest) => (
                                <span key={interest} className={styles['profile-interest-chip']}>
                                    {interest}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Saved POV Cards */}
                {savedCards.length > 0 && (
                    <div className={styles['profile-section']}>
                        <div className={styles['profile-section-title']}>
                            Their POVs ({savedCards.length})
                        </div>
                        <div className={styles['profile-cards-grid']}>
                            {savedCards.map((card) => {
                                const tmpl = CARD_TEMPLATES.find((t) => t.id === card.template)
                                return (
                                    <div
                                        key={card.id}
                                        className={styles['mini-card']}
                                        style={{
                                            background: tmpl?.gradient || 'var(--glass-bg)',
                                            color: '#fff',
                                        }}
                                    >
                                        {card.content.length > 80
                                            ? card.content.slice(0, 80) + '...'
                                            : card.content}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Dynamic CTA */}
                <div className={styles['connect-cta']}>
                    {renderCTA()}
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button
                    onClick={() => setReportModalOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}
                >
                    Report or Block User
                </button>
            </div>

            {/* ConnectionPrompt modal */}
            {showPrompt && (
                <ConnectionPrompt
                    shadowName={profile.shadow_name}
                    avatarId={profile.avatar_id}
                    onSelect={handleConnectionType}
                    onClose={() => setShowPrompt(false)}
                />
            )}

            {/* ReportModal */}
            {reportModalOpen && (
                <ReportModal
                    isOpen={reportModalOpen}
                    onClose={() => setReportModalOpen(false)}
                    userId={profile.id} // Assuming profile.id exists
                    shadowName={profile.shadow_name}
                />
            )}

            {/* SendRequestModal (Stranger flow) */}
            {showSendRequest && (
                <SendRequestModal
                    recipientId={userId}
                    shadowName={profile.shadow_name}
                    avatarId={profile.avatar_id}
                    onClose={() => setShowSendRequest(false)}
                    onSent={handleRequestSent}
                />
            )}

            {/* CodeShareModal (Known flow) */}
            {showCodeShare && codeData && (
                <CodeShareModal
                    code={codeData.code}
                    expiresAt={codeData.expiresAt}
                    shadowName={profile.shadow_name}
                    onClose={() => {
                        setShowCodeShare(false)
                        setCodeData(null)
                        // Refresh status — code generates a pending known connection
                        getConnectionStatus(userId).then(r => {
                            if (r.data) setConnStatus(r.data)
                        })
                    }}
                />
            )}

            {/* CodeEntryModal */}
            {showCodeEntry && (
                <CodeEntryModal
                    connectionId={connStatus?.connectionId || ''}
                    requesterName={profile.shadow_name}
                    onClose={() => setShowCodeEntry(false)}
                    onSuccess={handleCodeSuccess}
                />
            )}

            {/* Post-Accept Popup */}
            {showPostAccept && (
                <div className={styles['popup-overlay']}>
                    <div className={styles['popup-card']}>
                        <span className={styles['popup-icon']}>🎉</span>
                        <h3 className={styles['popup-title']}>Connected!</h3>
                        <p className={styles['popup-text']}>
                            You and {profile.shadow_name} are now connected.
                        </p>
                        <button
                            className={styles['popup-chat-btn']}
                            onClick={() => router.push(`/chat/${acceptedConnectionId}`)}
                        >
                            Start chatting →
                        </button>
                        <button
                            className={styles['popup-stay-btn']}
                            onClick={() => setShowPostAccept(false)}
                        >
                            Stay on profile
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
