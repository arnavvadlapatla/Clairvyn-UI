"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X, MessageSquare, Bug, Star } from "lucide-react"
import { analytics } from "@/lib/analytics"

type FeedbackType = "bug" | "feature" | "rating"

interface FeedbackWidgetProps {
  position?: "bottom-right" | "bottom-left"
}

export function FeedbackWidget({
  position = "bottom-right",
}: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
  const [message, setMessage] = useState("")
  const [rating, setRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim() && selectedType !== "rating") return

    setIsSubmitting(true)
    try {
      // Track the feedback submission
      analytics.trackEvent(`feedback_${selectedType}`, {
        message,
        rating: selectedType === "rating" ? rating : undefined,
      })

      // Send to backend
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          message: selectedType === "rating" ? `Rating: ${rating}/5` : message,
          rating: selectedType === "rating" ? rating : undefined,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setIsOpen(false)
          setSelectedType(null)
          setMessage("")
          setRating(0)
          setSubmitted(false)
        }, 2000)
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const positionClasses =
    position === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"

  return (
    <div className={`fixed ${positionClasses} z-40`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="mb-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
          >
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-green-500 text-3xl mb-2">✓</div>
                <p className="text-sm font-medium text-gray-900">
                  Thank you for your feedback!
                </p>
              </div>
            ) : selectedType ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {selectedType === "bug"
                      ? "Report a Bug"
                      : selectedType === "feature"
                        ? "Request a Feature"
                        : "Rate Us"}
                  </h3>
                  <button
                    onClick={() => setSelectedType(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedType === "rating" ? (
                  <div className="flex gap-2 justify-center py-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="text-2xl transition-transform hover:scale-110"
                      >
                        {star <= rating ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    className="w-full px-3 py-2 border border-[#D4C8F0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CBF]"
                    rows={3}
                  />
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    (selectedType !== "rating" && !message.trim()) ||
                    (selectedType === "rating" && rating === 0)
                  }
                  className="w-full bg-[#7C5CBF] hover:bg-[#5A3A9E] text-sm"
                >
                  {isSubmitting ? "Sending..." : "Submit"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  Help us improve
                </p>
                <button
                  onClick={() => setSelectedType("bug")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                >
                  <Bug className="w-4 h-4" />
                  Report a Bug
                </button>
                <button
                  onClick={() => setSelectedType("feature")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Request a Feature
                </button>
                <button
                  onClick={() => setSelectedType("rating")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  Rate Us
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full bg-[#7C5CBF] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        aria-label="Feedback"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageSquare className="w-6 h-6" />
        )}
      </motion.button>
    </div>
  )
}
