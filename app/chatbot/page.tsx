"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { handleScriptedInput } from "@/lib/demoScript"
import TypingIndicator from "@/components/TypingIndicator"
import {
  Menu,
  X,
  Pencil,
  User,
  Settings,
  LogOut,
  LogIn,
  Search,
  History,
  Save,
  Plus,
  Loader2,
  Trash2,
  Download,
  FileDown,
  CircleHelp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { useRouter } from "next/navigation"
import {
  createChatSession,
  renameChatSession,
  addMessageToChat,
  setChatMessages,
  Message as ChatMessage,
  ChatSession,
  getUserChatSessions,
  deleteChatSession,
  getLastActiveChatId,
  setLastActiveChatId,
  loadMessagesForChat,
} from "@/lib/chat-service"
import { apiFetch, getBackendUrl } from "@/lib/backendApi"
import { canGuestGenerate, incrementGuestGenerationsUsed, FREE_GUEST_GENERATIONS } from "@/lib/guest-limits"
import { profileCountryMissing } from "@/lib/meProfile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useClairvynOnboarding } from "@/hooks/useClairvynOnboarding"
import { WaitlistModal } from "@/components/WaitlistModal"

/** Shown while waiting for an assistant turn; phases follow elapsed time; line changes every 20–30s. */
const ASSISTANT_STATUS_PHASES: readonly (readonly string[])[] = [
  [
    "Interpreting your requirements",
    "Mapping spatial constraints",
    "Translating inputs into layout logic",
    "Defining room relationships",
  ],
  [
    "Generating initial floorplan structure",
    "Optimizing room placements for flow",
    "Aligning walls and dimensions",
    "Ensuring structural feasibility",
    "Calculating circulation efficiency",
    "Adjusting proportions for usability",
    "Eliminating wasted space",
  ],
  [
    "Positioning doors and entry points",
    "Placing windows for light and ventilation",
    "Arranging furniture for functionality",
    "Balancing private and common areas",
    "Refining layout for real-world use",
  ],
  [
    "Running final layout checks",
    "Fine-tuning spatial alignment",
    "Preparing clean 2D output",
    "Almost ready",
  ],
]

/** Phase boundaries (ms from start): start 0–2m, then mid, detail, final until done. */
const ASSISTANT_PHASE_END_MS = [120_000, 300_000, 420_000] as const

type FeedbackType = "positive" | "negative"
type FeedbackCategory =
  | "layout_accuracy"
  | "speed"
  | "ease_of_use"
  | "output_quality"
  | "layout_incorrect"
  | "missing_rooms_elements"
  | "unrealistic_dimensions"
  | "not_following_prompt"
  | "too_slow"
  | "hard_to_edit"
type FeedbackSeverity = "slight_issue" | "usable_with_edits" | "completely_unusable"

const POSITIVE_FEEDBACK_OPTIONS: ReadonlyArray<{ id: FeedbackCategory; label: string }> = [
  { id: "layout_accuracy", label: "Layout accuracy" },
  { id: "speed", label: "Speed" },
  { id: "ease_of_use", label: "Ease of use" },
  { id: "output_quality", label: "Output quality" },
]

const NEGATIVE_FEEDBACK_OPTIONS: ReadonlyArray<{ id: FeedbackCategory; label: string }> = [
  { id: "layout_incorrect", label: "Layout incorrect" },
  { id: "missing_rooms_elements", label: "Missing rooms/elements" },
  { id: "unrealistic_dimensions", label: "Unrealistic dimensions" },
  { id: "not_following_prompt", label: "Not following prompt" },
  { id: "too_slow", label: "Too slow" },
  { id: "hard_to_edit", label: "Hard to edit" },
]

const NEGATIVE_SEVERITY_OPTIONS: ReadonlyArray<{ id: FeedbackSeverity; label: string }> = [
  { id: "slight_issue", label: "Slight issue" },
  { id: "usable_with_edits", label: "Usable with edits" },
  { id: "completely_unusable", label: "Completely unusable" },
]

type MessageFeedbackState = {
  feedbackType?: FeedbackType
  category?: FeedbackCategory
  severity?: FeedbackSeverity
  submitted?: boolean
  alreadySubmitted?: boolean
  error?: string | null
}

function assistantPhaseIndex(elapsedMs: number): number {
  if (elapsedMs < ASSISTANT_PHASE_END_MS[0]) return 0
  if (elapsedMs < ASSISTANT_PHASE_END_MS[1]) return 1
  if (elapsedMs < ASSISTANT_PHASE_END_MS[2]) return 2
  return 3
}

/** Fetches image with Bearer token and displays via blob URL (for auth-protected backend images). */
function AuthImage({
  src,
  alt,
  className,
  getToken,
}: {
  src: string
  alt: string
  className?: string
  getToken: () => Promise<string | null>
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  useEffect(() => {
    if (!src) return
    let cancelled = false
    setError(false)
    getTokenRef
      .current()
      .then((token) => {
        if (!token || cancelled) return
        return fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      })
      .then((res) => {
        if (!res?.ok || cancelled) {
          if (res && !res.ok) setError(true)
          return null
        }
        return res!.blob()
      })
      .then((blob) => {
        if (!blob || cancelled) return
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setObjectUrl(url)
      })
      .catch(() => !cancelled && setError(true))

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setObjectUrl(null)
    }
  }, [src])

  if (error) return <span className={className}>Failed to load image</span>
  if (!objectUrl) return <span className={className}>Loading...</span>
  return <img src={objectUrl} alt={alt} className={className} />
}

export default function ChatbotPage() {
  const { user, logout, loading: authLoading, getIdToken, isGuest } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // used for mobile drawer

  const { startTutorial } = useClairvynOnboarding({
    authLoading,
    userUid: user?.uid,
    isGuest,
    setIsSidebarOpen,
  })
  const [hasPaid, setHasPaid] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  const normalizeImageUrl = (value: unknown): string | null => {
    if (typeof value !== "string" || value.trim().length === 0) return null
    const normalized = value.trim()
    return normalized.startsWith("/") ? getBackendUrl(normalized) : normalized
  }

  const getProfileImageFromMe = (data: any): string | null => {
    if (!data || typeof data !== "object") return null
    const explicitPhotoUrl = normalizeImageUrl(data.photo_url)
    if (explicitPhotoUrl) return explicitPhotoUrl

    const possible = [
      data.photoURL,
      data.profile_image_url,
      data.profileImageUrl,
      data.avatar_url,
      data.avatarUrl,
      data.image_url,
      data.imageUrl,
      data.picture,
    ]
    const url = possible.find((value) => normalizeImageUrl(value))
    return normalizeImageUrl(url)
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin")
    }
  }, [user, authLoading, router])

  // Fetch has_paid / profile image; require backend profile country for signed-in (non-guest) users
  useEffect(() => {
    if (!user) {
      setHasPaid(false)
      setProfileImageUrl(null)
      return
    }
    let cancelled = false
    getIdToken().then((token) => {
      if (!token || cancelled) return
      fetch(getBackendUrl("/api/me"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          console.log("[Clairvyn] /api/me user details:", data)
          if (!isGuest && profileCountryMissing(data.profile)) {
            router.replace("/onboarding/profile")
            return
          }
          if (typeof data.has_paid === "boolean") setHasPaid(data.has_paid)
          const backendPhoto = getProfileImageFromMe(data)
          console.log("[Clairvyn] resolved sidebar profile image:", backendPhoto ?? user.photoURL ?? null)
          setProfileImageUrl(backendPhoto ?? user.photoURL ?? null)
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [user, isGuest, getIdToken, router])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [placeholderText, setPlaceholderText] = useState("Design a Floor-plan for a 3BHK House")
  const [isFirstSubmit, setIsFirstSubmit] = useState<boolean>(true)

  // Helper function for demo script
  const addMessage = (msg: any) => setMessages(prev => [...prev, msg])
  const [isPencilHovered, setIsPencilHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  /** True only while waiting for POST /turn (not e.g. new chat creation). */
  const [isTurnInFlight, setIsTurnInFlight] = useState(false)
  const [assistantStatusLine, setAssistantStatusLine] = useState(
    ASSISTANT_STATUS_PHASES[0][0]
  )
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [backendChatId, setBackendChatId] = useState<string | null>(null)
  const [showGuestBanner, setShowGuestBanner] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedbackState>>({})
  const [feedbackSubmittingByMessage, setFeedbackSubmittingByMessage] = useState<Record<string, boolean>>({})
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  // Chat history state (integrated into sidebar)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const getFeedbackKey = (message: ChatMessage, index: number): string => {
    const id = (message as any)?.id
    return id != null ? String(id) : `idx-${index}`
  }

  const isGeneratedAssistantMessage = (message: ChatMessage): boolean => {
    if (message.role !== "assistant") return false
    const extra = (message as any).extra_data
    return Boolean(extra?.document_id || extra?.png_url)
  }

  useEffect(() => {
    if (!isTurnInFlight) return

    const start = Date.now()
    const lastPhaseRef = { current: 0 }
    const msgIndexRef = { current: 0 }

    const applyNextLine = () => {
      const elapsed = Date.now() - start
      const phase = assistantPhaseIndex(elapsed)
      const messages = ASSISTANT_STATUS_PHASES[phase]

      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase
        msgIndexRef.current = 0
      } else {
        msgIndexRef.current = (msgIndexRef.current + 1) % messages.length
      }

      setAssistantStatusLine(messages[msgIndexRef.current])
    }

    lastPhaseRef.current = 0
    msgIndexRef.current = 0
    setAssistantStatusLine(ASSISTANT_STATUS_PHASES[0][0])

    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const schedule = () => {
      const delayMs = 20_000 + Math.random() * 10_000
      timeoutId = setTimeout(() => {
        if (cancelled) return
        applyNextLine()
        schedule()
      }, delayMs)
    }
    schedule()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [isTurnInFlight])

  // Load messages on mount - only create new local chat if user has no sessions (prevents duplicate from Strict Mode)
  useEffect(() => {
    console.log("[Clairvyn] init effect", { hasUser: !!user, currentChatId, authLoading });
    if (user && !currentChatId) {
      const initChat = async () => {
        const token = await getIdToken()
        console.log("[Clairvyn] initChat: loading sessions", { hasToken: !!token });
        let sessions: ChatSession[] = []

        if (token) {
          try {
            sessions = await getUserChatSessions(user.uid, token)
          } catch (err) {
            console.warn("[Clairvyn] initChat: backend failed, falling back to local", err)
            sessions = await getUserChatSessions(user.uid)
          }
        } else {
          sessions = await getUserChatSessions(user.uid)
        }

        console.log("[Clairvyn] initChat: sessions loaded", { count: sessions.length });
        setChatSessions(sessions)
        if (sessions.length === 0) {
          console.log("[Clairvyn] initChat: no sessions, creating new chat");
          await createNewChat()
        } else {
          const preferredId = getLastActiveChatId(user.uid)
          const fallbackId = sessions[0].id
          const targetId =
            preferredId && sessions.some((s) => s.id === preferredId) ? preferredId : fallbackId
          console.log("[Clairvyn] initChat: restoring session", {
            targetId,
            preferredId,
            fallbackId,
          })

          const { messages: sessionMessages, fromBackend: loadedFromBackend } =
            await loadMessagesForChat(targetId, token)

          if (loadedFromBackend) {
            await setChatMessages(
              targetId,
              sessionMessages.map((m) => ({
                ...m,
                timestamp:
                  typeof m.timestamp === "string"
                    ? m.timestamp
                    : (m.timestamp as Date).toISOString(),
              }))
            )
            setBackendChatId(targetId)
          }

          setCurrentChatId(targetId)
          setMessages(
            sessionMessages.map((m) => ({
              ...m,
              timestamp:
                typeof m.timestamp === "string"
                  ? m.timestamp
                  : (m.timestamp as Date).toISOString(),
            }))
          )
          setHasStarted(sessionMessages.length > 0)
          setLastActiveChatId(user.uid, targetId)
        }
      }
      initChat()
    }
  }, [user, getIdToken])

  // After return from PhonePe: confirm payment, then refetch has_paid
  useEffect(() => {
    if (typeof window === "undefined" || !user) return
    const params = new URLSearchParams(window.location.search)
    const paymentReturn = params.get("payment_return")
    const orderId = params.get("order_id")
    if (paymentReturn !== "1" || !orderId) return
    let cancelled = false
    getIdToken().then((t) => {
      if (cancelled || !t) return
      fetch(getBackendUrl("/api/payments/phonepe/confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ merchant_order_id: orderId }),
      })
        .then(() => {
          if (cancelled) return
          return fetch(getBackendUrl("/api/me"), { headers: { Authorization: `Bearer ${t}` } })
        })
        .then((res) => (res?.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled) console.log("[Clairvyn] /api/me user details (after payment):", data)
          if (!cancelled && data && typeof data.has_paid === "boolean") setHasPaid(data.has_paid)
          if (!cancelled) {
            const backendPhoto = getProfileImageFromMe(data)
            console.log("[Clairvyn] resolved sidebar profile image (after payment):", backendPhoto ?? user.photoURL ?? null)
            setProfileImageUrl(backendPhoto ?? user.photoURL ?? null)
          }
        })
        .catch(() => {})
    })
    window.history.replaceState({}, "", "/chatbot")
    return () => { cancelled = true }
  }, [user, getIdToken])

  useEffect(() => {
    if (!user) {
      setProfileImageUrl(null)
      return
    }
    if (!profileImageUrl && user.photoURL) {
      setProfileImageUrl(user.photoURL)
    }
  }, [user, profileImageUrl])

  const createNewChat = async () => {
    console.log("[Clairvyn] createNewChat called", { hasUser: !!user });
    if (user) {
      setIsLoading(true)
      try {
        let localId: string | null = null
        const token = await getIdToken()
        if (token) {
          try {
            const data = await apiFetch<{ id: string; title: string | null; metadata: any }>(
              "/api/chats",
              { method: "POST", body: { title: null, metadata: {} }, token }
            )
            localId = typeof data.id === "number" ? String(data.id) : data.id
            setBackendChatId(localId)
            console.log("[Clairvyn] createNewChat: backend chat created", { id: localId, title: data.title });
          } catch (err) {
            console.warn("[Clairvyn] createNewChat: backend create failed", err)
          }
        }

        const chatId = await createChatSession(user.uid, localId || undefined)
        setCurrentChatId(chatId)
        setLastActiveChatId(user.uid, chatId)
        if (!localId) setBackendChatId(null)

        setMessages([])
        setHasStarted(false)
        console.log("[Clairvyn] createNewChat: done", { chatId, backendId: localId });
      } catch (error) {
        console.error("[Clairvyn] createNewChat error", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const ensureBackendChat = async (): Promise<string | null> => {
    if (backendChatId) {
      console.log("[Clairvyn] ensureBackendChat: already have id", { backendChatId });
      return backendChatId
    }
    const token = await getIdToken()
    if (!token) {
      console.error("[Clairvyn] ensureBackendChat: no token")
      throw new Error("Missing auth token")
    }

    try {
      console.log("[Clairvyn] ensureBackendChat: creating backend chat", { currentChatId });
      const data = await apiFetch<{ id: string | number; title: string | null; metadata: any }>(
        "/api/chats",
        {
          method: "POST",
          body: { title: null, metadata: {} },
          token,
        }
      )
      const backendId = String(data.id)
      if (currentChatId && currentChatId !== backendId) {
        await renameChatSession(currentChatId, backendId)
        setCurrentChatId(backendId)
        if (user) setLastActiveChatId(user.uid, backendId)
      }
      setBackendChatId(backendId)
      console.log("[Clairvyn] ensureBackendChat: done", { backendId, title: data.title });
      return backendId
    } catch (err) {
      console.error("[Clairvyn] ensureBackendChat failed", err)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // Set hasStarted to true on first message
    if (!hasStarted) {
      setHasStarted(true)
    }

    const userText = inputValue.trim()
    const normalized = userText.toLowerCase().trim()

    const userMessage: Omit<ChatMessage, 'timestamp'> = {
      role: 'user',
      content: userText
    }

    // Add user message to UI immediately (will be replaced by history from server)
    setMessages(prev => [...prev, { ...userMessage, timestamp: new Date().toISOString() }])

    // Helper to generate contextual suggestions based on user input
    const getContextualSuggestion = (text: string) => {
      if (text.includes("kitchen")) return "Add a kitchen island"
      if (text.includes("bedroom")) return "Add a walk-in closet"
      if (text.includes("living")) return "Make the TV unit bigger"
      if (text.includes("bathroom") || text.includes("toilet")) return "Add a jacuzzi"
      if (text.includes("office") || text.includes("study")) return "Add a bookshelf"
      if (text.includes("garden") || text.includes("balcony")) return "Add some outdoor seating"
      if (text.includes("dining")) return "Change to a 6-seater table"

      return "Make the room bigger"
    }

    // Clear input and update placeholder for next turn
    setInputValue("")
    if (isFirstSubmit) {
      setPlaceholderText(getContextualSuggestion(normalized))
      setIsFirstSubmit(false)
    } else {
      setPlaceholderText("What are you thinking?..")
    }

    // Try the scripted demo first — if handled, skip backend call
    const handled = handleScriptedInput(normalized, { addMessage, setTyping })
    if (handled) {
      return // DO NOT call backend — scripted demo handled it
    }

    // Unpaid users: free generations (localStorage), then waitlist
    if (!hasPaid && !canGuestGenerate()) {
      setWaitlistOpen(true)
      return
    }

    setIsTurnInFlight(true)
    setIsLoading(true)
    console.log("[Clairvyn] handleSubmit: start", { userText: userText.slice(0, 50), currentChatId, hasUser: !!user });

    try {
      if (user && currentChatId) {
        await addMessageToChat(currentChatId, userMessage)
      }

      const token = await getIdToken()
      if (!token) {
        throw new Error("Missing auth token")
      }

      const chatId = await ensureBackendChat()
      if (!chatId) {
        console.error("[Clairvyn] handleSubmit: no backend chat id");
        throw new Error('Could not create or retrieve backend chat')
      }
      console.log("[Clairvyn] handleSubmit: sending turn", { chatId, contentLength: userText.length });

      type TurnResponse = {
        user_message: { id: string; content: string; image_url: string | null; created_at: string }
        assistant_message: {
          id: string
          content: string
          image_url: string | null
          extra_data?: {
            document_id?: string
            png_url?: string | null
            dxf_url?: string | null
          }
          created_at: string
        }
      }

      let data: any;
      try {
        data = await apiFetch<any>(
          `/api/chats/${encodeURIComponent(chatId)}/turn`,
          {
            method: "POST",
            body: { content: userText, image_url: null },
            token,
          }
        )
      } catch (err: any) {
        console.error("[Clairvyn] handleSubmit: turn request failed", { chatId, error: err?.message ?? err });
        throw err;
      }

      // if backend returned chat_id we can cache it
      if (data.chat_id != null) {
        setBackendChatId(String(data.chat_id))
      }

      // Replace messages with server history (backend returns history array)
      const raw: any = data;
      const array: any[] = Array.isArray(raw?.history)
        ? raw.history
        : Array.isArray(raw?.messages)
        ? raw.messages
        : [];
      const updatedHistory: ChatMessage[] = array.map((m: any) => ({
        id: m.id,
        role: m.sender_type === "user" ? "user" : "assistant",
        content: m.content ?? "",
        timestamp:
          typeof m.created_at === "string"
            ? m.created_at
            : (m.created_at as Date)?.toISOString?.() ?? new Date().toISOString(),
        image_url: m.image_url ?? undefined,
        extra_data: m.extra_data ?? undefined,
        feedback_submitted: Boolean(m.feedback_submitted),
      }));

      if (currentChatId) {
        await setChatMessages(currentChatId, updatedHistory)
      }

      setMessages(updatedHistory)
      console.log("[Clairvyn] handleSubmit: success", { historyLength: updatedHistory.length, assistantContent: (data as any)?.assistant_message?.content });

      if (!hasPaid) {
        const nextUsed = incrementGuestGenerationsUsed()
        if (nextUsed >= FREE_GUEST_GENERATIONS) {
          setWaitlistOpen(true)
        }
      }

      // Optimistically set chat title in sidebar from first user message
      if (currentChatId) {
        const titleFromMessage = userText.slice(0, 80).trim() || "New chat"
        setChatSessions((prev) =>
          prev.map((s) =>
            s.id === currentChatId ? { ...s, title: s.title ?? titleFromMessage } : s
          )
        )
      }
    } catch (error: any) {
      console.error("[Clairvyn] handleSubmit: error", { message: error?.message, code: (error as any)?.code })
      let content = "I'm sorry, I encountered an error. Please try again."

      // peek at error to give a more helpful hint
      if (
        error?.message?.includes('socket hang up') ||
        error?.code === 'ECONNRESET'
      ) {
        content =
          "Unable to reach the AI backend – is the server running on port 5000?"
      }

      const errorMessage: Omit<ChatMessage, 'timestamp'> = {
        role: 'assistant',
        content,
      }
      setMessages(prev => [...prev, { ...errorMessage, timestamp: new Date().toISOString() }])
    } finally {
      setIsTurnInFlight(false)
      setIsLoading(false)
    }
  }

  const updateFeedbackState = (key: string, next: Partial<MessageFeedbackState>) => {
    setFeedbackByMessage((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        ...next,
      },
    }))
  }

  const submitFeedback = async (message: ChatMessage, index: number) => {
    const key = getFeedbackKey(message, index)
    const state = feedbackByMessage[key] ?? {}
    const chatId = backendChatId ?? currentChatId
    const messageIdRaw = (message as any)?.id
    const messageId = Number(messageIdRaw)
    const alreadySubmittedFromBackend = Boolean((message as any)?.feedback_submitted)

    if (alreadySubmittedFromBackend) {
      updateFeedbackState(key, { submitted: true, alreadySubmitted: true, error: null })
      return
    }

    if (!chatId || !Number.isFinite(messageId) || messageId <= 0) {
      updateFeedbackState(key, { error: "Unable to submit feedback for this response." })
      return
    }
    if (!state.feedbackType || !state.category || (state.feedbackType === "negative" && !state.severity)) {
      updateFeedbackState(key, { error: "Please complete all feedback steps." })
      return
    }

    setFeedbackSubmittingByMessage((prev) => ({ ...prev, [key]: true }))
    updateFeedbackState(key, { error: null })

    try {
      const token = await getIdToken()
      if (!token) throw new Error("Missing auth token")

      await apiFetch(
        `/api/chats/${encodeURIComponent(chatId)}/feedback`,
        {
          method: "POST",
          body: {
            message_id: messageId,
            feedback_type: state.feedbackType,
            category: state.category,
            severity: state.feedbackType === "negative" ? state.severity : null,
            comment: null,
            metadata: { source: "chatbot_inline_feedback_v1" },
          },
          token,
        }
      )

      updateFeedbackState(key, { submitted: true, error: null })
    } catch (error: any) {
      console.error("[Clairvyn] submitFeedback failed", error)
      const message = typeof error?.message === "string" ? error.message : ""
      if (message.includes("API 409")) {
        updateFeedbackState(key, { submitted: true, alreadySubmitted: true, error: null })
      } else {
        updateFeedbackState(key, { error: "Failed to submit feedback. Please try again." })
      }
    } finally {
      setFeedbackSubmittingByMessage((prev) => ({ ...prev, [key]: false }))
    }
  }

  const downloadDxf = async (documentId: string) => {
    const chatId = backendChatId ?? currentChatId
    console.log("[Clairvyn] downloadDxf", { documentId, chatId });
    if (!chatId) {
      console.warn("[Clairvyn] downloadDxf: no chatId");
      return
    }
    const token = await getIdToken()
    if (!token) {
      console.warn("[Clairvyn] downloadDxf: no token");
      return
    }
    try {
      const url = getBackendUrl(`/api/chats/${encodeURIComponent(chatId)}/files/${documentId}.dxf`)
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(res.statusText)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `${documentId}.dxf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
      console.log("[Clairvyn] downloadDxf: success", { documentId });
    } catch (e) {
      console.error("[Clairvyn] downloadDxf failed", { documentId, error: e });
    }
  }

  const downloadPng = async (documentId: string) => {
    const chatId = backendChatId ?? currentChatId
    if (!chatId) {
      console.warn("[Clairvyn] downloadPng: no chatId");
      return
    }
    const token = await getIdToken()
    if (!token) {
      console.warn("[Clairvyn] downloadPng: no token");
      return
    }
    try {
      const url = getBackendUrl(`/api/chats/${encodeURIComponent(chatId)}/files/${documentId}.png`)
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(res.statusText)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `${documentId}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch (e) {
      console.error("[Clairvyn] downloadPng failed", { documentId, error: e });
    }
  }

  const handleLogout = async () => {
    console.log("[Clairvyn] handleLogout");
    // Notify backend for auditing (optional; don't block sign-out if it fails)
    try {
      const idToken = await getIdToken()
      if (idToken) {
        const res = await fetch(getBackendUrl("/api/logout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        })
        console.log("[Clairvyn] handleLogout: backend response", { status: res.status })
      }
    } catch (e) {
      console.warn("[Clairvyn] handleLogout: backend logout failed (continuing)", e)
    }
    // Always sign out from Firebase and send user to landing page
    await logout()
    router.replace("/")
  }

  const handleSignIn = () => {
    router.push("/signin")
  }

  const handleSearchDesigns = () => {
    // TODO: Implement search functionality
    alert("Search Designs feature coming soon!")
  }

  const handleSavedDesigns = () => {
    // TODO: Implement saved designs functionality
    alert("Saved Designs feature coming soon!")
  }

  const handleHistory = async () => {
    console.log("[Clairvyn] handleHistory");
    if (!user) {
      setChatSessions([])
      return
    }
    setHistoryLoading(true)
    try {
      const token = await getIdToken()
      let sessions: ChatSession[] = []
      if (token) {
        try {
          sessions = await getUserChatSessions(user.uid, token)
        } catch (err) {
          console.warn("[Clairvyn] handleHistory: backend failed, using local", err)
          sessions = await getUserChatSessions(user.uid)
        }
      } else {
        sessions = await getUserChatSessions(user.uid)
      }
      console.log("[Clairvyn] handleHistory: loaded", { count: sessions.length });
      setChatSessions(sessions)
    } catch (error) {
      console.error("Error loading chat history:", error)
      setChatSessions([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDeleteChat = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    const token = await getIdToken()
    const ok = await deleteChatSession(sessionId, token ?? null)
    if (!ok) return
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (currentChatId === sessionId) {
      setMessages([])
      setHasStarted(false)
      setBackendChatId(null)
      if (user) {
        const newId = await createChatSession(user.uid)
        setCurrentChatId(newId)
        setLastActiveChatId(user.uid, newId)
      }
    }
  }

  const loadChatSession = async (chatId: string) => {
    console.log("[Clairvyn] loadChatSession", { chatId });
    try {
      const token = await getIdToken()
      const { messages: sessionMessages, fromBackend: loadedFromBackend } =
        await loadMessagesForChat(chatId, token)
      console.log("[Clairvyn] loadChatSession: messages loaded", { chatId, count: sessionMessages.length, fromBackend: loadedFromBackend });

      if (loadedFromBackend) {
        await setChatMessages(chatId, sessionMessages.map((m) => ({
          ...m,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : (m.timestamp as Date).toISOString()
        })))
        setBackendChatId(chatId)
      }

      setCurrentChatId(chatId)
      if (user) setLastActiveChatId(user.uid, chatId)
      setMessages(sessionMessages.map((m) => ({
        ...m,
        timestamp: typeof m.timestamp === "string" ? m.timestamp : (m.timestamp as Date).toISOString()
      })))
      setHasStarted(sessionMessages.length > 0)
      setIsSidebarOpen(false)
    } catch (error) {
      console.error("Error loading chat session:", error)
    }
  }

  const sidebarItems = [
    { icon: Plus, label: "New Chat", action: createNewChat },
    { icon: Search, label: "Search Designs", action: handleSearchDesigns },
    { icon: Save, label: "Saved Designs", action: handleSavedDesigns },
    { icon: History, label: "History", action: handleHistory },
  ]

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen chat-background relative overflow-hidden overflow-x-hidden">

      {/* Guest Banner - Temporarily disabled for demo */}
      {false && showGuestBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-3"
        >
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                You are in Guest Mode. Sign in to save your work.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSignIn}
                size="sm"
                className="bg-white text-orange-600 hover:bg-gray-100"
              >
                Sign In
              </Button>
              <button
                onClick={() => setShowGuestBanner(false)}
                className="text-white hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mobile Sidebar Drawer (desktop uses persistent sidebar) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSidebarOpen(false)
              }}
            />

            {/* Sidebar */}
            <motion.div
              className="fixed left-0 top-0 z-50 flex h-full min-h-0 w-80 max-w-[85vw] flex-col bg-gray-100/95 dark:bg-gray-900 shadow-2xl"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
                <div className="flex shrink-0 items-center justify-between">
                  <div className="flex items-center gap-3" data-onboarding="sidebar-profile">
                    <Avatar className="w-10 h-10 border border-white/50 dark:border-gray-700 shadow-sm">
                      {profileImageUrl ? (
                        <AvatarImage
                          src={profileImageUrl}
                          alt={user?.displayName || "User profile"}
                          referrerPolicy="no-referrer"
                          onError={() => setProfileImageUrl(null)}
                        />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-teal-600 to-green-500 text-white">
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {user ? (user.displayName || user.email) : "Guest User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user ? "Signed in" : "Guest Mode"}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close sidebar"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </motion.button>
                </div>

                <div className="mt-4 shrink-0">
                  <button
                    type="button"
                    data-onboarding="new-chat"
                    onClick={() => {
                      createNewChat()
                      setIsSidebarOpen(false)
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Chat
                  </button>
                </div>

                <nav className="mt-5 shrink-0 space-y-1">
                  {sidebarItems.slice(1).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.action()
                        setIsSidebarOpen(false)
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      {item.label}
                    </button>
                  ))}
                </nav>

                <div
                  className="mt-6 border-t border-gray-200/70 dark:border-gray-700/70 pt-4 flex min-h-0 flex-1 flex-col"
                  data-onboarding="recent-chats"
                >
                  <div className="mb-3 flex shrink-0 items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">
                      Recent Chats
                    </p>
                  </div>

                  <div className="scrollbar-sidebar min-h-0 flex-1 space-y-1 overflow-y-auto -mr-2 pr-2">
                    {!user ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Sign in to see your recent chats.
                      </p>
                    ) : historyLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      </div>
                    ) : chatSessions.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No chats yet.
                      </p>
                    ) : (
                      chatSessions.map((session) => {
                        const firstUserMessage = session.messages.find((m) => m.role === "user")
                        const preview = session.title ?? firstUserMessage?.content?.slice(0, 50) ?? "New chat"
                        const displayPreview = preview.length >= 50 ? `${preview}...` : preview
                        const isActive = session.id === currentChatId

                        return (
                          <div
                            key={session.id}
                            className={`group flex items-center gap-2 rounded-xl transition-colors ${
                              isActive
                                ? "bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
                                : "hover:bg-gray-100/70 dark:hover:bg-gray-800/70"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => loadChatSession(session.id)}
                              className="flex-1 min-w-0 px-3 py-2.5 text-left"
                            >
                              <p className={`text-sm font-medium truncate ${isActive ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200"}`}>
                                {displayPreview}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteChat(e, session.id)}
                              className="mr-2 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 opacity-100"
                              title="Delete chat"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="mt-4 shrink-0 border-t border-gray-200/70 dark:border-gray-700/70 pt-3 space-y-2">
                  {user && !isGuest ? (
                    <button
                      type="button"
                      onClick={() => startTutorial()}
                      disabled={authLoading}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors disabled:opacity-50"
                      aria-label="Show app tutorial"
                    >
                      <CircleHelp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      App tutorial
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Dark mode
                    <div
                      className={`ml-auto w-7 h-4 rounded-full transition-colors ${isDarkMode ? "bg-teal-600" : "bg-gray-300"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${isDarkMode ? "translate-x-3" : "translate-x-0"}`}
                      />
                    </div>
                  </button>
                  {user ? (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      Sign out
                    </button>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors"
                    >
                      <LogIn className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      Sign in
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content (sidebar is drawer-only; never persistent) */}
      <div className="relative z-10 flex min-h-screen">
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top bar (matches screenshot: hamburger on mobile, title center, search right) */}
          <header className="relative bg-white/50 dark:bg-gray-900/30 backdrop-blur-sm">
            <div className="h-16 flex items-center px-4 sm:px-6">
              <motion.button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </motion.button>

              <div className="flex-1 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
                    Clairvyn 1.0
                  </div>
                </div>
              </div>

              <motion.button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Profile"
              >
                <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </motion.button>
            </div>
          </header>

        {/* Quote Section */}
        <AnimatePresence>
          {messages.length === 0 && !hasStarted && (
            <motion.div
              className="text-center py-8 sm:py-12 px-4 flex-1 flex items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-2 px-4 text-2xl font-bold text-charcoal sm:text-3xl min-[769px]:text-4xl dark:text-white">
                Let's Build Something Together!
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Messages */}
        <div className="scrollbar-main flex-1 overflow-y-auto px-2 sm:px-4 pt-6 pb-32">
          <div className="max-w-5xl mx-auto space-y-3 sm:space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] p-3 sm:p-5 rounded-2xl shadow-lg ${message.role === 'user'
                    ? 'text-gray-800 dark:text-gray-50 w-fit chat-bubble-user'
                    : 'text-gray-800 dark:text-gray-100 min-w-[200px] sm:min-w-[280px] chat-bubble-assistant'
                    }`}
                >
                  <p className="text-sm sm:text-base leading-relaxed">{message.content}</p>
                  {/* Support for image/extra data and description (demo script + backend responses) */}
                  {(message as any).image || (message as any).image_url || (message as any).extra_data?.png_url || (message as any).extra_data?.dxf_url || (message as any).extra_data?.document_id ? (
                    <div className="mt-3 space-y-2">
                      {(() => {
                        const imgUrl = (message as any).extra_data?.png_url ?? (message as any).image_url ?? (message as any).image
                        if (!imgUrl) return null
                        const fullUrl = typeof imgUrl === "string" && imgUrl.startsWith("/") ? getBackendUrl(imgUrl) : imgUrl
                        const needsAuth = typeof fullUrl === "string" && fullUrl.includes("/api/chats/") && fullUrl.includes("/files/")
                        const imgClassName = "rounded-lg shadow-md border max-w-full h-auto"
                        return needsAuth ? (
                          <AuthImage src={fullUrl} alt="Floor plan" className={imgClassName} getToken={getIdToken} />
                        ) : (
                          <img src={fullUrl} alt="Floor plan" className={imgClassName} />
                        )
                      })()}
                      {((message as any).extra_data?.dxf_url || (message as any).extra_data?.document_id) && (
                        <div className="flex flex-wrap gap-2.5 mt-3">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/20 dark:to-blue-500/20 border border-indigo-200/70 dark:border-indigo-500/30 px-4 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-200 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-400/40 transition-all"
                            onClick={() => downloadPng((message as any).extra_data?.document_id || "floorplan")}
                          >
                            <Download className="w-4 h-4" />
                            <span>Download PNG</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 border border-violet-200/70 dark:border-violet-500/30 px-4 py-2.5 text-sm font-medium text-violet-700 dark:text-violet-200 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-violet-300 dark:hover:border-violet-400/40 transition-all"
                            onClick={() => downloadDxf((message as any).extra_data?.document_id || (message as any).extra_data?.dxf_url?.split("/").pop()?.replace(".dxf", "") || "floorplan")}
                          >
                            <FileDown className="w-4 h-4" />
                            <span>Download DXF</span>
                          </motion.button>
                        </div>
                      )}

                      {(message as any).description && (
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg text-sm prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{(message as any).description}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {(() => {
                    if (!isGeneratedAssistantMessage(message)) return null
                    const feedbackKey = getFeedbackKey(message, index)
                    const feedbackState = feedbackByMessage[feedbackKey] ?? {}
                    const isSubmitting = !!feedbackSubmittingByMessage[feedbackKey]
                    const optionClass =
                      "text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                    const selectedClass = "bg-indigo-600 text-white border-indigo-600"

                    const alreadySubmittedFromBackend = Boolean((message as any)?.feedback_submitted)
                    if (feedbackState.submitted || alreadySubmittedFromBackend) {
                      return (
                        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 px-3 py-2 text-xs sm:text-sm text-green-700 dark:text-green-300">
                          {feedbackState.alreadySubmitted || alreadySubmittedFromBackend ? "Feedback already submitted." : "Thanks for your feedback."}
                        </div>
                      )
                    }

                    const options =
                      feedbackState.feedbackType === "negative"
                        ? NEGATIVE_FEEDBACK_OPTIONS
                        : POSITIVE_FEEDBACK_OPTIONS

                    return (
                      <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40 p-3 space-y-3">
                        <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Are you liking Clairvyn so far?</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`${optionClass} ${feedbackState.feedbackType === "positive" ? selectedClass : ""}`}
                            onClick={() => updateFeedbackState(feedbackKey, { feedbackType: "positive", category: undefined, severity: undefined, error: null })}
                          >
                            <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />Yes</span>
                          </button>
                          <button
                            type="button"
                            className={`${optionClass} ${feedbackState.feedbackType === "negative" ? selectedClass : ""}`}
                            onClick={() => updateFeedbackState(feedbackKey, { feedbackType: "negative", category: undefined, severity: undefined, error: null })}
                          >
                            <span className="inline-flex items-center gap-1"><ThumbsDown className="w-3.5 h-3.5" />No</span>
                          </button>
                        </div>

                        {feedbackState.feedbackType && (
                          <>
                            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                              {feedbackState.feedbackType === "positive" ? "What did you like the most?" : "What was wrong according to you?"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {options.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={`${optionClass} ${feedbackState.category === option.id ? selectedClass : ""}`}
                                  onClick={() => updateFeedbackState(feedbackKey, { category: option.id, error: null })}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {feedbackState.feedbackType === "negative" && feedbackState.category && (
                          <>
                            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">How bad was it?</div>
                            <div className="flex flex-wrap gap-2">
                              {NEGATIVE_SEVERITY_OPTIONS.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={`${optionClass} ${feedbackState.severity === option.id ? selectedClass : ""}`}
                                  onClick={() => updateFeedbackState(feedbackKey, { severity: option.id, error: null })}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {feedbackState.error && (
                          <div className="text-xs text-red-600 dark:text-red-400">{feedbackState.error}</div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => submitFeedback(message, index)}
                            disabled={
                              isSubmitting ||
                              !feedbackState.feedbackType ||
                              !feedbackState.category ||
                              (feedbackState.feedbackType === "negative" && !feedbackState.severity)
                            }
                            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? "Submitting..." : "Submit feedback"}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                  <p className={`text-xs mt-2 sm:mt-3 ${message.role === 'user' ? 'text-gray-500 dark:text-indigo-100/70' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                    {message.timestamp
                      ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator (animated in/out) */}
            <AnimatePresence>
              {typing && (
                <motion.div
                  key="typing-indicator"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-start"
                >
                  <div className="chat-bubble-assistant text-gray-800 dark:text-gray-200 p-3 sm:p-4 rounded-2xl shadow-lg">
                    <p className="text-sm sm:text-base leading-relaxed chat-loading-text">Designing...</p>
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="chat-bubble-assistant text-gray-800 dark:text-gray-200 p-3 sm:p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-spin text-teal-600 dark:text-teal-400" />
                    <motion.span
                      key={isTurnInFlight ? assistantStatusLine : "clairvyn-thinking"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="text-xs sm:text-sm chat-loading-text min-w-0"
                    >
                      {isTurnInFlight ? assistantStatusLine : "Clairvyn is thinking..."}
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Chat Input - Single Container with Smooth Animation */}
        <div className={`chat-input-container ${hasStarted ? "dock" : "start"}`}>
          <div className="chat-input">
            <div className="flex-1 min-w-0" data-onboarding="chat-input">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={placeholderText}
                className="chat-input-field w-full min-w-0"
                disabled={isLoading}
              />
            </div>
            <motion.button
              type="button"
              data-onboarding="send"
              onClick={handleSubmit}
              disabled={isLoading || !inputValue.trim()}
              className="send-btn"
              whileHover={{ scale: isLoading ? 1 : 1.05 }}
              whileTap={{ scale: isLoading ? 1 : 0.95 }}
              onHoverStart={() => !isLoading && setIsPencilHovered(true)}
              onHoverEnd={() => setIsPencilHovered(false)}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <motion.div
                  animate={isPencilHovered ? { rotate: [0, -10, 10, -5, 0] } : {}}
                  transition={{ duration: 0.6 }}
                >
                  <Pencil className="w-5 h-5" />
                </motion.div>
              )}
            </motion.button>
          </div>
        </div>
        </main>
      </div>

      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
      />
    </div>
  )
}
