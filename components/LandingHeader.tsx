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
  "touch:rounded-2xl desktop:rounded-3xl border border-white/30 border-b border-b-white/45 bg-white/45 shadow-[0_8px_40px_rgba(30,43,214,0.08)] backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40"

const navLinkClass =
  "flex items-center touch:text-[15px] touch:font-semibold text-gray-800 transition-colors hover:text-[#1e2bd6] desktop:text-sm desktop:font-medium desktop:text-gray-800"

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
                className="hidden min-h-12 items-center justify-center rounded-full bg-[#1e2bd6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md desktop:inline-flex desktop:min-h-0"
              >
                Sign In
              </button>

              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="touch:inline-flex touch:min-h-12 touch:min-w-12 items-center justify-center rounded-xl text-gray-800 transition-colors hover:bg-white/50 hover:text-[#1e2bd6] desktop:hidden"
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
                      <SheetTitle className="text-xl font-bold text-[#0b1a3c]">Menu</SheetTitle>
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
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-gray-800 transition-all hover:bg-gradient-to-r hover:from-[#1e2bd6]/10 hover:to-[#1e2bd6]/5 hover:text-[#1e2bd6] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1e2bd6] to-[#1520b8] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
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
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-gray-800 transition-all hover:bg-gradient-to-r hover:from-[#1e2bd6]/10 hover:to-[#1e2bd6]/5 hover:text-[#1e2bd6] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1e2bd6] to-[#1520b8] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
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
                        className="group flex min-h-14 items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold text-gray-800 transition-all hover:bg-gradient-to-r hover:from-[#1e2bd6]/10 hover:to-[#1e2bd6]/5 hover:text-[#1e2bd6] active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1e2bd6] to-[#1520b8] text-white shadow-md transition-all group-hover:shadow-lg group-hover:scale-110">
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
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1e2bd6] to-[#1a21c0] text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:from-[#1e2bd6] hover:to-[#1620b0] active:scale-95"
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
