import math
# Original marks for Bella Rosa (generic subjects, hand-built): a five-petal wild-rose rosette and a line bloom.
def rosette_svg(stroke="#5B2A3C", fill="none", width=2.0, size=80, center="#5B2A3C", petals=5, inner=True):
    cx = cy = 50
    parts = []
    for i in range(petals):
        a = -90 + i * 360 / petals
        # petal: heart-ish rounded lobe pointing outward, built from two cubic curves
        def pt(r, da):
            t = math.radians(a + da)
            return cx + r * math.cos(t), cy + r * math.sin(t)
        p0 = pt(6, -34); p3 = pt(6, 34)
        c1 = pt(40, -46); c2 = pt(44, -8); tip = pt(36, 0)
        c3 = pt(44, 8); c4 = pt(40, 46)
        parts.append(f'<path d="M{p0[0]:.2f} {p0[1]:.2f} C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {tip[0]:.2f} {tip[1]:.2f} '
                     f'C{c3[0]:.2f} {c3[1]:.2f} {c4[0]:.2f} {c4[1]:.2f} {p3[0]:.2f} {p3[1]:.2f}" fill="{fill}"/>')
        if inner:
            q0 = pt(11, 0); q1 = pt(22, 0)
            parts.append(f'<path d="M{q0[0]:.2f} {q0[1]:.2f} L{q1[0]:.2f} {q1[1]:.2f}" stroke-width="{width*0.55:.2f}"/>')
    parts.append(f'<circle cx="50" cy="50" r="5.2" fill="{center}" stroke="none"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4 92 92" width="{size}" height="{size}" fill="none" '
            f'stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">' + "".join(parts) + '</svg>')

def rose_svg(stroke="#5B2A3C", width=2.2, leaf_fill="none", size=120, stem=True):
    parts = [
        '<path d="M31 31 C30 50 39 62 50 62 C61 62 70 50 69 31" />',
        '<path d="M31 31 C37 26 43 28 47 33" />',
        '<path d="M69 31 C63 26 57 28 53 33" />',
        '<path d="M50 39 C45 39 44 33 48 30 C53 27 58 31 57 36 C56 42 47 45 42 40" />',
        '<path d="M33 41 C38 51 52 54 62 45" />',
        '<path d="M66 35 C66 45 61 53 53 56" />',
    ]
    vb_h = 50
    if stem:
        parts += [
            '<path d="M50 62 C50 75 49 88 47 102" />',
            f'<path d="M49 79 C42 71 33 71 27 77 C33 82 42 83 49 79 Z" fill="{leaf_fill}" />',
            f'<path d="M48 92 C55 85 64 85 70 90 C64 95 55 96 48 92 Z" fill="{leaf_fill}" />',
        ]
        vb_h = 90
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="22 18 56 {vb_h}" width="{size}" '
            f'fill="none" stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">'
            + "".join(parts) + '</svg>')
