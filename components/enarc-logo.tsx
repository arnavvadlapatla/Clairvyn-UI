"use client"

import { motion } from "framer-motion"

interface EnarcLogoProps {
  size?: number
  className?: string
  animate?: boolean
}

export function EnarcLogo({ size = 80, className = "", animate = true }: EnarcLogoProps) {
  const LogoComponent = (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Background Circle */}
        <circle cx="40" cy="40" r="38" fill="url(#backgroundGradient)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

        {/* Blueprint Grid Pattern */}
        <defs>
          <pattern id="blueprintGrid" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <circle cx="40" cy="40" r="36" fill="url(#blueprintGrid)" opacity="0.3" />

        {/* Main Compass/Drafting Tool */}
        <g transform="translate(40,40)">
          {/* Compass Base */}
          <circle cx="0" cy="0" r="3" fill="white" opacity="0.9" />

          {/* Compass Arms */}
          <g stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none">
            {/* Left Arm - Pencil */}
            <path d="M -2,-1 L -18,-12" opacity="0.95" />
            <path d="M -16,-10 L -20,-14" strokeWidth="3" opacity="0.8" />

            {/* Right Arm - Point */}
            <path d="M 2,-1 L 18,-12" opacity="0.95" />
            <circle cx="18" cy="-12" r="1.5" fill="white" opacity="0.9" />
          </g>

          {/* Compass Arc */}
          <path
            d="M -15,-10 A 20 20 0 0 1 15,-10"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="2,2"
          />

          {/* Architectural Elements */}
          <g stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="none">
            {/* Blueprint Lines */}
            <path d="M -25,8 L 25,8" opacity="0.6" />
            <path d="M -20,15 L 20,15" opacity="0.5" />
            <path d="M -15,22 L 15,22" opacity="0.4" />

            {/* Measurement Marks */}
            <path d="M -25,6 L -25,10" opacity="0.6" />
            <path d="M 25,6 L 25,10" opacity="0.6" />
            <path d="M 0,6 L 0,10" opacity="0.4" />
          </g>

          {/* Central Design Element */}
          <g fill="rgba(255,255,255,0.8)">
            <polygon points="-8,2 8,2 6,8 -6,8" opacity="0.7" />
            <rect x="-1" y="-8" width="2" height="10" opacity="0.6" />
          </g>
        </g>

        {/* Gradient Definitions */}
        <defs>
          <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="50%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#134e4a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )

  if (animate) {
    return (
      <motion.div whileHover={{ rotate: 5, scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
        {LogoComponent}
      </motion.div>
    )
  }

  return LogoComponent
}

// Smaller version for footer and navigation
export function EnarcLogoSmall({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background Circle */}
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="url(#smallBackgroundGradient)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* Main Compass/Drafting Tool */}
        <g transform="translate(20,20)">
          {/* Compass Base */}
          <circle cx="0" cy="0" r="1.5" fill="white" opacity="0.9" />

          {/* Compass Arms */}
          <g stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none">
            <path d="M -1,-0.5 L -9,-6" opacity="0.95" />
            <path d="M 1,-0.5 L 9,-6" opacity="0.95" />
            <circle cx="9" cy="-6" r="0.8" fill="white" opacity="0.9" />
          </g>

          {/* Architectural Elements */}
          <g stroke="rgba(255,255,255,0.7)" strokeWidth="1" fill="none">
            <path d="M -12,4 L 12,4" opacity="0.6" />
            <path d="M -8,7 L 8,7" opacity="0.5" />
          </g>

          {/* Central Design Element */}
          <polygon points="-4,1 4,1 3,4 -3,4" fill="rgba(255,255,255,0.7)" opacity="0.7" />
        </g>

        {/* Gradient Definitions */}
        <defs>
          <linearGradient id="smallBackgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="50%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#134e4a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
