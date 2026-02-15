'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fetchPendingRequests } from '@/lib/actions/connections'
import { createClient } from '@/lib/supabase/client'
import StrangerRequestCard from '@/components/connect/StrangerRequestCard'
import KnownRequestCard from '@/components/connect/KnownRequestCard'
import SentRequestCard from '@/components/connect/SentRequestCard'
import styles from './requests.module.css'

interface IncomingRequest {
    id: string
    requester_id: string
    connection_type: 'stranger' | 'known'
    status: string
    request_message: string | null
    created_at: string
    verification_code: string | null
    code_expires_at: string | null
    code_attempts: number
    shadow_profile: { shadow_name: string; avatar_id: string }
}

interface OutgoingRequest {
    id: string
    recipient_id: string
    connection_type: string
    status: string
    request_message: string | null
    created_at: string
    shadow_profile: { shadow_name: string; avatar_id: string }
}

export default function RequestsPage() {
    const router = useRouter()
    const [incoming, setIncoming] = useState<IncomingRequest[]>([])
    const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
    const [loading, setLoading] = useState(true)

    const loadRequests = useCallback(async () => {
        const result = await fetchPendingRequests()
        if (result.data) {
            setIncoming(result.data.incoming as IncomingRequest[])
            setOutgoing(result.data.outgoing as OutgoingRequest[])
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadRequests()

        // Realtime subscription for new requests
        const supabase = createClient()
        const channel = supabase
            .channel('requests-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'connections' },
                () => {
                    loadRequests()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [loadRequests])

    const strangerRequests = incoming.filter(r => r.connection_type === 'stranger')
    const knownRequests = incoming.filter(r => r.connection_type === 'known')
    const totalCount = incoming.length

    const handleRequestHandled = () => {
        loadRequests()
    }

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.topBar}>
                    <button className={styles.backBtn} onClick={() => router.back()}>
                        ←
                    </button>
                    <h1 className={styles.title}>Requests</h1>
                </div>
                <div className={styles.loading}>Loading...</div>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.topBar}>
                <button className={styles.backBtn} onClick={() => router.back()}>
                    ←
                </button>
                <h1 className={styles.title}>
                    Requests {totalCount > 0 && <span className={styles.count}>({totalCount})</span>}
                </h1>
            </div>

            <div className={styles.content}>
                {/* Stranger Requests */}
                {strangerRequests.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>✨</span>
                            Stranger Requests
                        </h2>
                        <div className={styles.cardList}>
                            {strangerRequests.map(req => (
                                <StrangerRequestCard
                                    key={req.id}
                                    connectionId={req.id}
                                    requesterId={req.requester_id}
                                    shadowName={req.shadow_profile.shadow_name}
                                    avatarId={req.shadow_profile.avatar_id}
                                    message={req.request_message}
                                    createdAt={req.created_at}
                                    onHandled={handleRequestHandled}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Known Requests */}
                {knownRequests.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionHeader}>
                            <span className={styles.sectionIcon}>🔑</span>
                            Known Requests
                        </h2>
                        <div className={styles.cardList}>
                            {knownRequests.map(req => (
                                <KnownRequestCard
                                    key={req.id}
                                    connectionId={req.id}
                                    requesterId={req.requester_id}
                                    shadowName={req.shadow_profile.shadow_name}
                                    avatarId={req.shadow_profile.avatar_id}
                                    codeExpiresAt={req.code_expires_at}
                                    codeAttempts={req.code_attempts}
                                    onHandled={handleRequestHandled}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Sent by You */}
                {outgoing.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={`${styles.sectionHeader} ${styles.sentHeader}`}>
                            Sent by You
                        </h2>
                        <div className={styles.cardList}>
                            {outgoing.map(req => (
                                <SentRequestCard
                                    key={req.id}
                                    connectionId={req.id}
                                    targetUserId={req.recipient_id}
                                    shadowName={req.shadow_profile.shadow_name}
                                    avatarId={req.shadow_profile.avatar_id}
                                    connectionType={req.connection_type}
                                    createdAt={req.created_at}
                                    onCancelled={handleRequestHandled}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty State */}
                {totalCount === 0 && outgoing.length === 0 && (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>📬</span>
                        <h3 className={styles.emptyTitle}>All caught up!</h3>
                        <p className={styles.emptyText}>No pending requests right now.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
