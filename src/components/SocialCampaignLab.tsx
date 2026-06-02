import { ArrowSquareOut, ChefHat, InstagramLogo, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type SocialCampaignLabProps = {
  showReels: boolean
  showChefCta: boolean
  showSocialIcons: boolean
}

type ReelDraft = {
  id: string
  title: string
  hook: string
  outcome: string
  masala: string
}

const reelDrafts: ReelDraft[] = [
  {
    id: "reel-1",
    title: "Restaurant Review: Butter Chicken",
    hook: "Can we match this flavor at home?",
    outcome: "Home recreation scored 9/10 by family tasting panel.",
    masala: "Mix Masala Premium Blend",
  },
  {
    id: "reel-2",
    title: "Street Chaat Taste Test",
    hook: "Tanginess benchmark from top local chaat point.",
    outcome: "Balanced tang and heat in home trial.",
    masala: "Chaat Masala",
  },
  {
    id: "reel-3",
    title: "Punjabi Chole Recreation",
    hook: "Chef-level depth without restaurant kitchen setup.",
    outcome: "Dark, rich gravy with clean spice finish.",
    masala: "Chole Masala",
  },
]

export function SocialCampaignLab({ showReels, showChefCta, showSocialIcons }: SocialCampaignLabProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-50 via-amber-50 to-lime-50 p-5 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <Badge className="mb-3 bg-orange-600 text-white hover:bg-orange-600">Campaign Lab</Badge>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Restaurant To Home: Social Storytelling</h3>
          <p className="mt-2 text-sm text-slate-700 sm:text-base">
            New experiment concept: real restaurant review, chef outreach with sample pack, and home recreation using Sukhdevi premium masala.
          </p>
        </div>

        {showSocialIcons && (
          <div className="flex items-center gap-2">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Open Instagram" className="rounded-full border border-orange-200 bg-white p-2 text-slate-700 transition hover:-translate-y-0.5 hover:text-orange-700">
              <InstagramLogo size={18} weight="duotone" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="Open YouTube" className="rounded-full border border-orange-200 bg-white p-2 text-slate-700 transition hover:-translate-y-0.5 hover:text-orange-700">
              <YoutubeLogo size={18} weight="duotone" />
            </a>
            <a href="https://wa.me" target="_blank" rel="noreferrer" aria-label="Open WhatsApp" className="rounded-full border border-orange-200 bg-white p-2 text-slate-700 transition hover:-translate-y-0.5 hover:text-orange-700">
              <WhatsappLogo size={18} weight="duotone" />
            </a>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-orange-200/70 bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Step 1</p>
          <h4 className="mt-1 text-base font-semibold text-slate-900">Wife Reviews Restaurant Dish</h4>
          <p className="mt-2 text-sm text-slate-700">Capture honest taste notes and flavor benchmarks in a short reel.</p>
        </Card>
        <Card className="border-orange-200/70 bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Step 2</p>
          <h4 className="mt-1 text-base font-semibold text-slate-900">Connect With Chef</h4>
          <p className="mt-2 text-sm text-slate-700">Offer sample pack and ask for quick reaction or collaboration signal.</p>
        </Card>
        <Card className="border-orange-200/70 bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Step 3</p>
          <h4 className="mt-1 text-base font-semibold text-slate-900">Recreate Dish At Home</h4>
          <p className="mt-2 text-sm text-slate-700">Use your own premium masala and compare outcome side-by-side.</p>
        </Card>
      </div>

      {showReels && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {reelDrafts.map((draft) => (
            <Card key={draft.id} className="overflow-hidden border-slate-200 bg-white">
              <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
                <p className="text-xs uppercase tracking-wide text-slate-200">Reel Draft</p>
                <p className="mt-2 text-sm font-medium">{draft.hook}</p>
                <p className="mt-3 text-xs text-slate-300">Result Preview: {draft.outcome}</p>
              </div>
              <div className="space-y-2 p-4">
                <h5 className="font-semibold text-slate-900">{draft.title}</h5>
                <p className="text-xs text-slate-600">Recommended product: {draft.masala}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showChefCta && (
        <div className="mt-6 rounded-xl border border-orange-300 bg-white/95 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-orange-700">Chef Outreach</p>
              <h4 className="text-lg font-semibold text-slate-900">Invite Restaurants To Try A Sample Pack</h4>
              <p className="text-sm text-slate-700">Use this as a lead-generation CTA when campaign performance is strong.</p>
            </div>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <ChefHat size={18} className="mr-2" />
              Request Sample Pack
              <ArrowSquareOut size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
