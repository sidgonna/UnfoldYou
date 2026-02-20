'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { fetchChatData, sendMessage, fetchMessages, markMessagesRead, type Message, type ChatData } from '@/lib/actions/messages'
import { requestUnfold, fetchRevealedData, submitStageConsent, fetchConsentStatus } from '@/lib/actions/unfold'
import { createClient } from '@/lib/supabase/client'
import RevealProgressBar from '@/components/chat/RevealProgressBar'
import RevealMilestonePopup from '@/components/chat/RevealMilestonePopup'
import UnfoldRequestModal from '@/components/chat/UnfoldRequestModal'
import PartnerProfileModal from '@/components/chat/PartnerProfileModal'
import CodeEntryModal from '@/components/connect/CodeEntryModal'
import { respondToConnectionRequest } from '@/lib/actions/connections'

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
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [showCodeEntry, setShowCodeEntry] = useState(false)
    const [responding, setResponding] = useState(false)

    const [reportModalOpen, setReportModalOpen] = useState(false)
    const [prevStage, setPrevStage] = useState<string>('')
    const [consentStatus, setConsentStatus] = useState<any>(null)
    const [lastConsentRequest, setLastConsentRequest] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

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
                    setChatData(prev => prev ? {
                        ...prev,
                        connection: { ...prev.connection, ...updated }
                    } : prev)
                    
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

    async function handleRequestResponse(action: 'accept' | 'decline') {
        if (responding) return
        setResponding(true)
        const result = await respondToConnectionRequest(connectionId, action)
        if (result.error) {
            alert(result.error)
            setResponding(false)
        } else {
            // Realtime listener will catch the status change
            if (action === 'decline') {
                router.push('/chat')
            } else {
                setResponding(false)
                router.refresh()
            }
        }
    }

    const handleCodeSuccess = (cid: string) => {
        setShowCodeEntry(false)
        router.refresh()
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
    const displayAvatar = isAnonymous 
        ? <span className={styles.headerAvatarText}>{otherUser.avatar_id}</span>
        : (otherUser.profile_photo 
            ? <img src={otherUser.profile_photo} alt="Avatar" className={styles.headerAvatarImg} />
            : <span className={styles.headerAvatarText}>{otherUser.avatar_id}</span>
          )

    // Group messages
    const messageGroups = groupMessagesByDate(messages)
    const isSomeoneTyping = typingUsers.size > 0

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.push('/chat')}>←</button>
                
                {/* Clickable Profile Area */}
                <div 
                    className={styles.headerProfile} 
                    onClick={() => setShowProfileModal(true)}
                    role="button"
                    tabIndex={0}
                >
                    <div className={styles.headerAvatarWrapper}>
                        {displayAvatar}
                    </div>
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
                    isTestConnection={(chatData as any).isTestConnection}
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
                                            {mounted && new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

            {/* Request Response CTA */}
            {connection.status === 'pending' && connection.recipient_id === currentUserId && (
                <div className={styles.responseBar}>
                    {connection.request_message && (
                        <div className={styles.requestMessageDisplay}>
                            &ldquo;{connection.request_message}&rdquo;
                        </div>
                    )}
                    <div className={styles.responseText}>
                        {connection.connection_type === 'stranger' ? (
                            <><strong>{otherUser.shadow_name}</strong> wants to connect anonymously.</>
                        ) : (
                            <><strong>{otherUser.shadow_name}</strong> shared a connection code with you.</>
                        )}
                    </div>
                    <div className={styles.responseActions}>
                        <button 
                            className={styles.declineAction} 
                            onClick={() => handleRequestResponse('decline')}
                            disabled={responding}
                        >
                            Decline
                        </button>
                        <button 
                            className={styles.profileAction}
                            onClick={() => setShowProfileModal(true)}
                        >
                            View Profile
                        </button>
                        {connection.connection_type === 'known' ? (
                            <button 
                                className={styles.acceptAction}
                                onClick={() => setShowCodeEntry(true)}
                                disabled={responding}
                            >
                                Enter Code
                            </button>
                        ) : (
                            <button 
                                className={styles.acceptAction}
                                onClick={() => handleRequestResponse('accept')}
                                disabled={responding}
                            >
                                {responding ? 'Accepting...' : 'Accept ✓'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Waiting for acceptance for sender */}
            {connection.status === 'pending' && connection.requester_id === currentUserId && (
                <div className={styles.waitingBar}>
                    <div className={styles.waitingText}>
                        Waiting for <strong>{otherUser.shadow_name}</strong> to accept your request.
                    </div>
                    {connection.request_message && (
                        <div className={styles.requestMessageDisplay}>
                            &ldquo;{connection.request_message}&rdquo;
                        </div>
                    )}
                    <button 
                        className={styles.profileAction}
                        onClick={() => setShowProfileModal(true)}
                        style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                    >
                        View Profile
                    </button>
                </div>
            )}

            {/* Input - Hidden if pending */}
            {connection.status === 'accepted' && (
                <div className={styles.inputBar}>
                    <textarea
                        ref={(el) => {
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
                        autoFocus
                    />
                    <button
                        className={styles.sendBtn}
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                    >
                        →
                    </button>
                </div>
            )}

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

            {/* Partner Profile Modal */}
            {showProfileModal && chatData && (
                <PartnerProfileModal
                    onClose={() => setShowProfileModal(false)}
                    shadowProfile={{
                        shadow_name: otherUser.shadow_name,
                        avatar_id: otherUser.avatar_id,
                        pronouns: otherUser.pronouns,
                        social_energy: otherUser.social_energy,
                        bio: otherUser.bio,
                        interests: otherUser.interests || []
                    }}
                    realProfile={{
                        real_name: otherUser.real_name,
                        profile_photo: otherUser.profile_photo,
                        age: otherUser.age,
                        height: otherUser.height,
                        location: otherUser.location,
                        voice_note_url: otherUser.voice_note_url,
                        intent: otherUser.intent,
                        habits: otherUser.habits
                    }}
                    revealStage={connection.reveal_stage}
                    isKnownConnect={connection.connection_type === 'known'}
                />
            )}

            {/* Code Entry Modal */}
            {showCodeEntry && (
                <CodeEntryModal
                    connectionId={connectionId}
                    requesterName={otherUser.shadow_name}
                    onClose={() => setShowCodeEntry(false)}
                    onSuccess={handleCodeSuccess}
                />
            )}
        </div>
    )
}
