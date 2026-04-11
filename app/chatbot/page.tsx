"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { handleScriptedInput } from "@/lib/demoScript"
import LandingPageLoader from "@/components/LandingPageLoader"
import {
  Menu,
  X,
  Pencil,
  User,
  Settings,
  LogOut,
  LogIn,
  Plus,
  Trash2,
  Download,
  FileDown,
  CircleHelp,
  ThumbsUp,
  ThumbsDown,
  Home,
  DollarSign,
  Shield,
  Info,
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
  clearUserSessions,
  getLastActiveChatId,
  setLastActiveChatId,
  loadMessagesForChat,
} from "@/lib/chat-service"
import { apiFetch, getBackendUrl } from "@/lib/backendApi"
import { FREE_GUEST_GENERATIONS, canUserGenerate, incrementUserGenerations } from "@/lib/guest-limits"
import { profileCountryMissing } from "@/lib/meProfile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useClairvynOnboarding } from "@/hooks/useClairvynOnboarding"
import { WaitlistModal } from "@/components/WaitlistModal"
import { UserProfileModal } from "@/components/UserProfileModal"
import { GreetingMessage } from "@/components/GreetingMessage"

/** Shown while waiting for an assistant turn; phases follow elapsed time; line changes every 20–30s. */
const ASSISTANT_STATUS_PHASES: readonly (readonly string[])[] = [
  [
    "Interpreting your requirements",
    "Mapping spatial constraints",
    "Translating inputs into layout logic",
    "Defining room relationships",
  ],
  [
    "Generating initial floor plan structure",
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

/** Founders always get unlimited generations regardless of payment status. */
const FOUNDER_EMAILS = ["ronakmm2005@gmail.com", "yaswantmodi@gmail.com"]

export default function ChatbotPage() {
  const { user, logout, loading: authLoading, getIdToken, isGuest } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // used for mobile drawer
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false) // Profile modal state

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

  // Redirect if not authenticated (DISABLED FOR LOCAL TESTING)
  useEffect(() => {
    // TEMPORARILY DISABLED: Allow viewing chatbot without auth
    // if (!authLoading && !user) {
    //   router.push("/signin")
    // }
  }, [user, authLoading, router])

  // Mark that user has visited the app (for redirect logic on landing page)
  useEffect(() => {
    if (user && !authLoading) {
      sessionStorage.setItem("hasVisitedApp", "true")
      // Update last chatbot activity timestamp
      sessionStorage.setItem("lastChatbotActivityTime", Date.now().toString())
    }
  }, [user, authLoading])

  // Update last activity time periodically while chatbot is open
  useEffect(() => {
    if (!user || authLoading) return
    
    const updateActivityTime = () => {
      sessionStorage.setItem("lastChatbotActivityTime", Date.now().toString())
    }
    
    // Update every 10 seconds while chatbot is active
    const interval = setInterval(updateActivityTime, 10000)
    
    // Also update on user interaction
    window.addEventListener("click", updateActivityTime)
    window.addEventListener("keydown", updateActivityTime)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener("click", updateActivityTime)
      window.removeEventListener("keydown", updateActivityTime)
    }
  }, [user, authLoading])

  // Smooth keyboard handling on mobile — prevents the "zoom/snap" when the
  // soft keyboard opens by scrolling the focused input into view gently.
  useEffect(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return

    const onViewportResize = () => {
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      ) {
        // Small delay lets the keyboard fully settle before scrolling
        setTimeout(() => {
          active.scrollIntoView({ block: "nearest", behavior: "smooth" })
        }, 50)
      }
    }

    vv.addEventListener("resize", onViewportResize)
    return () => vv.removeEventListener("resize", onViewportResize)
  }, [])

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [placeholderText, setPlaceholderText] = useState("Design a Floor-plan for a 3BHK House")
  const [isFirstSubmit, setIsFirstSubmit] = useState<boolean>(true)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedbackState>>({})
  const [feedbackSubmittingByMessage, setFeedbackSubmittingByMessage] = useState<Record<string, boolean>>({})
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  // Chat history state (integrated into sidebar)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Guard to prevent initChat running concurrently for the same user (race condition fix)
  const initStartedForUidRef = useRef<string | null>(null)
  // Guard to prevent concurrent handleSubmit calls (e.g. rapid double-click before React re-renders)
  const submittingRef = useRef(false)

  // Auto-resize textarea as inputValue changes
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [inputValue])

  // Scroll to bottom whenever messages update or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

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
    if (!user || authLoading) return
    // Prevent concurrent runs for the same user (guards against getIdToken reference churn)
    if (initStartedForUidRef.current === user.uid) return
    initStartedForUidRef.current = user.uid

    let cancelled = false
    const uid = user.uid

    const initChat = async () => {
        const token = await getIdToken()
        if (cancelled) return
        console.log("[Clairvyn] initChat: loading sessions", { hasToken: !!token });
        let sessions: ChatSession[] = []

        if (token) {
          try {
            sessions = await getUserChatSessions(uid, token)
          } catch (err) {
            console.warn("[Clairvyn] initChat: backend failed, falling back to local", err)
            sessions = await getUserChatSessions(uid)
          }
        } else {
          sessions = await getUserChatSessions(uid)
        }

        if (cancelled) return
        console.log("[Clairvyn] initChat: sessions loaded", { count: sessions.length });
        setChatSessions(sessions)
        if (sessions.length === 0) {
          // No sessions yet — don't persist anything; wait for first message
          console.log("[Clairvyn] initChat: no sessions, starting blank")
          if (cancelled || submittingRef.current) return
          setCurrentChatId(null)
          setMessages([])
          setHasStarted(false)
        } else {
          const preferredId = getLastActiveChatId(uid)
          const fallbackId = sessions[0].id
          const targetId =
            preferredId && sessions.some((s) => s.id === preferredId) ? preferredId : fallbackId
          console.log("[Clairvyn] initChat: restoring session", {
            targetId,
            preferredId,
            fallbackId,
          })

          const { messages: sessionMessages, fromBackend: loadedFromBackend } =
            await loadMessagesForChat(uid, targetId, token)

          if (cancelled || submittingRef.current) return

          if (loadedFromBackend) {
            await setChatMessages(
              uid,
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

          if (cancelled || submittingRef.current) return
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
          setLastActiveChatId(uid, targetId)
        }
      }
      initChat()
      return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading])

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

  const createNewChat = () => {
    // Guard: already on a blank unsaved chat — nothing to do
    if (!hasStarted && currentChatId === null) return
    setMessages([])
    setHasStarted(false)
    setCurrentChatId(null)
    setBackendChatId(null)
    setInputValue("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    console.log("[Clairvyn] createNewChat: reset to blank (will persist on first message)")
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
        if (user) {
          await renameChatSession(user.uid, currentChatId, backendId)
          setCurrentChatId(backendId)
          setLastActiveChatId(user.uid, backendId)
        }
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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
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

    // Unpaid signed-in users: enforce per-user floor plan limit (3 free generations).
    // Founders are exempt from all generation limits.
    const isFounder = user?.email ? FOUNDER_EMAILS.includes(user.email.toLowerCase()) : false
    if (!hasPaid && !isFounder && user) {
      if (!canUserGenerate(user.uid)) {
        setWaitlistOpen(true)
        return
      }
    }

    // Block concurrent submissions: synchronous ref check ensures the second click is
    // rejected before React has had a chance to re-render the disabled Send button.
    if (submittingRef.current) return
    submittingRef.current = true

    setIsTurnInFlight(true)
    setIsLoading(true)

    // Lazily create the local chat session on the very first message
    let activeChatId = currentChatId
    if (!activeChatId && user) {
      const newId = await createChatSession(user.uid)
      activeChatId = newId
      setCurrentChatId(newId)
      setLastActiveChatId(user.uid, newId)
      setChatSessions(prev => [{
        id: newId,
        userId: user.uid,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }, ...prev])
      console.log("[Clairvyn] handleSubmit: created new session on first message", { newId })
    }

    console.log("[Clairvyn] handleSubmit: start", { userText: userText.slice(0, 50), activeChatId, hasUser: !!user });

    try {
      if (user && activeChatId) {
        await addMessageToChat(user.uid, activeChatId, userMessage)
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

      // If backend returned a task_id, poll until done
      let finalData = data;
      if (data.task_id && !data.history) {
        const resolvedChatId = data.chat_id ?? chatId;
        const taskId = data.task_id;
        const POLL_INTERVAL_MS = 4000;
        const MAX_POLLS = 75; // 5 minutes max
        let polls = 0;
        await new Promise<void>((resolve, reject) => {
          const interval = setInterval(async () => {
            polls++;
            if (polls > MAX_POLLS) {
              clearInterval(interval);
              reject(new Error("Floor plan generation timed out. Please try again."));
              return;
            }
            try {
              const pollData = await apiFetch<any>(
                `/api/chats/${encodeURIComponent(resolvedChatId)}/tasks/${encodeURIComponent(taskId)}`,
                { method: "GET", token }
              );
              if (pollData.status === "SUCCESS") {
                clearInterval(interval);
                finalData = pollData;
                resolve();
              } else if (pollData.status === "FAILURE") {
                clearInterval(interval);
                reject(new Error(pollData.error || "Floor plan generation failed."));
              }
              // PENDING or STARTED — keep polling
            } catch (e) {
              clearInterval(interval);
              reject(e);
            }
          }, POLL_INTERVAL_MS);
        });
      }

      // Replace messages with server history
      const raw: any = finalData;
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

      if (activeChatId && user) {
        await setChatMessages(user.uid, activeChatId, updatedHistory)
      }

      setMessages(updatedHistory)
      console.log("[Clairvyn] handleSubmit: success", { historyLength: updatedHistory.length, assistantContent: (finalData as any)?.assistant_message?.content });

      // Only count a generation when the backend actually produced a floor plan
      if (!hasPaid && !isFounder && user) {
        const lastAssistant = updatedHistory.filter((m) => m.role === "assistant").pop()
        const producedFloorPlan = Boolean(
          lastAssistant?.extra_data?.document_id || lastAssistant?.extra_data?.png_url
        )
        if (producedFloorPlan) {
          const nextUsed = incrementUserGenerations(user.uid)
          if (nextUsed >= FREE_GUEST_GENERATIONS) {
            setWaitlistOpen(true)
          }
        }
      }

      // Optimistically set chat title in sidebar from first user message
      if (activeChatId) {
        const titleFromMessage = userText.slice(0, 80).trim() || "New chat"
        setChatSessions((prev) =>
          prev.map((s) =>
            s.id === activeChatId ? { ...s, title: s.title ?? titleFromMessage } : s
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
      submittingRef.current = false
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
    
    // Clear redirect flags before logout to ensure clean state
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("fromChatbot")
        sessionStorage.removeItem("hasVisitedApp")
        sessionStorage.removeItem("lastChatbotActivityTime")
      }
    } catch (e) {
      console.warn("[Clairvyn] Error clearing sessionStorage in handleLogout", e)
    }

    // Clear locally cached chat sessions so they don't bleed into the next user's session
    if (user) {
      try { clearUserSessions(user.uid) } catch { /* ignore */ }
    }
    
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

  const handleGoHome = () => {
    try {
      // Set flag so landing page doesn't redirect us back to chatbot
      sessionStorage.setItem("fromChatbot", "true")
      // Clear the hasVisitedApp flag so landing page logic works correctly
      sessionStorage.removeItem("hasVisitedApp")
      sessionStorage.removeItem("lastChatbotActivityTime")
    } catch (e) {
      // sessionStorage not available - still navigate home
      console.warn("[Clairvyn] sessionStorage not available in handleGoHome")
    }
    router.push("/")
  }

  const handleDeleteChat = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (!user) return
    const token = await getIdToken()
    const ok = await deleteChatSession(user.uid, sessionId, token ?? null)
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
        await loadMessagesForChat(user?.uid || '', chatId, token)
      console.log("[Clairvyn] loadChatSession: messages loaded", { chatId, count: sessionMessages.length, fromBackend: loadedFromBackend });

      if (loadedFromBackend && user) {
        await setChatMessages(user.uid, chatId, sessionMessages.map((m) => ({
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
    { icon: Home, label: "Home", action: handleGoHome },
  ]

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1A1916] flex items-center justify-center">
        <LandingPageLoader />
      </div>
    )
  }

  const sidebarInner = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
      <div className="flex shrink-0 items-center justify-between">
        <button
          onClick={() => {
            setIsProfileModalOpen(true)
            setIsSidebarOpen(false)
          }}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity rounded-lg px-2 py-1.5 group"
          data-onboarding="sidebar-profile"
        >
          <Avatar className="w-10 h-10 border border-white/50 dark:border-[rgba(155,127,212,0.35)] shadow-sm group-hover:ring-2 group-hover:ring-[#9B7FD4]/40 transition-all">
            {profileImageUrl ? (
              <AvatarImage
                src={profileImageUrl}
                alt={user?.displayName || "User profile"}
                referrerPolicy="no-referrer"
                onError={() => setProfileImageUrl(null)}
              />
            ) : null}
            <AvatarFallback className="bg-[#2C2A27] text-[#C4B0F0] dark:bg-[#2C2A27] dark:text-[#C4B0F0]">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-[#F0EBE0] text-sm truncate">
              {user ? (user.displayName || user.email) : "Guest User"}
            </p>
            <p className="text-xs text-gray-500 dark:text-[#6B6458]">
              {user ? "Signed in" : "Guest Mode"}
            </p>
          </div>
        </button>
        <motion.button
          onClick={() => setIsSidebarOpen(false)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2825] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-[#A8A090] dark:group-hover:text-[#F0EBE0] transition-colors" />
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
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/80 dark:bg-[rgba(155,127,212,0.10)] border border-gray-200 dark:border-[rgba(155,127,212,0.20)] px-4 py-3 text-sm font-semibold text-gray-800 dark:text-[#C4B0F0] hover:bg-white dark:hover:bg-[rgba(155,127,212,0.18)] transition-colors"
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
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] hover:bg-gray-100/70 dark:hover:bg-[#2A2825] transition-colors"
          >
            <item.icon className="w-4 h-4 text-gray-500 dark:text-[#6B6458]" />
            {item.label}
          </button>
        ))}
      </nav>

      <div
        className="mt-6 border-t border-gray-200/70 dark:border-[rgba(255,255,255,0.07)] pt-4 flex min-h-0 flex-1 flex-col"
        data-onboarding="recent-chats"
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-[#6B6458] uppercase">
            Recent Chats
          </p>
        </div>

        <div className="scrollbar-sidebar min-h-0 flex-1 space-y-1 overflow-y-auto -mr-2 pr-2">
          {!user ? (
            <p className="text-sm text-gray-500 dark:text-[#6B6458]">
              Sign in to see your recent chats.
            </p>
          ) : historyLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-[rgba(155,127,212,0.20)] border-t-gray-500 dark:border-t-[#9B7FD4] animate-spin" />
            </div>
          ) : chatSessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-[#6B6458]">
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
                      ? "bg-white/80 dark:bg-[rgba(155,127,212,0.10)] border border-gray-200 dark:border-[rgba(155,127,212,0.20)] dark:border-l-2 dark:border-l-[#9B7FD4]"
                      : "hover:bg-gray-100/70 dark:hover:bg-[#2A2825]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadChatSession(session.id)}
                    className="flex-1 min-w-0 px-3 py-2.5 text-left"
                  >
                    <p className={`text-sm font-medium truncate ${isActive ? "text-gray-900 dark:text-[#C4B0F0]" : "text-gray-700 dark:text-[#A8A090]"}`}>
                      {displayPreview}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-[#6B6458] mt-1">
                      {new Date(session.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChat(e, session.id)}
                    className="mr-2 p-2 rounded-lg text-gray-400 dark:text-[#6B6458] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#DC2626]/10 transition-colors shrink-0 opacity-100"
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

      <div className="mt-4 shrink-0 border-t border-gray-200/70 dark:border-[rgba(255,255,255,0.07)] pt-3 space-y-2">
        <button
          type="button"
          onClick={() => startTutorial()}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] hover:bg-gray-100/70 dark:hover:bg-[#2A2825] transition-colors"
          aria-label="Show app tutorial"
        >
          <CircleHelp className="w-4 h-4 text-gray-500 dark:text-[#6B6458]" />
          App tutorial
        </button>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] hover:bg-gray-100/70 dark:hover:bg-[#2A2825] transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500 dark:text-[#6B6458]" />
          Dark mode
          <div
            className={`ml-auto w-7 h-4 rounded-full transition-colors ${isDarkMode ? "bg-[rgba(155,127,212,0.30)]" : "bg-gray-300"}`}
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform transition-colors ${isDarkMode ? "translate-x-3 bg-[#9B7FD4]" : "translate-x-0 bg-white"}`}
            />
          </div>
        </button>
        {user ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] hover:bg-gray-100/70 dark:hover:bg-[#2A2825] hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4 text-gray-500 dark:text-[#6B6458]" />
            Sign out
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] hover:bg-gray-100/70 dark:hover:bg-[#2A2825] transition-colors"
          >
            <LogIn className="w-4 h-4 text-gray-500 dark:text-[#6B6458]" />
            Sign in
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col chat-background overflow-hidden" style={{ height: '100dvh' }}>

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

      {/* Mobile Sidebar Overlay (< md) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              className={`fixed inset-0 z-40 md:hidden ${isDarkMode ? "bg-black/50" : "bg-black/20 backdrop-blur-sm"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSidebarOpen(false)
              }}
            />
            <motion.div
              className="fixed left-0 top-0 z-50 md:hidden flex h-full min-h-0 w-80 max-w-[85vw] flex-col bg-[rgba(255,255,255,0.45)] backdrop-blur-[24px] backdrop-saturate-[1.8] dark:bg-[rgba(26,25,22,0.45)] shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-r border-white/30 dark:border-[rgba(255,255,255,0.1)]"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              {sidebarInner}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main layout row: desktop sidebar (push) + content */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Desktop/Tablet Sidebar (≥ md) — pushes content */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              className="hidden md:flex shrink-0 h-full flex-col overflow-hidden bg-[rgba(255,255,255,0.45)] backdrop-blur-[24px] backdrop-saturate-[1.8] dark:bg-[rgba(26,25,22,0.45)] shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-r border-white/30 dark:border-[rgba(255,255,255,0.1)]"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="w-80 min-w-[320px] h-full">
                {sidebarInner}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 flex flex-col min-h-0 transition-all duration-200">
          {/* Top bar (matches screenshot: hamburger on mobile, title center, search right) */}
          <header className="relative chat-header">
            <div className={`flex items-center gap-1 transition-all duration-300 ${hasStarted ? 'h-8 sm:h-16 lg:h-[72px] px-1 sm:px-8 lg:px-10' : 'h-16 sm:h-20 px-3 sm:px-8'}`}>
              <motion.button
                onClick={() => setIsSidebarOpen(true)}
                className="group p-2 rounded-lg hover:bg-gray-100 dark:bg-transparent dark:hover:bg-transparent transition-colors outline-none"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-[#A8A090] dark:group-hover:text-[#F0EBE0] transition-colors" />
              </motion.button>

              <div className="flex-1 flex items-center justify-center pointer-events-none min-w-0">
                <div className="text-center truncate">
                  <div className={`font-semibold text-gray-800 dark:text-[#F0EBE0] truncate ${hasStarted ? 'text-sm sm:text-lg' : 'text-base sm:text-lg'}`}>
                    Clairvyn 1.0
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => setIsProfileModalOpen(true)}
                className="group p-2 rounded-lg hover:bg-gray-100 dark:bg-transparent dark:hover:bg-transparent transition-colors outline-none"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Open profile settings"
              >
                <User className="w-5 h-5 text-gray-600 dark:text-[#A8A090] dark:group-hover:text-[#F0EBE0] transition-colors" />
              </motion.button>
            </div>
          </header>

        {/* Chat area — centered when empty, messages + bottom-docked input when started */}
        {!hasStarted ? (
          <motion.div
            className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 gap-5 sm:gap-10 pb-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <GreetingMessage
              firstName={user?.displayName?.split(" ")[0] ?? undefined}
              as="h2"
            />
            <motion.div
              className="w-full max-w-2xl lg:max-w-3xl flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <div className="chat-input w-full chat-input--centered" data-onboarding="chat-input">
                <textarea
                  ref={textareaRef}
                  rows={1}
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
                  autoComplete="off"
                  spellCheck={true}
                />
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
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-[#6B6458]">Clairvyn can make mistakes</span>
                <button
                  type="button"
                  onClick={() => setShowDisclaimerModal(true)}
                  className="flex-shrink-0 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  style={{ minHeight: 0, minWidth: 0 }}
                  title="AI Disclaimer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <>
            <div className="scrollbar-main flex-1 overflow-y-auto flex flex-col px-3 sm:px-6">
              <div className="max-w-3xl lg:max-w-[700px] mx-auto w-full space-y-3 sm:space-y-5 lg:space-y-9 pt-1 sm:pt-8 lg:pt-14 pb-2">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 lg:p-5 rounded-2xl ${message.role === 'user'
                    ? 'text-gray-800 dark:text-[#F0EBE0] w-fit chat-bubble-user'
                    : 'text-gray-800 dark:text-[#D8D0C8] min-w-[200px] sm:min-w-[320px] chat-bubble-assistant'
                    }`}
                >
                  <div className="text-xs sm:text-base leading-relaxed lg:text-[15.5px] lg:leading-[1.78] space-y-1">
                    {message.content.split('\n').map((line: string, i: number) => (
                      line === '' ? <div key={i} className="h-2" /> : <p key={i}>{line}</p>
                    ))}
                  </div>
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
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-500/10 dark:bg-[#2C2A27] border border-gray-300/70 dark:border-[rgba(255,255,255,0.10)] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] backdrop-blur-sm shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-[rgba(255,255,255,0.18)] transition-all"
                            onClick={() => downloadPng((message as any).extra_data?.document_id || "floorplan")}
                          >
                            <Download className="w-4 h-4" />
                            <span>Download PNG</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-500/10 dark:bg-[#2C2A27] border border-gray-300/70 dark:border-[rgba(255,255,255,0.10)] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#A8A090] backdrop-blur-sm shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-[rgba(255,255,255,0.18)] transition-all"
                            onClick={() => downloadDxf((message as any).extra_data?.document_id || (message as any).extra_data?.dxf_url?.split("/").pop()?.replace(".dxf", "") || "floorplan")}
                          >
                            <FileDown className="w-4 h-4" />
                            <span>Download DXF</span>
                          </motion.button>
                        </div>
                      )}

                      {(message as any).description && (
                        <div className="bg-white dark:bg-[#242320] p-4 rounded-lg text-sm prose dark:prose-invert max-w-none">
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
                      "text-xs sm:text-sm px-3 py-2 sm:py-1.5 rounded-full border border-gray-200 dark:border-[rgba(255,255,255,0.10)] hover:border-gray-400 dark:hover:border-[rgba(255,255,255,0.20)] active:scale-95 transition-transform"
                    const selectedClass = "bg-gray-600 text-white border-gray-600"

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
                      <div className="mt-3 rounded-xl border border-gray-200 dark:border-[rgba(255,255,255,0.07)] bg-white/60 dark:bg-[#242320]/60 p-3 space-y-3">
                        <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-[#F0EBE0]">Are you liking Clairvyn so far?</div>
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
                            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-[#F0EBE0]">
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
                            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-[#F0EBE0]">How bad was it?</div>
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
                            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? "Submitting..." : "Submit feedback"}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </motion.div>
            ))}



            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="flex justify-start"
              >
                <div className="chat-bubble-assistant text-gray-700 dark:text-[#A8A090] p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Animated house icon */}
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 house-loader">
                      <svg
                        viewBox="0 0 64 64"
                        className="w-full h-full"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {/* House outline */}
                        <polyline 
                          points="32,12 52,28 52,54 12,54 12,28 32,12" 
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="120"
                          className="house-outline"
                        />
                      </svg>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.span
                        key={assistantStatusLine}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="text-xs sm:text-sm font-medium text-gray-600 dark:text-[#A8A090] min-w-0 flex-1"
                      >
                        {assistantStatusLine}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat Input - bottom docked */}
            <div className="chat-input-container">
              <div className="chat-input" data-onboarding="chat-input">
                <textarea
                  ref={textareaRef}
                  rows={1}
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
                  autoComplete="off"
                  spellCheck={true}
                />
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
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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

              {/* Disclaimer */}
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-[#6B6458]">
                  Clairvyn can make mistakes
                </span>
                <button
                  type="button"
                  onClick={() => setShowDisclaimerModal(true)}
                  className="flex-shrink-0 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:text-[#6B6458] dark:hover:text-[#A8A090]"
                  style={{ minHeight: 0, minWidth: 0 }}
                  title="AI Disclaimer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
        </main>
      </div>

      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        profileImageUrl={profileImageUrl}
      />

      {/* AI Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimerModal && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDisclaimerModal(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="bg-white dark:bg-[#242320] rounded-2xl shadow-xl dark:shadow-[0_8px_40px_rgba(0,0,0,0.50)] max-w-sm w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CircleHelp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[#F0EBE0] mt-0.5">AI Disclaimer</h3>
                </div>
                
                <div className="space-y-3 mb-6 text-sm text-gray-700 dark:text-[#A8A090]">
                  <p>
                    <strong>Please note:</strong> Clairvyn uses AI to generate floor plans. While powerful, AI is susceptible to mistakes.
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Generated floor plans may contain errors or unrealistic layouts</li>
                    <li>Dimensions and proportions may not always be accurate</li>
                    <li>The AI may miss important architectural constraints</li>
                    <li>Generated designs should <strong>never</strong> be used directly for construction</li>
                    <li>Always have professional architects review and certify plans before use</li>
                  </ul>
                  <p className="pt-2">
                    These outputs are conceptual aids only and should not replace professional architectural services.
                  </p>
                </div>

                <button
                  onClick={() => setShowDisclaimerModal(false)}
                  className="w-full bg-[#7C5CBF] hover:bg-[#5A3A9E] dark:bg-[#7C5CBF] dark:hover:bg-[#5A3A9E] text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


    </div>
  )
}
