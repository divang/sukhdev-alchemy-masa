import { ArrowLeft, SignOut } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UserProfile } from "@/lib/types"

type AccountDetailsViewProps = {
  profile: UserProfile
  onBack: () => void
  onSignOut: () => void | Promise<void>
}

export function AccountDetailsView({ profile, onBack, onSignOut }: AccountDetailsViewProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{profile.fullName}</CardTitle>
              <CardDescription>Account Information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Account Status</span>
                <Badge variant={profile.role === "admin" ? "destructive" : "secondary"}>
                  {profile.role === "admin" ? "Admin" : "Customer"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Email</p>
                <p className="text-base font-mono break-all">{profile.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Phone</p>
                <p className="text-base font-mono">{profile.phone || "Not provided"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Review & Rating Requests</span>
                <Badge variant={profile.reviewOptIn ? "default" : "outline"}>
                  {profile.reviewOptIn ? "✓ Enabled" : "✗ Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Order Updates & Marketing</span>
                <Badge variant={profile.marketingOptIn ? "default" : "outline"}>
                  {profile.marketingOptIn ? "✓ Enabled" : "✗ Disabled"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Account ID */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">User ID</p>
                <p className="text-xs font-mono text-muted-foreground break-all">{profile.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" className="w-full sm:flex-1" onClick={onBack}>
              <ArrowLeft size={18} className="mr-2" />
              Back to Store
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:flex-1"
              onClick={onSignOut}
            >
              <SignOut size={18} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
