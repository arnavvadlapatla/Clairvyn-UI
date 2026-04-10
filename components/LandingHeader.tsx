"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Menu, Tag, Info, BookOpen, X } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const glassBar =
  "landing-navbar touch:rounded-2xl desktop:rounded-3xl border border-[rgba(212,200,240,0.50)] bg-[rgba(255,255,255,0.55)] shadow-[0_4px_24px_rgba(124,92,191,0.08)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]"

const navLinkClass =
  "flex items-center touch:text-[15px] touch:font-semibold text-[#1A1040] transition-colors hover:text-[#7C5CBF] desktop:text-sm desktop:font-medium desktop:text-[#1A1040]"

export function LandingHeader() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const goSignIn = () => {
    setMenuOpen(false)
    router.push("/signin")
  }

  return (
    <header
      className={cn(
        "landing-header fixed left-0 right-0 top-0 z-40",
        "width-before-scroll-bar"
      )}
    >
      <div className="mx-auto max-w-6xl touch:px-3 touch:pt-2 desktop:px-4 desktop:pt-4">
        <div className={glassBar}>
          <div className="flex items-center touch:px-3 touch:py-2.5 desktop:px-6 desktop:py-3">
            {/* Left: Logo */}
            <div className="flex flex-1 items-center">
              <Link href="/" className="flex min-w-0 shrink items-center gap-2 py-1">
                <Image
                  src="/light.png"
                  alt="Clairvyn"
                  width={120}
                  height={40}
                  priority
                  className="h-8 w-auto touch:h-8 desktop:h-10"
                />
              </Link>
            </div>

            {/* Center: Nav */}
            <nav
              className="hidden desktop:flex desktop:items-center desktop:self-center desktop:gap-8"
              aria-label="Primary"
            >
              <Link href="/pricing" className={navLinkClass}>Pricing</Link>
              <Link href="/about" className={navLinkClass}>About</Link>
              <Link href="/blog" className={navLinkClass}>Blog</Link>
            </nav>

            {/* Right: Actions */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => router.push("/signin")}
                className="hidden min-h-12 items-center justify-center rounded-full bg-[#7C5CBF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md hover:bg-[#5A3A9E] desktop:inline-flex desktop:min-h-0"
              >
                Sign In
              </button>

              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="touch:inline-flex touch:min-h-12 touch:min-w-12 items-center justify-center rounded-xl text-[#1A1040] transition-colors hover:bg-white/50 hover:text-[#7C5CBF] desktop:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" strokeWidth={2} />
                </button>
                <SheetContent
                  side="right"
                  className="flex w-full max-w-[360px] flex-col border-l border-gray-100 bg-gradient-to-b from-white to-gray-50 p-0 backdrop-blur-xl sm:max-w-sm"
                >
                  <SheetHeader className="border-b border-gray-100 px-6 py-5 text-left">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="text-xl font-bold text-[#1A1040]">Menu</SheetTitle>
                    </div>
                  </SheetHeader>
                  
                  <nav
                    className="flex flex-col gap-0 px-4 py-3"
                    aria-label="Mobile primary"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05, duration: 0.3 }}
                      className="flex flex-col"
                    >
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-3" />
                      <Link
                        href="/pricing"
                        onClick={() => setMenuOpen(false)}
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-[#1A1040] transition-all hover:bg-gradient-to-r hover:from-[#7C5CBF]/10 hover:to-[#7C5CBF]/5 hover:text-[#7C5CBF] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CBF] to-[#5A3A9E] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
                          <Tag className="h-5 w-5 fill-current" />
                        </span>
                        <span>Pricing</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="flex flex-col"
                    >
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2" />
                      <Link
                        href="/about"
                        onClick={() => setMenuOpen(false)}
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-[#1A1040] transition-all hover:bg-gradient-to-r hover:from-[#7C5CBF]/10 hover:to-[#7C5CBF]/5 hover:text-[#7C5CBF] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CBF] to-[#5A3A9E] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
                          <Info className="h-5 w-5" />
                        </span>
                        <span>About</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      className="flex flex-col"
                    >
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2" />
                      <Link
                        href="/blog"
                        onClick={() => setMenuOpen(false)}
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-[#1A1040] transition-all hover:bg-gradient-to-r hover:from-[#7C5CBF]/10 hover:to-[#7C5CBF]/5 hover:text-[#7C5CBF] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CBF] to-[#5A3A9E] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
                          <BookOpen className="h-5 w-5 fill-current" />
                        </span>
                        <span>Blog</span>
                      </Link>
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mt-3" />
                    </motion.div>
                  </nav>
                  
                  <div className="mt-auto border-t border-gray-100 px-4 py-6">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <button
                        type="button"
                        onClick={goSignIn}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C5CBF] to-[#5A3A9E] text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:from-[#5A3A9E] hover:to-[#5A3A9E] active:scale-95"
                      >
                        Sign In
                      </button>
                    </motion.div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
