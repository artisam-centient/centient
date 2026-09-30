---
name: Centient
description: Train AI, cent by cent. Per-answer USDC payouts on Stellar, shown as receipts.
colors:
  primary: "#006d3d"
  on-primary: "#ffffff"
  primary-container: "#35d07f"
  secondary: "#785a00"
  secondary-container: "#fdce5e"
  secondary-fixed: "#ffdf9b"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  surface: "#f8f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f3f4f6"
  surface-container-high: "#e7e8ea"
  surface-container-highest: "#e1e2e4"
  on-surface: "#191c1e"
  on-surface-variant: "#3d4a3f"
  inverse-surface: "#2e3132"
  outline: "#6c7b6e"
  outline-variant: "#bbcabc"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 7vw, 5.25rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  display-sm:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "5rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  display-lg:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  display-xl:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "5.25rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline-stub:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  amount:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.05em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  micro-label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.2em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  receipt-body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.625
  receipt-prompt:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.375
  icon:
    fontFamily: "Material Symbols Outlined"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "\"liga\""
  icon-button:
    fontFamily: "Material Symbols Outlined"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
  icon-title:
    fontFamily: "Material Symbols Outlined"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.5rem"
  3xl: "2rem"
  full: "9999px"
spacing:
  gutter: "1.25rem"
  gutter-sm: "2rem"
  section: "6rem"
  section-sm: "7rem"
  paper-x: "1.25rem"
  stub-x: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "56px"
    width: "100%"
  button-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  link-inline:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
  receipt-paper:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    padding: "16px 20px 32px"
  receipt-stub:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    padding: "24px 20px"
    width: "15.5rem"
  receipt-amount:
    textColor: "{colors.secondary}"
    typography: "{typography.amount}"
  reward-chip:
    backgroundColor: "{colors.secondary-fixed}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  line-item-fields:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  line-item-disc:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "40px"
  response-option:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  printer:
    backgroundColor: "{colors.inverse-surface}"
    rounded: "{rounded.lg}"
    height: "28px"
  content-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.2xl}"
    padding: "24px"
---

# Design System: Centient

## Overview

**Creative North Star: "The Payslip"**

Centient is recorded as two layers. The **incumbent brand system** (brand.md, installed as the Tailwind 4 `@theme` block in `app/globals.css`) supplies every color, both typefaces, the radius scale, the soft shadow scale, Material Symbols Outlined icons, the owl mascot and the green action gradient. This build kept all of it. The **receipt language** is what the landing / sign-in revamp (`components/LoginScreen.tsx` and its children) added: white paper with a torn edge, a printer slot the paper feeds out of, stubs torn at both ends, dotted leaders between a field name and its value, dashed rules between groups, uppercase micro-labels naming fields, and system mono only for hashes and addresses.

The payment is the hero. The page reads as one receipt for one answer: a sample task prints itself line by line, real testnet payouts sit below it as stubs, the journey itemizes the same answer, and the close is the last stub handed over with the sign-in on it. Density is calm: off-white ground, one white paper at a time, generous section padding, a single max-width column. Motion is short, eased hard out, and every piece of it has a still, finished state for reduced motion.

Scope: the receipt language lives on the landing, its loading skeleton and the FAQ. The task screen, success screen and admin console were not redesigned and still follow brand.md's card patterns only; do not claim they use receipts.

**Key Characteristics:**
- Off-white ground, white paper, no tinted card surfaces.
- Green only on actions and confirmations; gold on every amount.
- Manrope 800 for display and all numerals; Inter for body and labels; mono only for hashes, addresses and the build SHA.
- Paper edges are cut with masks (torn teeth), not drawn with borders.
- Receipt rows: field name, dotted leader, value.
- Every animation resolves to a finished, legible still frame under reduced motion.

## Colors

A cool off-white and white paper palette, carried by deep green for action and warm gold for money, with ink (near-black) doing the structural work.

