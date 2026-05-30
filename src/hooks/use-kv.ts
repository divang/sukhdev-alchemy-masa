import { useCallback, useState } from "react"

type Updater<T> = T | ((prev: T) => T)

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") {
    return initialValue
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return initialValue
    }

    return JSON.parse(raw) as T
  } catch {
    return initialValue
  }
}

export function useKV<T>(key: string, initialValue: T): readonly [T, (next: Updater<T>) => void] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue))

  const setPersistedValue = useCallback((next: Updater<T>) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next

      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        }
      } catch {
        // Ignore storage quota/unavailable errors and keep in-memory value.
      }

      return resolved
    })
  }, [key])

  return [value, setPersistedValue] as const
}
