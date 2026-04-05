"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const glassBar =
  "touch:rounded-2xl desktop:rounded-3xl border border-white/30 border-b border-b-white/45 bg-white/45 shadow-[0_8px_40px_rgba(30,43,214,0.08)] backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40"

const navLinkClass =
  "touch:text-[15px] touch:font-semibold text-gray-800 transition-colors hover:text-[#1e2bd6] desktop:text-sm desktop:font-medium desktop:text-gray-800"

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
          <div className="flex items-center justify-between touch:gap-3 touch:px-3 touch:py-2.5 desktop:gap-3 desktop:px-6 desktop:py-3">
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

            <nav
              className="hidden desktop:flex desktop:items-center desktop:gap-8"
              aria-label="Primary"
            >
              <Link href="/pricing" className={navLinkClass}>
                Pricing
              </Link>
              <Link href="/about" className={navLinkClass}>
                About
              </Link>
              <Link href="/blog" className={navLinkClass}>
                Blog
              </Link>
            </nav>

            <div className="flex items-center gap-2">
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
                  className="flex w-[min(100vw,320px)] flex-col border-l border-white/20 bg-white/95 p-0 backdrop-blur-xl"
                >
                  <SheetHeader className="border-b border-gray-100 px-6 py-4 text-left">
                    <SheetTitle className="text-lg font-bold text-[#0b1a3c]">Menu</SheetTitle>
                  </SheetHeader>
                  <nav
                    className="flex flex-col gap-1 px-4 py-4 touch:gap-2 touch:px-5 touch:py-5"
                    aria-label="Mobile primary"
                  >
                    <Link
                      href="/pricing"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-gray-800 transition-colors hover:bg-[#1e2bd6]/8 hover:text-[#1e2bd6]"
                    >
                      Pricing
                    </Link>
                    <Link
                      href="/about"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-gray-800 transition-colors hover:bg-[#1e2bd6]/8 hover:text-[#1e2bd6]"
                    >
                      About
                    </Link>
                    <Link
                      href="/blog"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-gray-800 transition-colors hover:bg-[#1e2bd6]/8 hover:text-[#1e2bd6]"
                    >
                      Blog
                    </Link>
                  </nav>
                  <div className="mt-auto border-t border-gray-100 touch:p-5 p-4">
                    <button
                      type="button"
                      onClick={goSignIn}
                      className="flex h-12 w-full min-h-12 items-center justify-center rounded-full bg-[#1e2bd6] text-base font-semibold text-white shadow-md transition-shadow hover:shadow-lg touch:text-base"
                    >
                      Sign In
                    </button>
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