### Primary
- **Ledger Green** (primary): the wordmark, primary buttons (as the gradient start), inline links, focus rings, the Chosen stamp, Passed, signed keys, and Confirmed. Nothing decorative.
- **Signal Green** (primary-container): only as the end of the action gradient on the primary button, and in the text-selection tint.

### Secondary
- **Payout Gold** (secondary): every amount and its unit (receipt total, stub amounts, reward chip, the Paid row, the money line's icon). In the hero it also colors the tagline line "cent by cent.", which is the one wordplay accent per screen brand.md allows (it replaces brand.md's gradient text accent here).
- **Gold Wash** (secondary-container, secondary-fixed): transient only. The paid row flashes secondary-container at 55% and fades; a new payout stub carries secondary-fixed at 50% and fades; the reward chip sits on secondary-fixed at 45%.

### Neutral
- **Canvas** (surface): page ground, header background, and the fade that hides older receipt lines on small screens.
- **Paper** (surface-container-lowest): receipt paper, stubs, line-item field panels, the FAQ card.
- **Band** (surface-container-low): alternate full-bleed section bands (payouts, video) and unselected response options.
- **Skeleton** (surface-container-high): loading placeholders, pulsing.
- **Ink** (on-surface): body text, the journey rail fill and its reached discs.
- **Ink Muted** (on-surface-variant): secondary text, field names, helper copy.
- **Pencil** (outline): micro-labels, timestamps, tx hashes.
- **Rule Line** (outline-variant): dashed rules, dotted leaders, unreached rail and disc rings, empty-state dashed frames.
- **Printer Body** (inverse-surface): the printer slot housing; the slot itself is on-surface.
- **Error** (error, error-container, on-error-container): sign-in errors and failure states only.

### Named Rules
**The Green Means Go Rule.** Green appears only on things you can press or on a state that has been confirmed (Chosen, Passed, signed keys, Confirmed). Progress indicators, rails and numbered discs are ink, not green.

**The Gold Is Money Rule.** Any amount of USDC is Payout Gold in Manrope. Gold washes are one-shot highlights that fade to paper; gold is never a resting surface.

**The Existing Token Rule.** No color outside the `@theme` block. Tints are made by opacity on an existing token.

## Typography

**Display Font:** Manrope (with ui-sans-serif, system-ui)
**Body Font:** Inter (with ui-sans-serif, system-ui)
**Label/Mono Font:** Inter for labels; the system monospace stack for hashes and addresses only
**Icon Font:** Material Symbols Outlined (incumbent, brand.md §6, loaded globally in the root layout), set by ligature name

**Character:** Manrope at 800 with tight negative tracking carries headlines and every number, so amounts read like a printed total. Inter keeps body and field text quiet and legible at small sizes on phones.

