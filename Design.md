KOYA_AESTHETICS_PROMPT = """
<frontend_aesthetics>

You are building a premium fintech interface for Koya Bank — a borderless financial operating system.
The aesthetic must feel like it was designed by a team that has used Bloomberg Terminal, Vercel's dashboard,
and Linear — then threw all of it away and started from scratch for Africa.

The signature effect is liquid glassmorphism: surfaces that breathe, refract light, and feel like frosted
obsidian glass suspended in dark space. Not the flat, washed-out glass you see everywhere —
real depth, real blur, real material. Backgrounds bleed through. Layers stack with intention.

For motion, use Motion (formerly Framer Motion) exclusively. Orchestrate reveals on load —
numbers counting up from zero, glass panels sliding in with staggered delays, currency values
assembling digit by digit. One choreographed entrance sequence per page. After that, restraint.
Micro-interactions only where they reward the user: a swap button that pulses once on quote lock,
a balance card that lifts on hover with a 2px translate and shadow bloom.

Typography must not be Inter. Not Space Grotesk. Research what actual finance terminals and
premium trading platforms use — then go one step further. Monospace for all financial data, always.
Display faces should feel like they were commissioned, not downloaded.

The color source of truth is dark — deep navy-black backgrounds, a single electric cyan as the
primary signal color, neon mint only for positive financial states. Everything else is restrained.
No rainbow dashboards. No gradient abuse. Color earns its place by meaning something.

Backgrounds are not solid. They are layered: a base gradient, a subtle noise texture on top,
and glass panels floating above. The depth should make the interface feel three-dimensional
without ever touching actual 3D. Use CSS mesh gradients or canvas-based ambient glow effects
behind key surfaces to create atmosphere.

Components must be bespoke. No Shadcn defaults used as-is. Take the primitives and reskin them
completely — custom borders, custom shadows, custom focus rings in Signal Cyan. The conversion
widget especially: it should feel like a piece of precision engineering, not a form.

Avoid at all costs: purple-on-white, rounded cards with drop shadows on white backgrounds,
floating action buttons, hero sections with a centered headline and a stock photo, any layout
that could belong to a SaaS landing page from 2022.

This is financial infrastructure for people who move money across borders, hold Bitcoin, and
check KES/USD rates before they sleep. Build it like you respect what they're doing with it.

</frontend_aesthetics>
"""