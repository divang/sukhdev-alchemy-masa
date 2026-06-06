import { useState } from "react"
import { ArrowLeft } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type { UserProfile } from "@/lib/types"
import { BRAND_LOGO_PATH } from "@/lib/brand"
import {
  hasRecoveryParamsInUrl,
  requestPasswordReset,
  resendSignupConfirmation,
  sendPhoneOtp,
  signInAdmin,
  signInCustomer,
  signInWithGoogle,
  signUpCustomer,
  updateCurrentUserPassword,
  verifyPhoneOtp,
} from "@/lib/auth"
import { getPasswordPolicyMessage, validateStrongPassword } from "@/lib/validation"

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
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isRequestingReset, setIsRequestingReset] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [usePasswordSignIn, setUsePasswordSignIn] = useState(false)
  const [isRecoveryMode] = useState(() => hasRecoveryParamsInUrl())
  const [signInData, setSignInData] = useState({ email: "", password: "" })
  const [phoneOtpData, setPhoneOtpData] = useState({ phone: "", otp: "", otpSent: false })
  const [resetPasswordData, setResetPasswordData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  })
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

    const passwordValidationError = validateStrongPassword(signUpData.password)
    if (passwordValidationError) {
      toast.error(passwordValidationError)
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

      if (result.notice) {
        toast.info(result.notice)
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

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingOtp(true)
    const error = await sendPhoneOtp({ phone: phoneOtpData.phone })
    setIsSendingOtp(false)

    if (error) {
      toast.error(error)
      return
    }

    setPhoneOtpData((current) => ({ ...current, otpSent: true }))
    toast.success("OTP sent to your phone number.")
  }

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifyingOtp(true)
    const result = await verifyPhoneOtp({ phone: phoneOtpData.phone, otp: phoneOtpData.otp })
    setIsVerifyingOtp(false)

    if (result.error || !result.profile) {
      toast.error(result.error ?? "Unable to verify OTP.")
      return
    }

    toast.success("Signed in with phone OTP.")
    onAuthenticated(result.profile)
  }

  const handleGoogleSignIn = async () => {
    const error = await signInWithGoogle()
    if (error) {
      toast.error(error)
      return
    }

    toast.info("Redirecting to Google sign-in...")
  }

  const handleRequestPasswordReset = async () => {
    const email = signInData.email.trim() || resetPasswordData.email.trim()
    if (!email) {
      toast.error("Enter your email first.")
      return
    }

    setIsRequestingReset(true)
    const error = await requestPasswordReset(email)
    setIsRequestingReset(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success("Password reset email sent. Open the link in your email and set a new password.")
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    const passwordValidationError = validateStrongPassword(resetPasswordData.newPassword)
    if (passwordValidationError) {
      toast.error(passwordValidationError)
      return
    }

    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    setIsUpdatingPassword(true)
    const error = await updateCurrentUserPassword(resetPasswordData.newPassword)
    setIsUpdatingPassword(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success("Password updated. You can now sign in normally.")
    setResetPasswordData((current) => ({ ...current, newPassword: "", confirmPassword: "" }))
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
            <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-card">
              <img
                src={BRAND_LOGO_PATH}
                alt="Sukhdevi Alchemy logo"
                className="h-full w-full object-cover"
                loading="lazy"
              />
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
              <Tabs defaultValue={isRecoveryMode ? "reset-password" : "sign-in"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sign-in">Sign In</TabsTrigger>
                  <TabsTrigger value="create-account">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="sign-in" className="mt-6">
                  <div className="space-y-4">
                    <form className="space-y-3" onSubmit={phoneOtpData.otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp}>
                      <div>
                        <Label htmlFor="phone-otp-number">Phone Number</Label>
                        <Input
                          id="phone-otp-number"
                          value={phoneOtpData.phone}
                          onChange={(e) => setPhoneOtpData((current) => ({ ...current, phone: e.target.value }))}
                          placeholder="+91XXXXXXXXXX"
                        />
                      </div>

                      {phoneOtpData.otpSent && (
                        <div>
                          <Label htmlFor="phone-otp-code">OTP</Label>
                          <Input
                            id="phone-otp-code"
                            value={phoneOtpData.otp}
                            onChange={(e) => setPhoneOtpData((current) => ({ ...current, otp: e.target.value }))}
                            placeholder="Enter 6-digit OTP"
                          />
                        </div>
                      )}

                      <Button className="w-full" type="submit" disabled={isSendingOtp || isVerifyingOtp}>
                        {phoneOtpData.otpSent
                          ? (isVerifyingOtp ? "Verifying OTP..." : "Verify OTP")
                          : (isSendingOtp ? "Sending OTP..." : "Continue with Phone OTP")}
                      </Button>
                    </form>

                    <Button className="w-full" type="button" variant="outline" onClick={handleGoogleSignIn}>
                      Continue with Google
                    </Button>

                    <Button
                      className="w-full"
                      type="button"
                      variant="ghost"
                      onClick={() => setUsePasswordSignIn((current) => !current)}
                    >
                      {usePasswordSignIn ? "Hide email/password" : "Use email/password instead"}
                    </Button>

                    {usePasswordSignIn && (
                      <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSignIn}>
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
                        <Button
                          className="w-full"
                          type="button"
                          variant="outline"
                          disabled={isRequestingReset}
                          onClick={handleRequestPasswordReset}
                        >
                          {isRequestingReset ? "Sending reset email..." : "Forgot Password"}
                        </Button>
                      </form>
                    )}

                    {isRecoveryMode && (
                      <form className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3" onSubmit={handleUpdatePassword}>
                        <p className="text-sm font-medium text-amber-900">Set your new password</p>
                        <div>
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={resetPasswordData.newPassword}
                            onChange={(e) => setResetPasswordData((current) => ({ ...current, newPassword: e.target.value }))}
                            placeholder="12+ chars, mixed case, number, symbol"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">{getPasswordPolicyMessage()}</p>
                        </div>
                        <div>
                          <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                          <Input
                            id="confirm-new-password"
                            type="password"
                            value={resetPasswordData.confirmPassword}
                            onChange={(e) => setResetPasswordData((current) => ({ ...current, confirmPassword: e.target.value }))}
                            placeholder="Re-enter new password"
                          />
                        </div>
                        <Button className="w-full" type="submit" disabled={isUpdatingPassword}>
                          {isUpdatingPassword ? "Updating password..." : "Update Password"}
                        </Button>
                      </form>
                    )}
                  </div>
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
                          placeholder="12+ chars, mixed case, number, symbol"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{getPasswordPolicyMessage()}</p>
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