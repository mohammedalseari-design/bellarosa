from render import run_el
from rose import rose_svg
PLUM="#5B2A3C"
def header(size=110, w=3.0, color=PLUM):
    return (f'<div id="art" style="display:inline-block;padding:6px 10px"><div style="display:inline-flex;align-items:center;gap:{int(size*0.12)}px;direction:rtl">'
            f'{rose_svg(size=int(size*0.78), width=w, stroke=color)}'
            f'<div style="font-family:Amiri;font-weight:700;font-size:{size}px;line-height:1.12;color:{color}">بيلا روزا</div></div></div>')
run_el(header(110, 3.2), "out/logo-header.png", 900, 400)
run_el(header(110, 3.2, "#FFFFFF"), "out/logo-header-white.png", 900, 400)
