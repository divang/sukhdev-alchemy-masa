import { FacebookLogo, InstagramLogo, YoutubeLogo } from "@phosphor-icons/react"

const FOLLOW_US_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/sukhdevialchemy", icon: FacebookLogo },
  { name: "Instagram", href: "https://www.instagram.com/sukhdevialchemy/", icon: InstagramLogo },
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
                      className="text-foreground transition-opacity hover:opacity-70"
                    >
                      <Icon size={16} weight="fill" />
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}