import { createClient } from "@supabase/supabase-js";

function readEnv(nameCandidates) {
  for (const name of nameCandidates) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function mask(value) {
  if (!value) return "<empty>";
  if (value.length <= 10) return "**********";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parseAttempts() {
  const raw = readEnv(["TEST_SIGNIN_ATTEMPTS"]);
  const parsed = Number(raw || "5");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5;
  }
  return Math.min(Math.floor(parsed), 20);
}

async function runAttempt(supabase, email, password, attempt) {
  const startedAt = Date.now();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const durationMs = Date.now() - startedAt;

  if (error) {
    console.error(`Attempt ${attempt}: FAIL in ${durationMs}ms`);
    console.error({
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });
    return { ok: false, durationMs, error };
  }

  console.log(`Attempt ${attempt}: OK in ${durationMs}ms`);
  if (data?.session) {
    await supabase.auth.signOut();
  }
  return { ok: true, durationMs };
}

async function main() {
  const supabaseUrl = readEnv(["VITE_SUPABASE_URL", "SUPABASE_URL"]);
  const supabaseAnonKey = readEnv(["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);
  const email = readEnv(["TEST_SIGNIN_EMAIL"]);
  const password = readEnv(["TEST_SIGNIN_PASSWORD"]);
  const attempts = parseAttempts();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FAIL: Missing Supabase credentials.");
    console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY).");
    process.exit(1);
  }

  if (!email || !password) {
    console.error("FAIL: Missing test login credentials.");
    console.error("Set TEST_SIGNIN_EMAIL and TEST_SIGNIN_PASSWORD.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Running Supabase sign-in latency test with:");
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- Anon key: ${mask(supabaseAnonKey)}`);
  console.log(`- Email: ${email}`);
  console.log(`- Attempts: ${attempts}`);

  const durations = [];
  let failures = 0;

  for (let i = 1; i <= attempts; i += 1) {
    const result = await runAttempt(supabase, email, password, i);
    durations.push(result.durationMs);
    if (!result.ok) {
      failures += 1;
      if (result.error?.status === 429) {
        console.error("Detected HTTP 429 rate limiting. Stopping early.");
        break;
      }
    }
  }

  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const avg = Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length);

  console.log("Summary:");
  console.log({ attemptsRun: durations.length, failures, minMs: min, avgMs: avg, maxMs: max });

  if (failures > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("FAIL: Unexpected exception during sign-in test.");
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
