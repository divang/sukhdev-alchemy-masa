import { useEffect } from "react"

const RUNTIME_ERROR_REDIRECT_KEY = "runtime-error-home-redirected"

export const ErrorFallback = ({ error }) => {
  useEffect(() => {
    console.error("[runtime] Unhandled application error", error)

    if (typeof window === "undefined") {
      return
    }

    const isHomeRoute = window.location.pathname === "/" && !window.location.search && !window.location.hash
    const alreadyRedirected = window.sessionStorage.getItem(RUNTIME_ERROR_REDIRECT_KEY) === "1"

    if (!isHomeRoute && !alreadyRedirected) {
      window.sessionStorage.setItem(RUNTIME_ERROR_REDIRECT_KEY, "1")
      window.location.replace(`${window.location.origin}/`)
      return
    }

    window.sessionStorage.removeItem(RUNTIME_ERROR_REDIRECT_KEY)
  }, [error])

  return null
}
