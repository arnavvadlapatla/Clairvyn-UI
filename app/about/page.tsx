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
            <p>
              Clairvyn sits at the intersection of architecture education and AI: we care about precision, iteration,
              and teaching—not just one-shot images. Our product is meant to feel like a capable studio partner that
              respects how you already work.
            </p>
            <p>
              Whether you&apos;re refining a studio project or exploring options for a plan, we want you to stay in
              control of the design while the heavy lifting gets a little lighter.
            </p>
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
            className="mt-12 flex flex-col items-stretch touch:mt-14 touch:gap-4 gap-3 desktop:mt-14 desktop:flex-row desktop:flex-wrap desktop:items-center desktop:gap-4"
          >
            <Link
              href="/signup"
              className="flex h-12 w-full min-h-12 touch:w-full items-center justify-center rounded-full bg-[#1e2bd6] px-7 text-base font-semibold text-white shadow-md transition-shadow hover:shadow-lg desktop:inline-flex desktop:h-auto desktop:w-auto desktop:min-h-0 desktop:py-3.5 desktop:text-sm"
            >
              Get started
            </Link>
            <Link
              href="/pricing"
              className="flex h-12 w-full items-center justify-center rounded-full border border-[#1e2bd6]/25 text-base font-semibold text-[#1e2bd6] transition-colors hover:bg-[#1e2bd6]/5 hover:underline desktop:inline-flex desktop:h-auto desktop:w-auto desktop:border-0 desktop:py-0 desktop:text-sm"
            >
              View pricing
            </Link>
            <a
              href="mailto:hello@clairvyn.com"
              className="flex min-h-12 w-full items-center justify-center text-base font-semibold text-gray-600 transition-colors hover:text-[#1e2bd6] desktop:inline-flex desktop:w-auto desktop:min-h-0 desktop:justify-start desktop:text-sm"
            >
              hello@clairvyn.com
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.22 }}
            className="mt-12"
          >
            <Link
              href="/"
              className="inline-flex min-h-12 items-center text-base font-semibold text-[#1e2bd6] hover:underline desktop:min-h-0 desktop:text-sm"
            >
              ← Back to home
            </Link>
          </motion.p>
        </div>
      </main>
    </div>
  )
}
