#!/usr/bin/env node

import { spawn } from "node:child_process"

const forwardedArgs = process.argv.slice(2)
const commandArgs = [
  "playwright",
  "test",
  "tests/e2e/order-flow",
  "--project=chromium",
  ...forwardedArgs,
]

const child = spawn("npx", commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    VITE_E2E_MOCK_PAYMENT: process.env.VITE_E2E_MOCK_PAYMENT ?? "true",
  },
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
