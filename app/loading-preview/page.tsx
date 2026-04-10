"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import TypingIndicator from "@/components/TypingIndicator"

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

const ASSISTANT_PHASE_END_MS = [120_000, 300_000, 420_000] as const

export default function LoadingPreview() {
  const [statusLine, setStatusLine] = useState("Interpreting your requirements")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    if (!isAnimating) return

    const now = Date.now()
    if (!startTime) {
      setStartTime(now)
      return
    }

    const elapsed = now - startTime

    // Determine which phase we're in
    let phaseIdx = 0
    let phaseStart = 0
    for (let i = 0; i < ASSISTANT_PHASE_END_MS.length; i++) {
      if (elapsed < ASSISTANT_PHASE_END_MS[i]) {
        phaseIdx = i
        break
      }
      phaseStart = ASSISTANT_PHASE_END_MS[i]
      phaseIdx = i + 1
    }

    // Get the phase messages
    const phaseMessages = ASSISTANT_STATUS_PHASES[Math.min(phaseIdx, ASSISTANT_STATUS_PHASES.length - 1)]
    if (!phaseMessages) {
      setStatusLine("Almost ready")
      return
    }

    // Calculate which message in the phase
    const phaseElapsed = elapsed - phaseStart
    const msgInterval = (ASSISTANT_PHASE_END_MS[phaseIdx] || 600_000) - phaseStart
    const msgDuration = msgInterval / phaseMessages.length
    const msgIdx = Math.floor(phaseElapsed / msgDuration) % phaseMessages.length

    setStatusLine(phaseMessages[msgIdx])
  }, [startTime, isAnimating])

  useEffect(() => {
    const interval = setInterval(() => {
      setStartTime(null)
    }, 600_000) // Reset every 10 minutes

    return () => clearInterval(interval)
  }, [])

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating)
    if (isAnimating) {
      setStartTime(null)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #C0A8F2 0%, #FAF8F5 52%, #C8DCFA 100%)' }}>
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/40 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/40 blur-3xl" />
      </div>

      <main className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-950 mb-4">Loading Animation Preview</h1>
            <p className="text-gray-600">This is what the loading indicator looks like while processing</p>
          </div>

          {/* Loading indicator simulation */}
          <div className="mb-12 flex justify-start">
            {isAnimating && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="flex justify-start w-full"
              >
                <div className="chat-bubble-assistant text-gray-700 dark:text-gray-300 p-3 sm:p-4 rounded-2xl shadow-md bg-gradient-to-br from-white/92 via-[#F8F5FF]/90 to-[#EDE8FA]/88 border border-[#D4C8F0]/40 backdrop-blur-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rotating House Icon */}
                    <TypingIndicator />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={statusLine}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="text-xs sm:text-sm font-medium text-[#7C5CBF] min-w-0 flex-1"
                      >
                        {statusLine}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Controls */}
          <div className="text-center">
            <button
              onClick={toggleAnimation}
              className="inline-flex items-center justify-center rounded-full bg-[#7C5CBF] text-white font-semibold py-3 px-8 transition-all hover:bg-[#5A3A9E] hover:shadow-lg hover:shadow-[rgba(124,92,191,0.25)] active:scale-95"
            >
              {isAnimating ? "Pause" : "Start"} Animation
            </button>
            <p className="mt-6 text-sm text-gray-600">
              Current status: <span className="font-semibold text-gray-800">{statusLine}</span>
            </p>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* Styles removed - using animate-spin-smooth from globals.css */
      `}</style>
    </div>
  )
}
