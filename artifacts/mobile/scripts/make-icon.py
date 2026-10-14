"""Draw the Mage Card Game app icon, splash emblem and Android adaptive foreground.

A gilded wizard hat with sparkles inside an arcane rune ring, and the word MAGE in the
game's title font (Cinzel Decorative). Brand gold #C89B3C on obsidian #080810 with an
indigo glow.

Usage: python3 make-icon.py <vector-icons dir> <CinzelDecorative_700Bold.ttf> <out_dir>
  <vector-icons dir> = .../@expo/vector-icons/build/vendor/react-native-vector-icons
"""
import json
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

VI, TITLE_TTF, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
MDI_TTF = f"{VI}/Fonts/MaterialCommunityIcons.ttf"
MDI = json.load(open(f"{VI}/glyphmaps/MaterialCommunityIcons.json"))
S = 2048  # draw at 2x, downscale for smooth edges

GOLD_HI = (250, 222, 140)
GOLD = (200, 155, 60)
GOLD_LO = (130, 96, 18)
OBSIDIAN = (8, 8, 16)
INDIGO = (52, 36, 110)
VIOLET = (155, 89, 182)


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gold_gradient(size):
    g = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(g)
    for y in range(size):
        t = y / (size - 1)
        c = lerp(GOLD_HI, GOLD, t / 0.5) if t < 0.5 else lerp(GOLD, GOLD_LO, (t - 0.5) / 0.5)
        d.line([(0, y), (size, y)], fill=c)
    return g


def background(size):
    """Obsidian with an indigo glow behind the hat and a faint violet haze."""
    bg = Image.new("RGB", (size, size), OBSIDIAN)
    px = bg.load()
    cx, cy = size / 2, size * 0.44
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - cx, y - cy) / (size * 0.62)
            t = max(0.0, 1.0 - r) ** 1.5
            px[x, y] = lerp(OBSIDIAN, INDIGO, t)
    return bg


def glyph(d, name, cx, cy, size, font_cache={}):
    f = font_cache.setdefault(size, ImageFont.truetype(MDI_TTF, size))
    ch = chr(MDI[name])
    b = d.textbbox((0, 0), ch, font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), ch, font=f, fill=255)


def emblem_mask(size, with_text=True):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2

    # Arcane ring: thick outer band, thin inner line, rune stars between them.
    r_out = size * 0.445
    d.ellipse([c - r_out, c - r_out, c + r_out, c + r_out], outline=255, width=int(size * 0.022))
    r_in = size * 0.392
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], outline=255, width=int(size * 0.007))
    r_rune = (r_out + r_in) / 2 - size * 0.004
    for i in range(16):
        a = math.radians(i * 360 / 16 - 90)
        if with_text and 50 < (i * 360 / 16) % 360 < 310 and 112 < (i * 360 / 16) < 248:
            continue  # leave the bottom of the ring clear behind the word
        big = i % 4 == 0
        glyph(d, "star-four-points", c + r_rune * math.cos(a), c + r_rune * math.sin(a),
              int(size * (0.042 if big else 0.024)))

    # Wizard hat, with sparkles and a crescent moon around it.
    hat_cy = size * (0.43 if with_text else 0.49)
    glyph(d, "wizard-hat", c, hat_cy, int(size * 0.50))
    glyph(d, "star-four-points", c + size * 0.205, hat_cy - size * 0.17, int(size * 0.085))
    glyph(d, "star-four-points", c + size * 0.275, hat_cy - size * 0.05, int(size * 0.04))
    glyph(d, "star-four-points", c - size * 0.265, hat_cy - size * 0.03, int(size * 0.05))
    glyph(d, "moon-waning-crescent", c - size * 0.205, hat_cy - size * 0.165, int(size * 0.075))

    if with_text:
        font = ImageFont.truetype(TITLE_TTF, int(size * 0.135))
        word = "MAGE"
        b = d.textbbox((0, 0), word, font=font)
        w = b[2] - b[0]
        ty = size * 0.735
        d.text((c - w / 2 - b[0], ty - (b[3] - b[1]) / 2 - b[1]), word, font=font, fill=255)
    return m


def gilded(size, mask, glow=0.55):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    halo = mask.filter(ImageFilter.GaussianBlur(size * 0.025))
    glow_img = Image.new("RGBA", (size, size), GOLD + (0,))
    glow_img.putalpha(halo.point(lambda v: int(v * glow)))
    layer = Image.alpha_composite(layer, glow_img)
    fill = gold_gradient(size).convert("RGBA")
    fill.putalpha(mask)
    return Image.alpha_composite(layer, fill)


def word_plate(size):
    """Soft dark band behind MAGE so the ring line does not cut through the letters."""
    p = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(p)
    d.rounded_rectangle([size * 0.20, size * 0.665, size * 0.80, size * 0.805], radius=size * 0.05, fill=150)
    p = p.filter(ImageFilter.GaussianBlur(size * 0.012))
    plate = Image.new("RGBA", (size, size), OBSIDIAN + (0,))
    plate.putalpha(p)
    return plate


# 1) App icon: 1024x1024, opaque (Apple rejects icons with transparency).
icon = background(S).convert("RGBA")
icon = Image.alpha_composite(icon, word_plate(S))
icon = Image.alpha_composite(icon, gilded(S, emblem_mask(S)))
icon.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/icon.png", optimize=True)

# 2) Splash emblem (transparent; the splash background is #080810).
splash = Image.alpha_composite(word_plate(S), gilded(S, emblem_mask(S)))
splash.resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/splash-icon.png", optimize=True)

# 3) Android adaptive foreground: no word (too small after masking), kept in the safe zone.
em = gilded(S, emblem_mask(S, with_text=False)).resize((int(S * 0.64), int(S * 0.64)), Image.LANCZOS)
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
fg.paste(em, ((S - em.width) // 2, (S - em.height) // 2), em)
fg.resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/adaptive-icon.png", optimize=True)
print("ok")
