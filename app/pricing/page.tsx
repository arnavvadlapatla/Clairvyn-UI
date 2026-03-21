"use client"

import Link from "next/link"
import Image from "next/image"

const premiumFeatures = [
  "Multi-step design",
  "Unlimited prompts",
  "Unlimited Users Team",
  "Advanced Admin",
  "Custom Data Retention",
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden overflow-x-hidden">
      <div className="absolute inset-0">
        <Image src="/pricing_bg.png" alt="Pricing background" fill priority className="object-cover" />
        <div className="absolute backdrop-blur-sm inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(245,244,255,0.72))]" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-300/35 blur-3xl" />
        <div className="absolute -top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-blue-300/35 blur-3xl" />
        <div className="absolute bottom-[-240px] left-[20%] h-[640px] w-[640px] rounded-full bg-indigo-300/25 blur-3xl" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mt-4 rounded-2xl border border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/light.png" alt="Clairvyn" width={120} height={40} className="dark:hidden" priority />
              </Link>

              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700 dark:text-gray-200">
                <Link href="/#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Features
                </Link>
                <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="/#about" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  About
                </Link>
              </nav>

              <div className="flex items-center gap-3">
                <Link
                  href="/signin"
                  className="rounded-full bg-[#1e2bd6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-28 md:pt-36">
        <section className="grid gap-10 items-end lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#182f87]">Plans &amp; Pricing</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4f5c8f]">
              Whether your time-saving automation needs are large or small, we&apos;re here to help you scale.
            </p>

            <div className="group relative mt-12 h-[270px] sm:h-[320px] md:h-[340px] rounded-[30px] border border-white/70 bg-white/40 shadow-[0_20px_60px_rgba(86,102,181,0.18)] backdrop-blur-sm overflow-hidden transition-all duration-500 hover:shadow-[0_28px_85px_rgba(52,76,188,0.38),0_0_0_1px_rgba(255,255,255,0.65)] hover:-translate-y-0.5">
              <Image
                src="/landing/landing_3.png"
                alt="Pricing illustration"
                fill
                className="object-cover object-top opacity-75 blur-sm transition-transform duration-700 ease-out group-hover:scale-110"
                priority
              />
              <div className="absolute inset-x-0 bottom-11 text-center text-[30px] font-medium text-[#4f5c8f]/80 [font-family:cursive]">
                Unlock Premium to generate more prompts
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <article className="w-full max-w-[360px] rounded-[26px] border border-white/35 bg-gradient-to-br from-[#84a0ff] to-[#1f42c8] p-6 text-white shadow-[0_34px_70px_rgba(22,38,121,0.4)]">
              <div className="flex justify-end">
                <span className="inline-flex rounded-full bg-[#1d2e74]/60 px-4 py-1 text-[10px] font-bold tracking-[0.2em]">
                  PREMIUM
                </span>
              </div>

              <div className="mt-4 flex items-end gap-1 text-white">
                <span className="text-2xl font-bold opacity-90">₹</span>
                <span className="text-5xl font-extrabold leading-none">299</span>
                <span className="mb-1 text-lg font-medium text-white/80">/month</span>
              </div>

              <h2 className="mt-7 text-4xl font-semibold">Company</h2>
              <p className="mt-3 text-base text-white/85">Automation plus enterprise-grade features.</p>

              <ul className="mt-6 space-y-3 text-lg text-white/95">
                {premiumFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="text-white/90">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button className="mt-8 w-full rounded-full bg-[#88a2ff]/85 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-[#96adff] transition-colors">
                Coming Soon !!
              </button>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
