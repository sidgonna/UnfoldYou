'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
    respondToConnectionRequest, 
    cancelConnectionRequest,
    type ConnectionRequest
} from '@/lib/actions/connections'
import styles from './requests.module.css'

interface RequestsListProps {
    incomingRequests: any[]
    outgoingRequests: any[]
}

function RequestsContent({ 
    incomingRequests: initialIncoming, 
    outgoingRequests: initialOutgoing
}: RequestsListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const from = searchParams.get('from') // 'chat' or 'connect'

    const [incoming, setIncoming] = useState(initialIncoming)
    const [outgoing, setOutgoing] = useState(initialOutgoing)
    const [processing, setProcessing] = useState<string | null>(null)

    const handleAccept = async (id: string, requesterId: string) => {
        setProcessing(id)
        const result = await respondToConnectionRequest(id, 'accept')
        if (result.error) {
            alert(result.error)
        } else {
            router.refresh()
            setIncoming(prev => prev.filter(r => r.id !== id))
            
            // Context-aware redirect
            if (from === 'chat') {
                router.push(`/chat/${id}`)
            } else {
                router.push(`/connect/profile/${requesterId}`)
            }
        }
        setProcessing(null)
    }

    const handleDecline = async (id: string) => {
        setProcessing(id)
        const result = await respondToConnectionRequest(id, 'decline')
        if (result.error) alert(result.error)
        else {
            setIncoming(prev => prev.filter(r => r.id !== id))
            router.refresh()
        }
        setProcessing(null)
    }

    const handleCancel = async (id: string) => {
        setProcessing(id)
        const result = await cancelConnectionRequest(id)
        if (result.error) alert(result.error)
        else {
            setOutgoing(prev => prev.filter(r => r.id !== id))
            router.refresh()
        }
        setProcessing(null)
    }

    const visibleIncoming = incoming.filter(req => {
        if (from !== 'chat') return true;
        // In chat context, skip strangers who didn't write anything
        if (req.connection_type === 'stranger' && !req.request_message) return false;
        return true;
    });

    return (
        <div className="page page-with-header">
            <h1 className={styles.title}>Requests</h1>

            <div className={styles.list}>
                {visibleIncoming.length === 0 && outgoing.length === 0 ? (
                    <div className="text-muted text-center py-8">No pending requests here.</div>
                ) : (
                    <>
                        {visibleIncoming.length > 0 && (
                            <>
                                <h3 className={styles.sectionTitle}>Incoming Requests</h3>
                                {visibleIncoming.map(req => (
                                    <div 
                                        key={req.id} 
                                        className={styles.card} 
                                        onClick={() => {
                                            if (from === 'chat') {
                                                router.push(`/chat/${req.id}`)
                                            } else {
                                                router.push(`/connect/profile/${req.requester_id}`)
                                            }
                                        }}
                                        style={{cursor: 'pointer'}}
                                    >
                                        <div className={styles.cardHeader}>
                                            <div className={styles.avatar}>{req.shadow_profile?.avatar_id}</div>
                                            <div className={styles.info}>
                                                <div className={styles.name}>
                                                    {req.shadow_profile?.shadow_name} 
                                                    <span className="text-muted" style={{fontSize: '0.8rem', fontWeight: 'normal'}}>
                                                        • click to {from === 'chat' ? 'open chat' : 'view profile'}
                                                    </span>
                                                </div>
                                                {req.request_message && (
                                                    <div className={styles.message}>&ldquo;{req.request_message}&rdquo;</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleAccept(req.id, req.requester_id); }}
                                                disabled={processing === req.id}
                                                className="btn btn-primary btn-sm"
                                                style={{flex: 1}}
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDecline(req.id); }}
                                                disabled={processing === req.id}
                                                className="btn btn-ghost btn-sm"
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {outgoing.length > 0 && (
                            <>
                                <h3 className={styles.sectionTitle} style={{marginTop: '2rem'}}>Sent Requests</h3>
                                {outgoing.map(req => (
                                    <div key={req.id} className={styles.card}>
                                        <div className={styles.cardHeader} onClick={() => router.push(`/chat/${req.id}`)} style={{cursor: 'pointer'}}>
                                            <div className={styles.avatar}>{req.shadow_profile?.avatar_id}</div>
                                            <div className={styles.info}>
                                                <div className={styles.name}>To: {req.shadow_profile?.shadow_name} <span className="text-muted" style={{fontSize: '0.8rem', fontWeight: 'normal'}}>• click to view chat</span></div>
                                                <div className={styles.status}>Pending</div>
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <button 
                                                onClick={() => handleCancel(req.id)}
                                                disabled={processing === req.id}
                                                className="btn btn-ghost btn-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default function RequestsList(props: RequestsListProps) {
    return (
        <Suspense fallback={<div className="page p-8 text-center">Loading...</div>}>
            <RequestsContent {...props} />
        </Suspense>
    )
}
