import { type Message } from '@/lib/actions/messages'

export interface MessageGroup {
    dateLabel: string
    messages: Message[]
}

export function groupMessagesByDate(messages: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {}

    messages.forEach(msg => {
        const date = new Date(msg.created_at)
        // YYYY-MM-DD key for sorting
        const key = date.toISOString().split('T')[0]

        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(msg)
    })

    // Sort keys (ISO strings sort naturally)
    const sortedKeys = Object.keys(groups).sort()

    return sortedKeys.map(key => ({
        dateLabel: formatDateLabel(key),
        messages: groups[key]
    }))
}

function formatDateLabel(isoDateString: string): string {
    // Parse YYYY-MM-DD parts to avoid timezone shift on parsing
    const [year, month, day] = isoDateString.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day)

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (targetDate.getTime() === today.getTime()) {
        return 'Today'
    }
    if (targetDate.getTime() === yesterday.getTime()) {
        return 'Yesterday'
    }

    if (targetDate.getFullYear() === today.getFullYear()) {
        return targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    return targetDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
