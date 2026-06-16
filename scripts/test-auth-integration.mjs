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

async function main() {
  const supabaseUrl = readEnv(["VITE_SUPABASE_URL", "SUPABASE_URL"]);
  const supabaseAnonKey = readEnv(["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);
  const email = readEnv(["TEST_SIGNIN_EMAIL"]);
  const password = readEnv(["TEST_SIGNIN_PASSWORD"]);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FAIL: Missing Supabase credentials.");
    console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY)." );
    process.exit(1);
  }

  if (!email || !password) {
    console.error("FAIL: Missing real test credentials.");
    console.error("Set TEST_SIGNIN_EMAIL and TEST_SIGNIN_PASSWORD in the CI secret store.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("Running Supabase auth integration test with:");
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- Anon key: ${mask(supabaseAnonKey)}`);
  console.log(`- Test email: ${email}`);

  const startedAt = Date.now();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const durationMs = Date.now() - startedAt;

  if (error || !data.session || !data.user) {
    console.error("FAIL: signInWithPassword did not return an active session.");
    console.error(error?.message || "Unknown auth error");
    process.exit(2);
  }

  console.log(`PASS: signInWithPassword succeeded in ${durationMs}ms`);
  console.log(`- User ID: ${data.user.id}`);
  console.log(`- Session returned: yes`);

  await supabase.auth.signOut();
  console.log("- Sign-out completed.");
}

main().catch((err) => {
  console.error("FAIL: Unexpected exception during Supabase auth integration test.");
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