### Hierarchy
- **Display** (800, line-height 0.95, -0.04em; tokens `display`, `display-sm`, `display-lg`, `display-xl` are its breakpoint steps, not separate roles): the two-line hero only. Each line rises into its own clip on load. Responsive steps: 3.25rem base, 5rem at sm (640px), 4.5rem at lg (1024px, where the hero splits into two columns), 5.25rem at xl (1280px).
- **Headline** (800, line-height 1.05, -0.03em): section headings. Responsive steps: 1.875rem base, 2.75rem at sm. The closing stub's heading is the narrower step of the same role: 1.875rem base, 2.5rem at sm. (token `headline-stub`).
- **Title** (700, 1.25rem, 1.5rem from sm): journey line titles; receipt prompt text uses 700 at 15px/16px.
- **Amount** (800, 2.25rem on the receipt, 1.875rem on stubs, tracking-tighter, tabular numerals): every total, with its unit beside it at 700 and a smaller size.
- **Body** (400, 1rem to 1.25rem, line-height 1.625): sublines and section intros held to about 30rem / 34 to 46ch; receipt responses and reasons at 13px/14px.
- **Label** (600 or 700, 0.875rem): buttons, nav, receipt row names and values.
- **Micro-label** (700, 11px, 0.2em tracking, uppercase, outline color): field names on the receipt and stubs (Prompt, Reason, Paid) and the footer domain. Never above a section heading.
- **Mono** (400, 11px to 12px): wallet addresses, tx hashes, the footer build SHA.
- **Receipt Body** (Inter 400, line-height 1.625): response and reason text on the printing receipt. Responsive steps: 13px base, 14px at sm. It is the body role scaled to the slip, not a separate voice.
- **Receipt Prompt** (Manrope 700, line-height 1.375): the prompt line on the receipt. Responsive steps: 15px base, 16px at sm. It is the title role scaled to the slip.
- **Icon** (Material Symbols Outlined, weight 400, line-height 1, one em square, ligature names): every icon. Filled (`FILL 1`) for emphasized states (verified, check_circle, signed keys, the coin); outlined otherwise. Icons take their text color and never carry meaning alone. Size scale, by context:
  - 13px: the check inside the Chosen stamp.
  - 14px: the reward chip coin and the receipt's Confirmed mark.
  - 15px: Confirmed on stubs and journey rows.
  - 16px: receipt rows (Passed, keys), caption replay, stub View arrow, link-out marks.
  - 18px: the header Docs pill.
  - 22px: the primary button and the FAQ chevron (token `icon-button`).
  - 26px: journey line titles (token `icon-title`; the base `icon` token is the 16px default).

### Named Rules
**The Numerals Are Manrope Rule.** Amounts, counts in discs, and the signature tally use Manrope or tabular numerals; never Inter for a cUSD / USDC figure.

**The Icon Scale Rule.** Icons are Material Symbols Outlined only, at one of the seven sizes above (13, 14, 15, 16, 18, 22, 26px); pick by context, not by eye.

**The Mono Is For Machines Rule.** Monospace sets only strings a person would copy and verify: addresses, hashes, the build SHA. Never labels, never prose.

## Layout

A single centered column, max-width 72rem (`max-w-6xl`), with 1.25rem side gutters on phones and 2rem from 640px. Sections breathe at 6rem vertical padding (7rem from 640px; the journey uses 8rem). Full-bleed bands in Band tone alternate with Canvas to separate the feed and the video from the rest.

- **Hero:** stacked on phones; from 1024px a two-column grid of fluid copy and a 30rem receipt column (34rem from 1280px), filling the viewport height under the 4.5rem sticky header.
- **Receipt window:** below 1024px the paper shows through a fixed window (18rem phones, 20rem from 640px), newest line at the slot and older lines under a Canvas fade that sits outside the clipped window; from 1024px the window is the paper's full height. On phones the owl perches on the slip's top-right corner; from 640px it stands on the printer to the left of the paper at 10rem.
- **Payout feed:** a horizontal snap-scroll strip of 15.5rem stubs on phones and tablets, a four-column grid from 1024px.
- **Journey:** stacked on phones; from 1024px a 24rem sticky intro beside the numbered list, which runs on a 2.5rem disc column plus content.
- **Close:** a single stub, max 36rem, centered.

Breakpoints are Tailwind's defaults (640, 768, 1024, 1280). Nothing essential is behind hover; tap targets on buttons are 56px.

## Elevation & Depth

