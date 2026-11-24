# Repodest Design System (Linear + DeepWiki + Vercel Geist)

Shared design tokens used across **Repodest** (`styles.css`) and **Repodest-Extension** (`content/sidebar.css.js`).

## Color Tokens

| Token | Dark Mode | Light Mode | Usage |
|---|---|---|---|
| `--bg` | `#0A0E14` | `#F8FAFC` | Primary page canvas |
| `--bg2` | `#0E141D` | `#F1F5F9` | Recessed panels, inputs, diagram viewport |
| `--card` | `#111826` | `#FFFFFF` | Elevated cards and containers |
| `--card2` | `#182231` | `#F8FAFC` | Interactive pill buttons / hover surfaces |
| `--line` | `#212D3E` | `#E2E8F0` | 1px hairline borders |
| `--line2` | `#2E3D52` | `#CBD5E1` | Hover / active borders |
| `--accent` | `#34D399` | `#059669` | Primary signal-green brand accent |
| `--accent-strong` | `#6EE7B7` | `#047857` | Hover accent |
| `--accent-dim` | `rgba(52,211,153,.12)` | `rgba(5,150,105,.10)` | Active tab & selected preset tint |
| `--text` | `#E8ECF4` | `#0F172A` | Primary foreground text (WCAG AA+) |
| `--text2` | `#9AA6B8` | `#475569` | Secondary body copy |
| `--text3` | `#8593A9` | `#64748B` | Muted metadata & captions |
| `--cyan` | `#67E8F9` | `#0891B2` | Docs / info highlights |
| `--yellow` | `#FBBF24` | `#D97706` | Warnings / medium risk |
| `--red` | `#F87171` | `#DC2626` | Errors / high risk |

## Typography & Numerals
- **UI Sans:** `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`
- **Code / Paths / Metrics:** `'JetBrains Mono', ui-monospace, monospace`
- **Tabular Numerals:** `font-variant-numeric: tabular-nums` enforced on scores, file sizes, token estimates, and stats.

## Spacing, Radius & Motion
- **Radius:** `--r: 14px` (cards), `--rs: 10px` (buttons/inputs), `99px` (chips/pills)
- **Motion:** `150ms–200ms ease-out` transitions; transform-only pan/zoom (`will-change: transform`); full `@media (prefers-reduced-motion: reduce)` disablement.
- **Icons:** Single inline SVG icon sprite (`svg.ic` default `14px × 14px`, `stroke-width: 2`).

## Information Architecture (Web)
13 tabs organized into 5 clear visual groups with hairline dividers:
1. **Overview** (`Overview`, `Languages`)
2. **Code** (`Files`, `Digest`)
3. **Architecture** (`Diagram`, `Map`)
4. **Review** (`PR X-Ray`, `Deep`, `Deps`)
5. **Insights** (`Activity`, `Crawl`, `Fun`, `Onboard`)
