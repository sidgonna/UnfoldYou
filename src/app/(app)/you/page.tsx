import { fetchShadowProfile, fetchUserProfile, fetchLoveSoul } from '@/lib/actions/profile'
import { fetchSavedCards } from '@/lib/actions/pov-cards'
import { fetchConnections } from '@/lib/actions/connections'
import ProfileView from './ProfileView'

export default async function YouPage() {
    const [shadowResult, userResult, soulResult, cardsResult, connectionsResult] = await Promise.all([
        fetchShadowProfile(),
        fetchUserProfile(),
        fetchLoveSoul(),
        fetchSavedCards(),
        fetchConnections(false), // don't need last message
    ])

    const initialShadowProfile = shadowResult.data || null
    const initialUserProfile = userResult.data || null
    const initialLoveSoul = soulResult.data || null
    const initialSavedCards = (cardsResult.data || []) as any[]
    const initialConnections = connectionsResult.data || []

    return (
        <ProfileView 
            initialShadowProfile={initialShadowProfile} 
            initialUserProfile={initialUserProfile}
            initialLoveSoul={initialLoveSoul}
            initialSavedCards={initialSavedCards} 
            initialConnections={initialConnections}
        />
    )
}
