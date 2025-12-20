"use client"


import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Linkedin, Instagram, Mail, ExternalLink } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useState } from "react"


export default function HomePage() {
  const { user, enterGuestMode } = useAuth()
  const router = useRouter()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  const handleTryIt = () => {
    if (user) {
      router.push("/chatbot")
    } else {
      // Enter guest mode and redirect to chat
      enterGuestMode()
      router.push("/chatbot")
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black relative overflow-hidden overflow-x-hidden">
      {/* Static Architectural Background - Light Mode Only */}
      <div className="absolute inset-0 opacity-100 dark:hidden">
        {/* Primary Blueprint Grid */}
        <div className="absolute inset-0 blueprint-bg" />

        {/* Secondary Geometric Overlay */}
        <div className="absolute inset-0 geometric-overlay" />

        {/* Architectural Grid Pattern */}
        <div className="absolute inset-0 architectural-grid" />
      </div>

      {/* Floating Logo */}
      <div className="floating-logo">
        <Image
          src="/light.jpeg"
          alt="Clairvyn Logo"
          width={120}
          height={40}
          className="cursor-pointer dark:hidden"
          priority
        />
        <Image
          src="/dark.jpeg"
          alt="Clairvyn Dark Logo"
          width={120}
          height={40}
          className="cursor-pointer hidden dark:block"
          priority
        />
      </div>



      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="max-w-6xl mx-auto">

          {/* Hero Section */}
          <div className="text-center mb-16 overflow-visible">
            {/* Company Name */}
            <h1 className="brand-title text-6xl md:text-8xl leading-tight tracking-tight mb-6">
              Clairvyn
            </h1>

            {/* Tagline */}
            <p className="text-2xl md:text-3xl text-gray-600 dark:text-gray-300 max-w-none whitespace-nowrap mx-auto font-medium leading-relaxed mb-12">
              Design Architectural Floor-plans using Simple Prompts
            </p>

            {/* Call-to-Action Button */}
            <div>
                      <Button
                        size="lg"
                        className="btn-gradient text-white font-bold py-6 px-12 rounded-2xl shadow-xl text-xl border-0 cursor-not-allowed pointer-events-none"
                      >
                Coming Soon...
                      </Button>
            </div>
                </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {[
              {
                icon: "🏗️",
                title: "Floor Plan Design",
                description: "Create detailed floor plans with intelligent suggestions and real-time feedback",
                color: "from-blue-500 to-cyan-500",
              },
              {
                icon: "📐",
                title: "CAD Projects",
                description: "Get assistance with CAD modeling, technical drawings, and design specifications",
                color: "from-purple-500 to-pink-500",
              },
              {
                icon: "🎓",
                title: "Student Focused",
                description: "Tailored specifically for architecture students with educational guidance",
                color: "from-green-500 to-teal-500",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="text-center p-8 rounded-3xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:border-teal-200 transition-all duration-300 hover:shadow-xl group"
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow`}
                >
                  <span className="text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-charcoal dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-medium">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Company Intro + Video */}
          <div className="max-w-6xl mx-auto mb-20">
            <div className="grid md:grid-cols-12 gap-12 items-start">
              {/* Left: Copy */}
              <div className="md:col-span-6 text-left text-gray-700 dark:text-gray-300 space-y-6 text-base md:text-lg leading-relaxed">
                <p>
                  At <strong>Clairvyn</strong>, we’re building AI-powered tools for architects and civil engineers
                  to take a project from idea to execution using simple prompts. Our platform lets users generate
                  floor plans, detect design flaws, estimate costs, and collaborate, all in seconds, without needing
                  CAD expertise.
                </p>
                <p>
                  We’ve built a proprietary system with a custom compiler, rendering engine, and real-time interface
                  designed for natural language and voice. It understands spatial logic, constraints, and user intent,
                  giving professionals speed without losing precision.
                </p>
                <p>
                  Clairvyn also runs an in-house AI research division focused on spatially aware models,
                  reinforcement learning, and design intelligence. We’re not just making faster tools. We’re rethinking
                  how design works in the AI era.
                </p>
                <p className="font-semibold">Clairvyn — Disrupting the Ordinary.</p>
              </div>

              {/* Right: Video */}
              <div className="w-full md:col-span-6">
                <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <video
                    className="w-full h-full"
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    onCanPlay={(e) => { try { e.currentTarget.play(); } catch {} }}
                  >
                    <source src="/clairvyn-demo.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="container mx-auto px-4 py-8">
          {/* Badges */}
          <div className="mt-12 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Backed By
            </h3>
            <div className="flex flex-wrap justify-center items-center gap-12">
              <img src="/Microsoft-for-Startups.jpg" alt="Microsoft for Startups" className="h-24 object-contain" />
              <img src="/nvidia-inception.png" alt="NVIDIA Inception" className="h-24 object-contain" />
              <img src="/aws-activate.png" alt="AWS Activate" className="h-24 object-contain" />
              <img src="/Amplitude.png" alt="Amplitude" className="h-24 object-contain" />
              <img src="/Auth0.svg.png" alt="Auth0" className="h-24 object-contain" />
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
