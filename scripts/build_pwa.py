#!/usr/bin/env python3
"""── wave-x7b ── Bedrock app icons (twin of Dopps Class tools/build_pwa.py, icon half).

Makes public/app/*.png from the Bedrock art in public/art/ with Pillow:
  icon-32/180/192/512.png   rounded tile (favicon, Apple touch icon, install icons)
  icon-maskable-512.png     full-bleed tile with the art inside the 80% safe zone (Android adaptive icons)
  shortcut-*.png            96 px icons for the app's long-press shortcuts
Run it again after the art changes:  python3 scripts/build_pwa.py
(The service worker's cache version is stamped at build time by scripts/pwa-stamp.mjs, not here.)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART, OUT = ROOT / "public" / "art", ROOT / "public" / "app"
BG = (9, 13, 11)  # site --bg (#090d0b)


def tile(size: int, art: str, rounded: bool, art_frac: float) -> Image.Image:
    s = size * 4  # draw big, scale down for smooth edges
    base = Image.new("RGBA", (s, s), BG + (255,))
    # warm glow behind the art: emerald -> gold, like the nav logo
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((s * 0.12, s * 0.16, s * 0.88, s * 0.92), fill=(246, 196, 83, 120))
    d.ellipse((s * 0.02, s * 0.30, s * 0.55, s * 0.95), fill=(52, 211, 153, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.11))
    base.alpha_composite(glow)
    # thin gold rim
    if rounded:
        ImageDraw.Draw(base).rounded_rectangle((s * 0.012, s * 0.012, s * 0.988, s * 0.988), radius=s * 0.22, outline=(246, 196, 83, 150), width=max(2, s // 90))
    im = Image.open(ART / f"{art}.png").convert("RGBA")
    im = im.crop(im.getbbox())
    a = int(s * art_frac)
    k = a / max(im.size)  # fit (up or down) into the art box
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    base.alpha_composite(im, ((s - im.width) // 2, (s - im.height) // 2 + int(s * 0.01)))
    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.22, fill=255)
        base.putalpha(mask)
    return base.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (32, 180, 192, 512):
        # Apple touch icons get square corners (iOS rounds them itself)
        tile(size, "realm-1", rounded=size != 180, art_frac=0.86 if size == 32 else 0.8).save(OUT / f"icon-{size}.png", optimize=True)
    tile(512, "realm-1", rounded=False, art_frac=0.62).save(OUT / "icon-maskable-512.png", optimize=True)
    for name, art in (("arcade", "game-sprite-flap"), ("chapters", "hero-earth"), ("quest", "realm-8"), ("welcome", "realm-1")):
        tile(96, art, rounded=True, art_frac=0.82).save(OUT / f"shortcut-{name}.png", optimize=True)
    for f in sorted(OUT.glob("*.png")):
        print(f"{f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
