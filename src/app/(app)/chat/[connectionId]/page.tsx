'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { fetchChatData, sendMessage, fetchMessages, markMessagesRead, type Message, type ChatData } from '@/lib/actions/messages'
import { requestUnfold, fetchRevealedData, submitStageConsent, fetchConsentStatus } from '@/lib/actions/unfold'
import { createClient } from '@/lib/supabase/client'
import RevealProgressBar from '@/components/chat/RevealProgressBar'
import RevealMilestonePopup from '@/components/chat/RevealMilestonePopup'
import UnfoldRequestModal from '@/components/chat/UnfoldRequestModal'
import ReportModal from '@/components/safety/ReportModal'
import { useTyping } from '@/hooks/useTyping'
import { groupMessagesByDate } from '@/lib/utils/chat'
import styles from './chatroom.module.css'

export default function ChatRoomPage() {
    const router = useRouter()
    const params = useParams()
    const connectionId = params.connectionId as string

    const [chatData, setChatData] = useState<ChatData | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [showMilestone, setShowMilestone] = useState<string | null>(null)
    const [milestoneData, setMilestoneData] = useState<Record<string, unknown> | null>(null)
    const [showUnfold, setShowUnfold] = useState(false)
    const [reportModalOpen, setReportModalOpen] = useState(false)
    const [prevStage, setPrevStage] = useState<string>('')
    const [consentStatus, setConsentStatus] = useState<any>(null)
    const [lastConsentRequest, setLastConsentRequest] = useState<string | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const lastMessageIdRef = useRef<string | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    // Typing hook
    const currentUserId = chatData?.currentUserId || ''
    const { typingUsers, handleTyping } = useTyping(connectionId, currentUserId)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    // Auto-scroll on new messages (and initial load)
    useEffect(() => {
        if (loading || messages.length === 0) return

        const lastMsg = messages[messages.length - 1]

        // Only scroll if the *latest* message is different from what we saw last time
        if (lastMsg.id !== lastMessageIdRef.current) {
            lastMessageIdRef.current = lastMsg.id
            setTimeout(scrollToBottom, 100)
        }
    }, [messages, loading, scrollToBottom])

    // Initial load
    useEffect(() => {
        async function load() {
            const result = await fetchChatData(connectionId)
            if (result.error || !result.data) {
                router.push('/chat')
                return
            }
            setChatData(result.data)
            setMessages(result.data.messages)
            setPrevStage(result.data.connection.reveal_stage)
            
            // Initial consent fetch
            if (result.data.connection.connection_type === 'stranger') {
                const consentRes = await fetchConsentStatus(connectionId)
                if (consentRes.data) {
                    setConsentStatus(consentRes.data.consent_status)
                    setLastConsentRequest(consentRes.data.last_consent_request)
                }
            }
            
            setLoading(false)

            // Mark as read
            await markMessagesRead(connectionId)
        }
        load()
    }, [connectionId, router])

    // Refs for stable access inside effect
    const prevStageRef = useRef<string>(prevStage)
    const currentUserIdRef = useRef<string>(currentUserId)

    useEffect(() => {
        prevStageRef.current = prevStage
    }, [prevStage])

    useEffect(() => {
        currentUserIdRef.current = currentUserId
    }, [currentUserId])

    // Realtime subscription
    useEffect(() => {
        if (!connectionId || !currentUserId) return

        const supabase = createClient()
        const channel = supabase
            .channel(`chat:${connectionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `connection_id=eq.${connectionId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        // Deduplicate
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })

                    // Mark as read if from other user
                    if (newMsg.sender_id !== currentUserIdRef.current) {
                        markMessagesRead(connectionId)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `connection_id=eq.${connectionId}`,
                },
                (payload) => {
                    const updatedMsg = payload.new as Message
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m))
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'connections',
                    filter: `id=eq.${connectionId}`,
                },
                async (payload) => {
                    const updated = payload.new as ChatData['connection']
                    setChatData(prev => prev ? { ...prev, connection: updated } : prev)
                    
                    // Update consent status locally from payload if present
                    if ((updated as any).consent_status) {
                        setConsentStatus((updated as any).consent_status)
                    }
                    if ((updated as any).last_consent_request) {
                        setLastConsentRequest((updated as any).last_consent_request)
                    }

                    // Check for reveal stage change using ref
                    if (updated.reveal_stage !== prevStageRef.current) {
                        const revealResult = await fetchRevealedData(connectionId, updated.reveal_stage)
                        if (revealResult.data) {
                            setMilestoneData(revealResult.data.data)
                            setShowMilestone(updated.reveal_stage)
                        }
                        setPrevStage(updated.reveal_stage)
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [connectionId, currentUserId])

    // Send message
    async function handleSend() {
        if (!input.trim() || sending) return

        setSending(true)
        const result = await sendMessage(connectionId, input.trim())
        if (!result.error && result.data) {
            setMessages(prev => {
                if (prev.some(m => m.id === result.data!.id)) return prev
                return [...prev, result.data!]
            })
            setInput('')
            // Restore focus to input to keep keyboard up
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
        }
        setSending(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Load more (older) messages
    async function loadOlderMessages() {
        if (loadingMore || !hasMore || messages.length === 0) return
        setLoadingMore(true)

        const cursor = messages[0].created_at
        const result = await fetchMessages(connectionId, cursor, 50)
        const older = result.data || []

        if (older.length < 50) setHasMore(false)
        if (older.length > 0) {
            setMessages(prev => [...older, ...prev])
        }

        setLoadingMore(false)
    }

    // Unfold request
    async function handleUnfold() {
        const result = await requestUnfold(connectionId)
        if (result.data?.status === 'unfolded') {
            // Reload chat data for full profile
            const refreshed = await fetchChatData(connectionId)
            if (refreshed.data) {
                setChatData(refreshed.data)
            }
        }
        setShowUnfold(false)
    }

    // Handle Stage Unlock Request
    async function handleUnlockRequest(stage: string) {
        // Optimistic update? Maybe complex with 2 users. 
        // Let's just call server and let realtime update update UI
        const result = await submitStageConsent(connectionId, stage, 'accept')
        if (result.error) {
            alert(result.error) // Simple alert for now, toast better later
        }
    }

    if (loading || !chatData) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className="spinner" />
                </div>
            </div>
        )
    }

    const { connection, otherUser } = chatData
    const isAnonymous = connection.connection_type === 'stranger' && connection.reveal_stage !== 'unfold'
    const canUnfold = connection.reveal_stage === 'soul'
    const displayName = isAnonymous ? otherUser.shadow_name : (otherUser.real_name || otherUser.shadow_name)
    const displayAvatar = isAnonymous ? otherUser.avatar_id : (otherUser.profile_photo ? '📷' : otherUser.avatar_id)

    // Group messages
    const messageGroups = groupMessagesByDate(messages)
    const isSomeoneTyping = typingUsers.size > 0

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.push('/chat')}>←</button>
                <span className={styles.headerAvatar}>{displayAvatar}</span>
                <div className={styles.headerInfo}>
                    <span className={styles.headerName}>{displayName}</span>
                    {isSomeoneTyping ? (
                        <span className={styles.typingIndicator}>typing...</span>
                    ) : (
                        isAnonymous && (
                            <span className={styles.headerStage}>
                                {connection.reveal_stage}
                            </span>
                        )
                    )}
                </div>
                {canUnfold && (
                    <button className={styles.unfoldBtn} onClick={() => setShowUnfold(true)}>
                        🦋
                    </button>
                )}
                <button
                    onClick={() => setReportModalOpen(true)}
                    className={styles.backBtn} // reusing simple btn style or add new one
                    style={{ fontSize: '1.2rem', marginLeft: '8px', opacity: 0.7 }}
                    title="Report User"
                >
                    🚩
                </button>
            </div>

            <ReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                userId={otherUser.id}
                shadowName={otherUser.shadow_name}
            />

            {/* Reveal progress bar (anonymous only) */}
            {isAnonymous && (
                <RevealProgressBar
                    currentStage={connection.reveal_stage}
                    messageCount={connection.message_count}
                    onUnlockRequest={handleUnlockRequest}
                    consentStatus={consentStatus}
                    currentUserId={currentUserId}
                    lastConsentRequest={lastConsentRequest}
                />
            )}

            {/* Messages */}
            <div className={styles.messages} ref={messagesContainerRef}>
                {hasMore && (
                    <button className={styles.loadMore} onClick={loadOlderMessages} disabled={loadingMore}>
                        {loadingMore ? 'Loading...' : 'Load older messages'}
                    </button>
                )}

                {messageGroups.map((group) => (
                    <Fragment key={group.dateLabel}>
                        <div className={styles.dateSeparator}>{group.dateLabel}</div>
                        {group.messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.bubble} ${msg.message_type === 'system' ? styles.system :
                                    msg.sender_id === currentUserId ? styles.mine : styles.theirs
                                    }`}
                            >
                                {msg.message_type === 'system' ? (
                                    <span className={styles.systemText}>{msg.content}</span>
                                ) : (
                                    <>
                                        <span className={styles.bubbleText}>{msg.content}</span>
                                        <div className={styles.bubbleTime}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.sender_id === currentUserId && (
                                                <span className={`${styles.readReceipt} ${msg.is_read ? styles.read : ''}`}>
                                                    {msg.is_read ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </Fragment>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={styles.inputBar}>
                <textarea
                    ref={(el) => {
                        // Focus on mount for desktop, but maybe not mobile to avoid jumpiness
                        // But for now, just keep the ref
                        if (el && !inputRef.current) {
                            inputRef.current = el
                        }
                    }}
                    className={styles.textarea}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value)
                        handleTyping()
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    // Don't disable input to keep focus/keyboard up
                    // disabled={sending} 
                    autoFocus
                />
                <button
                    className={styles.sendBtn}
                    onMouseDown={(e) => e.preventDefault()} // Prevent button from stealing focus
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                >
                    →
                </button>
            </div>

            {/* Milestone Popup */}
            {showMilestone && (
                <RevealMilestonePopup
                    stage={showMilestone}
                    revealedData={milestoneData}
                    onClose={() => {
                        setShowMilestone(null)
                        setMilestoneData(null)
                    }}
                />
            )}

            {/* Unfold Modal */}
            {showUnfold && (
                <UnfoldRequestModal
                    shadowName={otherUser.shadow_name}
                    onConfirm={handleUnfold}
                    onClose={() => setShowUnfold(false)}
                />
            )}
        </div>
    )
}
