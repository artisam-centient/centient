#!/usr/bin/env python3
"""Build the Centient sticker pack.

Generates, under stickers/:
  NN-name.svg   print SVG (mm units, text as outlines, layers: bleed / artwork / cutline)
  NN-name.png   300 DPI export incl. 3 mm bleed, cutline hidden
  preview.html  every sticker on light + dark backgrounds

Requirements: pip install fonttools brotli uharfbuzz pillow numpy scipy scikit-image playwright
Fonts (Manrope, Inter; SIL OFL) are fetched from npm (@fontsource) into src/.fonts on first run.
Run: python3 stickers/src/build.py
"""
from __future__ import annotations

import base64
import html
import io
import re
import subprocess
import tarfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image
from scipy import ndimage
from skimage import measure

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
REPO = OUT.parent
FONT_DIR = HERE / ".fonts"

# ── Brand tokens (app/globals.css) ────────────────────────────────────────────
GREEN = "#006D3D"  # primary
FRESH = "#35D07F"  # primary-container
GOLD = "#FDCE5E"  # secondary-container
DEEP_GOLD = "#785A00"  # secondary
INK = "#191C1E"  # on-surface
PAPER = "#F8F9FB"  # surface
WHITE = "#FFFFFF"
PALETTE = {GREEN, FRESH, GOLD, DEEP_GOLD, INK, PAPER, WHITE, "#000000"}
CUT_STROKE = "#EC008C"  # non-printing CutContour convention

# ── Print system (mm) ─────────────────────────────────────────────────────────
IN = 25.4
BLEED = 3.0  # bleed beyond the cut line
BORDER = 3.0  # white die-cut border inside the cut line
RADIUS = 6.0  # body corner radius (cut = +3, bleed = +6)
PT = IN / 72
KEYLINE = 0.75 * PT  # ink keyline on every body edge
CUT_W = 0.25  # cutline stroke (0.71 pt)
MIN_TEXT_EM = 8 * PT  # 8 pt minimum type size
TEXT_SAFE = 5.0  # text keeps ≥5 mm inside the cut (spec asks ≥3 mm)
HALO = 1.5  # coloured halo around contour-cut owls
OWL_H = 0.55  # owl height as a fraction of body height (rect stickers)
OWL_TOP = 0.07  # owl top margin as a fraction of body height
DPI = 300


# ── Fonts ─────────────────────────────────────────────────────────────────────
def ensure_fonts() -> None:
    need = ["manrope-latin-800-normal.woff", "manrope-latin-700-normal.woff",
            "inter-latin-700-normal.woff", "inter-latin-600-normal.woff"]
    if all((FONT_DIR / n).exists() for n in need):
        return
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    for pkg in ("@fontsource/manrope", "@fontsource/inter"):
        tgz = subprocess.run(["npm", "pack", pkg, "--silent"], cwd=FONT_DIR, check=True,
                             capture_output=True, text=True).stdout.strip().splitlines()[-1]
        with tarfile.open(FONT_DIR / tgz) as t:
            for m in t.getmembers():
                name = Path(m.name).name
                if name in need:
                    (FONT_DIR / name).write_bytes(t.extractfile(m).read())
        (FONT_DIR / tgz).unlink()


class Font:
    def __init__(self, file: str):
        tt = TTFont(FONT_DIR / file)
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        data = buf.getvalue()
        self.tt = TTFont(io.BytesIO(data))
        self.glyphs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.upem = self.tt["head"].unitsPerEm
        self.cap = self.tt["OS/2"].sCapHeight / self.upem
        self.desc = -self.tt["hhea"].descent / self.upem
        self.hb = hb.Font(hb.Face(data))

    def measure(self, text: str, em: float, track: float = 0.0) -> tuple[list, float]:
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True, "liga": True})
        s = em / self.upem
        x, out = 0.0, []
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((self.order[info.codepoint], x + pos.x_offset * s, pos.y_offset * s))
            x += pos.x_advance * s + track * em
        return out, x - track * em

    def fit(self, text: str, width: float, track: float = 0.0) -> float:
        return width / self.measure(text, 1.0, track)[1]


