"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Home } from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { apiFetch } from "@/lib/backendApi"
import { getCountrySelectOptions } from "@/lib/countryOptions"
import { fetchMeProfile, profileCountryMissing } from "@/lib/meProfile"
import { ONBOARDING_SESSION_KEY } from "@/lib/onboardingConstants"
import LandingPageLoader from "@/components/LandingPageLoader"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ProfilePatchResponse = {
  user_id: number
  university: string | null
  city: string | null
  country: string | null
}

export default function OnboardingProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const [gateOk, setGateOk] = useState(false)
  const [countryCode, setCountryCode] = useState("")
  const [isStudent, setIsStudent] = useState<"yes" | "no" | "">("")
  const [university, setUniversity] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const countryOptions = useMemo(() => getCountrySelectOptions(), [])

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false

    void (async () => {
      const token = await getIdToken()
      if (cancelled) return
      if (!token) {
        router.replace("/signin")
        return
      }

      const profile = await fetchMeProfile(token)
      if (cancelled) return
      if (!profileCountryMissing(profile)) {
        router.replace("/chatbot")
        return
      }

      setGateOk(true)
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, user, router, getIdToken])

  const countryLabel = useMemo(() => {
    if (!countryCode) return ""
    return countryOptions.find((o) => o.value === countryCode)?.label ?? countryCode
  }, [countryCode, countryOptions])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError("")

      if (!countryCode) {
        setError("Please select your country.")
        return
      }
      if (isStudent !== "yes" && isStudent !== "no") {
        setError("Please tell us if you are a student.")
        return
      }
      if (isStudent === "yes" && !university.trim()) {
        setError("Please enter your university.")
        return
      }

      const token = await getIdToken()
      if (!token) {
        setError("Could not verify your session. Try signing in again.")
        return
      }
      if (!user) {
        setError("Could not verify your session. Try signing in again.")
        return
      }

      const body: { country: string; university: string | null } = {
        country: countryLabel,
        university: isStudent === "yes" ? university.trim() : null,
      }

      setIsSubmitting(true)
      try {
        await apiFetch<ProfilePatchResponse, typeof body>("/api/me/profile", {
          method: "PATCH",
          body,
          token,
        })
        if (typeof window !== "undefined") {
          sessionStorage.setItem(ONBOARDING_SESSION_KEY, "1")
        }
        router.replace("/chatbot")
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Something went wrong."
        setError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [countryCode, countryLabel, getIdToken, isStudent, university, router, user]
  )

  if (authLoading || !gateOk) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LandingPageLoader />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[url('/login_bg.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/65 to-white/20" />
      <div
        className="absolute right-0 top-0 hidden h-full w-1/2 bg-white/25 backdrop-blur-lg desktop:block"
        style={{
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)",
        }}
      />

      <Link href="/" className="absolute left-4 top-4 z-20 desktop:left-6 desktop:top-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 shadow desktop:h-10 desktop:w-10">
          <Home className="h-5 w-5 text-[#7C5CBF]" />
        </div>
      </Link>

      <div className="relative z-10 flex min-h-screen items-stretch justify-center touch-safe-x touch:px-4 touch:pb-12 touch:pt-20 px-4 pb-10 pt-20 desktop:ml-auto desktop:w-1/2 desktop:items-center desktop:justify-evenly desktop:p-5 desktop:pb-5 desktop:pl-12 desktop:pr-16 desktop:pt-0">
        <div className="w-full max-w-full rounded-2xl border border-white/60 bg-white/75 shadow-[0_30px_90px_rgba(124,92,191,0.14)] desktop:max-w-[430px]">
          <div className="p-5 touch:p-6 desktop:p-8">
            <h1 className="text-3xl font-bold leading-tight text-[#1A1040] desktop:text-[30px]">
              Tell us about you
            </h1>
            <p className="mt-2 text-base text-gray-600 desktop:text-sm">
              A few quick details help us improve Clairvyn for your region and community.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6 desktop:space-y-5">
              <div className="space-y-2">
                <Label className="text-base text-gray-800 desktop:text-sm">Where are you from?</Label>
                <Select value={countryCode || undefined} onValueChange={setCountryCode}>
                  <SelectTrigger className="h-12 min-h-12 rounded-xl border-gray-200 bg-white/80 text-base focus:ring-[#7C5CBF] desktop:text-sm">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base text-gray-800 desktop:text-sm">Are you a student?</Label>
                <RadioGroup
                  value={isStudent}
                  onValueChange={(v) => setIsStudent(v as "yes" | "no")}
                  className="flex flex-col gap-2"
                >
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white/60 px-4 py-3">
                    <RadioGroupItem value="yes" id="student-yes" />
                    <span className="text-base text-gray-800 desktop:text-sm">Yes</span>
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white/60 px-4 py-3">
                    <RadioGroupItem value="no" id="student-no" />
                    <span className="text-base text-gray-800 desktop:text-sm">No</span>
                  </label>
                </RadioGroup>
              </div>

              {isStudent === "yes" && (
                <div className="space-y-2">
                  <Label htmlFor="university" className="text-base text-gray-800 desktop:text-sm">
                    University
                  </Label>
                  <Input
                    id="university"
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    className="h-12 min-h-12 rounded-xl border-gray-200 bg-white/80 text-base placeholder:text-gray-500 focus-visible:ring-[#7C5CBF] desktop:text-sm"
                    placeholder="School or university name"
                    autoComplete="organization"
                  />
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 min-h-12 w-full rounded-xl bg-[#7C5CBF] text-base font-semibold text-white hover:bg-[#5A3A9E]"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
