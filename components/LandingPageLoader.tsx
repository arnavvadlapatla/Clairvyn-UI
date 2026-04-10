"use client"

/**
 * Optimized animated house icon loader for landing page.
 * Faster and smoother animation optimized for initial page load.
 */
export default function LandingPageLoader() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* House Building Animation - Optimized for landing page */}
      <div className="flex-shrink-0" style={{ width: 32, height: 32 }}>
        <svg
          viewBox="0 0 64 64"
          width="32"
          height="32"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* House outline */}
          <polyline 
            points="32,12 52,28 52,54 12,54 12,28 32,12" 
            fill="none"
            stroke="#7C5CBF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120"
            className="house-outline-landing"
          />
        </svg>
      </div>
    </div>
  )
}
