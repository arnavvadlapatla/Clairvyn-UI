"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
  UserPlus,
  Search,
  History,
  Save,
  Plus,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  Trash2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { useRouter } from "next/navigation"
import {
  createChatSession,
  renameChatSession,
  addMessageToChat,
  simulateAIResponse,
  setChatMessages,
  Message as ChatMessage,
  ChatSession,
  getGuestChats,
  saveGuestChats,
  clearGuestChats,
  getUserChatSessions,
  getChatMessages,
  deleteChatSession,
} from "@/lib/chat-service"
import { apiFetch, getBackendUrl } from "@/lib/backendApi"

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
  const { user, logout, loading: authLoading, isGuest, getIdToken } = useAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin")
    }
  }, [user, authLoading, router])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [placeholderText, setPlaceholderText] = useState("Design a Floor-plan for a 3BHK House")
  const [isFirstSubmit, setIsFirstSubmit] = useState<boolean>(true)

  // Feedback State
  const [messageCount, setMessageCount] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)
  const [feedbackAnswers, setFeedbackAnswers] = useState<{
    q1: 'up' | 'down' | null,
    q2: 'up' | 'down' | null,
    q3: 'up' | 'down' | null
  }>({ q1: null, q2: null, q3: null })
  const [feedbackText, setFeedbackText] = useState("")

  // Trigger feedback after 2 user messages
  useEffect(() => {
    if (messageCount === 2 && !feedbackSubmitted) {
      setShowFeedback(true)
    }
  }, [messageCount, feedbackSubmitted])

  // Helper function for demo script
  const addMessage = (msg: any) => setMessages(prev => [...prev, msg])
  const [isPencilHovered, setIsPencilHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [backendChatId, setBackendChatId] = useState<string | null>(null)
  const [showGuestBanner, setShowGuestBanner] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  // Chat history state (integrated into sidebar)
  const [sidebarView, setSidebarView] = useState<"menu" | "history">("menu")
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load messages on mount - only create new local chat if user has no sessions (prevents duplicate from Strict Mode)
  useEffect(() => {
    console.log("[Clairvyn] init effect", { hasUser: !!user, currentChatId, isGuest, authLoading });
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
        if (sessions.length === 0) {
          console.log("[Clairvyn] initChat: no sessions, creating new chat");
          await createNewChat()
        } else {
          const latest = sessions[0]
          console.log("[Clairvyn] initChat: restoring latest", { chatId: latest.id, title: latest.title, messageCount: latest.messages.length });
          setCurrentChatId(latest.id)
          setMessages(latest.messages.map((m) => ({
            ...m,
            timestamp: typeof m.timestamp === "string" ? m.timestamp : (m.timestamp as Date).toISOString()
          })))
          setHasStarted(latest.messages.length > 0)
        }
      }
      initChat()
    } else if (isGuest) {
      // Load guest chats from localStorage
      const guestMessages = getGuestChats()
      console.debug('loaded guest messages', guestMessages);
      setMessages(guestMessages)
    }
  }, [user, isGuest])

  // Save guest messages to localStorage when they change
  useEffect(() => {
    if (isGuest && messages.length > 0) {
      saveGuestChats(messages)
    }
  }, [messages, isGuest])

  const createNewChat = async () => {
    console.log("[Clairvyn] createNewChat called", { hasUser: !!user, isGuest });
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
        if (!localId) setBackendChatId(null)

        setMessages([])
        setHasStarted(false)
        console.log("[Clairvyn] createNewChat: done", { chatId, backendId: localId });
      } catch (error) {
        console.error("[Clairvyn] createNewChat error", error)
      } finally {
        setIsLoading(false)
      }
    } else if (isGuest) {
      // Clear guest messages
      clearGuestChats()
      setMessages([])
      setHasStarted(false) // Reset to initial state
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

    // Increment message count for feedback trigger
    setMessageCount(prev => prev + 1)

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

    setIsLoading(true)
    console.log("[Clairvyn] handleSubmit: start", { userText: userText.slice(0, 50), currentChatId, hasUser: !!user });

    try {
      if (user && currentChatId) {
        await addMessageToChat(currentChatId, userMessage)
      }

      if (!user) {
        // For guests we currently don't hit the backend AI; just simulate.
        console.log("[Clairvyn] handleSubmit: guest mode, simulating response");
        const aiResponse = await simulateAIResponse(userText)
        const assistantMessage: Omit<ChatMessage, 'timestamp'> = {
          role: 'assistant',
          content: aiResponse
        }
        setMessages(prev => [...prev, { ...assistantMessage, timestamp: new Date().toISOString() }])
        return
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
        role: m.sender_type === "user" ? "user" : "assistant",
        content: m.content ?? "",
        timestamp:
          typeof m.created_at === "string"
            ? m.created_at
            : (m.created_at as Date)?.toISOString?.() ?? new Date().toISOString(),
        image_url: m.image_url ?? undefined,
        extra_data: m.extra_data ?? undefined,
      }));

      if (currentChatId) {
        await setChatMessages(currentChatId, updatedHistory)
      }

      setMessages(updatedHistory)
      console.log("[Clairvyn] handleSubmit: success", { historyLength: updatedHistory.length, assistantContent: (data as any)?.assistant_message?.content });

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
      setIsLoading(false)
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
    setSidebarView("history")
    if (isGuest || !user) {
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
      }
    }
  }

  const loadChatSession = async (chatId: string) => {
    console.log("[Clairvyn] loadChatSession", { chatId });
    try {
      const token = await getIdToken()
      let sessionMessages = [] as ChatMessage[]
      let loadedFromBackend = false
      if (token) {
        try {
          sessionMessages = await getChatMessages(chatId, token)
          loadedFromBackend = true
        } catch (err) {
          console.warn("[Clairvyn] loadChatSession: backend failed, using local", err)
          sessionMessages = await getChatMessages(chatId)
        }
      } else {
        sessionMessages = await getChatMessages(chatId)
      }
      console.log("[Clairvyn] loadChatSession: messages loaded", { chatId, count: sessionMessages.length, fromBackend: loadedFromBackend });

      if (loadedFromBackend) {
        await setChatMessages(chatId, sessionMessages.map((m) => ({
          ...m,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : (m.timestamp as Date).toISOString()
        })))
        setBackendChatId(chatId)
      }

      setCurrentChatId(chatId)
      setMessages(sessionMessages.map((m) => ({
        ...m,
        timestamp: typeof m.timestamp === "string" ? m.timestamp : (m.timestamp as Date).toISOString()
      })))
      setHasStarted(sessionMessages.length > 0)
      setSidebarView("menu")
      setIsSidebarOpen(false)
    } catch (error) {
      console.error("Error loading chat session:", error)
    }
  }

  const sidebarItems = [
    { icon: Plus, label: "New Design", action: createNewChat, keepOpen: false },
    { icon: Search, label: "Search Designs", action: handleSearchDesigns, keepOpen: false },
    { icon: Save, label: "Saved Designs", action: handleSavedDesigns, keepOpen: false },
    { icon: History, label: "History", action: handleHistory, keepOpen: true },
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

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={(open) => {
        if (!feedbackSuccess) setShowFeedback(open)
      }}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          {!feedbackSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>We value your feedback!</DialogTitle>
                <DialogDescription>
                  Help us improve your design experience.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {/* Question 1 */}
                <div className="space-y-3">
                  <h4 className="font-medium">1. Was Clairvyn easy to use for you?</h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q1: 'up' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q1 === 'up' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsUp className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q1: 'down' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q1 === 'down' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsDown className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Question 2 */}
                <div className="space-y-3">
                  <h4 className="font-medium">2. Did Clairvyn save you time on your tasks?</h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q2: 'up' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q2 === 'up' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsUp className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q2: 'down' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q2 === 'down' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsDown className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Question 3 */}
                <div className="space-y-3">
                  <h4 className="font-medium">3. Would you keep using Clairvyn in your daily workflow?</h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q3: 'up' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q3 === 'up' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsUp className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setFeedbackAnswers(prev => ({ ...prev, q3: 'down' }))}
                      className={`p-2 rounded-full transition-colors ${feedbackAnswers.q3 === 'down' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    >
                      <ThumbsDown className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Conditional Text Area */}
                {(feedbackAnswers.q1 === 'down' || feedbackAnswers.q2 === 'down' || feedbackAnswers.q3 === 'down') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <h4 className="font-medium text-sm text-gray-600 dark:text-gray-300">
                      Please share details of why you chose that:
                    </h4>
                    <Textarea
                      placeholder="Your feedback helps us improve..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="resize-none"
                    />
                  </motion.div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFeedback(false)
                    setFeedbackSubmitted(true)
                  }}
                >
                  Skip
                </Button>
                <Button
                  onClick={() => {
                    setFeedbackSuccess(true)
                    setFeedbackSubmitted(true)
                  }}
                  disabled={!feedbackAnswers.q1 || !feedbackAnswers.q2 || !feedbackAnswers.q3}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Submit Feedback
                </Button>
              </DialogFooter>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10 text-center space-y-4"
            >
              <div className="text-4xl">🙌</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Thanks for beta testing with us!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Clairvyn 1.0 launches Jan 2026, see you soon 🚀
              </p>
              <Button
                onClick={() => setShowFeedback(false)}
                className="mt-4"
                variant="outline"
              >
                Close
              </Button>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* Guest Banner - Temporarily disabled for demo */}
      {false && isGuest && showGuestBanner && (
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

      {/* Header */}
      <header className="relative z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center relative px-4 sm:px-6 py-3 sm:py-4">
          {/* Left: Dashboard Icon */}
          <motion.button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-2 sm:left-6 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" />
          </motion.button>

          {/* Center: Company Name */}
          <div className="text-center">
            <motion.h1
              className="text-xl sm:text-2xl font-bold text-charcoal dark:text-white leading-relaxed"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Clairvyn
            </motion.h1>
            <motion.span
              className="text-xs text-gray-500 dark:text-gray-400 tracking-widest block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              BETA
            </motion.span>
          </div>

          {/* Right: User Info */}
          <div className="absolute right-2 sm:right-6 flex items-center gap-2 sm:gap-3">
            {user && (
              <>
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                  {user.email}
                </span>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
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
                setSidebarView("menu")
              }}
            />

            {/* Sidebar */}
            <motion.div
              className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl z-50"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-bold text-charcoal dark:text-white">
                    {sidebarView === "menu" ? "Dashboard" : "Chat History"}
                  </h2>
                  <motion.button
                    onClick={() => {
                      if (sidebarView === "history") {
                        setSidebarView("menu")
                      } else {
                        setIsSidebarOpen(false)
                        setSidebarView("menu")
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {sidebarView === "history" ? (
                      <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    ) : (
                      <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    )}
                  </motion.button>
                </div>

                {/* Sidebar content: Menu or History */}
                {sidebarView === "menu" ? (
                  <>
                    <nav className="space-y-2 mb-6 sm:mb-8">
                      {sidebarItems.map((item, index) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <button
                            onClick={() => {
                              item.action()
                              if (!item.keepOpen) setIsSidebarOpen(false)
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-white w-full text-left"
                          >
                            <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="font-medium text-sm sm:text-base">{item.label}</span>
                          </button>
                        </motion.div>
                      ))}
                    </nav>

                    {/* Profile Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-600 to-green-500 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {user ? (user.displayName || user.email) : "Guest User"}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                        {user ? "Signed in" : "Guest Mode"}
                      </p>
                    </div>
                  </div>

                  {/* Profile Actions */}
                  <div className="mt-3 sm:mt-4 space-y-2">
                    {user ? (
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 w-full text-left"
                      >
                        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-sm sm:text-base">Sign Out</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSignIn}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-white w-full text-left"
                      >
                        <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-sm sm:text-base">Sign In</span>
                      </button>
                    )}

                    {/* Dark Mode Toggle */}
                    <button
                      onClick={toggleDarkMode}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-white w-full text-left"
                    >
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-medium text-sm sm:text-base">Dark Mode</span>
                      <div className={`ml-auto w-6 h-3 rounded-full transition-colors ${isDarkMode ? 'bg-teal-600' : 'bg-gray-300'
                        }`}>
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-3' : 'translate-x-0'
                          }`} />
                      </div>
                    </button>

                  </div>
                    </div>
                  </>
                ) : (
                  /* History view */
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto -mr-2 pr-2 mt-2">
                      {isGuest || !user ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Sign in to save and view your chat history across devices.
                        </p>
                      ) : historyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                        </div>
                      ) : chatSessions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No chat history yet. Start a conversation to see it here!
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {chatSessions.map((session) => {
                            const firstUserMessage = session.messages.find((m) => m.role === "user")
                            const preview = session.title ?? firstUserMessage?.content?.slice(0, 50) ?? "New chat"
                            const displayPreview = preview.length >= 50 ? `${preview}...` : preview
                            const isActive = session.id === currentChatId

                            return (
                              <div
                                key={session.id}
                                className={`flex items-center gap-2 rounded-lg transition-colors ${
                                  isActive
                                    ? "bg-teal-100 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => loadChatSession(session.id)}
                                  className={`flex-1 min-w-0 p-3 text-left ${
                                    isActive ? "text-teal-700 dark:text-teal-300" : "text-gray-700 dark:text-gray-200"
                                  }`}
                                >
                                  <p className="font-medium text-sm truncate">{displayPreview}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {new Date(session.updatedAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteChat(e, session.id)}
                                  className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                  title="Delete chat"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)]">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-charcoal dark:text-white mb-2 px-4">
                Let's Build Something Together!
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4 pt-16 pb-32">
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
                    ? 'bg-gradient-to-r from-teal-600 to-green-500 text-white w-fit chat-bubble-user'
                    : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 min-w-[200px] sm:min-w-[280px] chat-bubble-assistant'
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-700"
                            onClick={() => downloadPng((message as any).extra_data?.document_id || "floorplan")}
                          >
                            Download image
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-700"
                            onClick={() => downloadDxf((message as any).extra_data?.document_id || (message as any).extra_data?.dxf_url?.split("/").pop()?.replace(".dxf", "") || "floorplan")}
                          >
                            Download DXF file
                          </Button>
                        </div>
                      )}

                      {(message as any).description && (
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg text-sm prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{(message as any).description}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <p className={`text-xs mt-2 sm:mt-3 ${message.role === 'user' ? 'text-teal-100' : 'text-gray-500 dark:text-gray-400'
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
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 p-3 sm:p-4 rounded-2xl shadow-lg">
                    <p className="text-sm sm:text-base leading-relaxed">Designing...</p>
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
                <div className="bg-white border-2 border-gray-200 text-gray-800 p-3 sm:p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-teal-600" />
                    <span className="text-xs sm:text-sm">Clairvyn is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Chat Input - Single Container with Smooth Animation */}
        <div className={`chat-input-container ${hasStarted ? "dock" : "start"}`}>
          <div className="chat-input">
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
              className="chat-input-field"
              disabled={isLoading}
            />
            <motion.button
              type="button"
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
  )
}
