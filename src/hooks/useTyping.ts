import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface TypingState {
    user_id: string
    is_typing: boolean
    last_typed: number
}

const TYPING_TIMEOUT = 3000

export function useTyping(connectionId: string, currentUserId: string) {
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
    const channelRef = useRef<RealtimeChannel | null>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isTypingRef = useRef(false)

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel(`typing:${connectionId}`)

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState<TypingState>()
                const typing = new Set<string>()

                Object.values(state).forEach(presences => {
                    presences.forEach(p => {
                        if (p.user_id !== currentUserId && p.is_typing) {
                            // Check if not stale (extra safety)
                            if (Date.now() - p.last_typed < TYPING_TIMEOUT + 1000) {
                                typing.add(p.user_id)
                            }
                        }
                    })
                })
                setTypingUsers(typing)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Initial track
                    await channel.track({
                        user_id: currentUserId,
                        is_typing: false,
                        last_typed: Date.now()
                    })
                }
            })

        channelRef.current = channel

        return () => {
            channel.unsubscribe()
        }
    }, [connectionId, currentUserId])

    const setTyping = async (isTyping: boolean) => {
        if (!channelRef.current) return

        // Throttle updates
        if (isTyping === isTypingRef.current && isTyping === false) return

        isTypingRef.current = isTyping

        await channelRef.current.track({
            user_id: currentUserId,
            is_typing: isTyping,
            last_typed: Date.now()
        })
    }

    const handleTyping = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        } else {
            setTyping(true)
        }

        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false)
            typingTimeoutRef.current = null
        }, TYPING_TIMEOUT)
    }

    return {
        typingUsers,
        handleTyping
    }
}
