import Link from "next/link"

export default function TermsModal() {
  return (
    <Link
      href="/terms-of-service"
      className="text-gray-600 transition-colors font-medium hover:text-[#1e2bd6] focus:outline-none"
    >
      Terms of Service
    </Link>
  )
}
