'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
    disconnectUser, 
    blockUser,
    type ConnectionWithProfile 
} from '@/lib/actions/connections'
import styles from './ConnectionsList.module.css'

interface ConnectionsListProps {
    initialConnections: ConnectionWithProfile[]
}

export default function ConnectionsList({ initialConnections }: ConnectionsListProps) {
    const router = useRouter()
    const [connections, setConnections] = useState(initialConnections)
    const [processing, setProcessing] = useState<string | null>(null)

    const handleDisconnect = async (id: string) => {
        if (!confirm('Are you sure you want to disconnect? This cannot be undone.')) return
        setProcessing(id)
        const result = await disconnectUser(id)
        if (result.error) alert(result.error)
        else {
            setConnections(prev => prev.filter(c => c.id !== id))
            router.refresh()
        }
        setProcessing(null)
    }

    const handleBlock = async (userId: string, connectionId: string) => {
        if (!confirm('Block this user? You will no longer see them or their content.')) return
        setProcessing(connectionId)
        const result = await blockUser(userId)
        if (result.error) alert(result.error)
        else {
            setConnections(prev => prev.filter(c => c.id !== connectionId))
            router.refresh()
        }
        setProcessing(processing === connectionId ? null : processing)
    }

    if (connections.length === 0) {
        return <div className={styles.empty}>No active connections yet.</div>
    }

    return (
        <div className={styles.list}>
            {connections.map(conn => (
                <div key={conn.id} className={styles.card}>
                    <div className={styles.cardHeader} onClick={() => router.push(`/connect/profile/${conn.other_user_id}`)} style={{cursor: 'pointer'}}>
                        <div className={styles.avatar}>{conn.avatar_id}</div>
                        <div className={styles.info}>
                            <div className={styles.name}>{conn.shadow_name}</div>
                            <div className={styles.status}>
                                {conn.reveal_stage} mode • {conn.connection_type}
                            </div>
                        </div>
                    </div>
                    <div className={styles.actions}>
                        <button 
                            onClick={() => router.push(`/chat/${conn.id}`)}
                            className="btn btn-primary btn-sm"
                            style={{flex: 1}}
                        >
                            Chat
                        </button>
                        <button 
                            onClick={() => handleDisconnect(conn.id)}
                            disabled={processing === conn.id}
                            className="btn btn-ghost btn-sm text-danger"
                        >
                            Disconnect
                        </button>
                        <button 
                            onClick={() => handleBlock(conn.other_user_id, conn.id)}
                            disabled={processing === conn.id}
                            className="btn btn-ghost btn-sm"
                        >
                            Block
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
