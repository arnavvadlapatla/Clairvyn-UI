"use client"

import { useCallback, useEffect, useRef } from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import {
  ONBOARDING_SESSION_KEY,
  onboardingDoneStorageKey,
} from "@/lib/onboardingConstants"

const LAYOUT_MS = 420
const START_DELAY_MS = 450

type Params = {
  authLoading: boolean
  userUid: string | undefined
  isGuest: boolean
  setIsSidebarOpen: (open: boolean) => void
}

export function useClairvynOnboarding({
  authLoading,
  userUid,
  isGuest,
  setIsSidebarOpen,
}: Params) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const unmountingRef = useRef(false)
  const tourTimeoutRef = useRef<number | null>(null)

  const clearScheduledTour = useCallback(() => {
    if (tourTimeoutRef.current !== null) {
      window.clearTimeout(tourTimeoutRef.current)
      tourTimeoutRef.current = null
    }
  }, [])

  const startTour = useCallback(() => {
    if (typeof window === "undefined" || authLoading || !userUid || isGuest) return

    clearScheduledTour()
    unmountingRef.current = false
    driverRef.current?.destroy()
    driverRef.current = null

    setIsSidebarOpen(true)

    const markFinished = () => {
      localStorage.setItem(onboardingDoneStorageKey(userUid), "1")
    }

    tourTimeoutRef.current = window.setTimeout(() => {
      tourTimeoutRef.current = null
      sessionStorage.removeItem(ONBOARDING_SESSION_KEY)

      const driverObj = driver({
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        popoverClass: "clairvyn-driver-popover",
        overlayOpacity: 0.72,
        smoothScroll: true,
        allowClose: true,
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        onDestroyed: () => {
          driverRef.current = null
          if (unmountingRef.current) return
          markFinished()
        },
        steps: [
          {
            element: "body",
            popover: {
              title: "Welcome to Clairvyn",
              description: "Let's take a quick tour to get you started. Clairvyn is an AI-powered architectural floor plan generator.",
              side: "center",
              align: "center",
            },
          },
          {
            element: "body",
            popover: {
              title: "Important Notice",
              description: "Please note: Currently generates floor plans up to 4 BHK maximum. You may encounter occasional errors as we continue to improve the AI. Your feedback helps us build better.",
              side: "center",
              align: "center",
            },
          },
          {
            element: '[data-onboarding="chat-input"]',
            popover: {
              title: "Generate Floor Plans",
              description: "Describe your floor plan requirements here. Tell us about room counts, layout preferences, dimensions, or any specific architectural features you want. The AI will generate a plan based on your description.",
              side: "top",
              align: "center",
            },
            onHighlightStarted: () => {
              setIsSidebarOpen(false)
            },
            onHighlighted: (_el, _step, { driver: d }) => {
              window.setTimeout(() => d.refresh(), LAYOUT_MS)
            },
          },
          {
            element: '[data-onboarding="send"]',
            popover: {
              title: "Submit Your Request",
              description: "Once you've written your floor plan description, click this button to send it to the AI. The generation process will begin immediately.",
              side: "top",
              align: "end",
            },
          },
          {
            element: '[data-onboarding="new-chat"]',
            popover: {
              title: "Start a New Generation",
              description: "Create a brand new chat to generate a different floor plan. Each chat keeps your previous plans organized and easily accessible.",
              side: "right",
              align: "start",
            },
            onHighlighted: (_el, _step, { driver: d }) => {
              setIsSidebarOpen(true)
              window.setTimeout(() => d.refresh(), LAYOUT_MS)
            },
          },
          {
            element: '[data-onboarding="recent-chats"]',
            popover: {
              title: "View Your Designs",
              description: "Access all your previously generated floor plans here. Browse through your design history and find any past projects you've worked on.",
              side: "right",
              align: "start",
            },
            onHighlighted: (_el, _step, { driver: d }) => {
              setIsSidebarOpen(true)
              window.setTimeout(() => d.refresh(), LAYOUT_MS)
            },
          },
          {
            element: '[data-onboarding="sidebar-profile"]',
            popover: {
              title: "Your Account",
              description: "Manage your profile, settings, and account preferences here. Track your usage, view your subscription details, and customize your experience.",
              side: "right",
              align: "start",
            },
            onHighlighted: (_el, _step, { driver: d }) => {
              setIsSidebarOpen(true)
              window.setTimeout(() => d.refresh(), LAYOUT_MS)
            },
          },
        ],
      })

      driverRef.current = driverObj
      driverObj.drive(0)
    }, START_DELAY_MS)
  }, [authLoading, userUid, isGuest, setIsSidebarOpen, clearScheduledTour])

  useEffect(() => {
    if (authLoading || !userUid || isGuest) return
    const show = sessionStorage.getItem(ONBOARDING_SESSION_KEY) === "1"
    const done = localStorage.getItem(onboardingDoneStorageKey(userUid))
    if (!show || done) return
    startTour()
  }, [authLoading, userUid, isGuest, startTour])

  useEffect(() => {
    return () => {
      unmountingRef.current = true
      clearScheduledTour()
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [userUid, clearScheduledTour])

  return { startTutorial: startTour }
}
