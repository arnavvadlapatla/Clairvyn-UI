"use client"

import { useState } from "react"

export default function AboutModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Inline link styled like other quicklinks */}
      <button
        onClick={() => {
          console.log('About button clicked!')
          setOpen(true)
        }}
        className="text-gray-600 hover:text-teal-600 transition-colors font-medium focus:outline-none"
      >
        About
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                About Clairvyn
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close about"
                className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="prose prose-sm dark:prose-invert text-sm leading-relaxed space-y-4">
                <p>
                  At <strong>Clairvyn</strong>, we're building AI-powered tools for architects and
                  civil engineers to take a project from idea to execution using simple prompts. Our
                  platform lets users generate floor plans, detect design flaws, estimate costs, and
                  collaborate, all in seconds, without needing CAD expertise.
                </p>

                <p>
                  We've built a proprietary system with a custom compiler, rendering engine, and
                  real-time interface designed for natural language and voice. It understands
                  spatial logic, constraints, and user intent, giving professionals speed without
                  losing precision.
                </p>

                <p>
                  Clairvyn also runs an in-house AI research division focused on spatially aware
                  models, reinforcement learning, and design intelligence. We're not just making
                  faster tools. We're rethinking how design works in the AI era.
                </p>

                <p>
                  <strong>Clairvyn — Disrupting the Ordinary.</strong>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

