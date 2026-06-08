import { useEffect } from "react"
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert"
import { Button } from "./components/ui/button"
import { AlertTriangleIcon, HouseIcon, RefreshCwIcon } from "lucide-react"

const RUNTIME_ERROR_REDIRECT_KEY = "runtime-error-home-redirected"

export const ErrorFallback = ({ error, resetErrorBoundary }) => {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            The error was logged in the console. Redirecting to the home page when possible.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.replace(`${window.location.origin}/`)
              }
            }}
            className="flex-1"
          >
            <HouseIcon />
            Go to Home
          </Button>
          <Button
            onClick={resetErrorBoundary}
            className="flex-1"
            variant="outline"
          >
            <RefreshCwIcon />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
