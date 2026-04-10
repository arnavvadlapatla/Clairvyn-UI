"use client"

import { motion } from "framer-motion"
import { LandingHeader } from "@/components/LandingHeader"
import Link from "next/link"

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#F8F5FF] relative overflow-hidden overflow-x-hidden">

      <LandingHeader />

      <main className="relative z-10 mx-auto w-full max-w-full touch-safe-x touch:pb-16 touch:pt-24 desktop:container desktop:px-4 desktop:pb-20 desktop:pt-36">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600 desktop:text-xs desktop:tracking-widest">
              CLAIRVYN
            </p>
            <h1 className="font-extrabold tracking-tight text-[#1A1040] touch:text-[1.65rem] touch:leading-snug desktop:text-5xl">
              Blog
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Product updates, tutorials, and stories about designing smarter. New posts will appear here as we publish them.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
            className="mt-10 rounded-2xl border border-[#D4C8F0] bg-white touch:mt-12 touch:px-5 touch:py-12 px-5 py-10 text-center shadow-[0_24px_70px_rgba(124,92,191,0.08)] desktop:mt-14 desktop:rounded-[28px] desktop:px-8 desktop:py-14"
          >
            <p className="text-base font-medium text-gray-600">
              No posts yet. Check back soon.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full border border-[#7C5CBF]/20 text-base font-semibold text-[#7C5CBF] transition-colors hover:bg-[#7C5CBF]/5 hover:underline desktop:w-auto desktop:min-h-0 desktop:border-0 desktop:py-0 desktop:text-sm"
            >
              <span aria-hidden="true" className="leading-none">←</span>
              <span>Back to home</span>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
