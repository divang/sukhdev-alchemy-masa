import { FacebookLogo, InstagramLogo, Phone, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react"

const CONTACT_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/sukhdevialchemy/",
    icon: InstagramLogo,
    handle: "@sukhdevialchemy",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/people/Sukhdevi-Alchemy/61590206949388/",
    icon: FacebookLogo,
    handle: "Sukhdevi Alchemy",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@sukhdevialchemy",
    icon: YoutubeLogo,
    handle: "@sukhdevialchemy",
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/917889480171",
    icon: WhatsappLogo,
    handle: "+91 78894 80171",
  },
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
              Reach us for product help, bulk orders, and delivery updates. We respond fastest on WhatsApp.
            </p>
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
              WhatsApp Direct: +91 78894 80171
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