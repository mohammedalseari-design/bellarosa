# Original line illustrations (generic garments) for the Bella Rosa sample catalog — one per product.
import math, random
PLUM = "#5B2A3C"

def svg(inner, uid, size=760, width=2.3, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" width="{size}" fill="none" stroke="{PLUM}" '
            f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"><defs>{defs}</defs>{inner}</svg>')

def scallops(x0, x1, ybase, n, depth=6, sag=6):
    half = (x1 - x0) / 2; mid = (x0 + x1) / 2
    y = lambda x: ybase + sag * (1 - ((x - mid) / half) ** 2)
    s = ""
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n; xb = x0 + (x1 - x0) * (i + 1) / n
        s += f" C{xa + (xb - xa) * .12:.1f} {y(xa) + depth:.1f} {xb - (xb - xa) * .12:.1f} {y(xb) + depth:.1f} {xb:.1f} {y(xb):.1f}"
    return s

def flower(cx, cy, r, fill, center, rot=0, sw=1.1):
    out = []
    for i in range(5):
        a = math.radians(rot - 90 + i * 72)
        px, py = cx + r * .55 * math.cos(a), cy + r * .55 * math.sin(a)
        out.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{r * .48:.2f}" fill="{fill}" stroke-width="{sw}"/>')
    out.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r * .26:.2f}" fill="{center}" stroke-width="{sw * .8}"/>')
    return "".join(out)

def star(cx, cy, s, fill):
    return (f'<path d="M{cx} {cy - s} Q{cx} {cy} {cx + s} {cy} Q{cx} {cy} {cx} {cy + s} Q{cx} {cy} {cx - s} {cy} Q{cx} {cy} {cx} {cy - s} Z" '
            f'fill="{fill}" stroke="none"/>')

def button(cx, cy, r=3, fill="#B98E68"):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke-width="1.3"/>'
            f'<circle cx="{cx - r * .3:.2f}" cy="{cy}" r="{r * .16:.2f}" fill="{PLUM}" stroke="none"/>'
            f'<circle cx="{cx + r * .3:.2f}" cy="{cy}" r="{r * .16:.2f}" fill="{PLUM}" stroke="none"/>')

# 1) فستان تول بفيونكة ساتان — وردي
def tulle_dress(size=760):
    pink, deep, under = "#F4CFD8", "#E7AFBE", "#FAE7EC"
    dots = "".join(f'<circle cx="{x}" cy="{y}" r=".9" fill="{PLUM}" stroke="none" opacity=".28"/>' for x, y in
                   [(78,140),(96,150),(118,138),(70,170),(88,176),(110,168),(128,180),(62,200),(82,204),(104,196),(124,206),(142,198),(92,128),(112,122),(76,188),(134,160)])
    inner = f'''
    <path d="M80 110 C64 142 46 186 30 230{scallops(30,170,230,8,5,6)} C154 186 136 142 120 110 Z" fill="{under}"/>
    <path d="M80 110 C66 140 50 180 36 220{scallops(36,164,220,7,7,7)} C150 180 134 140 120 110 Z" fill="{pink}"/>
    <path d="M92 116 C86 150 78 186 68 219" stroke-width="1" opacity=".6"/>
    <path d="M100 116 C100 152 100 190 100 225" stroke-width="1" opacity=".6"/>
    <path d="M108 116 C114 150 122 186 132 219" stroke-width="1" opacity=".6"/>
    {dots}
    <path d="M82 51 C72 50 63 58 64 67 C70 67 77 64 81 61 Z" fill="{pink}"/>
    <path d="M118 51 C128 50 137 58 136 67 C130 67 123 64 119 61 Z" fill="{pink}"/>
    <path d="M82 50 L90 47 C94 57 106 57 110 47 L118 50 C119 72 119 92 120 106 L80 106 C81 92 81 72 82 50 Z" fill="{pink}"/>
    <path d="M90 64 C92 80 92 94 91 104 M110 64 C108 80 108 94 109 104" stroke-width="1" opacity=".55"/>
    <path d="M79 104 L121 104 L121 113 L79 113 Z" fill="{deep}"/>
    <path d="M98 110 C95 122 91 134 87 145 L93 143 L96 149 C99 137 101 123 100 111 Z" fill="{deep}"/>
    <path d="M102 110 C105 122 109 134 113 145 L107 143 L104 149 C101 137 99 123 100 111 Z" fill="{deep}"/>
    <path d="M100 108 C88 93 71 97 75 110 C78 121 92 119 100 108 Z" fill="{deep}"/>
    <path d="M100 108 C112 93 129 97 125 110 C122 121 108 119 100 108 Z" fill="{deep}"/>
    <path d="M82 103 C87 106 92 107 96 108 M118 103 C113 106 108 107 104 108" stroke-width="1"/>
    <rect x="95" y="103" width="10" height="10" rx="3.2" fill="{pink}"/>'''
    return svg(inner, "tulle", size)

