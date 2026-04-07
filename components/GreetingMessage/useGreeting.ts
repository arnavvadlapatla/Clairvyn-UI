"use client"

import { useState } from "react"
import {
  morningGreetings,
  afternoonGreetings,
  eveningGreetings,
  nightGreetings,
  fallbackNames,
} from "./greetings"

const SESSION_KEY = "clvn_last_greeting_idx"
const FALLBACK_KEY = "clvn_last_fallback_idx"

function getTimePeriod(): "morning" | "afternoon" | "evening" | "night" {
  // Always use the browser's local timezone — never server time, never a hardcoded zone.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // toLocaleString with hour12:false returns "0"–"23"; midnight can be "24" in some runtimes.
  const raw = new Date().toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  })
  const parsed = parseInt(raw, 10)
  const h = Number.isFinite(parsed) ? (parsed === 24 ? 0 : parsed) : new Date().getHours()

  if (h >= 5 && h < 12) return "morning"
  if (h >= 12 && h < 17) return "afternoon"
  if (h >= 17 && h < 21) return "evening"
  return "night"
}

function pickRandom<T>(pool: readonly T[], lastIndex: number): { item: T; index: number } {
  if (pool.length === 1) return { item: pool[0], index: 0 }
  let idx = Math.floor(Math.random() * pool.length)
  if (idx === lastIndex) idx = (idx + 1) % pool.length
  return { item: pool[idx], index: idx }
}

/**
 * Interpolates the name token into a greeting template.
 * When name is empty, strips the token and fixes surrounding punctuation so the
 * sentence reads naturally (e.g. "Morning, {name}." → "Morning.").
 */
function interpolate(template: string, name: string): string {
  if (name) return template.replace("{name}", name)

  return template
    // "Morning, {name}." / "Good evening, {name}!" / "Still up, {name}?"
    .replace(/,\s*\{name\}(?=[.!?])/g, "")
    // "Hey {name}, …"
    .replace(/\s+\{name\},/g, ",")
    // "Welcome back, {name}!" already caught above; catch-all for any remainder
    .replace(/\{name\}/g, "")
    // collapse any double-spaces left behind
    .replace(/\s{2,}/g, " ")
    .trim()
}

function resolveName(firstName: string | null | undefined): string {
  const isBlank = !firstName || firstName.trim() === "" || firstName.trim() === "null"
  if (isBlank) {
    const lastIdx = parseInt(sessionStorage.getItem(FALLBACK_KEY) ?? "-1", 10)
    const { item, index } = pickRandom(fallbackNames, lastIdx)
    sessionStorage.setItem(FALLBACK_KEY, String(index))
    return item // may be ""
  }
  // Capitalise first letter defensively (guard against lowercase from backend)
  const trimmed = firstName.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function useGreeting(firstName: string | null | undefined): string {
  const [greeting] = useState<string>(() => {
    const period = getTimePeriod()
    const pools: Record<typeof period, readonly string[]> = {
      morning: morningGreetings,
      afternoon: afternoonGreetings,
      evening: eveningGreetings,
      night: nightGreetings,
    }
    const pool = pools[period]
    const lastIndex = parseInt(sessionStorage.getItem(SESSION_KEY) ?? "-1", 10)
    const { item: template, index } = pickRandom(pool, lastIndex)
    sessionStorage.setItem(SESSION_KEY, String(index))
    const name = resolveName(firstName)
    return interpolate(template, name)
  })
  return greeting
}
