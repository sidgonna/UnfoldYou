
import { fetchFeedCards } from '@/lib/actions/pov-cards'
import FeedList from './FeedList'
import styles from './feed.module.css'

// Server Component
export default async function FeedPage() {
    // Determine user via cookie-based auth in server action
    const result = await fetchFeedCards(0, 50)
    const initialCards = result.data || []

    return <FeedList initialCards={initialCards} />
}
