"use client"

import { useGreeting } from "./useGreeting"

interface GreetingMessageProps {
  firstName?: string | null
  className?: string
  as?: "p" | "h1" | "h2" | "h3" | "span"
}

export function GreetingMessage({
  firstName,
  className = "",
  as: Tag = "p",
}: GreetingMessageProps) {
  const greeting = useGreeting(firstName)
  return (
    <Tag
      aria-live="polite"
      aria-atomic="true"
      className={`greeting-headline${className ? ` ${className}` : ""}`}
    >
      {greeting}
    </Tag>
  )
}
