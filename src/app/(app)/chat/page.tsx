import { fetchConnections, fetchPendingRequests } from '@/lib/actions/connections'
import ChatList from './ChatList'

export default async function ChatPage() {
    const [connectionsResult, requestsResult] = await Promise.all([
        fetchConnections(true),
        fetchPendingRequests(),
    ])

    const initialConversations = connectionsResult.data || []
    const incomingRequests = requestsResult.data?.incoming || []

    return (
        <ChatList 
            initialConversations={initialConversations} 
            incomingRequests={incomingRequests}
        />
    )
}
