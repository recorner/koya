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

interface CardsSectionProps {
  badgeText?: string | null;
  heading?: string | null;
  subheading?: string | null;
  items?: Record<string, unknown>[] | null;
}

export function CardsSection({ badgeText, heading, subheading, items }: CardsSectionProps = {}) {
  const displayFeatures = features.map((f, i) => {
    const cms = items?.[i];
    if (!cms) return f;
    return {
      ...f,
      title: (cms.title as string) || f.title,
      description: (cms.description as string) || f.description,
    };
  });

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
            <div className="relative z-20 h-[200px] w-[300px] overflow-hidden rounded-[24px] border border-[rgba(180,185,195,0.18)] bg-[linear-gradient(145deg,#1A1C20_0%,#26292E_20%,#32363D_42%,#26292E_64%,#1A1C20_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.50),0_0_0_1px_rgba(212,175,55,0.08),inset_0_1px_0_rgba(255,255,255,0.10)] sm:h-[240px] sm:w-[390px] sm:rounded-[30px]">
              {/* brushed-metal sheen */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(240,208,96,0.08),transparent_36%),radial-gradient(ellipse_at_bottom_right,rgba(200,205,215,0.10),transparent_36%)]" />
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_22%,rgba(255,255,255,0.12)_44%,rgba(255,255,255,0.04)_50%,transparent_72%)]" />
              {/* gold edge accent — top */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,transparent_10%,rgba(212,175,55,0.30)_50%,transparent_90%)]" />

              <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
                <div className="flex items-center justify-between">
                  <KoyaMark size={30} id="cards-section-card" />
                  {/* EMV chip contact */}
                  <div className="flex items-center gap-3">
                    <div className="h-[26px] w-[34px] rounded-[5px] bg-[linear-gradient(145deg,#C9A030_0%,#D4AF37_40%,#A88520_100%)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_2px_6px_rgba(0,0,0,0.30)]">
                      <div className="mx-auto mt-[7px] h-[12px] w-[20px] rounded-[2px] border border-[rgba(139,105,20,0.50)] bg-[linear-gradient(180deg,rgba(240,208,96,0.30),rgba(168,133,32,0.20))]" />
                    </div>
                    {/* contactless symbol */}
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white/40" strokeWidth="1.8" stroke="currentColor">
                      <path d="M8.5 16.5a7 7 0 0 1 0-9" strokeLinecap="round" />
                      <path d="M12 14.5a4 4 0 0 1 0-5" strokeLinecap="round" />
                      <path d="M15.5 12.5a1 1 0 0 1 0-1" strokeLinecap="round" />
                    </svg>
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

            {/* funding chip — absolute on desktop, stacked on mobile */}
            <div className="hidden absolute right-[2%] top-[10%] z-30 w-[220px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.30)] backdrop-blur-sm sm:block">
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

            {/* controls chip — absolute on desktop, stacked on mobile */}
            <div className="hidden absolute bottom-[10%] left-[4%] z-30 w-[230px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.30)] backdrop-blur-sm sm:block">
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

            {/* usage chip — absolute on desktop, stacked on mobile */}
            <div className="hidden absolute bottom-[4%] right-[8%] z-30 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur-sm sm:block">
              <div className="flex items-center gap-2 text-[11px] text-white/58">
                <Globe2 className="h-3.5 w-3.5 text-[rgba(212,175,55,0.95)]" />
                Live across global merchants
              </div>
            </div>
          </div>

          {/* Mobile-only chips — visible below the card on small screens */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:hidden">
            <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                Funding source
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-white/72">USD Wallet</span>
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                  Active
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/6">
                <div className="h-full w-[74%] rounded-full bg-[linear-gradient(90deg,#A88520_0%,#D4AF37_55%,#F0D060_100%)]" />
              </div>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[rgba(212,175,55,0.95)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                  Controls
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2">
                <span className="text-xs text-white/72">Freeze card</span>
                <div className="h-4 w-7 rounded-full bg-white/10 p-0.5">
                  <div className="h-3 w-3 rounded-full bg-[rgba(212,175,55,0.95)]" />
                </div>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
              <Globe2 className="h-3.5 w-3.5 text-[rgba(212,175,55,0.95)]" />
              <span className="text-[11px] text-white/58">Live across global merchants</span>
            </div>
          </div>
        </FadeUp>

        {/* RIGHT: narrative + capability rows */}
        <FadeUp delay={0.15} className="lg:col-span-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
            {badgeText || 'Koya cards'}
          </p>

          {heading ? (
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              {heading}
            </h2>
          ) : (
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              One card, funded from
              <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
                any of your wallets
              </span>
            </h2>
          )}

          <p className="mt-5 max-w-xl text-sm leading-7 text-white/56 sm:text-base">
            {subheading || 'Koya cards connect directly to your wallets \u2014 spend in KES, USD, or auto-convert from crypto. Freeze instantly, see every transaction in real time, and control exactly how money leaves your account.'}
          </p>

          <div className="mt-8 space-y-3">
            {displayFeatures.map((feature) => {
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