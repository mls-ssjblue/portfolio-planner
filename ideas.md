# Portfolio Planner — Design Brainstorm

## Approach A — Terminal Quant
<response>
<text>
**Design Movement:** Dark terminal / Bloomberg-terminal aesthetic meets modern data-dense UI
**Core Principles:**
1. Information density without visual noise — every pixel earns its place
2. Monospace type for numbers, humanist sans for labels
3. Neon accent on deep charcoal — high contrast, zero ambiguity
4. Modular grid panels that feel like a trading workstation

**Color Philosophy:** Deep slate (#0d1117) background with electric green (#00ff88) as the primary accent for positive data, amber (#f59e0b) for warnings/neutral, and crimson (#ef4444) for bear scenarios. Cold and clinical — this is a tool, not a toy.

**Layout Paradigm:** Three-column asymmetric layout — narrow left rail (stock library), wide center canvas (portfolio), right panel (projections/analytics). Panels are resizable. No hero section.

**Signature Elements:**
- Monospace ticker labels with blinking cursor on active stock
- Thin horizontal rule separators with subtle glow
- Number cells that flash green/red on value change

**Interaction Philosophy:** Every action has immediate visual feedback. Drag operations leave a ghost trail. Sliders emit a subtle tick sound cue (optional). Data updates animate with a number-roll effect.

**Animation:** Entrance animations are fast (150ms). Number changes roll through intermediate values. Chart bars grow from baseline on mount.

**Typography System:** `JetBrains Mono` for all numbers/tickers, `Inter` for labels and body text. Tight letter-spacing on headings.
</text>
<probability>0.07</probability>
</response>

## Approach B — Sophisticated Finance Dashboard
<response>
<text>
**Design Movement:** Premium wealth management / private banking aesthetic — think Goldman Sachs private wealth portal
**Core Principles:**
1. Restrained luxury — navy, gold, cream, and deep teal
2. Generous whitespace with deliberate information hierarchy
3. Cards with soft shadows and subtle glass morphism
4. Typography-led design where numbers feel authoritative

**Color Philosophy:** Deep navy (#0f1e3d) as primary surface, warm gold (#c9a84c) as accent for key metrics and CTAs, off-white (#f8f5f0) for backgrounds, and muted teal (#2a9d8f) for chart accents. Evokes trust, precision, and wealth.

**Layout Paradigm:** Left sidebar (fixed, 280px) for stock library with search and filters. Main content area split horizontally — top half is portfolio canvas with allocation controls, bottom half is projection analytics. Right drawer slides in for individual stock detail/projection inputs.

**Signature Elements:**
- Gold divider lines between sections
- Card headers with a subtle left border accent in gold
- Donut chart with animated fill on portfolio allocation

**Interaction Philosophy:** Smooth, deliberate interactions. Drag-and-drop with satisfying snap animations. Sliders with gold thumb. Scenario tabs (Bear/Base/Bull) with color-coded active states.

**Animation:** Framer Motion page transitions, chart entrance animations (500ms ease-out), hover states with 200ms transitions.

**Typography System:** `Playfair Display` for headings and large numbers, `DM Sans` for body and labels. High contrast between display and body weights.
</text>
<probability>0.08</probability>
</response>

## Approach C — Precision Instrument
<response>
<text>
**Design Movement:** Scientific instrument / aerospace HUD meets modern SaaS — think Figma meets a Bloomberg terminal
**Core Principles:**
1. Asymmetric layout with deliberate tension between data density and breathing room
2. Stark white surfaces with sharp geometric accents
3. Color used exclusively for data encoding (not decoration)
4. Typographic hierarchy carries all the weight

**Color Philosophy:** Near-white (#fafafa) background, near-black (#111827) for primary text, a single vivid accent — electric indigo (#4f46e5) — for interactive elements only. Bear = warm red (#dc2626), Base = indigo, Bull = emerald (#059669). Color is semantic, never decorative.

**Layout Paradigm:** Horizontal split — top 40% is the portfolio workspace (drag-drop canvas + allocation controls), bottom 60% is the analytics/projection zone. Left rail is a collapsible stock library. The layout feels like a professional IDE.

**Signature Elements:**
- Thin 1px border grid lines on charts (no fill, just strokes)
- Pill-shaped industry tags with muted background colors
- Scenario comparison using side-by-side mini sparklines

**Interaction Philosophy:** Keyboard-friendly. Every element has a clear focus state. Drag operations are precise with grid snapping. Sliders show exact values on hover.

**Animation:** Minimal — only purposeful transitions (200ms). Charts animate once on mount. No decorative motion.

**Typography System:** `Space Grotesk` for headings and numbers, `Inter` for body. Tabular number figures throughout.
</text>
<probability>0.06</probability>
</response>

---

## Selected Approach: **B — Sophisticated Finance Dashboard**

Deep navy + warm gold + glass morphism cards. Playfair Display for headings, DM Sans for body. Left sidebar stock library, main portfolio canvas, right drawer for stock projections. This creates a premium wealth-management feel that matches the serious financial planning purpose of the tool.
