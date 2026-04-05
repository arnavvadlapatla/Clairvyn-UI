"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import Link from "next/link"
import { LandingHeader } from "@/components/LandingHeader"
import { WaitlistModal } from "@/components/WaitlistModal"

const starterFeatures = [
  { label: "3 floor plan generations", included: true },
  { label: "Basic prompt assistance", included: true },
  { label: "CAD-exportable outputs", included: true },
] as const

const blueprintProFeatures = [
  "Unlimited floor plan generations",
  "Multi-step design workflows",
  "Advanced prompt controls",
  "CAD-exportable outputs",
  "Priority support",
  "Custom data retention",
] as const

export default function PricingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/30 relative overflow-hidden overflow-x-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/50 to-indigo-100/30" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/40 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/40 blur-3xl" />
        <div className="absolute bottom-[-240px] left-[20%] h-[640px] w-[640px] rounded-full bg-indigo-300/30 blur-3xl" />
      </div>

      <LandingHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-4xl font-bold text-gray-950 mb-4 md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that works for you. Start free, upgrade anytime.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          {/* Starter Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/60 p-8 shadow-xl"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative">
              <div className="inline-block px-3 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-gray-700 text-xs font-semibold tracking-wide mb-4">
                FREE FOREVER
              </div>

              <h2 className="text-2xl font-bold text-gray-950 mb-2">Starter</h2>
              <p className="text-gray-600 text-sm mb-6">
                Everything you need to explore architectural AI
              </p>

              <div className="mb-2">
                <span className="text-5xl font-bold text-gray-950">₹0</span>
              </div>
              <p className="text-gray-600 text-sm mb-8">No credit card required</p>

              <Link
                href="/chatbot"
                className="w-full inline-flex items-center justify-center rounded-full bg-[#1e2bd6] text-white font-semibold py-3 px-6 transition-all hover:bg-[#1a24b8] hover:shadow-lg hover:shadow-[rgba(30,43,214,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Get started free
              </Link>

              <div className="space-y-4">
                {starterFeatures.map((feature) => (
                  <div key={feature.label} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Blueprint Pro Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-3xl bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-indigo-500/10 backdrop-blur-2xl border-2 border-white/70 p-8 shadow-2xl ring-1 ring-white/50"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative">
              <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/30 backdrop-blur-md border border-white/60 text-indigo-900 text-xs font-semibold tracking-wide mb-4">
                FULL ACCESS
              </div>

              <h2 className="text-2xl font-bold text-gray-950 mb-2">Blueprint Pro</h2>
              <p className="text-gray-600 text-sm mb-6">
                Full power for architects who move fast
              </p>

              <div className="mb-2">
                <span className="text-5xl font-bold text-gray-950">₹299</span>
                <span className="text-gray-600 text-lg">/month</span>
              </div>
              <p className="text-gray-600 text-sm mb-8">Billed monthly · cancel anytime</p>

              <button
                onClick={() => setWaitlistOpen(true)}
                className="w-full inline-flex items-center justify-center rounded-full bg-[#1e2bd6] text-white font-semibold py-3 px-6 transition-all hover:bg-[#1a24b8] hover:shadow-lg hover:shadow-[rgba(30,43,214,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Join waitlist
              </button>

              <div className="space-y-4">
                {blueprintProFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Institutions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative max-w-2xl mx-auto rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/60 p-12 text-center shadow-xl"
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative">
            <h3 className="text-2xl font-bold text-gray-950 mb-3">For Institutions</h3>
            <p className="text-gray-600 mb-8">
              Curriculum integration, bulk access, and institutional licensing for architecture colleges and universities.
            </p>
            <a
              href="mailto:hello@clairvyn.com"
              className="inline-flex items-center justify-center rounded-full border-2 border-gray-950 text-gray-950 font-semibold py-3 px-8 transition-colors hover:bg-gray-950 hover:text-white"
            >
              Contact us
            </a>
          </div>
        </motion.div>
      </main>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  )
}
