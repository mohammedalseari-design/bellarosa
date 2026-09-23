import sys
from render import run
from rose import rosette_svg
from products_illus import PRODUCTS
from PIL import Image
IVORY="#FBF7F4"
only = sys.argv[1:]
for name, fn, tint, decoc in PRODUCTS:
    if only and name not in only: continue
    d = lambda s, style: f'<div style="position:absolute;{style};opacity:.5">{rosette_svg(size=s, width=1.2, stroke=decoc, center=decoc, inner=False)}</div>'
    html = (f'<div style="position:relative;width:1200px;height:1500px;overflow:hidden;background:radial-gradient(110% 80% at 50% 38%, {IVORY} 0%, {tint} 78%)">'
            + d(330, "right:-110px;top:-100px") + d(150, "left:80px;top:120px") + d(250, "left:-100px;bottom:90px") + d(110, "right:120px;bottom:150px")
            + f'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 22px 28px rgba(91,42,60,.14))">{fn(size=900)}</div></div>')
    run(html, f"out/p-{name}.png", 1200, 1500)
    Image.open(f"out/p-{name}.png").convert("RGB").save(f"out/p-{name}.jpg", quality=88, optimize=True, progressive=True)
# contact sheet
ims = [Image.open(f"out/p-{n}.jpg") for n,*_ in PRODUCTS]
W = 300; H = 375
sheet = Image.new("RGB", (W*4+50, H*2+30), "white")
for i, im in enumerate(ims):
    sheet.paste(im.resize((W, H), Image.LANCZOS), (10 + (i%4)*(W+10), 10 + (i//4)*(H+10)))
sheet.save("out/products_sheet.jpg", quality=88)
print("ok")
