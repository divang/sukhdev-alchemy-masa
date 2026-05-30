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

function resolveRedirectUrl() {
  const fromEnv = readEnv(["VITE_AUTH_REDIRECT_URL", "AUTH_REDIRECT_URL", "EMAIL_REDIRECT_TO"]);
  if (fromEnv) return fromEnv;
  return "http://localhost:5000/";
}

async function main() {
  const supabaseUrl = readEnv(["VITE_SUPABASE_URL", "SUPABASE_URL"]);
  const supabaseAnonKey = readEnv(["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);
  const redirectTo = resolveRedirectUrl();
  const providedEmail = readEnv(["TEST_SIGNUP_EMAIL", "E2E_SIGNUP_EMAIL"]);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FAIL: Missing Supabase credentials.");
    console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY).");
    process.exit(1);
  }

  const seed = Date.now();
  const email = providedEmail || `smtp-e2e-${seed}@example.com`;
  const password = `E2e!${seed}Aa`;

  console.log("Running email confirmation check with:");
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- Anon key: ${mask(supabaseAnonKey)}`);
  console.log(`- Redirect URL: ${redirectTo}`);
  console.log(`- Signup email: ${email}`);
  if (!providedEmail) {
    console.log("- Note: using generated test email. Set TEST_SIGNUP_EMAIL to test a real inbox.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error("FAIL: signUp returned an error.");
    console.error(error.message);
    process.exit(1);
  }

  if (!data.user) {
    console.error("FAIL: signUp succeeded but no user was returned.");
    process.exit(1);
  }

  console.log(`- User created: ${data.user.id}`);
  console.log(`- Session returned: ${data.session ? "yes" : "no"}`);

  if (data.session) {
    console.error("FAIL: Confirmation is NOT enforced. Session exists immediately after signUp.");
    console.error("Action: Enable Auth -> Email -> Confirm email in Supabase dashboard.");
    process.exit(1);
  }

  console.log("PASS: Confirmation flow is enforced (no session before email verification).");
  console.log("Next: open the mailbox for the test email and verify the confirmation link redirects correctly.");
}

main().catch((err) => {
  console.error("FAIL: Unexpected exception during SMTP/confirmation test.");
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
