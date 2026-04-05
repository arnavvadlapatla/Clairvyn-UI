"use client"

import { motion } from "framer-motion"
import { AlertCircle, X } from "lucide-react"

interface ErrorStateProps {
  title: string
  message: string
  onDismiss?: () => void
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: "primary" | "secondary"
  }>
}

export function ErrorState({ title, message, onDismiss, actions }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="error-state"
    >
      <AlertCircle className="error-state-icon w-5 h-5" strokeWidth={2} />
      <div className="error-state-content">
        <div className="error-state-title">{title}</div>
        <div className="error-state-message">{message}</div>
        {actions && actions.length > 0 && (
          <div className="error-state-action flex gap-3 mt-3">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className={`text-sm font-medium transition-colors ${
                  action.variant === "secondary"
                    ? "text-gray-600 hover:text-gray-800"
                    : "text-[#dc2626] hover:text-[#b91c1c]"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      )}
    </motion.div>
  )
}

interface SuccessStateProps {
  title: string
  message: string
  onDismiss?: () => void
}

export function SuccessState({ title, message, onDismiss }: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="success-state"
    >
      <div className="success-state-icon w-5 h-5">
        <svg
          className="w-full h-full"
          fill="currentColor"
          viewBox="0 0 20 20"
          strokeWidth={2}
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="success-state-content">
        <div className="success-state-title">{title}</div>
        <div className="success-state-message">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Dismiss success"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      )}
    </motion.div>
  )
}
