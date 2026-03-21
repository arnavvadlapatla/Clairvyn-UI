"use client"

import { useState } from "react"
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal"

export default function TermsModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray-600 hover:text-teal-600 transition-colors font-medium focus:outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Terms of Service
      </button>

      <TermsOfServiceModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