# 2) فستان حفلات مطرّز بالترتر — عاجي
def sequin_dress(size=760):
    ivory, inner_c, seq, seq2 = "#F4EBDD", "#EFE2CE", "#C9AE86", "#B28F63"
    pts = []
    for j, y in enumerate(range(58, 104, 4)):
        off = 2 if j % 2 else 0
        for x in range(83 + off, 119, 4):
            if y < 60 and abs(x - 100) < 9: continue
            pts.append(f'<circle cx="{x}" cy="{y}" r="{1.25 if (x+y)%3 else 1.5}" fill="{seq if (x*y)%5 else seq2}" stroke="none"/>')
    inner = f'''
    <path d="M84 106 C68 140 54 180 44 216 C80 225 120 225 156 216 C146 180 132 140 116 106 Z" fill="{inner_c}" stroke-width="1.2" opacity=".95"/>
    <path d="M79 106 C58 136 36 176 22 220 C44 230 64 226 82 232 C100 238 118 228 138 234 C156 238 170 228 178 220 C164 176 142 136 121 106 Z" fill="#FFFFFF" fill-opacity=".55"/>
    <path d="M88 110 C80 150 66 190 52 228 M100 110 C100 150 99 196 98 234 M112 110 C120 150 134 190 148 230" stroke-width="1" opacity=".55"/>
    <path d="M80 49 C70 47 64 55 66 64 C71 63 76 61 80 59 Z" fill="{ivory}"/>
    <path d="M120 49 C130 47 136 55 134 64 C129 63 124 61 120 59 Z" fill="{ivory}"/>
    <path d="M80 48 L90 45 C94 55 106 55 110 45 L120 48 C121 70 121 92 121 106 L79 106 C79 92 79 70 80 48 Z" fill="{ivory}"/>
    {''.join(pts)}
    <path d="M79 106 C92 110 108 110 121 106" stroke-width="1.6"/>
    {star(146,70,6,seq2)}{star(56,92,4.5,seq)}{star(160,120,3.5,seq)}{star(40,140,3,seq2)}'''
    return svg(inner, "sequin", size)

# 3) فستان قطن إسباني مزهّر بياقة بيتر بان
def floral_dress(size=760):
    cream = "#FFF7F1"
    pat = (f'<pattern id="flo" width="18" height="18" patternUnits="userSpaceOnUse">'
           f'{flower(5,5,4.2,"#E7A3B1","#D4A95E",0,.0)}{flower(14,13,3.6,"#E7A3B1","#D4A95E",20,.0)}'
           f'<ellipse cx="9.5" cy="6.5" rx="1.8" ry=".9" fill="#9FB28C" stroke="none" transform="rotate(-30 9.5 6.5)"/>'
           f'<ellipse cx="3.5" cy="14" rx="1.8" ry=".9" fill="#9FB28C" stroke="none" transform="rotate(35 3.5 14)"/></pattern>')
    pat = pat.replace('stroke-width="0.0"', 'stroke="none"').replace('stroke-width="0.0"', 'stroke="none"')
    skirt = "M78 84 C70 120 60 170 52 214 C84 222 116 222 148 214 C140 170 130 120 122 84 Z"
    yoke = "M84 46 C90 52 110 52 116 46 L124 50 C124 62 123 74 122 84 L78 84 C77 74 76 62 76 50 Z"
    gathers = "".join(f'<path d="M{x} 86 L{x + (x - 100) * .06:.1f} 95" stroke-width="1" opacity=".6"/>' for x in range(84, 118, 6))
    inner = f'''
    <path d="{skirt}" fill="{cream}"/><path d="{skirt}" fill="url(#flo)" stroke-width="2.3"/>
    <path d="M54 204 C84 212 116 212 146 204" stroke-width="1.1" opacity=".7"/>
    {gathers}
    <path d="M76 50 C62 48 54 60 58 72 C64 75 70 73 77 70 Z" fill="{cream}"/><path d="M76 50 C62 48 54 60 58 72 C64 75 70 73 77 70 Z" fill="url(#flo)"/>
    <path d="M124 50 C138 48 146 60 142 72 C136 75 130 73 123 70 Z" fill="{cream}"/><path d="M124 50 C138 48 146 60 142 72 C136 75 130 73 123 70 Z" fill="url(#flo)"/>
    <path d="M61 67 C66 70 71 70 76 66 M139 67 C134 70 129 70 124 66" stroke-width="1"/>
    <path d="{yoke}" fill="{cream}"/><path d="{yoke}" fill="url(#flo)"/>
    <path d="M100 51 C94 53 88 51 84 46 C79 53 82 63 90 63 C96 63 100 58 100 51 Z" fill="#FFFFFF"/>
    <path d="M100 51 C106 53 112 51 116 46 C121 53 118 63 110 63 C104 63 100 58 100 51 Z" fill="#FFFFFF"/>'''
    return svg(inner, "floral", size, defs=pat)