def num(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".")


# ── Sticker model ─────────────────────────────────────────────────────────────
@dataclass
class Sticker:
    slug: str
    title: str
    concept: str
    w: float  # cut width (mm)
    h: float  # cut height (mm)
    bleed_d: str = ""
    cut_d: str = ""
    art: list[str] = field(default_factory=list)
    text_boxes: list[tuple] = field(default_factory=list)
    body_shape: tuple | None = None  # (x, y, w, h, r) for rect stickers
    images: set[str] = field(default_factory=set)

    @property
    def cw(self) -> float:  # canvas incl. bleed
        return self.w + 2 * BLEED

    @property
    def ch(self) -> float:
        return self.h + 2 * BLEED

    # text as outlines, with a safety check against the cut line
    def text(self, font: Font, s: str, em: float, x: float, y: float, fill: str,
             anchor: str = "middle", track: float = 0.0) -> float:
        assert em >= MIN_TEXT_EM - 1e-6, f"{self.slug}: '{s}' below 8 pt ({em / PT:.1f} pt)"
        glyphs, width = font.measure(s, em, track)
        x0 = x - {"start": 0, "middle": width / 2, "end": width}[anchor]
        s_ = em / font.upem
        parts = []
        for name, gx, gy in glyphs:
            pen = SVGPathPen(font.glyphs, ntos=num)
            font.glyphs[name].draw(TransformPen(pen, (s_, 0, 0, -s_, x0 + gx, y - gy)))
            parts.append(pen.getCommands())
        self.art.append(f'<path fill="{fill}" d="{" ".join(p for p in parts if p)}"/>')
        self.text_boxes.append((s, x0, y - font.cap * em * 1.05, x0 + width, y + font.desc * em * 0.6))
        return width


def rrect(x: float, y: float, w: float, h: float, r: float) -> str:
    r = min(r, w / 2, h / 2)
    return (f"M{num(x + r)},{num(y)}H{num(x + w - r)}A{num(r)},{num(r)} 0 0 1 {num(x + w)},{num(y + r)}"
            f"V{num(y + h - r)}A{num(r)},{num(r)} 0 0 1 {num(x + w - r)},{num(y + h)}"
            f"H{num(x + r)}A{num(r)},{num(r)} 0 0 1 {num(x)},{num(y + h - r)}"
            f"V{num(y + r)}A{num(r)},{num(r)} 0 0 1 {num(x + r)},{num(y)}Z")


def rect_sticker(slug, title, concept, w_in, h_in, body_fill) -> Sticker:
    st = Sticker(slug, title, concept, w_in * IN, h_in * IN)
    b = BLEED
    st.bleed_d = rrect(0, 0, st.cw, st.ch, RADIUS + BORDER + BLEED)
    st.cut_d = rrect(b, b, st.w, st.h, RADIUS + BORDER)
    bx, by, bw, bh = b + BORDER, b + BORDER, st.w - 2 * BORDER, st.h - 2 * BORDER
    st.body_shape = (bx, by, bw, bh, RADIUS)
    st.art.append(f'<path fill="{WHITE}" d="{st.cut_d}"/>')
    st.art.append(f'<path fill="{body_fill}" stroke="{INK}" stroke-width="{num(KEYLINE)}" '
                  f'd="{rrect(bx, by, bw, bh, RADIUS)}"/>')
    return st


# ── Owl artwork ───────────────────────────────────────────────────────────────
@dataclass
class Owl:
    key: str
    rgba: Image.Image  # cropped to visible pixels
    mask: np.ndarray  # bool, same size

    @property
    def aspect(self) -> float:
        return self.rgba.width / self.rgba.height


def load_owl(key: str, path: Path) -> Owl:
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 24)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return Owl(key, im, np.array(im)[..., 3] > 128)


_png_cache: dict[tuple, str] = {}


