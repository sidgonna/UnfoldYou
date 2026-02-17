'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './auth.module.css'

type AuthStep = 'email' | 'otp' | 'success'

export default function AuthPage() {
    const [step, setStep] = useState<AuthStep>('email')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [countdown, setCountdown] = useState(0)
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const sendOtp = async () => {
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                },
            })

            if (error) throw error

            setStep('otp')
            setCountdown(60)
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const verifyOtp = async () => {
        const otpString = otp.join('')
        if (otpString.length !== 6) {
            setError('Please enter the complete 6-digit code')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otpString,
                type: 'email',
            })

            if (error) throw error

            setStep('success')

            // Ensure session is fully established
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            if (sessionError || !session) throw new Error('Session not established. Please try again.')

            // Helper to fetch profile with retry
            const fetchProfile = async (retries = 3, delay = 500) => {
                for (let i = 0; i < retries; i++) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('onboarding_complete')
                        .eq('id', session.user.id)
                        .single()
                    
                    if (!error) return data
                    if (error.code !== 'PGRST116') {
                        console.error('Profile fetch error:', error)
                    }
                    if (i < retries - 1) await new Promise(r => setTimeout(r, delay))
                }
                return null
            }

            const profile = await fetchProfile()

            setTimeout(() => {
                if (profile?.onboarding_complete) {
                    router.push('/feed')
                } else {
                    router.push('/onboarding')
                }
            }, 1000)
        } catch (err: any) {
            console.error('Verify error:', err)
            setError(err.message || 'Invalid code. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, '').slice(0, 6).split('')
            const newOtp = [...otp]
            digits.forEach((d, i) => {
                if (index + i < 6) newOtp[index + i] = d
            })
            setOtp(newOtp)
            const nextIndex = Math.min(index + digits.length, 5)
            otpRefs.current[nextIndex]?.focus()
            return
        }

        if (!/^\d*$/.test(value)) return

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
        if (e.key === 'Enter' && otp.join('').length === 6) {
            verifyOtp()
        }
    }

    const resendOtp = async () => {
        if (countdown > 0) return
        await sendOtp()
    }

    return (
        <div className={styles['auth-page']}>
            <div className={styles['auth-content']}>
                {/* Logo */}
                <div className={styles['auth-logo']}>
                    <h1>unfold</h1>
                    <p>Express anonymously. Connect psychologically. Unfold authentically.</p>
                </div>

                {/* Auth Card */}
                <div className={styles['auth-card']}>
                    {step === 'email' && (
                        <div className={styles['auth-form']}>
                            <div>
                                <h2 className={styles['auth-title']}>Welcome</h2>
                                <p className={styles['auth-subtitle']}>
                                    Enter your email to get started. No passwords needed.
                                </p>
                            </div>

                            <div className="input-group">
                                <label className="input-label" htmlFor="email">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className={`input ${error ? 'input-error' : ''}`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        setError('')
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                                    autoFocus
                                    autoComplete="email"
                                />
                                {error && <span className="error-text">{error}</span>}
                            </div>

                            <button
                                className="btn btn-primary btn-full"
                                onClick={sendOtp}
                                disabled={loading || !email}
                            >
                                {loading ? (
                                    <span className="spinner" />
                                ) : (
                                    'Continue with Email'
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'otp' && (
                        <div className={styles['auth-form']}>
                            <div>
                                <h2 className={styles['auth-title']}>Check your inbox</h2>
                                <p className={styles['auth-subtitle']}>
                                    We sent a 6-digit code to<br />
                                    <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                                </p>
                            </div>

                            <div className={styles['otp-inputs']}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => { otpRefs.current[index] = el }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className={styles['otp-input']}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>

                            {error && (
                                <span className="error-text" style={{ textAlign: 'center' }}>
                                    {error}
                                </span>
                            )}

                            <button
                                className="btn btn-primary btn-full"
                                onClick={verifyOtp}
                                disabled={loading || otp.join('').length !== 6}
                            >
                                {loading ? <span className="spinner" /> : 'Verify Code'}
                            </button>

                            <button
                                className={styles['resend-btn']}
                                onClick={resendOtp}
                                disabled={countdown > 0}
                            >
                                {countdown > 0
                                    ? `Resend code in ${countdown}s`
                                    : 'Resend code'}
                            </button>

                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setStep('email')
                                    setOtp(['', '', '', '', '', ''])
                                    setError('')
                                }}
                                style={{ alignSelf: 'center' }}
                            >
                                ← Change email
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className={styles['auth-form']} style={{ alignItems: 'center' }}>
                            <div className={styles['success-icon']}>✓</div>
                            <h2 className={styles['auth-title']}>You&apos;re in!</h2>
                            <p className={styles['auth-subtitle']}>
                                Setting up your space...
                            </p>
                            <div className="spinner spinner-lg" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className={styles['auth-footer']}>
                    By continuing, you agree to UnfoldYou&apos;s Terms of Service
                    and Privacy Policy
                </p>
            </div>
        </div>
    )
}
