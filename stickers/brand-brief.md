# Centient Sticker Pack: Brand Brief (approved 2026-09-29)

Sources: `README.md`, `brand.md`, `app/globals.css`, `app/layout.tsx`, `public/`, `docs/features.md`.

## 1. Project name
**Centient**: capital C, rest lowercase. Never "CENTIENT" or "centient" (`brand.md` §1).

## 2. Problem and audience
AI teams need trustworthy human judgment on model outputs, and the people able to provide it, often without a bank account, rarely get paid quickly or fairly for microtasks. Centient pays each accepted ranking instantly in USDC on Stellar.

## 3. Existing logo
- `logo.png` (2048×2048 RGBA, repo root) and `public/logo.png` (1024×1024): a raster illustrated owl mascot, waving.
- Pose variants: `public/mascot/owl-{wave,think,idea,chart,laptop}.webp`
- **No vector logo exists.** Stickers will embed the 2048 px PNG, which is enough for 300 DPI at up to about 6.8 in. The owl keeps its own illustration colors (sage, mint, orange beak). The palette rule below covers everything we draw around it.
- There is no separate "C" monogram. `brand.md` §12 mentions one, but it was never made.

## 4. Color palette (from `app/globals.css` tokens)
| Role | Token | Hex | CMYK note |
|---|---|---|---|
| Brand green | `primary` | `#006D3D` | Prints well (about C100 M0 Y90 K45) |
| Fresh green | `primary-container` | `#35D07F` | Slight dulling in CMYK; acceptable |
| Gold (money) | `secondary-container` | `#FDCE5E` | Prints well |
| Deep gold | `secondary` | `#785A00` | Prints well |
| Ink | `on-surface` | `#191C1E` | Rich black substitute |
| + white / off-white `#F8F9FB` | | | |

I'm skipping `primary-fixed #6BFDA7` because it's neon and won't hold in CMYK. I'm also skipping the indigo tertiary, since the brand reserves it.

## 5. Typography (both SIL OFL, Google Fonts, already used in the app)
- **Display:** Manrope ExtraBold 800, tight tracking (wordmark rule from `brand.md` §4)
- **Supporting:** Inter SemiBold/Bold 600–700, uppercase with wide tracking for micro-labels

## 6. Visual style
**Soft, rounded, flat.** Pill and rounded-rect badges, solid fills with no gradients except one green→fresh-green accent, and a fixed 3 mm white die-cut border. This matches the app's rounded Material 3 UI and the friendly owl, and it prints cleanly.

Fixed system for every sticker: a 3 mm white die-cut border and 3 mm white bleed; a 0.75 pt `#191C1E` keyline on the edge of the coloured body; a 6 mm body corner radius (9 mm at the cut); and a coloured 1.5 mm halo on contour-cut owls. Wherever the owl sits inside a badge, it is top-centred at 55% of the body height with a 7% top margin. Artboards are 3 × 3 in, 3 × 1.25 in (wordmark), or 4 × 1.5 in (URL, sized to read from about 1 m).

## 7. Tone
**Friendly-confident**, with light wit only in hero or meme moments. This follows the brand voice: "clear, not clever" in the product, and wordplay allowed in marketing.

---

## Decisions (confirmed with the project owner)

- **Website URL:** `centient.work` (matches `app/layout.tsx` metadataBase). Not used: `beta.centient.work` (public beta build), `centient.xyz` (WalletConnect fallback in `lib/stellar/wallet-connect.ts:270`, which looks stale).
- **Tagline:** "Train AI, cent by cent." (the existing brand line)
- **Off-limits:** nothing beyond `brand.md` (no coins, chains, circuit-board clichés, or hype)
- **Settlement copy:** USDC on Stellar. `brand.md`'s cUSD / MiniPay wording is from the older Celo build.
- **Soroban:** Centient ships no Soroban contract (README), so there is no "Built with Soroban" badge.
- **Bonus sticker:** owl mascot pose (`owl-idea`)