# 4) فستان كتان بحمالات — أزرق سماوي، أزرار خشبية
def linen_dress(size=760):
    blue, light = "#CFE1EE", "#DDEAF4"
    tex = ('<pattern id="lin" width="10" height="7" patternUnits="userSpaceOnUse">'
           '<path d="M0 2 L4 2 M6 5 L10 5" stroke="#5B2A3C" stroke-width=".45" opacity=".22"/></pattern>')
    skirt = "M79 94 C68 130 54 180 44 222 C80 231 120 231 156 222 C146 180 132 130 121 94 Z"
    inner = f'''
    <path d="M83 34 C84 44 85 54 86 64 L93 64 C92 54 91 44 90 34 Z" fill="{blue}"/>
    <path d="M117 34 C116 44 115 54 114 64 L107 64 C108 54 109 44 110 34 Z" fill="{blue}"/>
    <path d="{skirt}" fill="{blue}"/><path d="{skirt}" fill="url(#lin)" stroke="none"/>
    <path d="M82 62 L118 62 C119 72 120 84 121 94 L79 94 C80 84 81 72 82 62 Z" fill="{blue}"/>
    <path d="M79 94 C92 97 108 97 121 94" stroke-width="1.6"/>
    <path d="M100 64 L100 150" stroke-width="1" opacity=".6"/>
    <path d="M60 150 L84 150 L84 172 C84 177 80 180 75 180 L69 180 C64 180 60 177 60 172 Z" fill="{light}"/>
    <path d="M140 150 L116 150 L116 172 C116 177 120 180 125 180 L131 180 C136 180 140 177 140 172 Z" fill="{light}"/>
    <path d="M60 156 L84 156 M116 156 L140 156" stroke-width="1" opacity=".6"/>
    <path d="M47 210 C82 218 118 218 153 210" stroke-width="1" opacity=".6"/>
    {button(89.5,59,2.4)}{button(110.5,59,2.4)}
    {button(100,74)}{button(100,90)}{button(100,108)}{button(100,126)}{button(100,144)}'''
    return svg(inner, "linen", size, defs=tex)

