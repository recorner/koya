'use client';

import { KoyaMark } from '@/components/marketing/koya-mark';
import { SectionShell } from '@/components/marketing/section-shell';
import { FadeUp } from '@/components/marketing/motion-wrapper';
import {
  Globe2,
  Snowflake,
  Smartphone,
  Zap,
  ArrowUpRight,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { SiVisa } from '@icons-pack/react-simple-icons';

const features = [
  {
    icon: Globe2,
    title: 'Global card acceptance',
    description:
      'Spend across international merchants and everyday payment surfaces with one premium card layer.',
  },
  {
    icon: Snowflake,
    title: 'Instant freeze controls',
    description:
      'Lock and unlock the card immediately when something looks off, without calling anyone or performing rituals.',
  },
  {
    icon: Smartphone,
    title: 'Live transaction visibility',
    description:
      'Push notifications and real-time card activity help you see where value moved the moment it happens.',
  },
  {
    icon: Zap,
    title: 'Wallet-linked funding',
    description:
      'Fund from the right wallet and support auto-conversion when spending across currencies.',
  },
];

export function CardsSection() {
  return (
    <SectionShell id="cards">
      <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        {/* LEFT: visual system */}
        <FadeUp className="lg:col-span-6">
          <div className="relative mx-auto flex min-h-[340px] w-full max-w-[560px] items-center justify-center sm:min-h-[500px]">
            {/* ambient glows */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl sm:h-[360px] sm:w-[360px]" />
            <div className="pointer-events-none absolute right-[10%] top-[18%] hidden h-[160px] w-[160px] rounded-full bg-[rgba(0,229,255,0.06)] blur-2xl sm:block" />

            {/* rear virtual card */}
            <div className="absolute left-[8%] top-[18%] hidden h-[220px] w-[340px] rotate-[-8deg] rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(180,185,195,0.06),rgba(140,145,155,0.03))] opacity-60 blur-[1px] shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:block sm:h-[230px] sm:w-[360px]" />

            {/* main physical card — titanium metallic */}
            <div className="relative z-20 h-[200px] w-[300px] overflow-hidden rounded-[24px] border border-[rgba(180,185,195,0.22)] bg-[linear-gradient(135deg,#1C1E22_0%,#2A2D33_28%,#383C44_52%,#2A2D33_76%,#1C1E22_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-[240px] sm:w-[390px] sm:rounded-[30px]">
              {/* brushed-metal sheen */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(200,205,215,0.14),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(180,185,195,0.10),transparent_36%)]" />
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(120deg,transparent_18%,rgba(255,255,255,0.10)_46%,transparent_74%)]" />
              {/* subtle grain texture for brushed metal feel */}
              <div className="absolute inset-0 opacity-[0.03] [background-image:url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')]" />

              <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
                <div className="flex items-center justify-between">
                  <KoyaMark size={30} id="cards-section-card" />
                  <div className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    Titanium
                  </div>
                </div>

                <div className="mt-4 sm:mt-6">
                  <div className="font-mono text-base tracking-[0.28em] text-white/82 sm:text-xl">
                    •••• •••• •••• 4821
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/28">
                      Card holder
                    </p>
                    <p className="mt-1 text-xs font-medium text-white/82 sm:text-sm">
                      KOYA MEMBER
                    </p>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/28">
                        Expires
                      </p>
                      <p className="mt-1 font-mono text-xs text-white/82 sm:text-sm">09/29</p>
                    </div>

                    {/* Visa logo */}
                    <SiVisa size={40} className="mb-0.5 shrink-0 text-white/75" />
                  </div>
                </div>
              </div>
            </div>

            {/* funding chip */}
            <div className="absolute right-[2%] top-[10%] z-30 hidden w-[220px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:block">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                Funding source
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-white/72">USD Wallet</span>
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                  Active
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
                <div className="h-full w-[74%] rounded-full bg-[linear-gradient(90deg,#A88520_0%,#D4AF37_55%,#F0D060_100%)]" />
              </div>
            </div>

            {/* controls chip */}
            <div className="absolute bottom-[10%] left-[4%] z-30 hidden w-[230px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:block">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                  Card controls
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                <span className="text-sm text-white/72">Freeze card</span>
                <div className="h-5 w-9 rounded-full bg-white/10 p-0.5">
                  <div className="h-4 w-4 rounded-full bg-[rgba(212,175,55,0.95)]" />
                </div>
              </div>

              <div className="mt-2 text-[11px] text-white/42">
                Spending controls update instantly across sessions.
              </div>
            </div>

            {/* usage chip */}
            <div className="absolute bottom-[4%] right-[8%] z-30 hidden rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur-xl sm:block">
              <div className="flex items-center gap-2 text-[11px] text-white/58">
                <Globe2 className="h-3.5 w-3.5 text-[rgba(212,175,55,0.95)]" />
                Live across global merchants
              </div>
            </div>
          </div>
        </FadeUp>

        {/* RIGHT: narrative + capability rows */}
        <FadeUp delay={0.15} className="lg:col-span-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
            Koya cards
          </p>

          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Premium cards wired into
            <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
              your full money stack
            </span>
          </h2>

          <p className="mt-5 max-w-xl text-sm leading-7 text-white/56 sm:text-base">
            Koya cards are not isolated payment tools. They connect directly to
            your wallets, funding logic, and controls so you can spend globally
            with better visibility, better switching, and tighter command over
            how money leaves the system.
          </p>

          <div className="mt-8 space-y-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 transition-all duration-300 hover:border-[rgba(212,175,55,0.18)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.10)] text-[rgba(212,175,55,0.95)]">
                      <Icon size={18} strokeWidth={1.7} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold tracking-tight text-white">
                          {feature.title}
                        </h3>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 text-white/22 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[rgba(212,175,55,0.80)]" />
                      </div>

                      <p className="mt-2 text-sm leading-6 text-white/56">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
            <CreditCard className="h-5 w-5 text-[rgba(212,175,55,0.95)]" />
            <p className="text-sm leading-6 text-white/64">
              Physical and virtual cards can sit on top of the same wallet system,
              so funding, controls, and spending intelligence stay unified.
            </p>
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}