def owl_data_uri(owl: Owl, h_mm: float) -> str:
    """PNG sized for ≥300 DPI at the printed height (capped at source resolution)."""
    px = min(owl.rgba.height, int(np.ceil(h_mm / IN * DPI * 1.15)))
    k = (owl.key, px)
    if k not in _png_cache:
        im = owl.rgba.resize((round(px * owl.aspect), px), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        _png_cache[k] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return _png_cache[k]


def place_owl(st: Sticker, owl: Owl, x: float, y: float, h: float) -> None:
    st.images.add(owl.key)
    w = h * owl.aspect
    st.art.append(f'<image data-owl="{owl.key}" x="{num(x)}" y="{num(y)}" width="{num(w)}" '
                  f'height="{num(h)}" preserveAspectRatio="none" href="{owl_data_uri(owl, h)}"/>')


def owl_top_center(st: Sticker, owl: Owl) -> float:
    """The one owl placement rule for rect stickers. Returns the owl's bottom y."""
    bx, by, bw, bh, _ = st.body_shape
    h = bh * OWL_H
    place_owl(st, owl, bx + (bw - h * owl.aspect) / 2, by + bh * OWL_TOP, h)
    return by + bh * OWL_TOP + h


def contour_sticker(slug, title, concept, owl: Owl, halo_fill: str, cut_h_in: float = 3.0) -> Sticker:
    """Die-cut following the owl silhouette: owl → halo → 3 mm white → cut → 3 mm bleed."""
    content_h = cut_h_in * IN - 2 * (HALO + BORDER)
    res = 10.0  # working px/mm for contour tracing
    scale = content_h * res / owl.mask.shape[0]
    small = ndimage.zoom(owl.mask.astype(float), scale, order=1) > 0.5
    small = ndimage.binary_fill_holes(small)
    pad = int((HALO + BORDER + BLEED) * res) + 4
    m = np.pad(small, pad)
    dist = ndimage.distance_transform_edt(~m) / res  # mm outside the silhouette

    def outline(level: float) -> np.ndarray:
        region = dist <= level
        bridge = 0.0
        while ndimage.label(region)[1] > 1:  # bridge detached bits (sparkles) into one die-cut piece
            bridge += 1.0
            grown = dist <= level + bridge
            region = ndimage.distance_transform_edt(grown) / res > bridge
        region = ndimage.binary_fill_holes(region)
        smooth = ndimage.gaussian_filter(region.astype(float), sigma=1.5)
        cs = measure.find_contours(smooth, 0.5)
        assert len([k for k in cs if len(k) > 20]) == 1, f"{slug}: contour at {level} mm is not one piece"
        return measure.approximate_polygon(max(cs, key=len), tolerance=0.25)

    levels = {"halo": HALO, "cut": HALO + BORDER, "bleed": HALO + BORDER + BLEED}
    polys = {k: outline(v) for k, v in levels.items()}
    # canvas = bleed contour bbox; mm coords with origin at bleed bbox top-left
    by0, bx0 = polys["bleed"].min(axis=0)
    by1, bx1 = polys["bleed"].max(axis=0)
    cut = polys["cut"]
    st = Sticker(slug, title, concept,
                 (cut[:, 1].max() - cut[:, 1].min()) / res, (cut[:, 0].max() - cut[:, 0].min()) / res)

    def d(poly: np.ndarray) -> str:
        pts = [(num((p[1] - bx0) / res), num((p[0] - by0) / res)) for p in poly]
        return "M" + "L".join(f"{x},{y}" for x, y in pts) + "Z"

    st.bleed_d, st.cut_d = d(polys["bleed"]), d(polys["cut"])
    st._canvas = ((bx1 - bx0) / res, (by1 - by0) / res)
    st.art.append(f'<path fill="{WHITE}" d="{st.cut_d}"/>')
    st.art.append(f'<path fill="{halo_fill}" stroke="{INK}" stroke-width="{num(KEYLINE)}" '
                  f'stroke-linejoin="round" d="{d(polys["halo"])}"/>')
    ox, oy = (pad - bx0) / res, (pad - by0) / res
    place_owl(st, owl, ox, oy, small.shape[0] / res)
    return st


# ── SVG output ────────────────────────────────────────────────────────────────
def canvas(st: Sticker) -> tuple[float, float]:
    return getattr(st, "_canvas", (st.cw, st.ch))


def render_svg(st: Sticker, *, mode: str = "file") -> str:
    """mode: file (print SVG), png (no cutline), preview (inline in HTML: no bleed, owls via <use>)."""
    cw, ch = canvas(st)
    art = "\n    ".join(st.art)
    if mode == "preview":
        art = re.sub(r'<image data-owl="([^"]+)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"[^>]*/>',
                     r'<use href="#owl-\1" x="\2" y="\3" width="\4" height="\5"/>', art)
    layers = []
    if mode != "preview":
        layers.append(f'<g id="bleed" inkscape:groupmode="layer" inkscape:label="bleed">\n'
                      f'    <path fill="{WHITE}" d="{st.bleed_d}"/>\n  </g>')
    layers.append(f'<g id="artwork" inkscape:groupmode="layer" inkscape:label="artwork">\n    {art}\n  </g>')
    if mode != "png":
        layers.append(f'<g id="cutline" class="cutline" inkscape:groupmode="layer" inkscape:label="cutline">\n'
                      f'    <path fill="none" stroke="{CUT_STROKE}" stroke-width="{num(CUT_W)}" '
                      f'stroke-linejoin="round" d="{st.cut_d}"/>\n  </g>')
    size = "" if mode == "preview" else f' width="{num(cw)}mm" height="{num(ch)}mm"'
    ns = ('xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
          'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"')
    if mode == "preview":
        ns = 'xmlns="http://www.w3.org/2000/svg"'
        return (f'<svg {ns} viewBox="0 0 {num(cw)} {num(ch)}" role="img" aria-label="{html.escape(st.title)}">\n  '
                + "\n  ".join(layers) + "\n</svg>")
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<!-- Centient sticker "{st.title}". Cut {num(st.w)} x {num(st.h)} mm; canvas includes {num(BLEED)} mm bleed.\n'
            f'     Layers: bleed (white, extends past cut) / artwork / cutline (non-printing, map to CutContour). -->\n'
            f'<svg {ns}{size} viewBox="0 0 {num(cw)} {num(ch)}">\n  <title>Centient: {html.escape(st.title)}</title>\n  '
            + "\n  ".join(layers) + "\n</svg>\n")


