"use client"

import { motion } from "framer-motion"
import { MessageSquare, Inbox, AlertCircle } from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  type: "no-chats" | "no-generations" | "error"
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ type, title, description, action }: EmptyStateProps) {
  const getIcon = () => {
    switch (type) {
      case "no-chats":
        return <MessageSquare className="empty-state-icon" strokeWidth={1.5} />
      case "no-generations":
        return <Inbox className="empty-state-icon" strokeWidth={1.5} />
      case "error":
        return <AlertCircle className="empty-state-icon" strokeWidth={1.5} />
      default:
        return null
    }
  }

  const Icon = getIcon()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="empty-state"
    >
      {Icon}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <div className="empty-state-action">
          {action.href ? (
            <Link
              href={action.href}
              className="btn-premium btn-premium-primary rounded-lg px-6 py-2.5 text-sm"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="btn-premium btn-premium-primary rounded-lg px-6 py-2.5 text-sm"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
