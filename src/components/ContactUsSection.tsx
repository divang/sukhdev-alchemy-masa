import { FacebookLogo, InstagramLogo, YoutubeLogo } from "@phosphor-icons/react"

const FOLLOW_US_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/sukhdevialchemy", icon: FacebookLogo },
  { name: "Instagram", href: "https://www.instagram.com/sukhdevialchemy/", icon: InstagramLogo },
  { name: "YouTube", href: "https://www.youtube.com/@sukhdevialchemy", icon: YoutubeLogo },
]

export function ContactUsSection() {
  const whatsappNumber = "7889480171"
  const whatsappHref = `https://wa.me/91${whatsappNumber}`

  return (
    <section className="border-t bg-card">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-4xl rounded-2xl border bg-background/80 p-4 sm:p-5">
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contact Us</p>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Reach us for product help, platform support, and delivery updates.
            </p>

            <div className="mt-3 text-sm text-foreground sm:text-base">
              WhatsApp: <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4 hover:opacity-80">+91 {whatsappNumber}</a>
            </div>

            <div className="mt-2 text-sm text-foreground sm:text-base">
              Email: <a href="mailto:care@sukhdevialchemy.com" className="font-semibold underline underline-offset-4 hover:opacity-80">care@sukhdevialchemy.com</a>
            </div>

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