"use client"

import type React from "react"
import { useEffect, useState } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Home, Lock, Mail } from "lucide-react"

function GoogleMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [rememberMe, setRememberMe] = useState(true)

  const { signIn, signInWithGoogle } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      await signIn(email, password, rememberMe)
      router.push("/chatbot")
    } catch (error: any) {
      setError(error.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError("")

    try {
      await signInWithGoogle({ rememberMe })
      router.push("/chatbot")
    } catch (error: any) {
      setError(error.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[url('/login_bg.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/65 to-white/20" />
      {/* Backdrop blur only on the right half of the screen */}
      <div
        className="absolute right-0 top-0 hidden h-full w-1/2 bg-white/25 backdrop-blur-lg desktop:block"
        style={{
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)",
        }}
      />

      <Link href="/" className="absolute left-4 top-4 z-20 desktop:left-6 desktop:top-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 shadow desktop:h-10 desktop:w-10">
          <Home className="h-5 w-5 text-[#1e2bd6]" />
        </div>
      </Link>

      <div className="relative z-10 flex min-h-screen items-stretch justify-center touch-safe-x touch:px-4 touch:pb-12 touch:pt-20 px-4 pb-10 pt-20 desktop:ml-auto desktop:w-1/2 desktop:items-center desktop:justify-evenly desktop:p-5 desktop:pb-5 desktop:pl-12 desktop:pr-16 desktop:pt-0">
        <div className="w-full max-w-full rounded-2xl border border-white/60 bg-white/75 shadow-[0_30px_90px_rgba(15,118,110,0.18)] desktop:max-w-[430px]">
          <div className="p-5 touch:p-6 desktop:p-8">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-[#1E3A8A] desktop:text-[30px]">
                Sign In
              </h1>
              <p className="mt-2 text-base text-gray-600 desktop:text-sm">
                Please login to continue to your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5 desktop:space-y-4">
              <div>
                <Label htmlFor="email" className="sr-only">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 min-h-12 rounded-xl border-gray-200 bg-white/80 pl-10 pr-4 text-base focus-visible:ring-[#1e2bd6] desktop:text-sm"
                    placeholder="Email"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="sr-only">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 min-h-12 rounded-xl border-gray-200 bg-white/80 pl-10 pr-12 text-base focus-visible:ring-[#1e2bd6] desktop:text-sm"
                    placeholder="Password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex min-h-12 items-center">
                <label className="inline-flex cursor-pointer items-center gap-3 text-base text-gray-600 select-none desktop:text-sm">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-[#1e2bd6] focus:ring-[#1e2bd6] desktop:h-4 desktop:w-4"
                  />
                  Keep me logged in
                </label>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 min-h-12 w-full rounded-xl bg-[#1E3A8A] text-base font-semibold text-white hover:bg-[#1E3A8A]/90"
              >
                {isLoading ? (
                  <span className="inline-flex items-center">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span className="flex-1 border-t border-gray-200" />
                <span className="text-base text-gray-400 desktop:text-sm">or</span>
                <span className="flex-1 border-t border-gray-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="mt-4 flex h-12 min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white/90 text-base font-medium text-gray-800 hover:bg-white"
              >
                <span>Continue with Google</span>
                <GoogleMark />
              </button>
            </div>

            <p className="mt-6 text-center text-base text-gray-500 desktop:text-sm">
              Don't have an account?{" "}
              <Link href="/signup" className="text-[#1E3A8A] font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}