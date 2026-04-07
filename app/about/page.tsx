"use client"

import { motion } from "framer-motion"
import { LandingHeader } from "@/components/LandingHeader"
import Link from "next/link"

const highlights = [
  {
    title: "Floor plan design",
    text: "Iterate on layouts with suggestions and feedback tuned for architectural workflows.",
  },
  {
    title: "CAD & technical work",
    text: "Get help with modeling, drawings, and specifications without losing rigor.",
  },
  {
    title: "Built for learning",
    text: "We focus on students and educators who need clear guidance, not black-box answers.",
  },
] as const

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden overflow-x-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#f6f4ff]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/60 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/60 blur-3xl" />
        <div className="absolute bottom-[-240px] left-[20%] h-[640px] w-[640px] rounded-full bg-indigo-300/50 blur-3xl" />
      </div>

      <LandingHeader />

      <main className="relative z-10 mx-auto w-full max-w-full touch-safe-x touch:pb-16 touch:pt-24 desktop:container desktop:px-4 desktop:pb-20 desktop:pt-36">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600 touch:tracking-[0.2em] desktop:text-xs desktop:tracking-widest">
              CLAIRVYN
            </p>
            <h1 className="font-extrabold tracking-tight text-[#0b1a3c] touch:text-[1.65rem] touch:leading-snug desktop:text-5xl">
              About us
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
            Clairvyn creates AI powered CAD software. Our mission is to democratise access to spatially aware artificial intelligence, empowering human creativity and innovation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.06 }}
            className="mt-8 space-y-5 text-base leading-relaxed text-gray-600 touch:space-y-6 touch:text-base desktop:mt-10"
          >
          </motion.div>

          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            className="mt-10 grid grid-cols-1 touch:mt-10 touch:gap-5 gap-4 desktop:mt-12 desktop:grid-cols-3 desktop:gap-5"
          >
            {highlights.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-black/8 bg-white/70 px-5 py-6 shadow-[0_16px_48px_rgba(30,43,214,0.06)] backdrop-blur-md desktop:rounded-[22px]"
              >
                <h2 className="text-base font-bold text-[#0b1a3c] desktop:text-sm">{item.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-gray-600 desktop:text-sm">{item.text}</p>
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.18 }}
            className="mt-12 touch:mt-14 desktop:mt-14"
          >
            <div className="flex flex-col gap-4 desktop:flex-row desktop:items-center desktop:gap-6">
              <Link
                href="/signup"
                className="flex h-12 items-center justify-center rounded-full bg-[#1e2bd6] px-7 text-base font-semibold text-white shadow-md transition-all hover:shadow-lg hover:bg-[#1a24b8] desktop:inline-flex desktop:h-auto desktop:px-8 desktop:py-3.5 desktop:text-sm"
              >
                Get started
              </Link>
              <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center desktop:gap-6">
                <Link
                  href="/pricing"
                  className="flex h-12 items-center justify-center rounded-full border-2 border-[#1e2bd6]/30 text-base font-semibold text-[#1e2bd6] transition-all hover:border-[#1e2bd6]/50 hover:bg-[#1e2bd6]/5 desktop:inline-flex desktop:h-auto desktop:border-0 desktop:py-0 desktop:text-sm desktop:hover:underline"
                >
                  View pricing
                </Link>
                <a
                  href="mailto:hello@clairvyn.com"
                  className="flex h-12 items-center justify-center rounded-full border-2 border-gray-300/40 text-base font-semibold text-gray-700 transition-all hover:border-gray-400/60 hover:bg-gray-100/50 desktop:inline-flex desktop:h-auto desktop:border-0 desktop:py-0 desktop:justify-start desktop:text-sm desktop:text-gray-600 desktop:hover:text-[#1e2bd6] desktop:hover:underline"
                >
                  hello@clairvyn.com
                </a>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.22 }}
            className="mt-12"
          >
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-[#1e2bd6] hover:underline desktop:min-h-0 desktop:text-sm"
            >
              <span aria-hidden="true" className="leading-none">←</span>
              <span>Back to home</span>
            </Link>
          </motion.p>
        </div>
      </main>
    </div>
  )
}
