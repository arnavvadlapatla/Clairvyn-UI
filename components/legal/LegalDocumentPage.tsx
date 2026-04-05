import Link from "next/link"

type LegalDocumentPageProps = {
  title: string
  effectiveDate: string
  body: string
}

/**
 * Legal / policy text: single column scroll on the document (no nested pre scrollbar).
 * touch: larger type for phones; desktop: compact filing-cabinet sizes unchanged.
 */
export function LegalDocumentPage({ title, effectiveDate, body }: LegalDocumentPageProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900">
      <div className="touch-safe-x mx-auto w-full min-w-0 max-w-4xl touch:pb-14 touch:pt-8 desktop:px-4 desktop:pb-8 desktop:py-4">
        <Link
          href="/"
          className="inline-flex items-center text-base font-semibold text-[#1e2bd6] transition-colors hover:text-[#1623b0] touch:min-h-12 desktop:min-h-0 desktop:text-sm"
        >
          ← Back to home
        </Link>

        <h1 className="text-2xl font-bold leading-tight text-[#0b1a3c] touch:mt-5 desktop:mt-3 desktop:text-[12px] desktop:font-semibold">
          {title}
        </h1>
        <p className="mt-2 text-base text-gray-600 touch:mt-3 desktop:mt-0 desktop:text-[12px] desktop:leading-tight desktop:text-gray-900">
          {effectiveDate}
        </p>

        <div
          className="touch-text-comfortable mt-6 max-w-full font-sans break-words whitespace-pre-wrap text-gray-900 touch:mt-8 desktop:mt-4 desktop:text-[11px] desktop:leading-[1.2]"
        >
          {body}
        </div>
      </div>
    </div>
  )
}
