# Centient Sticker Pack: Brand Brief (DRAFT, awaiting approval)

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

Fixed system for every sticker: 3 in × 3 in artboard (circles and badges) or 3 in × 1.5 in (horizontal wordmark/URL), a 3 mm white contour around each shape, 0.75 pt `#191C1E` hairline keyline inside the white border, a 6 mm corner radius on rectangles, and the owl always at the same height ratio (62% of the shape height) and left or top-centered.

## 7. Tone
**Friendly-confident**, with light wit only in hero or meme moments. This follows the brand voice: "clear, not clever" in the product, and wordplay allowed in marketing.

---

## Things to confirm before I design

1. **Website URL.** The repo has several candidates:
   - `https://centient.work`: `brand.md`, `app/layout.tsx` metadataBase, `spec.md`, OG image. **This is my assumption.**
   - `https://beta.centient.work`: `docs/payout-api.md` ("public build")
   - `https://centient.xyz`: fallback in `lib/stellar/wallet-connect.ts:270`
   - `https://centient.gitbook.io/centient-docs/`: docs link in `components/LoginScreen.tsx`
2. **Off-limits list.** Are there words, colors, jokes, or partner names to avoid? (`brand.md` already bans coins, chains, circuit-board imagery, and emoji in UI.)
3. **Stale copy in `brand.md`.** It still says cUSD and MiniPay from the older Celo build. The stickers will say **USDC on Stellar**, per the README.
4. **No Soroban contract.** The README says Centient deliberately ships no Soroban contract and uses classic payments. I will **not** make a "Built with Soroban" badge. For the bonus stickers I'd do (a) an owl mascot pose sticker and (b) a code sticker built from the repo's real `payment` op / `op_no_trust` handling.

## Tagline options (pick one, max ~6 words, problem-focused)
- **A.** "Good judgment shouldn't wait for payday."
- **B.** "No bank account. Still gets paid."
- **C.** "Your judgment, paid in seconds."

(The existing tagline "Train AI, cent by cent." stays on the lockup/OG, and I can use it instead if you prefer.)
