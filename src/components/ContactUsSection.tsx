import { FacebookLogo, InstagramLogo, LinkedinLogo, Phone, TwitterLogo, YoutubeLogo } from "@phosphor-icons/react"

const CONTACT_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/sukhdevialchemy/",
    icon: InstagramLogo,
    handle: "@sukhdevialchemy",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sukhdevialchemy",
    icon: FacebookLogo,
    handle: "Sukhdevi Alchemy",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@sukhdevialchemy",
    icon: YoutubeLogo,
    handle: "@sukhdevialchemy",
  },
]

const FOLLOW_US_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/sukhdevialchemy", icon: FacebookLogo },
  { name: "Instagram", href: "https://www.instagram.com/sukhdevialchemy/", icon: InstagramLogo },
  { name: "X", href: "https://x.com/sukhdevialchemy", icon: TwitterLogo },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/sukhdevialchemy", icon: LinkedinLogo },
  { name: "YouTube", href: "https://www.youtube.com/@sukhdevialchemy", icon: YoutubeLogo },
]

export function ContactUsSection() {
  return (
    <section className="border-t bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-2xl border bg-background/80 p-6 sm:p-8">
          <div className="mb-6 sm:mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contact Us</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Talk to Sukhdevi Alchemy</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Reach us for product help, platform support, and delivery updates.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow us</p>
              <div className="flex items-center gap-2">
                {FOLLOW_US_LINKS.map((link) => {
                  const Icon = link.icon
                  return (
                    <a
                      key={link.name}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${link.name}`}
                      className="rounded-full border p-1.5 text-foreground transition hover:bg-accent"
                    >
                      <Icon size={16} weight="fill" />
                    </a>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CONTACT_LINKS.map((link) => {
              const Icon = link.icon

              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon size={18} weight="duotone" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{link.name}</p>
                      <p className="text-xs text-muted-foreground">{link.handle}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Open</span>
                </a>
              )
            })}
          </div>

          <div className="mt-5 rounded-xl border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Phone size={16} />
              Support follows secure in-app checkout and tracked delivery flow.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Service hours: Monday to Saturday, 9:00 AM to 8:00 PM IST.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}