# 5) فستان بيبي قطن بكشكشة وأكمام منفوخة
def baby_ruffle_dress(size=760):
    pink, white = "#F6DDE2", "#FFFFFF"
    skirt = "M78 82 C70 112 60 146 50 180" + scallops(50, 150, 180, 7, 5, 5) + " C140 146 130 112 122 82 Z"
    inner = f'''
    <path d="{skirt}" fill="{pink}"/>
    <path d="M56 168 C84 176 116 176 144 168" stroke-width="1" opacity=".6"/>
    <path d="M88 96 C84 120 78 146 72 174 M112 96 C116 120 122 146 128 174" stroke-width="1" opacity=".55"/>
    <path d="M77 56 C58 48 46 64 54 80 C61 85 70 82 78 77 Z" fill="{pink}"/>
    <path d="M123 56 C142 48 154 64 146 80 C139 85 130 82 122 77 Z" fill="{pink}"/>
    <path d="M58 75 C64 78 71 77 77 73 M142 75 C136 78 129 77 123 73" stroke-width="1"/>
    <path d="M84 50 C90 57 110 57 116 50 L123 55 C123 64 122 72 122 80 L78 80 C78 72 77 64 77 55 Z" fill="{pink}"/>
    <path d="M77 74 L123 74 L123 80{scallops(123, 77, 84, 6, 6, 0)} Z" fill="{white}"/>
    <path d="M77 76 L123 76" stroke-width="1" opacity=".6"/>
    <path d="M100 58 C95 52 89 54 91 59 C92 63 97 62 100 58 Z M100 58 C105 52 111 54 109 59 C108 63 103 62 100 58 Z" fill="#E7AFBE" stroke-width="1.3"/>
    <circle cx="100" cy="58" r="1.8" fill="{PLUM}" stroke="none"/>'''
    return svg(inner, "babydress", size)

# 6) أوفرول بيبي قطن بأزرار خشبية
def baby_overall(size=760):
    oat, light, wood = "#EDE1CC", "#F6EEDF", "#A97E58"
    body = ("M76 96 L124 96 C126 120 128 150 128 176 C128 196 126 214 124 232 L106 232 C105 214 104 196 102 178 "
            "C101 173 99 173 98 178 C96 196 95 214 94 232 L76 232 C74 214 72 196 72 176 C72 150 74 120 76 96 Z")
    snaps = "".join(f'<circle cx="{x}" cy="{y}" r="1.3" fill="{PLUM}" stroke="none"/>' for x, y in [(97.4,188),(96.4,202),(95.4,216),(102.6,188),(103.6,202),(104.6,216)])
    inner = f'''
    <path d="M79 30 L87 30 L89 72 L83 72 Z" fill="{oat}"/>
    <path d="M121 30 L113 30 L111 72 L117 72 Z" fill="{oat}"/>
    <path d="{body}" fill="{oat}"/>
    <path d="M82 70 C82 66 84 64 88 64 L112 64 C116 64 118 66 118 70 L118 98 L82 98 Z" fill="{oat}"/>
    <path d="M76 97 C92 101 108 101 124 97" stroke-width="1.5"/>
    <path d="M91 76 L109 76 L109 88 C109 91 106 93 100 93 C94 93 91 91 91 88 Z" fill="{light}"/>
    <path d="M91 80 L109 80" stroke-width="1" opacity=".6"/>
    <path d="M77 222 L94.6 222 M105.4 222 L123 222" stroke-width="1.1" opacity=".7"/>
    <path d="M86 104 C86 130 85 160 84 176 M114 104 C114 130 115 160 116 176" stroke-width="1" opacity=".45"/>
    {snaps}
    {button(86,70,3.4,wood)}{button(114,70,3.4,wood)}'''
    return svg(inner, "overall", size)

# 7) طقم بيبي 3 قطع: بودي + بنطلون + قبعة
def baby_set(size=760):
    pink, light = "#F4DCE1", "#FBEEF1"
    ribs = "".join(f'<path d="M{x} 49 L{x} 57" stroke-width=".9" opacity=".55"/>' for x in range(82, 120, 4))
    waist = "".join(f'<path d="M{x} 164 L{x} 170" stroke-width=".9" opacity=".55"/>' for x in range(80, 122, 4))
    inner = f'''
    <path d="M81 50 C79 32 89 21 100 21 C111 21 121 32 119 50 Z" fill="{pink}"/>
    <path d="M100 21 C95 12 103 8 106 13 C108 17 104 21 100 21" fill="{pink}" stroke-width="1.8"/>
    <rect x="78" y="47" width="44" height="11" rx="3.5" fill="{light}"/>{ribs}
    <path d="M89 67 C93 73 107 73 111 67 L125 73 L146 106 L136 112 L124 95 C124 112 122 125 120 134 C116 141 112 146 106 149 L94 149 C88 146 84 141 80 134 C78 125 76 112 76 95 L64 112 L54 106 L75 73 Z" fill="{pink}"/>
    <path d="M89 67 C93 76 107 76 111 67" stroke-width="1.1"/>
    <path d="M138.5 102 L143 110 M61.5 102 L57 110" stroke-width="1.1" opacity=".7"/>
    <circle cx="96" cy="146" r="1.2" fill="{PLUM}" stroke="none"/><circle cx="100" cy="146" r="1.2" fill="{PLUM}" stroke="none"/><circle cx="104" cy="146" r="1.2" fill="{PLUM}" stroke="none"/>
    <path d="M77 160 L123 160 L125 172 C127 192 127 214 125 238 L106 238 C105 222 103 208 101 196 L99 196 C97 208 95 222 94 238 L75 238 C73 214 73 192 75 172 Z" fill="{pink}"/>
    <rect x="76" y="159" width="48" height="12" rx="3" fill="{light}"/>{waist}
    <path d="M75 229 L94.4 229 M105.6 229 L125 229" stroke-width="1.1" opacity=".7"/>'''
    return svg(inner, "set", size)

