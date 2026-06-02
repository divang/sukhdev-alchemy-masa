import { useState } from "react"
import { ArrowLeft, ShieldCheck, UserCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type { UserProfile } from "@/lib/types"
import { resendSignupConfirmation, signInAdmin, signInCustomer, signUpCustomer } from "@/lib/auth"

type AuthViewProps = {
  mode: "customer" | "admin"
  onBack: () => void
  onAuthenticated: (profile: UserProfile) => void
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export function AuthView({ mode, onBack, onAuthenticated }: AuthViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [signInData, setSignInData] = useState({ email: "", password: "" })
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    reviewOptIn: true,
    marketingOptIn: true,
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[auth-ui] handleSignIn submitted", { mode, email: signInData.email })
    setAuthNotice(null)
    setIsSubmitting(true)

    try {
      const result = mode === "admin"
        ? await signInAdmin(signInData)
        : await signInCustomer(signInData)

      console.log("[auth-ui] handleSignIn result", {
        hasError: Boolean(result.error),
        hasProfile: Boolean(result.profile),
        requiresEmailConfirmation: Boolean(result.requiresEmailConfirmation),
        error: result.error,
      })

      if (result.error || !result.profile) {
        toast.error(result.error ?? "Unable to sign in.")
        return
      }

      if (result.notice) {
        setAuthNotice(result.notice)
        toast.info(result.notice)
      }

      toast.success(mode === "admin" ? "Admin access granted." : "Signed in successfully.")
      onAuthenticated(result.profile)
    } catch (error) {
      if (error instanceof Error) {
        console.error("[auth-ui] handleSignIn unexpected error", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          mode,
          email: signInData.email,
        })
      } else {
        console.error("[auth-ui] handleSignIn unexpected non-Error", {
          error,
          mode,
          email: signInData.email,
        })
      }
      toast.error("Sign in request failed. Please retry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[auth-ui] handleSignUp submitted", { email: signUpData.email })

    if (signUpData.password.length < 8) {
      toast.error("Password must be at least 8 characters long.")
      return
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const result = await withTimeout(
        signUpCustomer({
          fullName: signUpData.fullName,
          email: signUpData.email,
          phone: signUpData.phone,
          password: signUpData.password,
          reviewOptIn: signUpData.reviewOptIn,
          marketingOptIn: signUpData.marketingOptIn,
        }),
        15000,
        "Account creation timed out. Please retry."
      )
      console.log("[auth-ui] handleSignUp result", {
        hasError: Boolean(result.error),
        hasProfile: Boolean(result.profile),
        requiresEmailConfirmation: Boolean(result.requiresEmailConfirmation),
        error: result.error,
      })

      if (result.requiresEmailConfirmation) {
        toast.success(result.error ?? "Account created. Check your email and confirm the account before signing in.")
        setSignInData({ email: signUpData.email, password: "" })
        setSignUpData((current) => ({
          ...current,
          password: "",
          confirmPassword: "",
        }))
        return
      }

      if (result.error || !result.profile) {
        toast.error(result.error ?? "Unable to create account.")
        return
      }

      toast.success("Account created. You can now continue to payment.")
      onAuthenticated(result.profile)
    } catch (error) {
      console.error("[auth-ui] handleSignUp unexpected error", error)
      toast.error("Account creation request failed. Please retry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendConfirmation = async () => {
    const email = signInData.email.trim() || signUpData.email.trim()
    console.log("[auth-ui] handleResendConfirmation clicked", { email })
    if (!email) {
      toast.error("Enter your email first, then tap resend confirmation.")
      return
    }

    setIsResending(true)
    let error: string | undefined

    try {
      error = await withTimeout(
        resendSignupConfirmation(email),
        15000,
        "Resend request timed out. Please retry."
      )
    } catch (timeoutError) {
      console.error("[auth-ui] handleResendConfirmation unexpected error", timeoutError)
      toast.error(timeoutError instanceof Error ? timeoutError.message : "Resend request failed. Please retry.")
      setIsResending(false)
      return
    }

    setIsResending(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success("Confirmation email sent. If you retry, wait at least 60 seconds between attempts.")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back to Store
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Card>
          <CardHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              {mode === "admin" ? <ShieldCheck size={28} /> : <UserCircle size={28} />}
            </div>
            <CardTitle className="text-center text-2xl">
              {mode === "admin" ? "Admin Sign In" : "Your Account"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "admin"
                ? "Only admin accounts can access the full order dashboard."
                : "Create an account before payment so customers can view only their own orders and receive updates or review requests. If email confirmation is enabled in Supabase, confirm the email before signing in."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authNotice && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {authNotice}
              </div>
            )}
            {mode === "admin" ? (
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div>
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData((current) => ({ ...current, email: e.target.value }))}
                    placeholder="admin@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData((current) => ({ ...current, password: e.target.value }))}
                    placeholder="Enter your password"
                  />
                </div>
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In as Admin"}
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="sign-in" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sign-in">Sign In</TabsTrigger>
                  <TabsTrigger value="create-account">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="sign-in" className="mt-6">
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <div>
                      <Label htmlFor="sign-in-email">Email</Label>
                      <Input
                        id="sign-in-email"
                        type="email"
                        value={signInData.email}
                        onChange={(e) => setSignInData((current) => ({ ...current, email: e.target.value }))}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sign-in-password">Password</Label>
                      <Input
                        id="sign-in-password"
                        type="password"
                        value={signInData.password}
                        onChange={(e) => setSignInData((current) => ({ ...current, password: e.target.value }))}
                        placeholder="Enter your password"
                      />
                    </div>
                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Signing in..." : "Sign In"}
                    </Button>
                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      disabled={isSubmitting || isResending}
                      onClick={handleResendConfirmation}
                    >
                      {isResending ? "Resending..." : "Resend Confirmation Email"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="create-account" className="mt-6">
                  <form className="space-y-4" onSubmit={handleSignUp}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="full-name">Full Name</Label>
                        <Input
                          id="full-name"
                          value={signUpData.fullName}
                          onChange={(e) => setSignUpData((current) => ({ ...current, fullName: e.target.value }))}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={signUpData.phone}
                          onChange={(e) => setSignUpData((current) => ({ ...current, phone: e.target.value }))}
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="sign-up-email">Email</Label>
                      <Input
                        id="sign-up-email"
                        type="email"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData((current) => ({ ...current, email: e.target.value }))}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="sign-up-password">Password</Label>
                        <Input
                          id="sign-up-password"
                          type="password"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData((current) => ({ ...current, password: e.target.value }))}
                          placeholder="Minimum 8 characters"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={signUpData.confirmPassword}
                          onChange={(e) => setSignUpData((current) => ({ ...current, confirmPassword: e.target.value }))}
                          placeholder="Re-enter your password"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <Checkbox
                        checked={signUpData.marketingOptIn}
                        onCheckedChange={(checked) => setSignUpData((current) => ({ ...current, marketingOptIn: checked === true }))}
                      />
                      <span>Allow order updates and follow-up messages on email or phone.</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <Checkbox
                        checked={signUpData.reviewOptIn}
                        onCheckedChange={(checked) => setSignUpData((current) => ({ ...current, reviewOptIn: checked === true }))}
                      />
                      <span>Allow review and rating requests after delivery.</span>
                    </label>

                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}