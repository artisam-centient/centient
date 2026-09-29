# Centient sticker pack

Eight die-cut stickers built on one brand system (see [`brand-brief.md`](brand-brief.md)). Open [`preview.html`](preview.html) to see them all side by side on light and dark backgrounds. There is a toggle for the cut lines.

| # | File | Concept | Final cut size | Fonts / assets to check |
|---|---|---|---|---|
| 1 | `01-logo.svg` / `.png` | **Logo:** the Centient owl alone, contour die-cut, on a 1.5 mm brand-green halo | 2.73 × 2.99 in (69 × 76 mm), contour | Owl illustration `logo.png` (confirm ownership / commercial rights) |
| 2 | `02-name.svg` / `.png` | **Wordmark:** "Centient", white on brand green | 3.00 × 1.25 in (76 × 32 mm), rounded rect | Manrope (OFL) |
| 3 | `03-lockup.svg` / `.png` | **Lockup:** owl stacked over the wordmark on paper white | 3.00 × 3.00 in (76 × 76 mm), rounded square | Manrope (OFL), owl `logo.png` |
| 4 | `04-tagline.svg` / `.png` | **Tagline:** "Train AI, cent by cent." on payout gold | 3.00 × 3.00 in (76 × 76 mm), rounded square | Manrope, Inter (OFL) |
| 5 | `05-on-stellar.svg` / `.png` | **Centient on Stellar:** owl, then "Centient on Stellar". "Stellar" is set as text in Manrope; no Stellar logo is used. | 3.00 × 3.00 in (76 × 76 mm), rounded square | Manrope (OFL), owl `logo.png`. The word "Stellar" is a trademark of SDF; see the note below. |
| 6 | `06-website.svg` / `.png` | **Website:** `centient.work`. Cap height is about 9 mm, so it reads from about 1 m. | 4.00 × 1.50 in (102 × 38 mm), rounded rect | Manrope (OFL) |
| 7 | `07-meme.svg` / `.png` | **Meme:** a Horizon `op_no_trust` error labelled "UNREVIEWED AI OUTPUT", with the fix "Add a human trustline." | 3.00 × 3.00 in (76 × 76 mm), rounded square | Manrope, Inter (OFL) |
| 8 | `08-mascot.svg` / `.png` | **Bonus mascot:** winking owl with a lightbulb, contour die-cut on a payout-gold halo | 2.83 × 2.99 in (72 × 76 mm), contour | Owl illustration `public/mascot/owl-idea.webp` (confirm rights) |

**Meme, explained:** on Stellar, a payment to an account that has no trustline for the asset fails with `op_no_trust`. Centient's pitch is that AI output shouldn't be trusted until a human has reviewed it. Stellar devs get the error code, and everyone else gets the pun.

## Shared system (applies to every sticker)
- **Palette:** `#006D3D` green, `#35D07F` fresh green, `#FDCE5E` gold, `#785A00` deep gold, `#191C1E` ink, `#F8F9FB` paper, and white. These are the app's `globals.css` tokens. The build fails if any other colour appears.
- **Type:** Manrope ExtraBold/Bold (display, wordmark with −0.05 em tracking) and Inter Bold/SemiBold (micro-labels with 0.2 em tracking, code). All text is converted to outlines, so the SVGs contain no `<text>`.
- **Border and edge:** 3 mm white border inside the cut and 3 mm white bleed outside it. Each body has a 0.75 pt ink keyline and a 6 mm corner radius (9 mm at the cut). Contour stickers add a 1.5 mm coloured halo.
- **Owl placement:** in badges, the owl is top-centred at 55% of body height with a 7% top margin. Stickers 3 and 5 use the same owl at the same proportions.

## Print specs
- **SVG layers:** `bleed` (white, 3 mm past the cut), `artwork`, and `cutline`. The `cutline` layer is a single closed path with a 0.25 mm `#EC008C` stroke. It does not print; map it to your printer's `CutContour` spot colour.
- **Units:** mm. Each canvas is the cut size plus 3 mm bleed on every side.
- **Checks enforced by the build:** text is at least 8 pt and sits at least 5 mm inside the cut line (the spec asks for 3 mm); every stroke is at least 0.5 pt.
- **PNG:** 300 DPI, transparent outside the bleed shape, cutline hidden, bleed included.
- **CMYK:** there are no neon values. The brand's `#6BFDA7` was deliberately left out. `#35D07F` may print slightly duller in CMYK, so ask your printer for a proof.
- **Owl resolution:** the owl rasters are embedded at 300 DPI or more at their printed size (about 340 DPI in the badges; the smaller mascot source gives about 312 DPI). There is no vector owl yet. A vectorised owl would help at sizes above about 3.5 in.

## Things to verify before printing
1. **URL:** `centient.work` was confirmed. `lib/stellar/wallet-connect.ts:270` still falls back to `centient.xyz`.
2. **Stellar name:** no Stellar logo is used, only the word "Stellar" in our font, and there is no endorsement language. Check the wording against SDF's current brand / trademark guidelines before a large print run.
3. **Font licences:** Manrope and Inter are both SIL Open Font License 1.1. Outlined text needs no font embedding, and the OFL allows commercial print.
4. **Owl illustration rights:** confirm the owl art (`logo.png`, `public/mascot/*`) is owned or licensed for merchandise use. If it was AI-generated, check the terms of the tool that made it.

## Rebuilding
```bash
pip install fonttools brotli uharfbuzz pillow numpy scipy scikit-image playwright
python3 stickers/src/build.py   # fetches Manrope/Inter from npm (@fontsource) on first run
```
All geometry and copy live in [`src/build.py`](src/build.py). Edit the script and re-run it; don't hand-edit the SVGs.
