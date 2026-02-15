'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './onboarding.module.css'

// ==================== CONSTANTS ====================

const TOTAL_STEPS = 6

const AVATARS = [
    '🦊', '🐺', '🦉', '🐙', '🦋',
    '🌙', '🔮', '🌊', '🌸', '⭐',
    '🍀', '🎭', '💎', '🌀', '🪐',
    '🦚', '🐉', '🌿', '🫧', '🔥',
]

const INTEREST_OPTIONS = [
    'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Jazz', 'Classical', 'Electronic', 'Indie',
    'Sci-Fi', 'Romance', 'Thriller', 'Comedy', 'Anime', 'Drama', 'Horror', 'Documentary',
    'Fiction', 'Poetry', 'Self-Help', 'Philosophy',
    'Travel', 'Cooking', 'Gaming', 'Fitness', 'Art', 'Photography', 'Fashion', 'Tech',
    'Nature', 'Astrology', 'Psychology', 'Writing',
]

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

const HABIT_OPTIONS = [
    { key: 'drinking', label: '🍷 Drinking', options: ['Never', 'Socially', 'Regularly'] },
    { key: 'smoking', label: '🚬 Smoking', options: ['Never', 'Sometimes', 'Regularly'] },
    { key: 'fitness', label: '💪 Fitness', options: ['Rarely', 'Sometimes', 'Active', 'Athlete'] },
    { key: 'sleep', label: '😴 Sleep', options: ['Night owl', 'Early bird', 'Flexible'] },
]

const INTENT_OPTIONS = [
    { value: 'playful_spark', icon: '✨', label: 'Playful Spark', desc: 'Light, fun connections' },
    { value: 'find_my_crowd', icon: '🫂', label: 'Find My Crowd', desc: 'Genuine friendships' },
    { value: 'explore_love', icon: '💜', label: 'Explore Love', desc: 'Different perspectives on love' },
    { value: 'something_real', icon: '🌹', label: 'Something Real', desc: 'Deep, meaningful bond' },
]

const Q1_OPTIONS = [
    'Someone to hold space — just be there and listen without fixing anything',
    'Time alone to decompress — I need quiet before I can talk about it',
    'A distraction — take me out, make me laugh, help me forget for a bit',
    `Words of encouragement — remind me I'm capable and this will pass`,
    'Physical comfort — a hug, a hand to hold, just closeness',
]

const Q2_OPTIONS = [
    'Tells me exactly what they appreciate about me — specific words matter',
    'Does something thoughtful without being asked — actions over words',
    'Gives me their undivided time and attention — no phones, just us',
    'Surprises me with something small but meaningful — a note, a song, a gift',
    'Shows affection physically — a touch, a lean-in, being close',
]

const Q3_OPTIONS = [
    'Stand my ground — I need to be heard before I can move on',
    'Smooth things over — I hate tension and want peace quickly',
    'Walk away first — I need space to think before I say something I regret',
    'Try to understand both sides — I look for the middle ground',
    'Get quiet and internalize — I process fights internally before responding',
]

// ==================== TYPES ====================

interface FormData {
    // Real profile
    name: string
    dob: string
    height_cm: string
    gender: string
    location_city: string
    location_country: string
    habits: Record<string, string>
    intent: string
    // Shadow profile
    shadow_name: string
    avatar_id: string
    interests: string[]
    pronouns: string
    social_energy: string
    bio: string
    // Love soul
    q1: string
    q2: string
    q3: string
    q_final: string
}

