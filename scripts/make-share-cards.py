"""Builds the per-page share pictures (dist/share/<page>.jpg, 1200x630) shown when a page link is posted on Discord,
X, iMessage and so on. Same look as share-card-bebop.jpg. Run: python3 scripts/make-share-cards.py
Needs Pillow and the Anton + Special Elite fonts (set FONT_DIR if they aren't in ~/.fonts)."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), '..', 'dist')
FONTS = os.environ.get('FONT_DIR', os.path.expanduser('~/.fonts'))
INK, INK2, PAPER, DIM, MUSTARD, RED, TEAL = '#14110f', '#1d1916', '#efe6d2', '#cfc4ad', '#e3a92f', '#c0402f', '#3f8f8c'

# slug: (kicker, title, subtitle, url path, picture)
PAGES = {
    'crew': ('The people I roll with', 'THE CREW', 'Streamer friends worth a follow', '/crew/', 'avatar.png'),
    'event': ('Big nights on the channel', 'SPECIAL EVENTS', 'Subathons, charity streams and more', '/event/', 'avatar.png'),
    'garage': ('Cars are part of the lore', 'THE GARAGE', 'The Sojourn ST build, mods and photos', '/garage/', 'assets/cars/car-01.jpg'),
    'guide': ('First time here?', 'VIEWER GUIDE', 'Everything a new crew member should know', '/guide/', 'avatar.png'),
    'install': ('Take it with you', 'INSTALL THE APP', 'The site on your home screen', '/install/', 'avatar.png'),
    'log': ('Sign the ship', 'SHIP’S LOG', 'Leave a message for Dismeigh', '/log/', 'avatar.png'),
    'lore': ('Case files', 'CHANNEL LORE', 'The running jokes, explained', '/lore/', 'avatar.png'),
    'rewind': ('Year in review', 'DISMEIGH REWIND', 'A year of streams, by the numbers', '/rewind/', 'avatar.png'),
    'shelf': ('On repeat', 'DISMEIGH’S SHELF', 'Favorite anime, games and music', '/shelf/', 'avatar.png'),
    'voice': ('Voice actor', 'VOICE WORK', 'Roles, commissions and how to book', '/voice/', 'avatar.png'),
    'work': ('Websites and Discord servers', 'WORK', 'Built to order by Dismeigh', '/work/', 'avatar.png'),
    'wallpapers': ('Free downloads', 'WALLPAPERS', 'Bebop-style art for your screens', '/wallpapers/', 'avatar.png'),
}

def font(name, size): return ImageFont.truetype(os.path.join(FONTS, name), size)

def fit(draw, text, name, size, max_w):
    while size > 20:
        f = font(name, size)
        if draw.textlength(text, font=f) <= max_w: return f
        size -= 2
    return font(name, size)

def card(slug, kicker, title, sub, path, pic):
    im = Image.new('RGB', (1200, 630), INK)
    d = ImageDraw.Draw(im)
    # slabs and the banner
    d.polygon([(28, 34), (848, 12), (848, 40), (46, 64), (46, 262), (28, 262)], fill=MUSTARD)
    d.rectangle([1150, 186, 1182, 300], fill=RED)
    d.rectangle([44, 40, 1162, 324], fill='#0b0908')
    banner = Image.open(os.path.join(ROOT, 'banner.png')).convert('RGB')
    banner = ImageOps.fit(banner, (1100, 266), Image.LANCZOS, centering=(0.5, 0.5))
    im.paste(banner, (53, 49))
    # round picture with a mustard ring
    size = 228
    art = ImageOps.fit(Image.open(os.path.join(ROOT, pic)).convert('RGB'), (size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0); ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    d.ellipse([60, 352, 60 + size + 12, 352 + size + 12], fill=MUSTARD)
    im.paste(art, (66, 358), mask)
    # words
    x, w = 322, 820
    d.text((x, 348), kicker, font=fit(d, kicker, 'SpecialElite-Regular.ttf', 26, w), fill=MUSTARD)
    tf = fit(d, title, 'Anton-Regular.ttf', 100, w)
    d.text((x, 482), title, font=tf, fill=PAPER, anchor='ls')
    d.text((x, 500), sub, font=fit(d, sub, 'SpecialElite-Regular.ttf', 25, w), fill=DIM)
    # address tag
    url = f'DENIZEN-DISMEIGH.COM{path.rstrip("/").upper()}'
    uf = fit(d, url, 'Anton-Regular.ttf', 30, 560)
    tw = d.textlength(url, font=uf)
    box = Image.new('RGBA', (int(tw) + 40, 60), MUSTARD)
    ImageDraw.Draw(box).text((20, 8), url, font=uf, fill=INK)
    box = box.rotate(2, expand=True, resample=Image.BICUBIC)
    im.paste(box, (1160 - box.width, 540), box)
    d.rectangle([0, 618, 1200, 630], fill=TEAL)
    out = os.path.join(ROOT, 'share', f'{slug}.jpg')
    im.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    return out

if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'share'), exist_ok=True)
    for slug, args in PAGES.items(): print(card(slug, *args))
