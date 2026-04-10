import Link from "next/link"

export default function TermsModal() {
  return (
    <Link
      href="/terms-of-service"
      target="_blank"
      rel="noopener noreferrer"
      className="text-gray-600 transition-colors font-medium hover:text-[#7C5CBF] focus:outline-none"
    >
      Terms of Service
    </Link>
  )
}