def validate(st: Sticker) -> None:
    svg = render_svg(st, mode="png")
    for c in re.findall(r'(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', svg):
        assert c.upper() in PALETTE, f"{st.slug}: off-palette colour {c}"
    for w in re.findall(r'stroke-width="([\d.]+)"', svg):
        assert float(w) >= 0.5 * PT - 1e-6, f"{st.slug}: stroke {w} mm thinner than 0.5 pt"
    if st.body_shape:  # text inside the cut line by ≥ TEXT_SAFE
        x0, y0 = BLEED + TEXT_SAFE, BLEED + TEXT_SAFE
        x1, y1 = BLEED + st.w - TEXT_SAFE, BLEED + st.h - TEXT_SAFE
        for s, a, b, c, d in st.text_boxes:
            assert a >= x0 and b >= y0 and c <= x1 and d <= y1, \
                f"{st.slug}: '{s}' breaks the {TEXT_SAFE} mm text safe zone ({a:.1f},{b:.1f},{c:.1f},{d:.1f})"


# ── The pack ──────────────────────────────────────────────────────────────────
def build() -> list[Sticker]:
    ensure_fonts()
    manrope = Font("manrope-latin-800-normal.woff")
    manrope7 = Font("manrope-latin-700-normal.woff")
    inter7 = Font("inter-latin-700-normal.woff")
    inter6 = Font("inter-latin-600-normal.woff")
    wave = load_owl("wave", REPO / "logo.png")
    idea = load_owl("idea", REPO / "public/mascot/owl-idea.webp")
    WM = -0.05  # wordmark tracking (brand.md: tracking-tighter)
    LBL = 0.2  # micro-label tracking (brand.md: tracking-[0.2em])
    out: list[Sticker] = []

    # 01 Logo: owl die-cut on a brand-green halo
    out.append(contour_sticker("01-logo", "Logo", "The Centient owl alone, contour die-cut with a brand-green halo.",
                               wave, GREEN))

    # 02 Name: wordmark only
    st = rect_sticker("02-name", "Wordmark", "“Centient” wordmark in Manrope ExtraBold, white on brand green.",
                      3, 1.25, GREEN)
    bx, by, bw, bh, _ = st.body_shape
    em = manrope.fit("Centient", bw - 14, WM)
    st.text(manrope, "Centient", em, bx + bw / 2, by + bh / 2 + manrope.cap * em / 2, WHITE, track=WM)
    out.append(st)

    # 03 Logo + name: stacked lockup
    st = rect_sticker("03-lockup", "Lockup", "Stacked lockup: owl over the wordmark on paper white.", 3, 3, PAPER)
    bx, by, bw, bh, _ = st.body_shape
    owl_bottom = owl_top_center(st, wave)
    em = manrope.fit("Centient", bw * 0.72, WM)
    mid = (owl_bottom + by + bh - 4) / 2
    st.text(manrope, "Centient", em, bx + bw / 2, mid + manrope.cap * em / 2, GREEN, track=WM)
    out.append(st)

    # 04 Tagline
    st = rect_sticker("04-tagline", "Tagline", "“Train AI, cent by cent.”: the brand line, on payout gold.",
                      3, 3, GOLD)
    bx, by, bw, bh, _ = st.body_shape
    lbl = 3.2
    st.text(inter7, "CENTIENT", lbl, bx + bw / 2, by + 10, DEEP_GOLD, track=LBL)
    em = manrope.fit("cent by cent.", bw - 14, -0.03)
    cy = by + bh / 2 + 1
    st.text(manrope, "Train AI,", em, bx + bw / 2, cy - 1.5, INK, track=-0.03)
    st.text(manrope, "cent by cent.", em, bx + bw / 2, cy + em * 1.05, GREEN, track=-0.03)
    st.art.append(f'<rect x="{num(bx + bw / 2 - 8)}" y="{num(cy + em * 1.05 + manrope.desc * em + 2.5)}" width="16" height="1.2" '
                  f'rx="0.6" fill="{GREEN}"/>')
    st.text(inter7, "CENTIENT.WORK", lbl, bx + bw / 2, by + bh - 7, DEEP_GOLD, track=LBL * 0.6)
    out.append(st)

    # 05 Centient on Stellar
    st = rect_sticker("05-on-stellar", "Centient on Stellar",
                      "Owl + “Centient on Stellar”: Stellar set as text in the brand font; no SDF marks.",
                      3, 3, GREEN)
    bx, by, bw, bh, _ = st.body_shape
    owl_bottom = owl_top_center(st, wave)
    em1 = manrope.fit("Centient", bw * 0.56, WM)
    em2 = em1 * 0.62
    gap = 2.2
    block = manrope.cap * em1 + gap + manrope7.cap * em2
    top = (owl_bottom + by + bh - 4) / 2 - block / 2
    st.text(manrope, "Centient", em1, bx + bw / 2, top + manrope.cap * em1, WHITE, track=WM)
    st.text(manrope7, "on Stellar", em2, bx + bw / 2, top + block, GOLD, track=-0.01)
    out.append(st)

    # 06 Website: legible from ~1 m
    st = rect_sticker("06-website", "Website", "centient.work, set big enough to read from about 1 m.", 4, 1.5, PAPER)
    bx, by, bw, bh, _ = st.body_shape
    em = manrope.fit("centient.work", bw - 16, -0.02)
    w1 = manrope.measure("centient", em, -0.02)[1] + (-0.02 * em)
    w = manrope.measure("centient.work", em, -0.02)[1]
    x0 = bx + (bw - w) / 2
    base = by + bh / 2 + manrope.cap * em / 2
    st.text(manrope, "centient", em, x0, base, GREEN, anchor="start", track=-0.02)
    st.text(manrope, ".work", em, x0 + w1, base, INK, anchor="start", track=-0.02)
    out.append(st)

    # 07 Meme: op_no_trust
    st = rect_sticker("07-meme", "op_no_trust",
                      "Horizon's op_no_trust error applied to unreviewed AI output: add a human trustline.",
                      3, 3, INK)
    bx, by, bw, bh, _ = st.body_shape
    pad = 5.5
    lx = bx + pad
    st.text(inter7, "UNREVIEWED AI OUTPUT", 3.0, lx, by + pad + 3, FRESH, anchor="start", track=0.12)
    box_y, lh, code_em = by + pad + 7, 4.9, 3.3
    code = [(0, '"result_codes": {', WHITE), (1, '"operations": [', WHITE), (2, '"op_no_trust"', GOLD),
            (1, "]", WHITE), (0, "}", WHITE)]
    inset = 3.6  # equal padding above the first cap line and below the last baseline
    box_h = 2 * inset + inter6.cap * code_em + (len(code) - 1) * lh + 0.6
    st.art.append(f'<path fill="none" stroke="{FRESH}" stroke-width="{num(0.5)}" '
                  f'd="{rrect(lx, box_y, bw - 2 * pad, box_h, 3)}"/>')
    for i, (ind, s, col) in enumerate(code):
        f = inter7 if col == GOLD else inter6
        st.text(f, s, code_em, lx + 3.5 + ind * 4.2, box_y + inset + inter6.cap * code_em + lh * i, col, anchor="start")
    em = manrope.fit("Add a human", bw - 2 * pad, -0.02)
    em = min(em, 7.2)
    y = box_y + box_h + 3 + manrope.cap * em
    st.text(manrope, "Add a human", em, lx, y, WHITE, anchor="start", track=-0.02)
    st.text(manrope, "trustline.", em, lx, y + em * 1.12, FRESH, anchor="start", track=-0.02)
    out.append(st)

    # 08 Bonus: mascot (owl-idea) on a gold halo
    out.append(contour_sticker("08-mascot", "Mascot: bright idea",
                               "Bonus: winking owl-with-lightbulb pose, contour die-cut on a payout-gold halo.",
                               idea, GOLD))

    for s in out:
        validate(s)
    return out


