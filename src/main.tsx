import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
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
