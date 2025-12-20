import React from 'react'

interface ClairvynLogoProps {
  width?: number
  height?: number
  className?: string
}

const ClairvynLogo: React.FC<ClairvynLogoProps> = ({ 
  width = 50, 
  height = 50, 
  className = "" 
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Main C shape with integrated house */}
      <path
        d="M20 20 Q20 10 30 10 L70 10 Q80 10 80 20 L80 30 Q80 40 70 40 L60 40 Q50 40 50 50 Q50 60 60 60 L70 60 Q80 60 80 70 L80 80 Q80 90 70 90 L30 90 Q20 90 20 80 L20 70 Q20 60 30 60 L40 60 Q50 60 50 50 Q50 40 40 40 L30 40 Q20 40 20 30 Z"
        fill="url(#logoGradient)"
      />
      
      {/* House windows - 2x2 grid */}
      <rect x="35" y="25" width="8" height="8" fill="url(#logoGradient)" opacity="0.8" />
      <rect x="47" y="25" width="8" height="8" fill="url(#logoGradient)" opacity="0.8" />
      <rect x="35" y="37" width="8" height="8" fill="url(#logoGradient)" opacity="0.8" />
      <rect x="47" y="37" width="8" height="8" fill="url(#logoGradient)" opacity="0.8" />
    </svg>
  )
}

export default ClairvynLogo



