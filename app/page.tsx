"use client"


import { motion } from "framer-motion"
import { Instagram, Linkedin, Mail } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { LandingHeader } from "@/components/LandingHeader"


export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [heroStack, setHeroStack] = useState([0, 1, 2] as number[])
  const [leavingId, setLeavingId] = useState<number | null>(null)
  const [heroStackStep, setHeroStackStep] = useState(22)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const apply = () => setHeroStackStep(mq.matches ? 10 : 22)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Prefetch chatbot so redirect feels instant
  useEffect(() => {
    router.prefetch("/chatbot")
  }, [router])

  const heroSlides = [
    { src: "/landing/landing_2.png", alt: "Clairvyn editor preview", objectPosition: "50% 45%" },
    { src: "/landing/landing_1.png", alt: "Clairvyn editor preview", objectPosition: "55% 20%" },
    { src: "/landing/landing_3.png", alt: "Clairvyn editor preview", objectPosition: "75% 55%" },
  ] as const

  useEffect(() => {
    const holdMs = 2200
    const id = window.setInterval(() => {
      // Drive rotation off animation completion for seamless motion.
      if (leavingId !== null) return
      setLeavingId(heroStack[0] ?? null)
    }, holdMs)

    return () => window.clearInterval(id)
  }, [heroStack, leavingId])

  // If already logged in, redirect to chat screen immediately
  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace("/chatbot")
    }
  }, [user, loading, router])

  const handleTryIt = () => {
    console.log('handleTryIt called')
    if (user) {
      console.log('User is authenticated, redirecting to /chatbot')
      router.push("/chatbot")
    } else {
      console.log('User is not authenticated, redirecting to /signup')
      router.push("/signup")
    }
  }

  // Don't show landing page while checking auth — logged-in users go straight to chat
  if (loading || user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f6f4ff]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/60 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/60 blur-3xl" />
        <div className="absolute bottom-[-240px] left-[20%] h-[640px] w-[640px] rounded-full bg-indigo-300/50 blur-3xl" />
      </div>

      <LandingHeader />

      <div className="relative z-10 mx-auto w-full max-w-full touch-safe-x touch:pb-12 touch:pt-24 desktop:container desktop:px-4 desktop:pb-16 desktop:pt-36">
        <div className="mx-auto max-w-6xl">
          {/* Hero — touch: column stack + full-width CTA; desktop: grid unchanged */}
          <section className="touch:mb-12 touch:flex touch:flex-col touch:gap-10 desktop:mb-16 desktop:grid desktop:grid-cols-12 desktop:items-center desktop:gap-10">
            <div className="w-full min-w-0 desktop:col-span-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600 touch:mb-4 touch:text-[11px] desktop:mb-4 desktop:text-xs desktop:tracking-widest">
                DESIGN SMARTER, NOT HARDER
              </div>
              <h1 className="font-extrabold tracking-tight text-[#0b1a3c] touch:text-[1.65rem] touch:leading-snug desktop:text-5xl desktop:leading-tight desktop:lg:text-6xl">
                Design Architectural <br className="hidden desktop:block" />
                Floor plans using <br className="hidden desktop:block" />
                Simple Prompts.
              </h1>
              <div className="mt-8 touch:mt-10">
                <button
                  onClick={handleTryIt}
                  className="group flex h-12 w-full min-h-12 touch:w-full touch:px-6 items-center justify-center gap-2 rounded-full bg-[#1e2bd6] px-8 text-base font-semibold text-white shadow-md transition-all hover:shadow-lg hover:bg-[#1a24b8] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed desktop:inline-flex desktop:h-auto desktop:w-auto desktop:min-h-0 desktop:py-5 desktop:text-[1em]"
                >
                  Try Now
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>

            <div className="w-full min-w-0 max-w-full desktop:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative mx-auto max-w-full origin-left desktop:mx-0 desktop:lg:scale-[1.08]"
              >
                <div className="absolute -inset-6 touch:-inset-3 rounded-[40px] bg-gradient-to-br from-white/60 to-white/10 blur-xl" />

                <div className="relative max-w-full overflow-hidden rounded-[16px] border border-black/8 bg-white/80 shadow-[0_40px_100px_rgba(30,43,214,0.22),0_8px_32px_rgba(0,0,0,0.10)] backdrop-blur-md desktop:overflow-visible desktop:rounded-[20px]">
                  <div className="relative aspect-[16/9] max-w-full overflow-hidden desktop:overflow-visible">
                    {heroStack.map((slideIdx, stackPos) => {
                      const isLeaving = slideIdx === leavingId

                      const base = {
                        x: stackPos * heroStackStep,
                        y: stackPos * heroStackStep,
                        scale: 1 - stackPos * 0.035,
                        opacity: 1 - stackPos * 0.24,
                      }

                      const leaving = {
                        x: 0,
                        y: -10,
                        scale: 1.01,
                        opacity: 0,
                      }

                      return (
                        <motion.div
                          key={slideIdx}
                          initial={false}
                          animate={isLeaving ? leaving : base}
                          transition={{ duration: 0.52, ease: "easeInOut" }}
                          className="absolute inset-0"
                          style={{ zIndex: 10 - stackPos }}
                          onAnimationComplete={() => {
                            if (!isLeaving) return
                            setHeroStack((prev) => [...prev.slice(1), prev[0]])
                            setLeavingId(null)
                          }}
                        >
                          <div className="absolute inset-0">
                            <div className="absolute inset-0 rounded-[18px] overflow-hidden border border-black/6 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">

                              {/* macOS Safari-style browser chrome */}
                              <div className="flex items-center gap-2 px-3 py-[9px] border-b border-black/[0.07] bg-[#ececec]">
                                {/* Traffic lights */}
                                <div className="flex items-center gap-[5px]">
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                </div>

                                {/* Sidebar toggle */}
                                <svg viewBox="0 0 18 14" className="h-[14px] w-[14px] text-gray-400 ml-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="1" y="1" width="16" height="12" rx="2" />
                                  <line x1="6" y1="1" x2="6" y2="13" />
                                </svg>

                                {/* URL bar – centered */}
                                <div className="flex-1 flex justify-center">
                                  <div className="flex items-center gap-1.5 bg-white/90 rounded-[7px] px-2.5 py-[4px] text-[10px] text-gray-500 border border-black/10 w-full max-w-[200px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                                    {/* Shield / lock icon */}
                                    <svg viewBox="0 0 10 12" className="h-[10px] w-[10px] shrink-0 opacity-50" fill="currentColor">
                                      <path d="M5 0L1 2v4c0 2.5 1.7 4.7 4 5 2.3-.3 4-2.5 4-5V2L5 0zm0 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                                    </svg>
                                    <span className="font-medium flex-1 text-center tracking-tight">clairvyn.com</span>
                                    {/* Refresh icon */}
                                    <svg viewBox="0 0 12 12" className="h-[10px] w-[10px] shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10.5 6a4.5 4.5 0 1 1-1.32-3.18" />
                                      <polyline points="9.5,1.5 9.5,4.5 6.5,4.5" />
                                    </svg>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-[9px] text-gray-400">
                                  {/* Share */}
                                  <svg viewBox="0 0 14 16" className="h-[14px] w-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M7 1v10M3 5l4-4 4 4M1 11v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
                                  </svg>
                                  {/* Plus */}
                                  <svg viewBox="0 0 12 12" className="h-[13px] w-[13px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                                    <path d="M6 2v8M2 6h8" />
                                  </svg>
                                  {/* Tabs grid */}
                                  <svg viewBox="0 0 14 14" className="h-[13px] w-[13px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="3" width="9" height="10" rx="1.5" />
                                    <path d="M4 3V2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" />
                                  </svg>
                                </div>
                              </div>

                              {/* Window content */}
                              <div className="relative w-full h-[calc(100%-44px)]">
                                <Image
                                  src={heroSlides[slideIdx].src}
                                  alt={heroSlides[slideIdx].alt}
                                  fill
                                  priority={stackPos === 0}
                                  className="object-cover"
                                  style={{ objectPosition: heroSlides[slideIdx].objectPosition }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom-left bubbles removed */}
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section
            id="features"
            className="mx-auto grid max-w-6xl grid-cols-1 touch:mb-14 touch:gap-7 desktop:mb-20 desktop:grid-cols-3 desktop:gap-8"
          >
            {[
              {
                image: { src: "/landing/floor_plan.png", alt: "Floor plan design", objectPosition: "50% 50%" },
                title: "Floor plan design",
                description: "Create detailed floor plans with intelligent suggestions and real-time feedback",
                color: "from-[#e9edff] to-white",
              },
              {
                image: { src: "/landing/cad_projects.png", alt: "CAD Projects", objectPosition: "50% 50%" },
                title: "CAD Projects",
                description: "Get assistance with CAD modeling, technical drawings, and design specifications",
                color: "from-[#eef7ff] to-white",
              },
              {
                image: { src: "/landing/student_focused.png", alt: "Student Focused", objectPosition: "50% 50%" },
                title: "Student Focused",
                description: "Tailored specifically for architecture students with educational guidance",
                color: "from-[#f1efff] to-white",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.06 }}
                className="rounded-2xl border border-purple-500/7 bg-gradient-to-b from-white to-[#C8BFFB] p-6 text-center shadow-sm backdrop-blur transition-shadow hover:shadow-xl desktop:rounded-[28px] desktop:p-12"
              >
                <div
                  className={`mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-[28px] bg-gradient-to-br shadow-[0_22px_55px_rgba(30,43,214,0.14)] desktop:mb-9 desktop:h-48 desktop:w-48 desktop:rounded-[34px] ${feature.color}`}
                >
                  <div className="relative h-32 w-32 overflow-hidden rounded-[22px] border border-black/5 bg-white/85 shadow-sm desktop:h-40 desktop:w-40 desktop:rounded-[26px]">
                    <Image
                      src={feature.image.src}
                      alt={feature.image.alt}
                      fill
                      className="object-contain"
                      style={{ objectPosition: feature.image.objectPosition }}
                      sizes="96px"
                    />
                  </div>
                </div>
                <h3 className="mb-3 text-lg font-bold text-[#0b1a3c] desktop:mb-4 desktop:text-xl">{feature.title}</h3>
                <p className="text-base font-medium leading-relaxed text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </section>
        </div>
      </div>

      {/* Footer - fades in from transparent for seamless transition */}
      <footer className="relative z-10 mt-12 overflow-hidden bg-gradient-to-b from-transparent to-white">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-white/50" aria-hidden />
        {/* Backdrop-blurred top strip */}
        <div className="relative mx-auto w-full max-w-full touch-safe-x touch:py-10 py-8 desktop:container desktop:px-4 desktop:py-8">
          {/* Badges */}
          <div className="mt-8 flex flex-col items-center touch:mt-10 desktop:mt-12">
            <h3 className="mb-4 text-lg font-semibold text-gray-700">Backed By</h3>
            <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-6 py-2 touch:gap-x-3 touch:gap-y-5 desktop:flex-nowrap desktop:gap-8">
              <img src="/nvidia-inception.png" alt="NVIDIA Inception" className="h-14 max-h-16 w-auto max-w-[min(200px,42vw)] object-contain desktop:h-20 desktop:max-w-[200px]" />
              <img src="/aws-activate.png" alt="AWS Activate" className="h-14 max-h-16 w-auto max-w-[min(200px,42vw)] object-contain desktop:h-20 desktop:max-w-[200px]" />
              <img src="/Microsoft-for-Startups.png" alt="Microsoft for Startups" className="h-14 max-h-16 w-auto max-w-[min(200px,42vw)] object-contain desktop:h-20 desktop:max-w-[200px]" />
              <img src="/Amplitude.png" alt="Amplitude" className="h-14 max-h-16 w-auto max-w-[min(200px,42vw)] object-contain desktop:h-20 desktop:max-w-[200px]" />
              <img src="/Auth0.svg.png" alt="Auth0" className="h-14 max-h-16 w-auto max-w-[min(200px,42vw)] object-contain desktop:h-20 desktop:max-w-[200px]" />
            </div>
          </div>

          <div className="mt-10 flex flex-col touch:mt-12 touch:gap-12 gap-10 desktop:mt-0 desktop:flex-row desktop:items-start desktop:justify-between desktop:gap-0">
            {/* Quicklinks */}
            <div className="flex-1">
              <h3 className="mb-4 text-lg font-semibold text-charcoal touch:mb-3">Quicklinks</h3>
              <div className="flex flex-col touch:gap-2 gap-1 desktop:flex-row desktop:flex-wrap desktop:items-center desktop:gap-6">
                <Link
                  href="/terms-of-service"
                  className="flex min-h-12 items-center rounded-lg text-base font-medium text-gray-600 transition-colors hover:text-[#1e2bd6] focus:outline-none hover:underline desktop:min-h-0 desktop:text-[15px]"
                >
                  Terms of Service
                </Link>
                <Link
                  href="/privacy-policy"
                  className="flex min-h-12 items-center rounded-lg text-base font-medium text-gray-600 transition-colors hover:text-[#1e2bd6] focus:outline-none hover:underline desktop:min-h-0 desktop:text-[15px]"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/consent-notice"
                  className="flex min-h-12 items-center rounded-lg text-base font-medium text-gray-600 transition-colors hover:text-[#1e2bd6] focus:outline-none hover:underline desktop:min-h-0 desktop:text-[15px]"
                >
                  Consent Notice
                </Link>
              </div>
            </div>

            {/* Connect */}
            <div className="flex flex-1 justify-center desktop:justify-end">
              <div className="text-center">
                <h3 className="mb-4 text-lg font-semibold text-charcoal">Connect</h3>
                <div className="flex justify-center touch:gap-8 gap-6 desktop:space-x-8">
                  {/* Instagram */}
                  <a
                    href="https://www.instagram.com/clairvyn.ai?igsh=ZnR4M3dhd255aGhq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 group"
                  >
                    <Instagram size={24} className="text-gray-600 transition-colors group-hover:text-blue-500" />
                  </a>

                  {/* LinkedIn */}
                  <a
                    href="https://www.linkedin.com/company/clairvyn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 group"
                  >
                    <Linkedin size={24} className="text-gray-600 transition-colors group-hover:text-blue-700" />
                  </a>

                  {/* Email */}
                  <a
                    href="mailto:hello@clairvyn.com"
                    className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 group"
                  >
                    <Mail size={24} className="text-gray-600 transition-colors group-hover:text-[#1e2bd6]" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright removed per request */}
        </div>
      </footer>

    </div>
  )
}
