export default function ChatLoading() {
    return (
        <div className="page page-with-header page-with-bottom-nav">
            <div className="skeleton-container" style={{ paddingTop: '80px' }}>
                {/* Search Bar Skeleton */}
                <div className="skeleton-line skeleton-animate" style={{ height: '48px', width: '100%', marginBottom: '24px', borderRadius: '24px' }} />
                
                {/* Conversation Items */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                        <div className="skeleton-avatar skeleton-animate" />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="skeleton-line skeleton-animate" style={{ width: '40%' }} />
                            <div className="skeleton-line skeleton-animate short" style={{ width: '70%', height: '14px' }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
