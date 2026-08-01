import { createRoot } from 'react-dom/client'
import { useEffect, useState } from "react"
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner"

import App from './App.tsx'
import { AmazonProductListingPage } from "@/components/AmazonProductListingPage"
import { StorefrontV2 } from "@/components/StorefrontV2"
import { CloudKitchenPage } from "@/components/CloudKitchenPage"
import { ErrorFallback } from './ErrorFallback.tsx'
import { getSlugFromProductPath, isProductPath } from "@/lib/product-url"

import "./main.css"
import "./styles/theme.css"
import "./index.css"

function RootRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handleNavigation = () => setPathname(window.location.pathname)
    window.addEventListener("popstate", handleNavigation)
    return () => window.removeEventListener("popstate", handleNavigation)
  }, [])

  if (pathname === "/v2" || pathname.startsWith("/v2/")) {
    return <StorefrontV2 />
  }

  if (pathname === "/cloudkitchen" || pathname.startsWith("/cloudkitchen/")) {
    return <CloudKitchenPage />
  }

  if (isProductPath(pathname)) {
    return <AmazonProductListingPage slug={getSlugFromProductPath(pathname)} />
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <RootRouter />
    <Toaster
      richColors
      position="bottom-center"
      toastOptions={{
        duration: 2200,
        className: "text-xs sm:text-sm px-3 py-2 max-w-[90vw] sm:max-w-sm",
      }}
    />
   </ErrorBoundary>
)
