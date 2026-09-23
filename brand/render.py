import asyncio, sys, pathlib
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).parent.resolve()
FONTS = f"""
@font-face{{font-family:'ArefRuqaa';src:url('file://{HERE}/fonts/ArefRuqaa-Bold.ttf');font-weight:700}}
@font-face{{font-family:'ArefRuqaa';src:url('file://{HERE}/fonts/ArefRuqaa-Regular.ttf');font-weight:400}}
@font-face{{font-family:'Amiri';src:url('file://{HERE}/fonts/Amiri-Bold.ttf');font-weight:700}}
@font-face{{font-family:'Amiri';src:url('file://{HERE}/fonts/Amiri-Regular.ttf');font-weight:400}}
@font-face{{font-family:'ElMessiri';src:url('file://{HERE}/fonts/ElMessiri[wght].ttf');font-weight:400 700}}
@font-face{{font-family:'Almarai';src:url('file://{HERE}/fonts/Almarai-Regular.ttf');font-weight:400}}
@font-face{{font-family:'Almarai';src:url('file://{HERE}/fonts/Almarai-Bold.ttf');font-weight:700}}
@font-face{{font-family:'Almarai';src:url('file://{HERE}/fonts/Almarai-ExtraBold.ttf');font-weight:800}}
@font-face{{font-family:'Cormorant';src:url('file://{HERE}/fonts/CormorantGaramond[wght].ttf');font-weight:300 700}}
@font-face{{font-family:'Marcellus';src:url('file://{HERE}/fonts/Marcellus-Regular.ttf');font-weight:400}}
"""
async def render(html, out, w, h, transparent=False, scale=1):
    doc = HERE / "_page.html"
    doc.write_text(f"<!doctype html><html><head><meta charset='utf-8'><style>{FONTS} html,body{{margin:0;padding:0}}</style></head><body>{html}</body></html>", encoding="utf-8")
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        await pg.goto(doc.as_uri())
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=out, omit_background=transparent, full_page=False)
        await b.close()
def run(html, out, w, h, transparent=False, scale=1):
    asyncio.run(render(html, out, w, h, transparent, scale))

async def render_el(html, out, w, h, transparent=True, scale=2, selector="#art"):
    doc = HERE / "_page.html"
    doc.write_text(f"<!doctype html><html><head><meta charset='utf-8'><style>{FONTS} html,body{{margin:0;padding:0}}</style></head><body>{html}</body></html>", encoding="utf-8")
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        await pg.goto(doc.as_uri())
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(300)
        await pg.locator(selector).screenshot(path=out, omit_background=transparent)
        await b.close()
def run_el(html, out, w, h, transparent=True, scale=2, selector="#art"):
    asyncio.run(render_el(html, out, w, h, transparent, scale, selector))
