"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useMemo } from "react"

interface EnhancedAvatarProps {
  src?: string
  alt?: string
  name?: string
  email?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
}

const colors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-clv-violet",
]

export function EnhancedAvatar({
  src,
  alt = "User avatar",
  name = "User",
  email,
  size = "md",
  className = "",
}: EnhancedAvatarProps) {
  const initials = useMemo(() => {
    if (!name) return "U"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [name])

  const bgColor = useMemo(() => {
    const hash = (email || name).split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)
    return colors[hash % colors.length]
  }, [email, name])

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback
        className={`${bgColor} text-white font-semibold flex items-center justify-center`}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
