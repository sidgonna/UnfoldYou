import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { CARD_TEMPLATES } from '@/lib/constants'

export const runtime = 'edge'

export const alt = 'UnfoldYou POV'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    console.log('[OG] Generating for ID:', id)

    const supabase = createAdminClient()

    // 1. Fetch card first
    const { data: card, error: cardError } = await supabase
        .from('pov_cards')
        .select('content, template, creator_id')
        .eq('id', id)
        .single()

    if (cardError || !card) {
        console.error('[OG] Card fetch error:', cardError)
        // Fallback below
    } else {
        // 2. Fetch profile manually
        const { data: profile } = await supabase
            .from('shadow_profiles')
            .select('shadow_name, avatar_id')
            .eq('id', card.creator_id) // Correct: id is the PK (user_id)
            .single()

            // Attach profile to card object for rendering
            ; (card as any).shadow_profile = profile
    }

    // Handle error/missing card via existing fallback
    const error = cardError

    if (error) {
        console.error('[OG] Supabase Error:', error)
    }
    if (!card) {
        console.error('[OG] No card data found for ID:', id)
    }

    const template = CARD_TEMPLATES.find(t => t.id === card?.template) || CARD_TEMPLATES[0]
    const safeCard = card as any // Cast to any to avoid TS errors for injected shadow_profile

    // Fallback if card not found
    if (!card) {
        return new ImageResponse(
            (
                <div
                    style={{
                        background: '#0F0F1A',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                    }}
                >
                    <div style={{ fontSize: 60, marginBottom: 20 }}>👻</div>
                    <div style={{ fontSize: 40, fontWeight: 'bold' }}>POV Not Found</div>
                </div>
            ),
            { ...size }
        )
    }

    // Since gradients in OG images can sometimes be tricky or behave differently 
    // with different CSS engines (Satori), we use a safe linear-gradient style.
    // The templates in constants.ts use standard CSS syntax which generally works well with Satori.

    return new ImageResponse(
        (
            <div
                style={{
                    background: '#0F0F1A', // Dark background behind card
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                }}
            >
                {/* Card Container simulating the look of the actual card */}
                <div
                    style={{
                        background: template.gradient,
                        width: '100%',
                        maxWidth: '800px', // Constrain width for aesthetics
                        height: 'auto',
                        minHeight: '400px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '48px',
                        borderRadius: '32px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        position: 'relative',
                        color: 'white',
                    }}
                >
                    {/* Header: Avatar + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '48px' }}>
                            {Array.isArray(safeCard.shadow_profile) ? safeCard.shadow_profile[0]?.avatar_id : (safeCard.shadow_profile as any)?.avatar_id || '🎭'}
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', opacity: 0.9 }}>
                            {Array.isArray(safeCard.shadow_profile) ? safeCard.shadow_profile[0]?.shadow_name : (safeCard.shadow_profile as any)?.shadow_name || 'Anonymous'}
                        </div>
                    </div>

                    {/* Content */}
                    <div
                        style={{
                            fontSize: card.content.length > 150 ? '36px' : '48px',
                            fontWeight: '600',
                            lineHeight: 1.4,
                            marginTop: '40px',
                            marginBottom: '40px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word', // Important for long words
                        }}
                    >
                        {card.content}
                    </div>

                    {/* Footer: Branding */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div
                            style={{
                                fontSize: '24px',
                                fontWeight: 'bold',
                                opacity: 0.3,
                                letterSpacing: '4px',
                                textTransform: 'uppercase',
                            }}
                        >
                            unfold
                        </div>
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            // We could load fonts here if we had them as assets, 
            // but default sans-serif is safer for now without external fetch.
        }
    )
}