Depth is soft and ambient, from brand.md's cool-ink shadow scale (rgba(25,28,30) at 3 to 10%), plus green-tinted shadows on the primary action. The receipt language adds one technical rule: masked paper cannot carry a box-shadow (the mask clips it), so torn paper and stubs take a `drop-shadow` filter on a wrapper, which follows the teeth. The printer is the one dense, dark object, with a hard inset slot to read as a machine.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 8px 24px rgba(25,28,30,0.06)`): standard content cards such as the FAQ (incumbent).
- **Whisper** (`box-shadow: 0 4px 12px rgba(25,28,30,0.04)`): journey field panels.
- **Paper** (`filter: drop-shadow(0 18px 30px rgba(25,28,30,0.10))`): the printing receipt.
- **Stub** (`filter: drop-shadow(0 8px 18px rgba(25,28,30,0.08))`, hover `drop-shadow(0 16px 28px rgba(25,28,30,0.12))` with a 4px lift): payout stubs.
- **Handed Stub** (`filter: drop-shadow(0 24px 40px rgba(25,28,30,0.09))`): the closing stub.
- **Action** (`box-shadow: 0 8px 24px rgba(0,109,61,0.2)`, hover `0 12px 32px rgba(0,109,61,0.3)`): the primary button (incumbent signature shadow).
- **Stamp** (`box-shadow: 0 4px 10px rgba(0,109,61,0.25)`): the Chosen stamp.
- **Video Frame** (`box-shadow: 0 24px 60px rgba(0,109,61,0.14)`): the promo video frame only.
- **Header Hairline** (`box-shadow: 0 1px 0` outline-variant at 55%): appears on the sticky header over the first 96px of scroll, where scroll-driven animation is supported.

### Named Rules
**The Filter Follows The Tear Rule.** Anything cut with a mask takes a drop-shadow filter on its parent, never a box-shadow on itself.

**The No Default Shadow Rule.** Tailwind's `shadow-md` / `shadow-lg` are never used; every shadow is an arbitrary value from the list above.

## Shapes

Two families. The incumbent family is rounded: pills (`full`) for buttons and chips, 0.75rem for response options and the printer, 1rem to 1.5rem for cards, 2rem for the video frame. The video frame's 3rem corner is not a resting radius: it is the start frame of its scroll-in animation, which opens from 3rem (and 0.92 scale) to its resting 2rem as the frame enters view, and only where reduced motion is not requested. The receipt family is cut, not rounded: paper has a straight top and a row of 14px triangular teeth along the bottom; stubs have teeth on both ends; both are made by CSS masks so the paper stays one flat white shape. The masks paint nothing: their `#000` is the alpha channel meaning keep, and `#0000` (transparent) means cut. Neither is a color in the palette, and neither may appear as a painted fill, text or border. Inside paper, structure is drawn with lines, not boxes: dashed rules (outline-variant) between groups and dotted leaders between a field name and its value. Empty and error states in the feed use a dashed 1.5rem-radius frame, the same line as the receipt rules.

## Components

### Buttons
Tactile and confident, the incumbent signature button kept as is.
- **Shape:** full pill (9999px), 56px tall, up to 20rem wide.
- **Primary (Connect Freighter):** the green action gradient from Ledger Green to Signal Green, white label at 1.125rem / 700, a Material icon, Action shadow.
- **Hover / Focus:** lifts 2px and deepens the green shadow; press scales to 0.97; focus shows a 2px primary ring offset 2px from the surface.
- **Pill (Docs, header):** flat primary fill, 0.875rem / 700 label with icon, a lighter green shadow (0 4px 12px at 15%), lifts 1px on hover.
- **Inline link:** primary, 600, underline on hover; used for email sign-in, the payout account and contact.

### Chips
- **Reward chip:** gold text on secondary-fixed at 45%, pill, 0.75rem Manrope 700 with a filled coin icon. Sits in the receipt header.
- **Chosen stamp:** a primary pill with a check, 11px label, Stamp shadow, pops in (0.6 to 1 scale, 320ms).

### Cards / Containers
- **Content card (incumbent):** Paper on 1.5rem radius, Soft shadow, used by the FAQ list with 30%-opacity outline-variant dividers.
- **Line-item field panel:** Paper, 0.5rem radius, Whisper shadow, 0.875rem label text, one receipt row per field.
- **Response option:** Band tone, 0.75rem radius, a 24px letter tile (A/B); chosen gets a 2px primary ring and a 6% primary tint, weighed gets a 2px outline-variant ring.

