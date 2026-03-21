"use client"


import { motion } from "framer-motion"
import { Instagram, Linkedin, Mail } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"


export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [heroStack, setHeroStack] = useState([0, 1, 2] as number[])
  const [leavingId, setLeavingId] = useState<number | null>(null)

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
      console.log('User is not authenticated, redirecting to /signin')
      router.push("/signin")
    }
  }

  // Don't show landing page while checking auth — logged-in users go straight to chat
  if (loading || user) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black relative overflow-hidden overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f6f4ff] dark:from-black dark:via-black dark:to-[#0b0a14]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/60 blur-3xl dark:bg-purple-500/20" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/60 blur-3xl dark:bg-blue-500/20" />
        <div className="absolute bottom-[-240px] left-[20%] h-[640px] w-[640px] rounded-full bg-indigo-300/50 blur-3xl dark:bg-indigo-500/20" />
      </div>

      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mt-4 rounded-3xl border border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/light.png"
                  alt="Clairvyn"
                  width={120}
                  height={40}
                  className="dark:hidden"
                  priority
                />
              </Link>

              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700 dark:text-gray-200">
                <a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
                <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link>
                <button
                  onClick={() => setAboutOpen(true)}
                  className="hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  About
                </button>
              </nav>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/signup")}
                  className="rounded-full bg-[#1e2bd6] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-28 md:pt-36 pb-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <section className="grid lg:grid-cols-12 gap-10 items-center mb-16">
            <div className="lg:col-span-5">
              <div className="text-xs font-semibold tracking-widest text-gray-600 dark:text-gray-300 mb-4">
                DESIGN SMARTER, NOT HARDER
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0b1a3c] dark:text-white leading-tight">
                Design Architectural <br className="hidden sm:block" />
                Floor plans using <br className="hidden sm:block" />
                Simple Prompts.
              </h1>
              <div className="mt-8">
                <button
                  onClick={handleTryIt}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#1e2bd6] px-8 py-5 text-[1em] font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
                >
                  Try Now
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative lg:scale-[1.08] origin-left"
              >
                <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-white/60 to-white/10 dark:from-white/10 dark:to-white/5 blur-xl" />

                <div className="relative overflow-visible rounded-[20px] border border-black/8 bg-white/80 backdrop-blur-md shadow-[0_40px_100px_rgba(30,43,214,0.22),0_8px_32px_rgba(0,0,0,0.10)] dark:border-white/10 dark:bg-[#1a1a1a]/80">
                  <div className="relative aspect-[16/9] overflow-visible">
                    {heroStack.map((slideIdx, stackPos) => {
                      const isLeaving = slideIdx === leavingId

                      const base = {
                        x: stackPos * 22,
                        y: stackPos * 22,
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
                            <div className="absolute inset-0 rounded-[18px] overflow-hidden border border-black/6 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#1c1c1c]">

                              {/* macOS Safari-style browser chrome */}
                              <div className="flex items-center gap-2 px-3 py-[9px] border-b border-black/[0.07] dark:border-white/10 bg-[#ececec] dark:bg-[#2a2a2a]">
                                {/* Traffic lights */}
                                <div className="flex items-center gap-[5px]">
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                  <span className="h-[11px] w-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]" />
                                </div>

                                {/* Sidebar toggle */}
                                <svg viewBox="0 0 18 14" className="h-[14px] w-[14px] text-gray-400 dark:text-gray-500 ml-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="1" y="1" width="16" height="12" rx="2" />
                                  <line x1="6" y1="1" x2="6" y2="13" />
                                </svg>

                                {/* URL bar – centered */}
                                <div className="flex-1 flex justify-center">
                                  <div className="flex items-center gap-1.5 bg-white/90 dark:bg-[#3c3c3c] rounded-[7px] px-2.5 py-[4px] text-[10px] text-gray-500 dark:text-gray-400 border border-black/10 dark:border-white/10 w-full max-w-[200px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
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
                                <div className="flex items-center gap-[9px] text-gray-400 dark:text-gray-500">
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
          <section id="features" className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
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
                className="text-center p-10 md:p-12 rounded-[28px] bg-white/75 dark:bg-white/5 border border-purple-500/7 dark:border-white/10 hover:shadow-xl transition-shadow backdrop-blur"
              >
                <div
                  className={`w-48 h-48 bg-gradient-to-br ${feature.color} rounded-[34px] flex items-center justify-center mx-auto mb-9 shadow-[0_22px_55px_rgba(30,43,214,0.14)]`}
                >
                  <div className="relative h-40 w-40 rounded-[26px] overflow-hidden bg-white/85 border border-black/5 shadow-sm">
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
                <h3 className="text-xl font-bold text-[#0b1a3c] dark:text-white mb-4">{feature.title}</h3>
                <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed font-medium">{feature.description}</p>
              </motion.div>
            ))}
          </section>
        </div>
      </div>

      {/* Footer - fades in from transparent for seamless transition */}
      <footer className="relative z-10 mt-12 overflow-hidden bg-gradient-to-b from-transparent to-white dark:to-gray-900">
      <div className="absolute inset-x-0 top-0 h-32 from-black to-white/50 dark:to-gray-900/80" aria-hidden />
        {/* Backdrop-blurred top strip */}
        <div className="container mx-auto px-4 py-8 relative">
          {/* Badges */}
          <div className="mt-12 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Backed By
            </h3>
            <div className="flex flex-nowrap justify-center items-center gap-8 overflow-x-auto py-2">
              <img src="/Microsoft-for-Startups.png" alt="Microsoft for Startups" className="h-20 max-w-[200px] w-auto object-contain" />
              <img src="/nvidia-inception.png" alt="NVIDIA Inception" className="h-20 max-w-[200px] w-auto object-contain" />
              <img src="/aws-activate.png" alt="AWS Activate" className="h-20 max-w-[200px] w-auto object-contain" />
              <img src="/Amplitude.png" alt="Amplitude" className="h-20 max-w-[200px] w-auto object-contain" />
              <img src="/Auth0.svg.png" alt="Auth0" className="h-20 max-w-[200px] w-auto object-contain" />
            </div>
          </div>

          <div className="flex justify-between items-start">
            {/* Quicklinks */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4">Quicklinks</h3>
              <div className="flex flex-wrap items-center gap-6">
                <button
                  onClick={() => setAboutOpen(true)}
                  className="text-gray-600 hover:text-teal-600 transition-colors font-medium focus:outline-none"
                >
                  About
                </button>
                <button
                  onClick={() => setTermsOpen(true)}
                  className="text-gray-600 hover:text-teal-600 transition-colors font-medium focus:outline-none"
                >
                  Terms of Service
                </button>
              </div>
            </div>

            {/* Connect */}
            <div className="flex-1 flex justify-end">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4">Connect</h3>
                <div className="flex justify-center space-x-8">
                  {/* Instagram */}
                  <a
                    href="https://www.instagram.com/clairvyn.ai?igsh=ZnR4M3dhd255aGhq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                  >
                    <Instagram size={24} className="text-gray-600 dark:text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </a>

                  {/* LinkedIn */}
                  <a
                    href="https://www.linkedin.com/company/clairvyn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                  >
                    <Linkedin size={24} className="text-gray-600 dark:text-gray-300 group-hover:text-blue-700 transition-colors" />
                  </a>

                  {/* Email */}
                  <a
                    href="mailto:hello@clairvyn.com"
                    className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                  >
                    <Mail size={24} className="text-gray-600 dark:text-gray-300 group-hover:text-green-500 transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright removed per request */}
        </div>
      </footer>

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                About Clairvyn
              </h2>
              <button
                onClick={() => setAboutOpen(false)}
                className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 pt-3 overflow-y-auto max-h-[70vh]">
              <div className="text-sm leading-relaxed space-y-4 text-gray-700 dark:text-gray-300">
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
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setAboutOpen(false)}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {termsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Terms of Service</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Clairvyn Privacy and Data Use Consent Notice</p>
              </div>
              <button
                onClick={() => setTermsOpen(false)}
                className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 pt-3 overflow-y-auto max-h-[70vh]">
              <div className="text-sm leading-relaxed space-y-4 text-gray-700 dark:text-gray-300">
                <p>
                  At Clairvyn Private Limited ("Clairvyn", "we", "our", or "us"), your privacy is of paramount
                  importance to us. This notice explains in clear and transparent terms how we collect, use,
                  store, and share the information you provide when you interact with our platform, tools, or
                  services, including the ways in which we may use such information for research, development,
                  and scientific purposes. By continuing to use our services and expressly consenting where
                  prompted, you agree to the terms of this policy.
                </p>
                <p>
                  When you engage with Clairvyn's services, you may be asked to submit or provide various types
                  of information including, but not limited to, written responses, audio recordings, uploaded
                  content, and other interactions generated during your use of our platform. These responses and
                  interactions may include your thoughts, preferences, opinions, or any other personal inputs
                  you choose to share with us. In addition to this direct input, certain technical and usage
                  data may also be automatically collected, such as your device type, browser details, IP
                  address, time of access, location data (based on your IP or device settings), and system logs.
                  This data helps us improve the stability, performance, and usability of our services.
                </p>
                <p>
                  We may record and retain your responses and related data for the purpose of enhancing the
                  quality, reliability, and scope of our products and services. Furthermore, we may analyze and
                  use such responses internally for the purposes of academic study, scientific research, machine
                  learning, product optimization, or publication in anonymized form. The information collected
                  may be used to develop new technologies, refine our algorithms, or assess how users engage
                  with specific features or queries. This helps us in advancing innovation, driving user-centric
                  design, and contributing to the broader body of knowledge in emerging fields such as
                  artificial intelligence and human–computer interaction.
                </p>
                <p>
                  We assure you that your personal data and responses will not be sold to third parties. However,
                  we may engage with carefully selected service providers, research institutions, or affiliates
                  for the limited purpose of facilitating our services, processing information securely, or
                  conducting internal research. Any such sharing shall be strictly governed by confidentiality
                  obligations and in accordance with applicable laws. In circumstances where we are required by
                  law, legal process, or governmental authorities to disclose specific information, we will
                  comply accordingly.
                </p>
                <p>
                  Your participation is entirely voluntary, and your consent forms the legal basis on which we
                  process your information for the purposes described above. By agreeing to this privacy and
                  data use notice, you explicitly grant Clairvyn Private Limited the right to collect, store,
                  analyze, and utilize your responses and related data, including but not limited to text,
                  voice, files, or media, for internal and external research or development purposes. This
                  consent remains valid unless and until you decide to withdraw it. You may withdraw your
                  consent at any time by contacting us at{" "}
                  <a href="mailto:hello@clairvyn.com" className="text-teal-600 underline">
                    hello@clairvyn.com
                  </a>
                  . Upon receiving such a request, we will take appropriate steps to discontinue the use of your
                  personal data for future research or product development, subject to our legal or regulatory
                  obligations. You also have the right to request access to the personal data we hold about you,
                  to correct any inaccuracies, or to request deletion of your data, unless we are required to
                  retain certain information under law or for legitimate business purposes.
                </p>
                <p>
                  We employ industry-standard security measures to safeguard your data and ensure its
                  confidentiality, integrity, and availability. Our data storage systems, access controls,
                  encryption standards, and employee protocols are designed to protect your information from
                  unauthorized access or misuse.
                </p>
                <p>
                  This notice may be updated from time to time to reflect changes in our practices, legal
                  requirements, or technology. You will be notified of any significant updates through our
                  website or email, and your continued use of our services following such updates shall
                  constitute acceptance of the revised terms. If you have any questions, concerns, or wish to
                  exercise your data protection rights, you may contact us at{" "}
                  <a href="mailto:hello@clairvyn.com" className="text-teal-600 underline">
                    hello@clairvyn.com
                  </a>{" "}
                  or write to us at our registered address: Clairvyn Private Limited, [No. 136/1, No. 8/9,
                  Parvallal Street, Murugappa Nagar, Ennore RS, Tiruvallur, Tamil Nadu, - 600 057], India.
                </p>
                <p>
                  By proceeding, you confirm that you have read, understood, and voluntarily consent to the
                  collection and use of your responses and data by Clairvyn Private Limited as outlined in this
                  Privacy and Consent Notice.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
