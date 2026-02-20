'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, updateUserProfile, updateShadowProfile, type ShadowProfile, type UserProfile, type LoveSoul } from '@/lib/actions/profile'
import { type ConnectionWithProfile } from '@/lib/actions/connections'
import { CARD_TEMPLATES, HABIT_OPTIONS, INTENT_OPTIONS, AVATARS, INTEREST_OPTIONS } from '@/lib/constants'
import ConnectionsList from '@/components/profile/ConnectionsList'
import NotificationBell from '@/components/notifications/NotificationBell'
import MusicPlayer from '@/components/ui/MusicPlayer'
import styles from './you.module.css'

interface SavedCard {
    id: string
    content: string
    template: string
    likes_count: number
    created_at: string
    saved_at: string | null
}

interface ProfileViewProps {
    initialShadowProfile: ShadowProfile | null
    initialUserProfile: UserProfile | null
    initialLoveSoul: LoveSoul | null
    initialSavedCards: SavedCard[]
    initialConnections: ConnectionWithProfile[]
}

export default function ProfileView({ 
    initialShadowProfile, 
    initialUserProfile, 
    initialLoveSoul,
    initialSavedCards,
    initialConnections
}: ProfileViewProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'shadow' | 'real' | 'connections'>('shadow')
    const [savedCards] = useState<SavedCard[]>(initialSavedCards)
    const [signingOut, setSigningOut] = useState(false)

    // Real Profile State
    const [userProfile, setUserProfile] = useState<UserProfile | null>(initialUserProfile)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({})

    // Shadow Profile State
    const [shadowProfile, setShadowProfile] = useState<ShadowProfile | null>(initialShadowProfile)
    const [isShadowEditing, setIsShadowEditing] = useState(false)
    const [shadowEditForm, setShadowEditForm] = useState<Partial<ShadowProfile>>({})

    const [saveError, setSaveError] = useState('')
    const [saving, setSaving] = useState(false)
    const [isFetchingLocation, setIsFetchingLocation] = useState(false)

    const handleSignOut = async () => {
        setSigningOut(true)
        await signOut()
        router.push('/auth')
    }

    const fetchLocation = () => {
        if (!navigator.geolocation) {
            setSaveError('Geolocation is not supported by your browser.')
            return
        }

        setIsFetchingLocation(true)
        setSaveError('')

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
                    const data = await response.json()
                    
                    setEditForm(prev => ({ 
                        ...prev, 
                        location_city: data.city || data.locality || '',
                        location_country: data.countryName || ''
                    }))
                } catch (err) {
                    setSaveError('Failed to fetch location details. Please try again.')
                } finally {
                    setIsFetchingLocation(false)
                }
            },
            (err) => {
                setIsFetchingLocation(false)
                setSaveError('Failed to access location: ' + err.message)
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
    }

    const startEditing = () => {
        if (!userProfile) return
        setEditForm({
            location_city: userProfile.location_city || '',
            location_country: userProfile.location_country || '',
            height_cm: userProfile.height_cm,
            habits: { ...userProfile.habits },
            intent: userProfile.intent || '',
        })
        setIsEditing(true)
        setSaveError('')
    }

    const cancelEditing = () => {
        setIsEditing(false)
        setEditForm({})
        setSaveError('')
    }

    const saveChanges = async () => {
        setSaving(true)
        setSaveError('')

        const result = await updateUserProfile(editForm)

        if (result.error) {
            setSaveError(result.error)
            setSaving(false)
        } else {
            setUserProfile(prev => prev ? { ...prev, ...editForm } as UserProfile : null)
            setIsEditing(false)
            setSaving(false)
            router.refresh()
        }
    }

    const startShadowEditing = () => {
        if (!shadowProfile) return
        setShadowEditForm({
            shadow_name: shadowProfile.shadow_name,
            avatar_id: shadowProfile.avatar_id,
            social_energy: shadowProfile.social_energy,
            bio: shadowProfile.bio || '',
            interests: [...(shadowProfile.interests || [])],
            sound_of_week_url: shadowProfile.sound_of_week_url || '',
        })
        setIsShadowEditing(true)
        setSaveError('')
    }

    const cancelShadowEditing = () => {
        setIsShadowEditing(false)
        setShadowEditForm({})
        setSaveError('')
    }

    const saveShadowChanges = async () => {
        setSaving(true)
        setSaveError('')

        const result = await updateShadowProfile(shadowEditForm)

        if (result.error) {
            setSaveError(result.error)
            setSaving(false)
        } else {
            setShadowProfile(prev => prev ? { ...prev, ...shadowEditForm } as ShadowProfile : null)
            setIsShadowEditing(false)
            setSaving(false)
            router.refresh()
        }
    }

    const toggleInterest = (interest: string) => {
        const current = shadowEditForm.interests || []
        if (current.includes(interest)) {
            setShadowEditForm({ ...shadowEditForm, interests: current.filter(i => i !== interest) })
        } else if (current.length < 15) {
            setShadowEditForm({ ...shadowEditForm, interests: [...current, interest] })
        }
    }

    if (!initialShadowProfile) {
        return (
            <div className="page page-with-header">
                <div className={styles['loading-profile']}>
                    <p className="text-muted">Profile not found</p>
                    <button className="btn btn-primary" onClick={() => router.push('/onboarding')}>
                        Complete Onboarding
                    </button>
                    <button onClick={handleSignOut} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
                        Sign Out
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="page page-with-header">
            <div className={styles['profile-page']}>
                <div className={styles['page-header']}>
                    <h1>You</h1>
                </div>
                
                {/* Tabs */}
                <div className={styles.tabs}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'shadow' ? styles.active : ''}`}
                        onClick={() => setActiveTab('shadow')}
                    >
                        Shadow Identity
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'real' ? styles.active : ''}`}
                        onClick={() => setActiveTab('real')}
                    >
                        Real Identity
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'connections' ? styles.active : ''}`}
                        onClick={() => setActiveTab('connections')}
                    >
                        Connections ({initialConnections.length})
                    </button>
                </div>

                {/* Shadow Tab */}
                {activeTab === 'shadow' && shadowProfile && (
                    <div className={styles['profile-card']}>
                        {isShadowEditing ? (
                            <div className={styles['edit-form']}>
                                {saveError && <div className={styles['error-msg']}>{saveError}</div>}
                                
                                <div className={styles['edit-header']}>
                                    <h3>Edit Shadow Identity</h3>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Shadow Name</label>
                                    <input 
                                        className={styles.input} 
                                        value={shadowEditForm.shadow_name || ''}
                                        onChange={e => setShadowEditForm({...shadowEditForm, shadow_name: e.target.value})}
                                        maxLength={20}
                                    />
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Avatar</label>
                                    <div className={styles['avatar-edit-grid']}>
                                        {AVATARS.map(avatar => (
                                            <button 
                                                key={avatar}
                                                className={`${styles['avatar-option']} ${shadowEditForm.avatar_id === avatar ? styles.selected : ''}`}
                                                onClick={() => setShadowEditForm({ ...shadowEditForm, avatar_id: avatar })}
                                            >
                                                {avatar}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Social Energy</label>
                                    <select 
                                        className={styles.input}
                                        value={shadowEditForm.social_energy || ''}
                                        onChange={e => setShadowEditForm({...shadowEditForm, social_energy: e.target.value})}
                                    >
                                        <option value="">Select energy</option>
                                        <option value="introvert">Introvert</option>
                                        <option value="extrovert">Extrovert</option>
                                        <option value="ambivert">Ambivert</option>
                                    </select>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Bio</label>
                                    <textarea 
                                        className={styles.input} 
                                        value={shadowEditForm.bio || ''}
                                        onChange={e => setShadowEditForm({...shadowEditForm, bio: e.target.value.slice(0, 500)})}
                                        maxLength={500}
                                        rows={3}
                                        style={{ resize: 'none' }}
                                    />
                                    <div className="text-small" style={{ textAlign: 'right', marginTop: '4px' }}>{(shadowEditForm.bio || '').length}/500</div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Interests ({shadowEditForm.interests?.length}/15)</label>
                                    <div className={styles['interest-edit-grid']}>
                                        {INTEREST_OPTIONS.map(interest => (
                                            <button 
                                                key={interest}
                                                className={`${styles.chip} ${shadowEditForm.interests?.includes(interest) ? styles.selected : ''}`}
                                                onClick={() => toggleInterest(interest)}
                                            >
                                                {interest}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Sound of the Week (Link)</label>
                                    <input 
                                        className={styles.input} 
                                        value={shadowEditForm.sound_of_week_url || ''}
                                        onChange={e => setShadowEditForm({...shadowEditForm, sound_of_week_url: e.target.value})}
                                        placeholder="Spotify, YouTube, or Apple Music link..."
                                    />
                                </div>

                                <div className={styles.buttons}>
                                    <button className={styles['btn-secondary']} onClick={cancelShadowEditing}>Cancel</button>
                                    <button className={styles['btn-primary']} onClick={saveShadowChanges} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles['edit-header']}>
                                    <div className={styles['profile-avatar']}>{shadowProfile.avatar_id}</div>
                                    <button className={styles['edit-btn']} onClick={startShadowEditing}>
                                        ✏️ Edit
                                    </button>
                                </div>
                                <div className={styles['profile-name']}>{shadowProfile.shadow_name}</div>

                                <div className={styles['profile-badges']}>
                                    {shadowProfile.pronouns && <span className={styles.badge}>{shadowProfile.pronouns}</span>}
                                    {shadowProfile.social_energy && <span className={styles.badge}>{shadowProfile.social_energy}</span>}
                                </div>

                                {shadowProfile.bio && (
                                    <p className={styles['profile-bio']}>&ldquo;{shadowProfile.bio}&rdquo;</p>
                                )}

                                {shadowProfile.interests && shadowProfile.interests.length > 0 && (
                                    <div className={styles['interests-section']}>
                                        <div className={styles['section-label']}>Interests</div>
                                        <div className={styles['interest-tags']}>
                                            {shadowProfile.interests.map((interest) => (
                                                <span key={interest} className={styles['interest-tag']}>{interest}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {shadowProfile.sound_of_week_url && (
                                    <div className={styles['sound-of-week']}>
                                        <div className={styles['section-label']}>Sound of the Week</div>
                                        <MusicPlayer url={shadowProfile.sound_of_week_url} />
                                    </div>
                                )}

                                <div className={styles['profile-actions']}>
                                    <button className={`${styles['action-link']} ${styles.danger}`} onClick={handleSignOut} disabled={signingOut}>
                                        {signingOut ? 'Signing out...' : 'Sign Out'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Saved POVs inside Shadow Tab */}
                        <div className={styles['saved-section']}>
                            <div className={styles['saved-header']}>
                                <h2>Saved POVs</h2>
                                <span className={styles['saved-count']}>{savedCards.length}</span>
                            </div>

                            {savedCards.length === 0 ? (
                                <div className={styles['saved-empty']}>
                                    <div className={styles['saved-empty-icon']}>💾</div>
                                    <p>No saved POVs yet.</p>
                                </div>
                            ) : (
                                <div className={styles['saved-cards-grid']}>
                                    {savedCards.map((card) => {
                                        const tmpl = CARD_TEMPLATES.find((t) => t.id === card.template) || CARD_TEMPLATES[0]
                                        return (
                                            <div key={card.id} className={styles['saved-card']} style={{ background: tmpl.gradient }}>
                                                <div className={styles['saved-card-content']}>{card.content}</div>
                                                <div className={styles['saved-card-meta']}>
                                                    <span className={styles['saved-card-likes']}>{card.likes_count > 0 ? `❤️ ${card.likes_count}` : ''}</span>
                                                    <span className={styles['saved-card-watermark']}>unfold</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Real Tab */}
                {activeTab === 'real' && userProfile && (
                    <div className={styles['profile-card']}>
                        {isEditing ? (
                            <div className={styles['edit-form']}>
                                {saveError && <div className={styles['error-msg']}>{saveError}</div>}
                                
                                <div className={styles['edit-header']}>
                                    <h3>Edit Profile</h3>
                                </div>

                                {/* Read-Only Fields */}
                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Name <span className={styles['locked-icon']}>🔒</span></label>
                                    <div className={styles['read-only-value']}>{userProfile.name}</div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Age <span className={styles['locked-icon']}>🔒</span></label>
                                    <div className={styles['read-only-value']}>
                                        {Math.floor((Date.now() - new Date(userProfile.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Gender <span className={styles['locked-icon']}>🔒</span></label>
                                    <div className={styles['read-only-value']}>{userProfile.gender}</div>
                                </div>

                                {/* Editable Fields */}
                                <div className={styles['form-group']} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className={styles.label}>Location</label>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        onClick={fetchLocation}
                                        disabled={isFetchingLocation}
                                        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                    >
                                        {isFetchingLocation ? <span className="spinner spinner-sm" style={{borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white'}} /> : "📍"} 
                                        {isFetchingLocation ? 'Locating...' : 'Refetch My Location'}
                                    </button>
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>City</label>
                                    <input 
                                        className={styles.input} 
                                        value={editForm.location_city || ''}
                                        readOnly
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                                    />
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Country</label>
                                    <input 
                                        className={styles.input} 
                                        value={editForm.location_country || ''}
                                        readOnly
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                                    />
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>Height (cm)</label>
                                    <input 
                                        type="number"
                                        className={styles.input} 
                                        value={editForm.height_cm || ''}
                                        onChange={e => setEditForm({...editForm, height_cm: parseInt(e.target.value) || undefined})}
                                    />
                                </div>

                                <div className={styles['form-group']}>
                                    <label className={styles.label}>My Intent</label>
                                    <select 
                                        className={styles.input}
                                        value={editForm.intent || ''}
                                        onChange={e => setEditForm({...editForm, intent: e.target.value})}
                                    >
                                        <option value="">Select intent</option>
                                        {INTENT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles['habits-edit-grid']}>
                                    {HABIT_OPTIONS.map(habit => (
                                        <div key={habit.key} className={styles['form-group']}>
                                            <label className={styles.label}>{habit.label}</label>
                                            <select 
                                                className={styles.input}
                                                value={editForm.habits?.[habit.key] || ''}
                                                onChange={e => setEditForm({
                                                    ...editForm, 
                                                    habits: { ...editForm.habits, [habit.key]: e.target.value }
                                                })}
                                            >
                                                <option value="">Select</option>
                                                {habit.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.buttons}>
                                    <button className={styles['btn-secondary']} onClick={cancelEditing}>Cancel</button>
                                    <button className={styles['btn-primary']} onClick={saveChanges} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {userProfile.profile_picture_url && (
                                    <div className={styles['real-avatar-container']}>
                                        <img 
                                            src={userProfile.profile_picture_url} 
                                            alt={userProfile.name} 
                                            className={styles['real-avatar']}
                                        />
                                    </div>
                                )}
                                <div className={styles['edit-header']}>
                                    <div className={styles['profile-name']}>{userProfile.name}, {Math.floor((Date.now() - new Date(userProfile.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}</div>
                                    <button className={styles['edit-btn']} onClick={startEditing}>
                                        ✏️ Edit
                                    </button>
                                </div>

                                <div className="text-muted" style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <span>📍 {userProfile.location_city}, {userProfile.location_country}</span>
                                    <span>•</span>
                                    <span>📏 {userProfile.height_cm}cm</span>
                                </div>

                                {userProfile.voice_note_url && (
                                    <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                                        <div className={styles['section-label']}>Voice Verification</div>
                                        <audio controls src={userProfile.voice_note_url} style={{ width: '100%', height: '32px' }} />
                                    </div>
                                )}

                                <div className={styles['info-grid']}>
                                    <div className={styles['habits-container']}>
                                        <div className={styles['grid-label']}>Habits & Lifestyle</div>
                                        <div className={styles['habits-grid']}>
                                            {HABIT_OPTIONS.map(habit => {
                                                const value = userProfile.habits?.[habit.key]
                                                if (!value) return null
                                                return (
                                                    <div key={habit.key} className={styles['habit-item']}>
                                                        <div className={styles['section-label']} style={{ marginBottom: '4px' }}>{habit.label}</div>
                                                        <div className={styles['habit-value']}>{String(value)}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className={styles['intent-container']}>
                                        <div className={styles['grid-label']}>Intent</div>
                                        <div className={styles['intent-tag']}>
                                            {(() => {
                                                const opt = INTENT_OPTIONS.find(o => o.value === userProfile.intent)
                                                return opt ? `${opt.icon} ${opt.label}` : userProfile.intent?.replace('_', ' ')
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {initialLoveSoul && (
                                    <>
                                        <div className={styles['soul-section']}>
                                            <div className={styles['grid-label']}>Love Soul & Psychology</div>
                                            <div className={styles['soul-grid']}>
                                                <div className={styles['soul-item']}>
                                                    <div className={styles['soul-label']}>Attachment Style</div>
                                                    <div className={styles['soul-value']}>{initialLoveSoul.q1_overwhelmed}</div>
                                                    {initialLoveSoul.attachment_style && <span className={styles['soul-badge']}>{initialLoveSoul.attachment_style}</span>}
                                                </div>
                                                <div className={styles['soul-item']}>
                                                    <div className={styles['soul-label']}>Love Language</div>
                                                    <div className={styles['soul-value']}>{initialLoveSoul.q2_seen_appreciated}</div>
                                                    {initialLoveSoul.love_language && <span className={styles['soul-badge']}>{initialLoveSoul.love_language?.replace(/_/g, ' ')}</span>}
                                                </div>
                                                <div className={styles['soul-item']}>
                                                    <div className={styles['soul-label']}>Conflict Resolution</div>
                                                    <div className={styles['soul-value']}>{initialLoveSoul.q3_disagreement}</div>
                                                    {initialLoveSoul.conflict_style && <span className={styles['soul-badge']}>{initialLoveSoul.conflict_style}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles['final-thoughts']}>
                                            <div className={styles['grid-label']}>Thoughts on Love</div>
                                            <div className={styles['final-quote']}>
                                                {initialLoveSoul.q_final_love}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Connections Tab */}
                {activeTab === 'connections' && (
                    <div className={styles['connections-view']}>
                        <ConnectionsList initialConnections={initialConnections} />
                    </div>
                )}
            </div>
        </div>
    )
}