# 8) طوق شعر بزهور ولؤلؤ
def flower_headband(size=760):
    band, pink, white = "#F0CDD5", "#F2C3CE", "#FFFDFB"
    cx, cy, rx, ry = 100, 158, 66, 92
    outer, innr = [], []
    for k in range(0, 121):
        th = math.radians(-24 + k * (228 / 120))
        t = 5 + 6.5 * max(0, math.sin(th))
        x, y = cx + rx * math.cos(th), cy - ry * math.sin(th)
        nx, ny = math.cos(th) / rx, -math.sin(th) / ry
        nl = math.hypot(nx, ny); nx, ny = nx / nl, ny / nl
        outer.append((x + nx * t, y + ny * t)); innr.append((x - nx * t, y - ny * t))
    pts = outer + innr[::-1]
    band_d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"
    wraps = ""
    for k in range(4, 118, 5):
        a, b = outer[k], innr[k + 2 if k + 2 < 121 else k]
        wraps += f'<path d="M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" stroke-width=".8" opacity=".35"/>'
    def on(thdeg, off=0):
        th = math.radians(thdeg)
        return cx + (rx + off) * math.cos(th), cy - (ry + off) * math.sin(th)
    flowers = ""
    for thd, r, f, rot in [(128, 9, white, 10), (111, 12.5, pink, 30), (92, 15, white, 0), (73, 12.5, pink, 18), (56, 9, white, 40)]:
        x, y = on(thd, 2)
        flowers += flower(x, y, r, f, "#D4A95E", rot, 1.3)
    leaves = ""
    for thd, ang in [(101, -60), (83, 60), (120, -40), (64, 40)]:
        x, y = on(thd, 12)
        leaves += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="6" ry="2.6" fill="#B7C4A4" stroke-width="1.1" transform="rotate({ang} {x:.1f} {y:.1f})"/>'
    pearls = ""
    for thd, off, r in [(136, -1, 2.4), (119, 9, 2.1), (102, -8, 2.3), (82, -8, 2.3), (64, 9, 2.1), (48, -1, 2.4), (140, 7, 1.7), (44, 7, 1.7)]:
        x, y = on(thd, off)
        pearls += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{white}" stroke-width="1.1"/>'
    inner = f'<path d="{band_d}" fill="{band}"/>{wraps}{leaves}{flowers}{pearls}'
    return svg(inner, "headband", size)

PRODUCTS = [
    ("tulle-dress-pink", tulle_dress, "#F7E3E7", "#E9C3CC"),
    ("sequin-dress-ivory", sequin_dress, "#F4EDE3", "#E2D3BC"),
    ("floral-cotton-dress", floral_dress, "#F9ECE5", "#EDCBBF"),
    ("linen-strap-dress-blue", linen_dress, "#E7EFF5", "#C9D9E6"),
    ("baby-ruffle-dress", baby_ruffle_dress, "#F8E7EA", "#EBC8CF"),
    ("baby-overall", baby_overall, "#F2EBE0", "#E0D0B8"),
    ("baby-3-piece-set", baby_set, "#F6E5E9", "#E9C6CF"),
    ("flower-headband", flower_headband, "#F6ECE2", "#E6CFB8"),
]
