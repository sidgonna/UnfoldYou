import styles from './PartnerProfileModal.module.css'

interface PartnerProfileModalProps {
    onClose: () => void
    shadowProfile: {
        shadow_name: string
        avatar_id: string
        pronouns?: string | null
        social_energy?: string | null
        bio?: string | null
        interests: string[]
    }
    realProfile: {
        real_name?: string | null
        profile_photo?: string | null
        age?: number
        height?: number
        location?: string | null
        voice_note_url?: string | null
        intent?: string | null
        habits?: string[] | null
    }
    revealStage: string
    isKnownConnect: boolean
}

const STAGE_ORDER = ['shadow', 'whisper', 'glimpse', 'soul', 'unfold']

export default function PartnerProfileModal({
    onClose,
    shadowProfile,
    realProfile,
    revealStage,
    isKnownConnect
}: PartnerProfileModalProps) {
    
    // Determine visibility levels
    const currentStageIndex = STAGE_ORDER.indexOf(revealStage)
    const canSeeVoice = currentStageIndex >= STAGE_ORDER.indexOf('whisper')
    const canSeeHabits = currentStageIndex >= STAGE_ORDER.indexOf('glimpse')
    const canSeeSoul = currentStageIndex >= STAGE_ORDER.indexOf('soul')
    const canSeeFull = currentStageIndex >= STAGE_ORDER.indexOf('unfold') || isKnownConnect

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>×</button>
                
                <div className={styles.header}>
                    <div className={styles.avatarWrapper}>
                        {canSeeFull && realProfile.profile_photo ? (
                            <img 
                                src={realProfile.profile_photo} 
                                alt="Real Avatar" 
                                className={styles.realAvatar} 
                            />
                        ) : (
                            <div className={styles.shadowAvatar}>{shadowProfile.avatar_id}</div>
                        )}
                    </div>
                    <h2 className={styles.name}>
                        {canSeeFull && realProfile.real_name 
                            ? realProfile.real_name 
                            : shadowProfile.shadow_name}
                    </h2>
                    {isKnownConnect && <span className={styles.knownBadge}>Known Connection</span>}
                </div>

                <div className={styles.content}>
                    {/* Shadow Section - Always Visible */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Shadow Identity</h3>
                        {shadowProfile.bio && <p className={styles.bio}>&ldquo;{shadowProfile.bio}&rdquo;</p>}
                        
                        <div className={styles.tags}>
                            {shadowProfile.interests.map(tag => (
                                <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                        </div>
                        
                        <div className={styles.metaRow}>
                           {shadowProfile.pronouns && <span className={styles.metaBadge}>{shadowProfile.pronouns}</span>} 
                           {shadowProfile.social_energy && <span className={styles.metaBadge}>🔋 {shadowProfile.social_energy}</span>} 
                        </div>
                    </div>

                    {/* Real Profile Section - Progressive Reveal */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            Real Identity 
                            {!isKnownConnect && !canSeeFull && <span className={styles.lockIcon}>🔒</span>}
                        </h3>

                        {/* Whisper Milestone: Voice */}
                        <div className={`${styles.revealItem} ${!canSeeVoice && !isKnownConnect ? styles.locked : ''}`}>
                            <div className={styles.revealLabel}>Voice Note</div>
                            {canSeeVoice || isKnownConnect ? (
                                realProfile.voice_note_url ? (
                                    <audio controls src={realProfile.voice_note_url} className={styles.audioPlayer} />
                                ) : <span className={styles.emptyText}>No voice note added</span>
                            ) : (
                                <div className={styles.blurText}>Unlocks at Whisper Mode</div>
                            )}
                        </div>

                        {/* Glimpse Milestone: Intent & Habits */}
                         <div className={`${styles.revealItem} ${!canSeeHabits && !isKnownConnect ? styles.locked : ''}`}>
                            <div className={styles.revealLabel}>Intent & Habits</div>
                            {(canSeeHabits || isKnownConnect) ? (
                                <>
                                    {realProfile.intent && <p className={styles.intent}>Currently looking for: <strong>{realProfile.intent}</strong></p>}
                                    {Array.isArray(realProfile.habits) && realProfile.habits.length > 0 && (
                                        <div className={styles.habitTags}>
                                            {realProfile.habits.map(h => <span key={h} className={styles.habitBadge}>{h}</span>)}
                                        </div>
                                    )}
                                     {(!realProfile.intent && (!Array.isArray(realProfile.habits) || realProfile.habits.length === 0)) && <span className={styles.emptyText}>No habits added</span>}
                                </>
                            ) : (
                                <div className={styles.blurText}>Unlocks at Glimpse Mode</div>
                            )}
                        </div>

                        {/* Unfold Milestone: Location, Age, Height */}
                         <div className={`${styles.revealItem} ${!canSeeFull ? styles.locked : ''}`}>
                            <div className={styles.revealLabel}>Personal Details</div>
                            {canSeeFull ? (
                                <div className={styles.personalGrid}>
                                    <div>📍 {realProfile.location || 'Unknown'}</div>
                                    <div>🎂 {realProfile.age || '?'} y/o</div>
                                    <div>📏 {realProfile.height || '?'} cm</div>
                                </div>
                            ) : (
                                <div className={styles.blurText}>Unlocks at Unfold</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
