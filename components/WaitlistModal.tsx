"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

import { WaitlistSignup } from "@/components/WaitlistSignup"

type WaitlistModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps & { userEmail?: string }) {
  const [formKey, setFormKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  const skipNextReset = useRef(true)
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    if (skipNextReset.current) {
      skipNextReset.current = false
      return
    }
    setFormKey((k) => k + 1)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-[rgba(0,0,0,0.65)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-transparent bg-[#FAF8F5] dark:bg-[#242320] p-6 text-gray-900 dark:text-[#F0EBE0] shadow-2xl dark:shadow-[0_8px_40px_rgba(0,0,0,0.50)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm p-1 text-gray-500 dark:text-[#6B6458] opacity-70 ring-offset-white transition-opacity hover:opacity-100 hover:text-gray-700 dark:hover:text-[#F0EBE0] focus:outline-none focus:ring-2 focus:ring-[#7C5CBF] dark:focus:ring-[#9B7FD4] focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2 id="waitlist-modal-title" className="pr-8 text-lg font-semibold tracking-tight">
          Join the waitlist
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#A8A090]">
          Be the first to know when the Company plan is available.
        </p>
        <WaitlistSignup key={formKey} title="" className="mt-4" userEmail={user?.email || undefined} />
      </div>
    </div>,
    document.body
  )
}
