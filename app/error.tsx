'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-md text-center">
        <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Something went wrong!</h2>
        <p className="mb-8 text-base leading-relaxed text-gray-400">
          An error occurred while loading this page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-bold text-white hover:bg-blue-700 min-[769px]:w-auto min-[769px]:py-3"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

