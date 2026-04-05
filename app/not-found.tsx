import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-md text-center">
        <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Page Not Found</h2>
        <p className="mb-8 text-base leading-relaxed text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-bold text-white hover:bg-blue-700 min-[769px]:w-auto min-[769px]:py-3"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}