# ── Outputs ───────────────────────────────────────────────────────────────────
def write_pngs(stickers: list[Sticker]) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        page = browser.new_page()
        for st in stickers:
            cw, ch = canvas(st)
            wpx, hpx = round(cw / IN * DPI), round(ch / IN * DPI)
            svg = render_svg(st, mode="png").split("?>", 1)[1]
            svg = re.sub(r'width="[^"]+mm" height="[^"]+mm"', f'width="{wpx}" height="{hpx}"', svg, count=1)
            page.set_viewport_size({"width": wpx, "height": hpx})
            page.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            page.wait_for_timeout(150)
            path = OUT / f"{st.slug}.png"
            page.screenshot(path=str(path), omit_background=True, clip={"x": 0, "y": 0, "width": wpx, "height": hpx})
            im = Image.open(path)
            im.save(path, dpi=(DPI, DPI), optimize=True)
        browser.close()


def size_label(st: Sticker) -> str:
    return f'{st.w / IN:.2f} × {st.h / IN:.2f} in ({st.w:.0f} × {st.h:.0f} mm)'


def write_preview(stickers: list[Sticker], owls: dict[str, Owl]) -> None:
    defs = "".join(
        f'<symbol id="owl-{k}" viewBox="0 0 {o.rgba.width} {o.rgba.height}" preserveAspectRatio="none">'
        f'<image width="{o.rgba.width}" height="{o.rgba.height}" href="{owl_data_uri(o, 40)}"/></symbol>'
        for k, o in owls.items())
    MM_PX = 3.2  # on-screen scale

    def cards() -> str:
        items = []
        for st in stickers:
            cw, ch = canvas(st)
            items.append(
                f'<figure class="card"><div class="art" style="width:{cw * MM_PX:.0f}px">'
                f'{render_svg(st, mode="preview")}</div>'
                f'<figcaption><b>{st.slug}</b> {html.escape(st.title)}<span>{size_label(st)}</span></figcaption></figure>')
        return "\n".join(items)

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Centient Sticker Pack</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{{--paper:{PAPER};--ink:{INK};--green:{GREEN};--muted:#3d4a3f;--card-cap:#3d4a3f}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}}
header{{padding:32px 16px 8px;max-width:1280px;margin:0 auto}}
h1{{font:800 32px/1.1 Manrope,sans-serif;letter-spacing:-.03em;color:var(--green);margin:0 0 6px}}
header p{{margin:0;color:var(--muted);max-width:70ch}}
.controls{{margin:14px 0 0;display:flex;gap:18px;flex-wrap:wrap;font-weight:600;font-size:14px}}
section{{padding:28px 16px 36px}}
section h2{{font:700 11px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin:0 auto 20px;max-width:1280px}}
.sheet{{max-width:1280px;margin:0 auto;display:flex;flex-wrap:wrap;gap:28px 32px;align-items:flex-end}}
.light{{background:var(--paper)}} .light h2{{color:#6c7b6e}}
.dark{{background:var(--ink)}} .dark h2{{color:#bbcabc}} .dark figcaption{{color:#e1e2e4}} .dark figcaption span{{color:#bbcabc}}
.card{{margin:0;display:flex;flex-direction:column;gap:10px;max-width:100%}}
.art{{max-width:100%;filter:drop-shadow(0 6px 14px rgba(25,28,30,.18))}}
.art svg{{display:block;width:100%;height:auto;overflow:visible}}
figcaption{{font-size:13px;color:var(--card-cap)}} figcaption b{{font-family:Manrope,sans-serif;margin-right:4px}}
figcaption span{{display:block;color:#6c7b6e;font-size:12px}}
body:not(.show-cut) .cutline{{display:none}}
.cutline path{{stroke-dasharray:1.2 .8}}
</style></head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{defs}</defs></svg>
<header>
  <h1>Centient sticker pack</h1>
  <p>{len(stickers)} die-cut stickers, rendered from the print SVGs at roughly true relative size. Each shape is shown to its cut line; the 3&nbsp;mm bleed is hidden here. Palette: brand green, fresh green, gold, deep gold, ink and white. Type: Manrope ExtraBold and Inter.</p>
  <div class="controls"><label><input type="checkbox" id="cut"> Show cut lines</label></div>
</header>
<section class="light"><h2>On light</h2><div class="sheet">{cards()}</div></section>
<section class="dark"><h2>On dark</h2><div class="sheet">{cards()}</div></section>
<script>
const cb=document.getElementById('cut');
try{{cb.checked=localStorage.getItem('showCut')==='1'}}catch(e){{}}
const apply=()=>{{document.body.classList.toggle('show-cut',cb.checked);try{{localStorage.setItem('showCut',cb.checked?'1':'0')}}catch(e){{}}}};
cb.addEventListener('change',apply);apply();
</script>
</body></html>
"""
    (OUT / "preview.html").write_text(page)


def main() -> None:
    stickers = build()
    for st in stickers:
        (OUT / f"{st.slug}.svg").write_text(render_svg(st))
        print(f"{st.slug:16} {size_label(st)}")
    owls = {"wave": load_owl("wave", REPO / "logo.png"), "idea": load_owl("idea", REPO / "public/mascot/owl-idea.webp")}
    write_preview(stickers, owls)
    write_pngs(stickers)


if __name__ == "__main__":
    main()