### Navigation
Sticky 4.5rem header on Canvas: wordmark (Manrope 800, tracking-tighter, primary) with the logo on the left, section links (0.875rem / 600, on-surface-variant) from 768px with a primary underline that grows from the left on hover, the Docs pill on the right. The hairline under it appears only once the page scrolls. Phones show wordmark and Docs only.

### Receipt (signature)
The hero. White paper in the Paper shadow, torn along its bottom edge, feeding upward out of a dark printer slot at the bottom of the figure; the newest line always sits at the slot. Lines print in groups: header with wordmark and reward chip, Prompt, two responses, Reason (typed at 34ms per character with a primary caret), Quality check with a dotted leader to Passed, Signatures with a leader to three keys and a "2 of 3" tally, then the Paid block with the gold amount counting up over 800ms, the recipient address and tx in mono, and Confirmed. Each group settles from a 3px blur (520ms); the paid block flashes gold once. The slip then tears off (lifts 28px and fades) and the next sample prints. The owl changes pose per stage (wave, laptop, think, idea, chart) with a 500ms scale settle. Playback runs only while on screen in a visible tab; a light pointer tilt applies on fine pointers. A caption with a replay icon names it a sample on testnet. Reduced motion shows the finished receipt, still.

### Payout Stub
A payout as a stub torn at both ends: a Paid micro-label with a relative time, the amount in gold Manrope 800, To and Tx rows with dotted leaders to mono values, then a dashed rule over Confirmed (green, filled verified icon) and a View affordance whose arrow nudges up-right on hover. The whole stub is a link to the ledger. A stub the feed has not shown before slides in from the left (700ms) with a gold wash that fades over 1.8s; reduced motion shows it in place with no wash.

### Line Item (journey)
A numbered sequence on an ink rail. Each line: a 40px disc (ink with a Canvas numeral when reached, Paper with a ring when not), a title with a Material icon (gold on the money line, muted otherwise), a short body, and a field panel of receipt rows. As a line crosses mid-screen the rail fills to it (700ms), its text goes from 40% to full opacity, and its panel stamps in left to right in 14 steps. Only the final Status row is green. Without scripts or with reduced motion every line reads as reached.

### Closing Stub
The last stub, torn at both ends: wordmark over a dashed rule, headline, body, a dashed rule, then the wallet sign-in again (without the phone pairing prompt).

## Do's and Don'ts

### Do:
- **Do** use only tokens from the `@theme` block; make tints with opacity on an existing token.
- **Do** set every amount in Payout Gold, Manrope 800, tabular numerals, with the unit beside it.
- **Do** keep green to presses and confirmations; draw progress, rails and step discs in ink.
- **Do** build receipt rows as field name, dotted leader (outline-variant), value; separate groups with dashed rules.
- **Do** cut torn edges with the paper and stub masks (14px teeth) and shadow them with a drop-shadow filter on the parent.
- **Do** ease motion with cubic-bezier(0.16, 1, 0.3, 1) and give every animation a finished still frame under reduced motion.
- **Do** put any fade that hides clipped content outside the clipped element, so no row leaks at fractional edges.
- **Do** name sample data as a sample, and say testnet plainly wherever payouts appear.

### Don't:
- **Don't** use monospace for anything but addresses, hashes and the build SHA.
- **Don't** put a micro-label above a section heading; micro-labels name fields inside paper.
- **Don't** give masked paper a box-shadow; it is clipped by the mask.
- **Don't** use Tailwind's default shadows, pure black, or colors outside the palette.
- **Don't** draw solid outline borders around content cards; the only lines are the receipt's dashed rules and dotted leaders, and hairline dividers.
- **Don't** make gold a resting surface; gold washes flash once and fade.
- **Don't** apply the receipt language to the task screen or admin console by assumption; they have not been redesigned.
