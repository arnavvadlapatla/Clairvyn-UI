import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Caveat, Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { DOCUMENT_THEME_SYNC_SCRIPT } from "@/lib/documentTheme"
import { NetworkStatus } from "@/components/NetworkStatus"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
})

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-caveat",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Clairvyn",
  icons: {
    icon: '/logo.png',
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  description:
    "Design Architectural Floor Plans using Simple Prompts.",
  keywords: "architecture, design, AI, challenges, education, floor plan, building design, Clairvyn",
  authors: [{ name: "Clairvyn Team" }],
  generator: 'v0.app'
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${caveat.variable} ${playfair.variable}`}
      suppressHydrationWarning
      style={{ colorScheme: "light only" }}
    >
      <body className={inter.className}>
        <Script
          id="clairvyn-document-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: DOCUMENT_THEME_SYNC_SCRIPT }}
        />
        <NetworkStatus />
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
