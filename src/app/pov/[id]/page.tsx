import { createAdminClient } from '@/lib/supabase/admin'

import Link from 'next/link'
import PovCardComponent from '@/components/pov/PovCard'
import { CARD_TEMPLATES } from '@/lib/constants'
import { Metadata } from 'next'

// This fetch is duplicated from actions/pov-cards because we need it in a Server Component
// and we want to handle the 404/Expired state specifically for this page.
async function getPovCard(id: string) {
    // Use admin client to bypass RLS for public view
    const supabase = createAdminClient()

    // 1. Fetch card first
    const { data: card, error } = await supabase
        .from('pov_cards')
        .select(`
            id,
            creator_id,
            content,
            template,
            created_at,
            expires_at
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching POV:', error)
    }

    if (!card) {
        console.log('POV not found for ID:', id)
        return null
    }

    // Check expiry
    const now = new Date()
    const expiresAt = new Date(card.expires_at)
    if (expiresAt < now) {
        console.log('POV expired:', id, expiresAt, now)
        return 'expired'
    }

    // 2. Fetch shadow profile manually
    const { data: profile } = await supabase
        .from('shadow_profiles')
        .select('shadow_name, avatar_id')
        .eq('id', card.creator_id)
        .single()

    // 3. Combine
    return {
        ...card,
        shadow_profile: profile
    }
}

type Props = {
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const id = (await params).id
    const card: any = await getPovCard(id)

    if (!card || card === 'expired') {
        return {
            title: 'POV Not Found - UnfoldYou',
            description: 'This POV card has expired or does not exist.'
        }
    }

    return {
        title: `POV by ${card.shadow_profile?.shadow_name || 'Anonymous'}`,
        description: card.content.slice(0, 100),
        // We'll add openGraph images later
    }
}

export default async function PovPage({ params }: Props) {
    const id = (await params).id
    const cardData: any = await getPovCard(id)

    if (!cardData || cardData === 'expired') {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#0F0F1A',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ fontSize: '3rem' }}>👻</div>
                <h1>POV Not Found</h1>
                <p style={{ opacity: 0.7 }}>
                    {cardData === 'expired' ? 'This POV has expired.' : 'This POV does not exist.'}
                </p>
                <Link
                    href="/feed"
                    style={{
                        background: '#F97316',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontWeight: 'bold'
                    }}
                >
                    Back to Feed
                </Link>
            </div>
        )
    }

    // Transform to component props format
    const cardProps = {
        ...cardData,
        likes_count: 0, // Not vital for public view
        is_saved: false,
        user_has_liked: false,
        is_own_card: false, // Assume viewer is not owner for public/shared view context initially
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0F1A',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
        }}>
            <div style={{ width: '100%', maxWidth: '500px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <Link href="/feed" style={{ color: 'white', textDecoration: 'none', opacity: 0.7 }}>
                        ← Back to UnfoldYou
                    </Link>
                </div>

                <PovCardComponent card={cardProps} />

                <div style={{ marginTop: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '300px', fontSize: '14px' }}>
                        Join UnfoldYou to connect authentically with {cardData.shadow_profile?.shadow_name || 'this user'} and others.
                    </p>
                    <Link
                        href={`/connect/profile/${cardData.creator_id}`} // Redirect to profile
                        style={{
                            display: 'inline-block',
                            background: '#E85D3A', // Ember brand color
                            color: 'white',
                            border: 'none',
                            padding: '14px 32px',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            boxShadow: '4px 4px 0px #1A1A2E' // Neobrut shadow
                        }}
                    >
                        View Profile
                    </Link>
                    <Link href="/feed" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>
                        Download App
                    </Link>
                </div>
            </div>
        </div>
    )
}
