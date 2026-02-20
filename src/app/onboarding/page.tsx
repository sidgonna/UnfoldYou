'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './onboarding.module.css'
import { CARD_TEMPLATES, HABIT_OPTIONS, INTENT_OPTIONS, AVATARS, INTEREST_OPTIONS } from '@/lib/constants'
import { OnboardingStep1Schema, OnboardingStep4Schema } from '@/lib/validators/onboarding'
import { saveMedia, getMedia, clearMedia } from '@/lib/utils/onboarding-db'

// ==================== CONSTANTS ====================

const TOTAL_STEPS = 7

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

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
    // Media
    profile_photo_file: File | null
    voice_note_blob: Blob | null
    sound_of_week_url: string
}

// ==================== COMPONENT ====================

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
        profile_photo_file: null,
        voice_note_blob: null,
        sound_of_week_url: '',
    })

    const [isFetchingLocation, setIsFetchingLocation] = useState(false)

    // ============ PERSISTENCE ============
    // Load progress on mount
    useEffect(() => {
        const savedStep = localStorage.getItem('unfoldyou_onboarding_step')
        const savedForm = localStorage.getItem('unfoldyou_onboarding_form')

        if (savedStep) {
            setStep(parseInt(savedStep))
        }
        if (savedForm) {
            try {
                const parsed = JSON.parse(savedForm)
                // Filter out null/undefined to avoid wiping defaults if something went wrong
                const filtered = Object.fromEntries(
                    Object.entries(parsed).filter(([_, v]) => v !== null && v !== undefined)
                )
                setForm(prev => ({ ...prev, ...filtered }))
            } catch (e) {
                console.error('Failed to parse saved onboarding form:', e)
            }
        }

        // Restore Media from IndexedDB
        const restoreMedia = async () => {
            try {
                const photo = await getMedia('profile_photo');
                if (photo) {
                    setForm(prev => ({ ...prev, profile_photo_file: photo as File }));
                    setPreviewUrl(URL.createObjectURL(photo));
                }
                const voice = await getMedia('voice_note');
                if (voice) {
                    setForm(prev => ({ ...prev, voice_note_blob: voice }));
                    setAudioUrl(URL.createObjectURL(voice));
                }
            } catch (err) {
                console.error('Failed to restore media from IndexedDB:', err);
            }
        };
        restoreMedia();
    }, [])

    // Save progress on change
    useEffect(() => {
        if (step > 1) {
            localStorage.setItem('unfoldyou_onboarding_step', step.toString())
        }
        // Don't save files/blobs to localStorage
        const { profile_photo_file, voice_note_blob, ...persistableForm } = form
        localStorage.setItem('unfoldyou_onboarding_form', JSON.stringify(persistableForm))
    }, [step, form])

    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    const updateForm = (key: keyof FormData, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        setError('')
        setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    }

    const renderFieldError = (key: string) => {
        if (!fieldErrors[key]) return null
        return <span className="error-text" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{fieldErrors[key]}</span>
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

    // ============ MEDIA HELPERS ============

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            if (file.size > 5 * 1024 * 1024) {
                setError('Photo too large (max 5MB)')
                return
            }
            setForm(prev => ({ ...prev, profile_photo_file: file }))
            setPreviewUrl(URL.createObjectURL(file))
            saveMedia('profile_photo', file).catch(console.error)
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            
            // iOS/Safari compatibility: check supported types
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
                ? 'audio/mp4' 
                : 'audio/webm';
            
            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
                setForm(prev => ({ ...prev, voice_note_blob: audioBlob }))
                setAudioUrl(URL.createObjectURL(audioBlob))
                saveMedia('voice_note', audioBlob).catch(console.error)
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch (err) {
            console.error('Mic error:', err)
            setError('Could not access microphone')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        }
    }

    const deleteRecording = () => {
        setForm(prev => ({ ...prev, voice_note_blob: null }))
        setAudioUrl(null)
        audioChunksRef.current = []
        // Optional: clear from IDB too, or just let overwrite handle it
    }

    const fetchLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.')
            return
        }

        setIsFetchingLocation(true)
        setError('')

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
                    const data = await response.json()
                    
                    updateForm('location_city', data.city || data.locality || '')
                    updateForm('location_country', data.countryName || '')
                } catch (err) {
                    setError('Failed to fetch location details. Please try again.')
                } finally {
                    setIsFetchingLocation(false)
                }
            },
            (err) => {
                setIsFetchingLocation(false)
                setError('Failed to access location: ' + err.message)
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
    }

    const uploadFile = async (bucket: string, file: File | Blob, name: string) => {
        const fileExt = bucket === 'voice_notes' 
            ? (file.type.includes('mp4') ? 'mp4' : 'webm')
            : (file as File).name.split('.').pop()
        const fileName = `${name}-${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
        return data.publicUrl
    }

    const validateStep = (): boolean => {
        setFieldErrors({})
        setError('')
        
        switch (step) {
            case 1: {
                const result = OnboardingStep1Schema.safeParse({
                    name: form.name,
                    dob: form.dob,
                    height_cm: form.height_cm,
                    gender: form.gender,
                    location_city: form.location_city,
                    location_country: form.location_country,
                })
                
                if (!result.success) {
                    const errors: Record<string, string> = {}
                    result.error.issues.forEach(issue => {
                        const path = issue.path[0] as string
                        if (!errors[path]) errors[path] = issue.message
                    })
                    setFieldErrors(errors)
                    setError('Please fix the errors below')
                    return false
                }
                return true
            }
            case 2: {
                const errors: Record<string, string> = {}
                if (!form.profile_photo_file) errors.profile_photo = 'Profile photo is required'
                if (!form.voice_note_blob) errors.voice_note = 'Voice note is required'
                if (Object.keys(errors).length > 0) {
                    setFieldErrors(errors)
                    setError('Please upload your photo and record a voice whisper to continue')
                    return false
                }
                return true
            }
            case 3:
                if (!form.intent) { setError('Please choose your intent'); return false }
                if (Object.keys(form.habits).length < 4) { setError('Please select an option for all habits'); return false }
                return true
            case 4: {
                const result = OnboardingStep4Schema.safeParse({
                    shadow_name: form.shadow_name,
                    bio: form.bio,
                    avatar_id: form.avatar_id,
                    social_energy: form.social_energy,
                    sound_of_week_url: form.sound_of_week_url,
                })

                if (!result.success) {
                    const errors: Record<string, string> = {}
                    result.error.issues.forEach(issue => {
                        const path = issue.path[0] as string
                        if (!errors[path]) errors[path] = issue.message
                    })
                    setFieldErrors(errors)
                    setError('Please fix the errors below')
                    return false
                }
                return true
            }
            case 5:
                if (form.interests.length < 3) { setError('Pick at least 3 interests'); return false }
                return true
            case 6: {
                const errors: Record<string, string> = {}
                if (!form.q1) errors.q1 = 'Please answer this question'
                if (!form.q2) errors.q2 = 'Please answer this question'
                if (!form.q3) errors.q3 = 'Please answer this question'
                if (Object.keys(errors).length > 0) {
                    setFieldErrors(errors)
                    return false
                }
                return true
            }
            case 7:
                if (!form.q_final.trim() || form.q_final.trim().length < 20) {
                    setError(form.q_final.trim().length < 20 ? 'Tell us a bit more (at least 20 characters)' : 'Please share your thoughts on love')
                    return false
                }
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

            // Upload Media
            let profilePhotoUrl = null
            let voiceNoteUrl = null

            if (form.profile_photo_file) {
                profilePhotoUrl = await uploadFile('avatars', form.profile_photo_file, `profile-${user.id}`)
            }

            if (form.voice_note_blob) {
                voiceNoteUrl = await uploadFile('voice_notes', form.voice_note_blob, `voice-${user.id}`)
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
                    profile_picture_url: profilePhotoUrl,
                    voice_note_url: voiceNoteUrl,
                    habits: form.habits,
                    intent: form.intent,
                    onboarding_complete: true,
                })

            if (profileError) throw profileError

            // Derive pronouns from gender
            const genderToPronouns: Record<string, string> = {
                'Male': 'he/him',
                'Female': 'she/her',
                'Non-binary': 'they/them'
            }
            const derivedPronouns = genderToPronouns[form.gender] || form.pronouns || null

            // Insert shadow profile
            const { error: shadowError } = await supabase
                .from('shadow_profiles')
                .upsert({
                    id: user.id,
                    shadow_name: form.shadow_name.trim(),
                    avatar_id: form.avatar_id,
                    interests: form.interests,
                    pronouns: derivedPronouns,
                    social_energy: form.social_energy,
                    bio: form.bio.trim(),
                    sound_of_week_url: form.sound_of_week_url,
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

            // Clear progress on success
            localStorage.removeItem('unfoldyou_onboarding_step')
            localStorage.removeItem('unfoldyou_onboarding_form')
            clearMedia().catch(console.error)

            // Show success for a moment
            setStep(TOTAL_STEPS + 1)
            setTimeout(() => router.push('/feed'), 2000)
        } catch (err: any) {
            console.error('Onboarding Submission Error:', err)
            // Handle specific Supabase "Failed to fetch" which can happen on network/tunnel issues
            if (err.message === 'Failed to fetch') {
                setError('Network error: Could not connect to the database. Please check your connection or try again in a moment.')
            } else {
                setError(err.message || 'Something went wrong. Please try again.')
            }
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
                                    className={`input ${fieldErrors.name ? 'input-error' : ''}`}
                                    placeholder="Your real name"
                                    value={form.name}
                                    onChange={(e) => updateForm('name', e.target.value)}
                                    autoFocus
                                    required
                                    pattern="^[a-zA-Z\s\-']+$"
                                    minLength={2}
                                    maxLength={50}
                                />
                                {renderFieldError('name')}
                            </div>

                            <div className={styles['field-row']}>
                                <div className="input-group">
                                    <label className="input-label">Date of birth</label>
                                    <input
                                        type="date"
                                        className={`input ${fieldErrors.dob ? 'input-error' : ''}`}
                                        value={form.dob}
                                        onChange={(e) => updateForm('dob', e.target.value)}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                        required
                                    />
                                    {renderFieldError('dob')}
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Height (cm)</label>
                                    <input
                                        type="number"
                                        className={`input ${fieldErrors.height_cm ? 'input-error' : ''}`}
                                        placeholder="170"
                                        value={form.height_cm}
                                        onChange={(e) => updateForm('height_cm', e.target.value)}
                                        min={50}
                                        max={300}
                                        required
                                    />
                                    {renderFieldError('height_cm')}
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Gender</label>
                                <select
                                    className={`${styles['select-input']} ${fieldErrors.gender ? 'input-error' : ''}`}
                                    value={form.gender}
                                    onChange={(e) => updateForm('gender', e.target.value)}
                                    required
                                >
                                    <option value="">Select gender</option>
                                    {GENDER_OPTIONS.map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                                {renderFieldError('gender')}
                            </div>

                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-primary" 
                                    onClick={fetchLocation}
                                    disabled={isFetchingLocation}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                >
                                    {isFetchingLocation ? <span className="spinner spinner-sm" style={{borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white'}} /> : "📍"} 
                                    {isFetchingLocation ? 'Locating...' : 'Fetch My Location'}
                                </button>
                                <p className="text-small" style={{ marginTop: '0.5rem', opacity: 0.7 }}>We use this to verify your region. Prevents fake locations.</p>
                            </div>

                            <div className={styles['field-row']}>
                                <div className="input-group">
                                    <label className="input-label">City</label>
                                    <input
                                        className={`input ${fieldErrors.location_city ? 'input-error' : ''}`}
                                        placeholder="City (Auto-filled)"
                                        value={form.location_city}
                                        readOnly
                                        required
                                        onClick={() => !form.location_city && setError('Please use "Fetch My Location" button')}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                                    />
                                    {renderFieldError('location_city')}
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Country</label>
                                    <input
                                        className={`input ${fieldErrors.location_country ? 'input-error' : ''}`}
                                        placeholder="Country (Auto-filled)"
                                        value={form.location_country}
                                        readOnly
                                        required
                                        onClick={() => !form.location_country && setError('Please use "Fetch My Location" button')}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                                    />
                                    {renderFieldError('location_country')}
                                </div>
                            </div>
                        </div>
                    </>
                )

            // Step 2: Media (NEW)
            case 2:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 2 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Real Identity Media</h2>
                            <p className={styles['step-description']}>
                                Only shown when you Unfold or Whisper.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            {/* Profile Photo */}
                            <div className="input-group">
                                <label className="input-label">Profile Photo (for Unfold)</label>
                                <div className={`${styles.mediaUpload} ${fieldErrors.profile_photo ? styles.error : ''}`}>
                                    {previewUrl ? (
                                        <div className={styles.previewContainer}>
                                            <img src={previewUrl} alt="Preview" className={styles.photoPreview} />
                                            <button 
                                                className={styles.removeBtn}
                                                onClick={() => {
                                                    setForm(p => ({ ...p, profile_photo_file: null }))
                                                    setPreviewUrl(null)
                                                }}
                                            >×</button>
                                        </div>
                                    ) : (
                                        <label className={styles.uploadBtn}>
                                            <span>📸 Upload Photo</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handlePhotoUpload}
                                                hidden 
                                            />
                                        </label>
                                    )}
                                </div>
                                {renderFieldError('profile_photo')}
                            </div>

                            {/* Voice Note */}
                            <div className="input-group">
                                <label className="input-label">Voice Note (for Whisper)</label>
                                <p className={styles.helperText}>&ldquo;Describe your perfect Sunday morning...&rdquo;</p>
                                
                                <div className={`${styles.voiceControls} ${fieldErrors.voice_note ? styles.error : ''}`}>
                                    {!isRecording && !audioUrl && (
                                        <button className={styles.recordBtn} onClick={startRecording}>
                                            🎙️ Record
                                        </button>
                                    )}
                                    
                                    {isRecording && (
                                        <button className={`${styles.recordBtn} ${styles.recording}`} onClick={stopRecording}>
                                            ⏹️ Stop Recording...
                                        </button>
                                    )}

                                    {audioUrl && (
                                        <div className={styles.audioPreview}>
                                            <audio src={audioUrl} controls />
                                            <button className={styles.trashBtn} onClick={deleteRecording} type="button">🗑️</button>
                                        </div>
                                    )}
                                </div>
                                {renderFieldError('voice_note')}
                            </div>
                        </div>
                    </>
                )

            // Step 3: Habits & Intent
            case 3:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 3 of {TOTAL_STEPS}</div>
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

            // Step 4: Shadow Profile
            case 4:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 4 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Your shadow</h2>
                            <p className={styles['step-description']}>
                                Create your anonymous identity. This is how others see you first.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            <div className="input-group">
                                <label className="input-label">Shadow name</label>
                                <input
                                    className={`input ${fieldErrors.shadow_name ? 'input-error' : ''}`}
                                    placeholder="Pick a mysterious name..."
                                    value={form.shadow_name}
                                    onChange={(e) => updateForm('shadow_name', e.target.value)}
                                    maxLength={20}
                                    minLength={3}
                                    required
                                    autoFocus
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    {renderFieldError('shadow_name')}
                                    <span className="text-small">{form.shadow_name.length}/20</span>
                                </div>
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

                            <div className="input-group">
                                <label className="input-label">Social Energy (required)</label>
                                <select
                                    className={`${styles['select-input']} ${fieldErrors.social_energy ? 'input-error' : ''}`}
                                    value={form.social_energy}
                                    onChange={(e) => updateForm('social_energy', e.target.value)}
                                    required
                                >
                                    <option value="">Select your energy</option>
                                    <option value="introvert">Introvert</option>
                                    <option value="extrovert">Extrovert</option>
                                    <option value="ambivert">Ambivert</option>
                                </select>
                                {renderFieldError('social_energy')}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Bio (required)</label>
                                <textarea
                                    className={`input ${fieldErrors.bio ? 'input-error' : ''}`}
                                    placeholder="A glimpse into your shadow self..."
                                    value={form.bio}
                                    onChange={(e) => updateForm('bio', e.target.value.slice(0, 500))}
                                    maxLength={500}
                                    rows={3}
                                    style={{ resize: 'none', minHeight: '80px' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    {renderFieldError('bio')}
                                    <span className="text-small">{form.bio.length}/500</span>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Sound of the Week (Link required)</label>
                                <input
                                    className={`input ${fieldErrors.sound_of_week_url ? 'input-error' : ''}`}
                                    placeholder="Spotify, YouTube, or Apple Music link..."
                                    value={form.sound_of_week_url}
                                    onChange={(e) => updateForm('sound_of_week_url', e.target.value)}
                                    required
                                />
                                {renderFieldError('sound_of_week_url')}
                            </div>
                        </div>
                    </>
                )

            // Step 5: Interests
            case 5:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 5 of {TOTAL_STEPS}</div>
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

            // Step 6: Psychology questions
            case 6:
                return (
                    <>
                        <div className={styles['step-header']}>
                            <div className={styles['step-label']}>Step 6 of {TOTAL_STEPS}</div>
                            <h2 className={styles['step-title']}>Your love soul</h2>
                            <p className={styles['step-description']}>
                                These reveal how you connect. There are no wrong answers.
                            </p>
                        </div>
                        <div className={styles['step-content']}>
                            {/* Q1 */}
                            <div className={`${styles['psych-card']} ${fieldErrors.q1 ? styles.error : ''}`}>
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
                                {renderFieldError('q1')}
                            </div>

                            {/* Q2 */}
                            <div className={`${styles['psych-card']} ${fieldErrors.q2 ? styles.error : ''}`}>
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
                                {renderFieldError('q2')}
                            </div>

                            {/* Q3 */}
                            <div className={`${styles['psych-card']} ${fieldErrors.q3 ? styles.error : ''}`}>
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
                                {renderFieldError('q3')}
                            </div>
                        </div>
                    </>
                )

            // Step 7: Final love question
            case 7:
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
                            <div className={`${styles['psych-card']} ${fieldErrors.q_final ? styles.error : ''}`}>
                                <textarea
                                    className={styles['love-textarea']}
                                    placeholder="Love is..."
                                    value={form.q_final}
                                    onChange={(e) => updateForm('q_final', e.target.value.slice(0, 300))}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-xs)' }}>
                                    {renderFieldError('q_final')}
                                    <div className={`${styles['char-count']} ${form.q_final.length > 280 ? styles.danger :
                                        form.q_final.length > 250 ? styles.warning : ''
                                        }`}>
                                        {form.q_final.length}/300
                                    </div>
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
