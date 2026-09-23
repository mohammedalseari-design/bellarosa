from render import run, run_el
from rose import rose_svg, rosette_svg
from illus import occasion_dress, day_dress, baby_romper, bow_headband
from PIL import Image
PLUM="#5B2A3C"; MAUVE="#9A5F70"; IVORY="#FBF7F4"; ROSE="#F3DCE0"

def lockup(size=96, latin=True, color=PLUM, sub=MAUVE, rose_color=None):
    rc = rose_color or color
    lat = (f'<div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-top:{int(size*0.1)}px">'
           f'<span style="height:1px;width:{int(size*0.38)}px;background:{sub};opacity:.6"></span>'
           f'<span style="font-family:Marcellus;font-size:{int(size*0.19)}px;letter-spacing:.5em;color:{sub};padding-left:.5em">BELLA ROSA</span>'
           f'<span style="height:1px;width:{int(size*0.38)}px;background:{sub};opacity:.6"></span></div>') if latin else ''
    return (f'<div style="display:inline-flex;align-items:center;gap:{int(size*0.14)}px;direction:rtl">{rose_svg(size=int(size*0.8), width=2.0, stroke=rc)}'
            f'<div style="text-align:center"><div style="font-family:Amiri;font-weight:700;font-size:{size}px;line-height:1.12;color:{color}">بيلا روزا</div>{lat}</div></div>')

# 1) header logo (no latin line) + full lockup, transparent, tight crop
run_el(f'<div id="art" style="display:inline-block;padding:6px 10px">{lockup(110, latin=False)}</div>', "out/logo-header.png", 900, 400)
run_el(f'<div id="art" style="display:inline-block;padding:10px 16px">{lockup(120, latin=True)}</div>', "out/logo-full.png", 1000, 500)
run_el(f'<div id="art" style="display:inline-block;padding:10px 16px">{lockup(120, latin=True, color="#FFFFFF", sub="#F3DCE0")}</div>', "out/logo-full-white.png", 1000, 500)

# 2) favicon 512
run(f'<div style="width:512px;height:512px;border-radius:112px;background:{ROSE};display:flex;align-items:center;justify-content:center">{rose_svg(size=330, width=2.6, stem=False)}</div>', "out/favicon.png", 512, 512, transparent=True)

# 3) social share 1200x628
deco = lambda s, style: f'<div style="position:absolute;{style};opacity:.5">{rosette_svg(size=s, width=1.2, stroke="#D9B8C0", center="#D9B8C0", inner=False)}</div>'
og = (f'<div style="position:relative;width:1200px;height:628px;overflow:hidden;background:radial-gradient(120% 90% at 50% 20%, #FFFFFF 0%, {IVORY} 45%, {ROSE} 100%)">'
      + deco(260, "left:-70px;top:-60px") + deco(200, "right:-40px;bottom:-50px") + deco(90, "right:140px;top:60px") + deco(70, "left:170px;bottom:70px")
      + f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px">{lockup(132, latin=True)}'
      + f'<div style="font-family:Almarai;font-weight:700;font-size:30px;color:{PLUM};direction:rtl">فساتين وملابس أطفال إسبانية · جدة</div>'
      + f'<div style="font-family:Almarai;font-size:22px;color:{MAUVE};direction:rtl">توصيل لكل مدن المملكة · استلام من المحل · استبدال خلال 3 أيام</div></div></div>')
run(og, "out/og-share.png", 1200, 628)

# 4) collection covers 960x1200
tiles = {
  "cover-occasion": (occasion_dress, "#F3DCE0", "#F3DCE0", "#E2BCC6"),
  "cover-daily": (day_dress, "#F7E4D8", "#F3D6C4", "#E3BFA8"),
  "cover-baby": (baby_romper, "#E9E4F2", "#E1D9F0", "#C9BEDF"),
  "cover-accessories": (bow_headband, "#F5E9D7", "#EFDCC2", "#DDC3A0"),
}
for name, (fn, tint, fill, decoc) in tiles.items():
    d = lambda s, style: f'<div style="position:absolute;{style};opacity:.55">{rosette_svg(size=s, width=1.3, stroke=decoc, center=decoc, inner=False)}</div>'
    html = (f'<div style="position:relative;width:960px;height:1200px;overflow:hidden;background:linear-gradient(180deg,{tint} 0%,{IVORY} 88%)">'
            + d(300, "right:-90px;top:-80px") + d(150, "left:70px;top:150px") + d(220, "left:-80px;bottom:120px")
            + f'<div style="position:absolute;left:0;right:0;top:120px;display:flex;justify-content:center">{fn(fill=fill, size=560, width=2.4)}</div></div>')
    run(html, f"out/{name}.png", 960, 1200)
    Image.open(f"out/{name}.png").convert("RGB").save(f"out/{name}.jpg", quality=90, optimize=True, progressive=True)
Image.open("out/og-share.png").convert("RGB").save("out/og-share.jpg", quality=90, optimize=True, progressive=True)
import os
for f in sorted(os.listdir("out")): print(f, os.path.getsize("out/"+f), Image.open("out/"+f).size)
