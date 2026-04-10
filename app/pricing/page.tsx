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

const proFeatures = [
  "Unlimited floor plan generations",
  "Multi-step design workflows",
  "Advanced prompt controls",
  "CAD-exportable outputs",
  "Priority support",
  "Custom data retention",
] as const

const studioFeatures = [
  "Unlimited seats for students and faculty",
  "Curriculum integration support",
  "Institutional data governance",
  "Custom onboarding",
  "Priority support",
] as const

export default function PricingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  return (
    <div className="min-h-screen relative overflow-hidden overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #C0A8F2 0%, #FAF8F5 60%)' }}>
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/40 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/40 blur-3xl" />
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
          <h1 className="text-4xl font-bold text-[#1A1040] mb-4 md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[#5B4D8A] max-w-2xl mx-auto">
            Choose the plan that works for you. Start free, upgrade anytime.
          </p>
        </motion.div>

        {/* Pricing Cards - Three Equal Columns */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-20">
          {/* Starter Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/60 p-8 shadow-xl"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative flex flex-col h-full">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-[#A090C0] text-xs font-semibold tracking-wide mb-4">
                  FREE FOREVER
                </div>

                <h2 className="text-2xl font-bold text-[#1A1040] mb-2">Starter</h2>
                <p className="text-[#5B4D8A] text-sm mb-6">
                  Everything you need to explore architectural AI
                </p>

                <div className="mb-2">
                  <span className="text-5xl font-bold text-[#1A1040]">₹0</span>
                </div>
                <p className="text-[#5B4D8A] text-sm mb-8">No credit card required</p>
              </div>

              <Link
                href="/chatbot"
                className="w-full inline-flex items-center justify-center rounded-full bg-[#7C5CBF] text-white font-semibold py-3 px-6 transition-all hover:bg-[#5A3A9E] hover:shadow-lg hover:shadow-[rgba(124,92,191,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Get started free
              </Link>

              <div className="space-y-4">
                {starterFeatures.map((feature) => (
                  <div key={feature.label} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[#1A1040] text-sm">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Pro Tier - Highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="pro-pricing-card relative rounded-3xl bg-[rgba(192,168,242,0.18)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)] border-2 border-[#7C5CBF] p-8 shadow-[0_8px_32px_rgba(124,92,191,0.15)]"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative flex flex-col h-full">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-[rgba(139,92,246,0.12)] backdrop-blur-md border border-[rgba(139,92,246,0.25)] text-[#6D28D9] text-xs font-semibold tracking-wide mb-4" style={{ borderRadius: '9999px' }}>
                  FULL ACCESS
                </div>

                <h2 className="text-2xl font-bold text-[#1A1040] mb-2">Pro</h2>
                <p className="text-[#5B4D8A] text-sm mb-6">
                  Full power for architects who move fast
                </p>

                <div className="mb-2">
                  <span className="text-5xl font-bold text-[#1A1040]">₹299</span>
                  <span className="text-[#5B4D8A] text-lg">/month</span>
                </div>
                <p className="text-[#5B4D8A] text-sm mb-8">Billed monthly · cancel anytime</p>
              </div>

              <button
                onClick={() => setWaitlistOpen(true)}
                className="w-full inline-flex items-center justify-center rounded-full bg-[#7C5CBF] text-white font-semibold py-3 px-6 transition-all hover:bg-[#5A3A9E] hover:shadow-lg hover:shadow-[rgba(124,92,191,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Join waitlist
              </button>

              <div className="space-y-4">
                {proFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#22A06B] flex-shrink-0" />
                    <span className="text-[#1A1040] text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Studio Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/60 p-8 shadow-xl"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative flex flex-col h-full">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/60 text-[#A090C0] text-xs font-semibold tracking-wide mb-4">
                  FOR INSTITUTIONS
                </div>

                <h2 className="text-2xl font-bold text-[#1A1040] mb-2">Studio</h2>
                <p className="text-[#5B4D8A] text-sm mb-6">
                  Integration and access for architecture colleges
                </p>

                <div className="mb-2">
                  <span className="text-5xl font-bold text-[#1A1040]">Custom</span>
                </div>
                <p className="text-[#5B4D8A] text-sm mb-8">Tailored for your institution's needs</p>
              </div>

              <a
                href="mailto:hello@clairvyn.com"
                className="w-full inline-flex items-center justify-center rounded-full bg-[#7C5CBF] text-white font-semibold py-3 px-6 transition-all hover:bg-[#5A3A9E] hover:shadow-lg hover:shadow-[rgba(124,92,191,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Contact us
              </a>

              <div className="space-y-4">
                {studioFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[#1A1040] text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  )
}
