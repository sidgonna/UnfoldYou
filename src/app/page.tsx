import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import styles from './landing.module.css'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/feed')
  }

  return (
    <div className={styles.landing}>
      <div className={styles.hero}>
        <h1 className={styles.brand}>unfold</h1>
        <p className={styles.tagline}>
          Express <strong>anonymously</strong>.<br />
          Connect <strong>psychologically</strong>.<br />
          Unfold <strong>authentically</strong>.
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles['feature-icon']}>🎭</div>
            <div className={styles['feature-text']}>
              <strong>Shadow Identity</strong>
              Be yourself without the pressure of being yourself
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles['feature-icon']}>💜</div>
            <div className={styles['feature-text']}>
              <strong>Love Soul</strong>
              Psychology-driven compatibility, not just appearances
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles['feature-icon']}>✨</div>
            <div className={styles['feature-text']}>
              <strong>Progressive Reveal</strong>
              Earn real connections through genuine conversation
            </div>
          </div>
        </div>

        <div className={styles['cta-wrapper']}>
          <Link href="/auth" className="btn btn-primary btn-full btn-lg">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  )
}
