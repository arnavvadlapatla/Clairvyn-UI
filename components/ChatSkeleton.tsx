"use client"

import { motion } from "framer-motion"

export function ChatMessageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex justify-start"
    >
      <div className="chat-bubble-assistant p-3 sm:p-4 rounded-2xl max-w-md">
        <div className="space-y-3">
          {/* Multiple skeleton lines for natural look */}
          <div className="skeleton skeleton-text w-full" />
          <div className="skeleton skeleton-text w-5/6" />
          <div className="skeleton skeleton-text w-4/5" />
          <div className="skeleton skeleton-text w-3/4" />
        </div>
      </div>
    </motion.div>
  )
}

export function ChatInputSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-12 rounded-full skeleton"
    />
  )
}

export function ChatHistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="h-10 rounded-lg skeleton"
        />
      ))}
    </div>
  )
}
