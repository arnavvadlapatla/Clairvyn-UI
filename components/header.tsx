import Image from "next/image"
import Link from "next/link"
import { useTheme } from "@/contexts/ThemeContext"

export default function Header() {
  const { isDarkMode } = useTheme()
  
  return (
    <header className="flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
      {/* Left Section - Logo */}
      <div className="flex items-center space-x-3">
        <Link href="/">
          <Image
            src="/light.jpeg"
            alt="Clairvyn Logo"
            width={120}
            height={40}
            className="cursor-pointer"
            priority
          />
        </Link>
      </div>

      {/* Right Section - Menu */}
      <button className="text-gray-600 hover:text-teal-600 transition-colors text-2xl focus:outline-none">
        ☰
      </button>
    </header>
  )
}
