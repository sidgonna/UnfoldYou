export default function YouLoading() {
    return (
        <div className="page page-with-header page-with-bottom-nav">
            <div className="skeleton-container" style={{ paddingTop: '80px', alignItems: 'center' }}>
                {/* Avatar */}
                <div className="skeleton-avatar skeleton-animate" style={{ width: '120px', height: '120px', marginBottom: '24px' }} />
                
                {/* Name */}
                <div className="skeleton-header skeleton-animate" style={{ width: '200px', height: '32px', marginBottom: '8px' }} />
                
                {/* Status Badges */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
                    <div className="skeleton-line skeleton-animate" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
                    <div className="skeleton-line skeleton-animate" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
                </div>
                
                {/* Tabs */}
                <div style={{ display: 'flex', width: '100%', gap: '16px', marginBottom: '24px' }}>
                    <div className="skeleton-line skeleton-animate" style={{ flex: 1, height: '40px', borderRadius: '20px' }} />
                    <div className="skeleton-line skeleton-animate" style={{ flex: 1, height: '40px', borderRadius: '20px' }} />
                </div>

                {/* Content */}
                <div className="skeleton-item skeleton-animate" style={{ height: '200px' }} />
            </div>
        </div>
    )
}
