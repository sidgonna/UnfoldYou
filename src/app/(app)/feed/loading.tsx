export default function FeedLoading() {
    return (
        <div className="page page-with-header page-with-bottom-nav">
            <div className="skeleton-container" style={{ paddingTop: '80px', gap: '24px' }}>
                <div className="skeleton-card skeleton-animate" style={{ height: '300px' }} />
                <div className="skeleton-card skeleton-animate" style={{ height: '300px' }} />
                <div className="skeleton-card skeleton-animate" style={{ height: '300px' }} />
            </div>
        </div>
    )
}
