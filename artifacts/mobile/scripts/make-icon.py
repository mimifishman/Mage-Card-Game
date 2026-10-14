"""Draw the Mage Card Game app icon, splash emblem and Android adaptive foreground.

Brand: gold filigree #C89B3C (dim #8B6914) on obsidian #080810 with an indigo glow,
and the Ionicons "flash" bolt the sign-in screen uses.
Usage: python3 make_icon.py <Ionicons.ttf> <Ionicons.json> <out_dir>
"""
import json
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

TTF, MAP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
S = 2048  # draw at 2x, downscale for smooth edges

GOLD_HI = (246, 214, 128)
GOLD = (200, 155, 60)
GOLD_LO = (139, 105, 20)
OBSIDIAN = (8, 8, 16)
INDIGO = (40, 30, 86)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gold_gradient(size):
    """Vertical bright-to-deep gold, like gilded metal."""
    g = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(g)
    for y in range(size):
        t = y / (size - 1)
        c = lerp(GOLD_HI, GOLD, t / 0.55) if t < 0.55 else lerp(GOLD, GOLD_LO, (t - 0.55) / 0.45)
        d.line([(0, y), (size, y)], fill=c)
    return g


def background(size):
    """Obsidian with a soft indigo glow in the middle."""
    bg = Image.new("RGB", (size, size), OBSIDIAN)
    px = bg.load()
    cx = cy = size / 2
    rmax = size * 0.72
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - cx, y - cy) / rmax
            t = max(0.0, 1.0 - r) ** 1.6
            px[x, y] = lerp(OBSIDIAN, INDIGO, t)
    return bg


def emblem_mask(size, ring=True, bolt_scale=1.0):
    """White-on-black mask of the gold ring + bolt, centred."""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2
    if ring:
        r_out, w = size * 0.36, size * 0.032
        d.ellipse([c - r_out, c - r_out, c + r_out, c + r_out], outline=255, width=int(w))
        r2 = size * 0.315  # thin inner filigree ring
        d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=255, width=int(size * 0.008))
    glyph = chr(json.load(open(MAP))["flash"])
    font = ImageFont.truetype(TTF, int(size * 0.46 * bolt_scale))
    bbox = d.textbbox((0, 0), glyph, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((c - w / 2 - bbox[0], c - h / 2 - bbox[1]), glyph, font=font, fill=255)
    return m


def gilded(size, mask, glow=True):
    """Gold-filled emblem on a transparent layer, with a warm outer glow."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if glow:
        halo = mask.filter(ImageFilter.GaussianBlur(size * 0.03))
        glow_img = Image.new("RGBA", (size, size), GOLD + (0,))
        glow_img.putalpha(halo.point(lambda v: int(v * 0.55)))
        layer = Image.alpha_composite(layer, glow_img)
    fill = gold_gradient(size).convert("RGBA")
    fill.putalpha(mask)
    return Image.alpha_composite(layer, fill)


# 1) App icon: 1024x1024, opaque (Apple rejects icons with transparency).
bg = background(S).convert("RGBA")
icon = Image.alpha_composite(bg, gilded(S, emblem_mask(S)))
icon.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/icon.png", optimize=True)

# 2) Splash emblem: transparent, shown centred on the obsidian splash background.
splash = gilded(S, emblem_mask(S))
splash.resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/splash-icon.png", optimize=True)

# 3) Android adaptive foreground: emblem kept inside the 66% safe zone.
small = gilded(S, emblem_mask(S)).resize((int(S * 0.62), int(S * 0.62)), Image.LANCZOS)
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
fg.paste(small, ((S - small.width) // 2, (S - small.height) // 2), small)
fg.resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/adaptive-icon.png", optimize=True)
print("ok")
