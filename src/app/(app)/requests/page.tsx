import { Suspense } from 'react'
import { fetchPendingRequests } from '@/lib/actions/connections'
import RequestsList from './RequestsList'

export default async function RequestsPage() {
    const requestsResult = await fetchPendingRequests()

    const incomingRequests = requestsResult.data?.incoming || []
    const outgoingRequests = requestsResult.data?.outgoing || []

    return (
        <Suspense fallback={<div className="page p-8 text-center">Loading requests...</div>}>
            <RequestsList 
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
            />
        </Suspense>
    )
}
