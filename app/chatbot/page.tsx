"use client"

import { useState, useEffect } from "react"
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
  Star
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { useRouter } from "next/navigation"
import {
  createChatSession,
  addMessageToChat,
  simulateAIResponse,
  Message as ChatMessage,
  getGuestChats,
  saveGuestChats,
  clearGuestChats
} from "@/lib/chat-service"
export default function ChatbotPage() {
  const { user, logout, loading: authLoading, isGuest } = useAuth()
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
  const [rating, setRating] = useState(0)
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
  const [showGuestBanner, setShowGuestBanner] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  // Load messages on mount
  useEffect(() => {
    if (user && !currentChatId) {
      createNewChat()
    } else if (isGuest) {
      // Load guest chats from localStorage
      const guestMessages = getGuestChats()
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
    if (user) {
      setIsLoading(true)
      try {
        const chatId = await createChatSession(user.uid)
        setCurrentChatId(chatId)
        setMessages([])
        setHasStarted(false) // Reset to initial state
      } catch (error) {
        console.error("Error creating chat session:", error)
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

    // Add user message to UI immediately
    setMessages(prev => [...prev, { ...userMessage, timestamp: new Date().toISOString() }])

    // Clear input and update placeholder for next turn
    setInputValue("")
    if (isFirstSubmit) {
      setPlaceholderText("Make the Living Room Bigger")
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

    try {
      if (user && currentChatId) {
        // Add user message to Firestore
        await addMessageToChat(currentChatId, userMessage)
      }

      // Call the real API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response from AI')
      }

      const data = await response.json()
      const aiResponse = data.reply

      const assistantMessage: Omit<ChatMessage, 'timestamp'> = {
        role: 'assistant',
        content: aiResponse
      }

      if (user && currentChatId) {
        // Add AI response to Firestore
        await addMessageToChat(currentChatId, assistantMessage)
      }

      // Add AI response to UI
      setMessages(prev => [...prev, { ...assistantMessage, timestamp: new Date().toISOString() }])
    } catch (error) {
      console.error("Error sending message:", error)
      // Add error message to UI
      const errorMessage: Omit<ChatMessage, 'timestamp'> = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again."
      }
      setMessages(prev => [...prev, { ...errorMessage, timestamp: new Date().toISOString() }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/")
    } catch (error) {
      console.error("Error logging out:", error)
    }
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

  const handleHistory = () => {
    // TODO: Implement history functionality
    alert("History feature coming soon!")
  }

  const sidebarItems = [
    { icon: Plus, label: "New Design", action: createNewChat },
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

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>We value your feedback!</DialogTitle>
            <DialogDescription>
              Help us improve your design experience.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Rate Accuracy</h4>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 cursor-pointer transition-colors ${star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-gray-600 hover:text-yellow-400"
                      }`}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Your Experience</h4>
              <Textarea
                placeholder="Tell us what you liked or what needs improvement..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="resize-none"
              />
            </div>
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
                // TODO: Submit feedback to backend
                console.log({ rating, feedbackText })
                setShowFeedback(false)
                setFeedbackSubmitted(true)
                alert("Thank you for your feedback!")
              }}
              disabled={rating === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
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
              onClick={() => setIsSidebarOpen(false)}
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
                  <h2 className="text-lg sm:text-xl font-bold text-charcoal dark:text-white">Dashboard</h2>
                  <motion.button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </motion.button>
                </div>

                {/* Navigation Items */}
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
                          setIsSidebarOpen(false)
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
                  {/* Support for image and description from demo script */}
                  {(message as any).image && (
                    <div className="mt-3 space-y-2">
                      <img src={(message as any).image} alt="Generated" className="rounded-lg shadow-md border max-w-full h-auto" />
                      {(message as any).description && (
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg text-sm prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{(message as any).description}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
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