// ==================== COMPONENT ====================

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const [form, setForm] = useState<FormData>({
        name: '',
        dob: '',
        height_cm: '',
        gender: '',
        location_city: '',
        location_country: '',
        habits: {},
        intent: '',
        shadow_name: '',
        avatar_id: '🦊',
        interests: [],
        pronouns: '',
        social_energy: '',
        bio: '',
        q1: '',
        q2: '',
        q3: '',
        q_final: '',
    })

    const updateForm = (key: keyof FormData, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        setError('')
    }

    const toggleInterest = (interest: string) => {
        setForm((prev) => {
            const interests = prev.interests.includes(interest)
                ? prev.interests.filter((i) => i !== interest)
                : prev.interests.length < 15
                    ? [...prev.interests, interest]
                    : prev.interests
            return { ...prev, interests }
        })
    }

    const updateHabit = (key: string, value: string) => {
        setForm((prev) => ({
            ...prev,
            habits: { ...prev.habits, [key]: value },
        }))
    }

    // ============ VALIDATION ============

    const validateStep = (): boolean => {
        switch (step) {
            case 1:
                if (!form.name.trim()) { setError('Name is required'); return false }
                if (!form.dob) { setError('Date of birth is required'); return false }
                const age = Math.floor((Date.now() - new Date(form.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                if (age < 18) { setError('You must be 18 or older'); return false }
                if (!form.gender) { setError('Please select your gender'); return false }
                return true
            case 2:
                if (!form.intent) { setError('Please choose your intent'); return false }
                return true
            case 3:
                if (!form.shadow_name.trim()) { setError('Shadow name is required'); return false }
                if (form.shadow_name.length < 3) { setError('Shadow name must be at least 3 characters'); return false }
                return true
            case 4:
                if (form.interests.length < 3) { setError('Pick at least 3 interests'); return false }
                return true
            case 5:
                if (!form.q1) { setError('Please answer the question'); return false }
                if (!form.q2) { setError('Please answer the question'); return false }
                if (!form.q3) { setError('Please answer the question'); return false }
                return true
            case 6:
                if (!form.q_final.trim()) { setError('Please share your thoughts on love'); return false }
                if (form.q_final.trim().length < 20) { setError('Tell us a bit more (at least 20 characters)'); return false }
                return true
            default:
                return true
        }
    }

    const nextStep = () => {
        if (!validateStep()) return
        setStep((s) => Math.min(s + 1, TOTAL_STEPS + 1))
        setError('')
    }

    const prevStep = () => {
        setStep((s) => Math.max(s - 1, 1))
        setError('')
    }

    // ============ SUBMIT ============

    const handleSubmit = async () => {
        if (!validateStep()) return

        setLoading(true)
        setError('')

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Determine psychology types from answers
            const attachmentMap: Record<string, string> = {
                [Q1_OPTIONS[0]]: 'anxious',
                [Q1_OPTIONS[1]]: 'avoidant',
                [Q1_OPTIONS[2]]: 'avoidant',
                [Q1_OPTIONS[3]]: 'secure',
                [Q1_OPTIONS[4]]: 'anxious',
            }

            const loveLanguageMap: Record<string, string> = {
                [Q2_OPTIONS[0]]: 'words_of_affirmation',
                [Q2_OPTIONS[1]]: 'acts_of_service',
                [Q2_OPTIONS[2]]: 'quality_time',
                [Q2_OPTIONS[3]]: 'gifts',
                [Q2_OPTIONS[4]]: 'physical_touch',
            }

            const conflictMap: Record<string, string> = {
                [Q3_OPTIONS[0]]: 'competing',
                [Q3_OPTIONS[1]]: 'accommodating',
                [Q3_OPTIONS[2]]: 'avoiding',
                [Q3_OPTIONS[3]]: 'collaborating',
                [Q3_OPTIONS[4]]: 'compromising',
            }

            // Insert real profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    name: form.name.trim(),
                    dob: form.dob,
                    height_cm: form.height_cm ? parseInt(form.height_cm) : null,
                    gender: form.gender,
                    location_city: form.location_city.trim() || null,
                    location_country: form.location_country.trim() || null,
                    habits: form.habits,
                    intent: form.intent,
                    onboarding_complete: true,
                })

            if (profileError) throw profileError

            // Insert shadow profile
            const { error: shadowError } = await supabase
                .from('shadow_profiles')
                .upsert({
                    id: user.id,
                    shadow_name: form.shadow_name.trim(),
                    avatar_id: form.avatar_id,
                    interests: form.interests,
                    pronouns: form.pronouns || null,
                    social_energy: form.social_energy || null,
                    bio: form.bio.trim() || null,
                })

            if (shadowError) throw shadowError

            // Insert love soul
            const { error: soulError } = await supabase
                .from('love_soul')
                .upsert({
                    id: user.id,
                    q1_overwhelmed: form.q1,
                    q2_seen_appreciated: form.q2,
                    q3_disagreement: form.q3,
                    q_final_love: form.q_final.trim(),
                    attachment_style: attachmentMap[form.q1] || null,
                    love_language: loveLanguageMap[form.q2] || null,
                    conflict_style: conflictMap[form.q3] || null,
                })

            if (soulError) throw soulError

            // Show success for a moment
            setStep(TOTAL_STEPS + 1)
            setTimeout(() => router.push('/feed'), 2000)
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ============ RENDER STEPS ============

    const renderStep = () => {
        switch (step) {
            // Step 1: Basic Info
            case 1:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 1 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Let&apos;s start with you</h2>
                            <p className={styles['step-description']}>
                                This info stays private until you choose to unfold.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            <div className="input-group">
                                <label className="input-label">Name</label>
                                <input
                                    className="input"
                                    placeholder="Your real name"
                                    value={form.name}
                                    onChange={(e) => updateForm('name', e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className={styles['field-row']}>
                                <div className="input-group">
                                    <label className="input-label">Date of birth</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.dob}
                                        onChange={(e) => updateForm('dob', e.target.value)}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Height (cm)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="170"
                                        value={form.height_cm}
                                        onChange={(e) => updateForm('height_cm', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Gender</label>
                                <select
                                    className={styles['select-input']}
                                    value={form.gender}
                                    onChange={(e) => updateForm('gender', e.target.value)}
                                >
                                    <option value="">Select gender</option>
                                    {GENDER_OPTIONS.map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles['field-row']}>
                                <div className="input-group">
                                    <label className="input-label">City</label>
                                    <input
                                        className="input"
                                        placeholder="Your city"
                                        value={form.location_city}
                                        onChange={(e) => updateForm('location_city', e.target.value)}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Country</label>
                                    <input
                                        className="input"
                                        placeholder="Country"
                                        value={form.location_country}
                                        onChange={(e) => updateForm('location_country', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )

            // Step 2: Habits & Intent
            case 2:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 2 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Your vibe</h2>
                            <p className={styles['step-description']}>
                                What are your habits, and why are you here?
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            {HABIT_OPTIONS.map((habit) => (
                                <div key={habit.key} className="input-group">
                                    <label className="input-label">{habit.label}</label>
                                    <div className={styles['chip-container']}>
                                        {habit.options.map((opt) => (
                                            <button
                                                key={opt}
                                                className={`${styles.chip} ${form.habits[habit.key] === opt ? styles.selected : ''}`}
                                                onClick={() => updateHabit(habit.key, opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="input-group">
                                <label className="input-label">Why are you here?</label>
                                <div className={styles['intent-grid']}>
                                    {INTENT_OPTIONS.map((intent) => (
                                        <button
                                            key={intent.value}
                                            className={`${styles['intent-card']} ${form.intent === intent.value ? styles.selected : ''}`}
                                            onClick={() => updateForm('intent', intent.value)}
                                        >
                                            <span className={styles['intent-icon']}>{intent.icon}</span>
                                            <div className={styles['intent-info']}>
                                                <strong>{intent.label}</strong>
                                                <span>{intent.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )

            // Step 3: Shadow Profile
            case 3:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 3 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Your shadow</h2>
                            <p className={styles['step-description']}>
                                Create your anonymous identity. This is how others see you first.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            <div className="input-group">
                                <label className="input-label">Shadow name</label>
                                <input
                                    className="input"
                                    placeholder="Pick a mysterious name..."
                                    value={form.shadow_name}
                                    onChange={(e) => updateForm('shadow_name', e.target.value)}
                                    maxLength={20}
                                    autoFocus
                                />
                                <span className="text-small">{form.shadow_name.length}/20</span>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Choose your avatar</label>
                                <div className={styles['avatar-grid']}>
                                    {AVATARS.map((avatar) => (
                                        <button
                                            key={avatar}
                                            className={`${styles['avatar-option']} ${form.avatar_id === avatar ? styles.selected : ''}`}
                                            onClick={() => updateForm('avatar_id', avatar)}
                                        >
                                            {avatar}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles['field-row']}>
                                <div className="input-group">
                                    <label className="input-label">Pronouns</label>
                                    <select
                                        className={styles['select-input']}
                                        value={form.pronouns}
                                        onChange={(e) => updateForm('pronouns', e.target.value)}
                                    >
                                        <option value="">Optional</option>
                                        <option value="he/him">he/him</option>
                                        <option value="she/her">she/her</option>
                                        <option value="they/them">they/them</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Energy</label>
                                    <select
                                        className={styles['select-input']}
                                        value={form.social_energy}
                                        onChange={(e) => updateForm('social_energy', e.target.value)}
                                    >
                                        <option value="">Optional</option>
                                        <option value="introvert">Introvert</option>
                                        <option value="extrovert">Extrovert</option>
                                        <option value="ambivert">Ambivert</option>
                                    </select>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Bio</label>
                                <textarea
                                    className="input"
                                    placeholder="A glimpse into your shadow self..."
                                    value={form.bio}
                                    onChange={(e) => updateForm('bio', e.target.value.slice(0, 150))}
                                    rows={3}
                                    style={{ resize: 'none', minHeight: '80px' }}
                                />
                                <span className="text-small">{form.bio.length}/150</span>
                            </div>
                        </div>
                    </>
                )

            // Step 4: Interests
            case 4:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 4 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>What moves you?</h2>
                            <p className={styles['step-description']}>
                                Pick 3–15 interests that define your world.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            <div className={styles['chip-counter']}>
                                {form.interests.length}/15 selected
                            </div>
                            <div className={styles['chip-container']}>
                                {INTEREST_OPTIONS.map((interest) => (
                                    <button
                                        key={interest}
                                        className={`${styles.chip} ${form.interests.includes(interest) ? styles.selected : ''}`}
                                        onClick={() => toggleInterest(interest)}
                                    >
                                        {interest}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )

            // Step 5: Psychology questions
            case 5:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 5 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Your love soul</h2>
                            <p className={styles['step-description']}>
                                These reveal how you connect. There are no wrong answers.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            {/* Q1 */}
                            <div className={styles['psych-card']}>
                                <p className={styles['psych-question']}>
                                    &ldquo;When I&apos;ve had a terrible day or feel overwhelmed, I usually need...&rdquo;
                                </p>
                                <div className={styles['psych-options']}>
                                    {Q1_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            className={`${styles['psych-option']} ${form.q1 === opt ? styles.selected : ''}`}
                                            onClick={() => updateForm('q1', opt)}
                                        >
                                            <div className={styles['psych-radio']} />
                                            <span>{opt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q2 */}
                            <div className={styles['psych-card']}>
                                <p className={styles['psych-question']}>
                                    &ldquo;I feel most seen and appreciated when someone...&rdquo;
                                </p>
                                <div className={styles['psych-options']}>
                                    {Q2_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            className={`${styles['psych-option']} ${form.q2 === opt ? styles.selected : ''}`}
                                            onClick={() => updateForm('q2', opt)}
                                        >
                                            <div className={styles['psych-radio']} />
                                            <span>{opt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q3 */}
                            <div className={styles['psych-card']}>
                                <p className={styles['psych-question']}>
                                    &ldquo;In a disagreement or a fight, my instinct is to...&rdquo;
                                </p>
                                <div className={styles['psych-options']}>
                                    {Q3_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            className={`${styles['psych-option']} ${form.q3 === opt ? styles.selected : ''}`}
                                            onClick={() => updateForm('q3', opt)}
                                        >
                                            <div className={styles['psych-radio']} />
                                            <span>{opt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )

            // Step 6: Final love question
            case 6:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Final question</div>
                            <h2 className={styles['step-title']}>What is love to you?</h2>
                            <p className={styles['step-description']}>
                                No right answer. Just yours.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            <div className={styles['psych-card']}>
                                <textarea
                                    className={styles['love-textarea']}
                                    placeholder="Love is..."
                                    value={form.q_final}
                                    onChange={(e) => updateForm('q_final', e.target.value.slice(0, 300))}
                                />
                                <div className={`${styles['char-count']} ${form.q_final.length > 280 ? styles.danger :
                                    form.q_final.length > 250 ? styles.warning : ''
                                    }`}>
                                    {form.q_final.length}/300
                                </div>
                            </div>
                        </div>
                    </>
                )

            // Completion
            default:
                return (
                    <div className={styles.completion}>
                        <div className={styles['completion-icon']}>🦋</div>
                        <h2>You&apos;re ready to unfold</h2>
                        <p>Your shadow awaits. Time to express yourself.</p>
                        <div className="spinner spinner-lg" />
                    </div>
                )
        }
    }

    return (
        <div className={styles.onboarding}>
            {/* Progress bar */}
            {step <= TOTAL_STEPS && (
                <div className={styles['progress-bar']}>
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                        <div
                            key={i}
                            className={`${styles['progress-segment']} ${i + 1 === step ? styles.active :
                                i + 1 < step ? styles.completed : ''
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Step content */}
            {renderStep()}

            {/* Error */}
            {error && (
                <div className="error-text" style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
                    {error}
                </div>
            )}

            {/* Navigation */}
            {step <= TOTAL_STEPS && (
                <div className={styles['step-nav']}>
                    {step > 1 && (
                        <button className="btn btn-secondary" onClick={prevStep}>
                            Back
                        </button>
                    )}
                    {step < TOTAL_STEPS ? (
                        <button className="btn btn-primary" onClick={nextStep}>
                            Continue
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? <span className="spinner" /> : 'Enter UnfoldYou'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
