const API_BASE_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000" : ""

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface ApiFetchOptions<TBody> {
  method?: HttpMethod
  body?: TBody
  token: string | null
  signal?: AbortSignal
}

export async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  { method = "GET", body, token, signal }: ApiFetchOptions<TBody>
): Promise<TResponse> {
  const url = `${API_BASE_URL}${path}`

  const headers: Record<string, string> = {}

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`API ${response.status}: ${text || response.statusText}`)
  }

  // For 204/empty responses, avoid JSON parsing.
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return (await response.blob().catch(() => null)) as TResponse
  }

  return (await response.json()) as TResponse
}

