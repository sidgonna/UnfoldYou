import { Notification } from '@/lib/actions/notifications'
import { useRouter } from 'next/navigation'
import styles from './notifications.module.css'

interface NotificationListProps {
    onClose: () => void
    notifications: Notification[]
    loading: boolean
    markRead: (id: string) => void
    markAllRead: () => void
}

export default function NotificationList({ onClose, notifications, loading, markRead, markAllRead }: NotificationListProps) {
    const router = useRouter()

    if (loading) {
        return <div className={styles.loading}>Loading updates...</div>
    }

    if (notifications.length === 0) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>😴</div>
                <p>No new updates here.</p>
            </div>
        )
    }

    const handleItemClick = async (notification: any) => {
        if (!notification.is_read) {
            markRead(notification.id)
        }

        // Navigate based on type
        switch (notification.type) {
            case 'connection_request':
                // Redirect to the requests tab/page
                router.push('/connect/requests')
                break
            case 'connection_accepted':
                router.push(`/chat/${notification.resource_id}`)
                break
            case 'new_message':
                router.push(`/chat/${notification.resource_id}`)
                break
            case 'pov_like':
                // User wants to see WHO liked it, so go to their profile
                if (notification.actor_id) {
                    router.push(`/connect/profile/${notification.actor_id}`)
                }
                break
            case 'reveal_milestone':
                // Check if we have connection_id in metadata or resource_id
                if (notification.resource_id) {
                    router.push(`/chat/${notification.resource_id}`)
                }
                break
        }
        onClose()
    }

    return (
        <div className={styles.listContainer}>
            <div className={styles.header}>
                <span className={styles.title}>Updates</span>
                <button className={styles.markReadBtn} onClick={() => markAllRead()}>
                    Mark all read
                </button>
            </div>

            <div className={styles.scrollArea}>
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
                        onClick={() => handleItemClick(n)}
                    >
                        <div className={styles.avatar}>
                            {n.actor?.avatar_id || '👤'}
                        </div>
                        <div className={styles.content}>
                            <p className={styles.text}>
                                <span className={styles.name}>{n.actor?.shadow_name || 'Someone'}</span>
                                {getNotificationText(n.type)}
                            </p>
                            <span className={styles.time}>
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        {!n.is_read && <div className={styles.dot} />}
                    </div>
                ))}
            </div>
        </div>
    )
}

function getNotificationText(type: string): string {
    switch (type) {
        case 'connection_request': return ' wants to connect.'
        case 'connection_accepted': return ' accepted your request!'
        case 'new_message': return ' sent you a message.'
        case 'pov_like': return ' liked your POV.'
        case 'reveal_milestone': return ' unlocked a new layer!'
        default: return ' updated something.'
    }
}
