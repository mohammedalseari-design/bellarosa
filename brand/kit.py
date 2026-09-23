# Bella Rosa launch kit: Instagram posts (1080x1350), story (1080x1920), highlight covers, profile picture.
import os, sys
from render import run
from rose import rose_svg, rosette_svg
from products_illus import (tulle_dress, floral_dress, baby_ruffle_dress, sequin_dress, linen_dress,
                            baby_overall, baby_set, flower_headband)
from PIL import Image
PLUM, MAUVE, IVORY, ROSE = "#5B2A3C", "#9A5F70", "#FBF7F4", "#F3DCE0"
os.makedirs("kit", exist_ok=True)

def lockup(size, latin=True, color=PLUM, sub=MAUVE, rw=2.4):
    lat = (f'<div style="display:flex;align-items:center;gap:{int(size*.12)}px;justify-content:center;margin-top:{int(size*.1)}px">'
           f'<span style="height:1px;width:{int(size*.38)}px;background:{sub};opacity:.6"></span>'
           f'<span style="font-family:Marcellus;font-size:{int(size*.19)}px;letter-spacing:.5em;color:{sub};padding-left:.5em">BELLA ROSA</span>'
           f'<span style="height:1px;width:{int(size*.38)}px;background:{sub};opacity:.6"></span></div>') if latin else ''
    return (f'<div style="display:inline-flex;align-items:center;gap:{int(size*.14)}px;direction:rtl">{rose_svg(size=int(size*.8), width=rw, stroke=color)}'
            f'<div style="text-align:center"><div style="font-family:Amiri;font-weight:700;font-size:{size}px;line-height:1.12;color:{color}">بيلا روزا</div>{lat}</div></div>')

ICONS = {
  "truck": '<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 9.5h4.2l3.3 3.4v3.1h-7.5"/><circle cx="6.5" cy="17.2" r="1.9" fill="VAR"/><circle cx="17" cy="17.2" r="1.9" fill="VAR"/>',
  "store": '<path d="M4 11v9h16v-9"/><path d="M3 10.5 5 4h14l2 6.5"/><path d="M3 10.5c0 1.6 1.3 2.8 3 2.8s3-1.2 3-2.8c0 1.6 1.3 2.8 3 2.8s3-1.2 3-2.8c0 1.6 1.3 2.8 3 2.8s3-1.2 3-2.8"/><path d="M10 20v-4.5h4V20"/>',
  "exchange": '<path d="M4.5 9.5A8 8 0 0 1 18.3 6.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M19.5 14.5A8 8 0 0 1 5.7 17.4L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
  "ruler": '<rect x="2.5" y="8" width="19" height="8" rx="1.6"/><path d="M6 8v3.2M9 8v2M12 8v3.2M15 8v2M18 8v3.2"/>',
  "sparkle": '<path d="M11 3.5c.6 4.1 2.4 5.9 6.5 6.5-4.1.6-5.9 2.4-6.5 6.5-.6-4.1-2.4-5.9-6.5-6.5 4.1-.6 5.9-2.4 6.5-6.5z"/><path d="M18.5 14.5c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z"/>',
  "heart": '<path d="M12 20s-7.2-4.4-9.1-8.7C1.5 8.2 3.4 4.8 7 4.8c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.5 3.4 4.1 6.5C19.2 15.6 12 20 12 20z"/>',
  "cash": '<rect x="2.5" y="6.5" width="19" height="11" rx="1.6"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  "chat": '<path d="M4 18.5 5.2 15A7.8 7.8 0 1 1 8.6 18z"/><path d="M8.5 11.5h7M8.5 8.5h5"/>',
  "gift": '<rect x="3.5" y="9.5" width="17" height="10.5" rx="1.2"/><path d="M2.5 6.5h19v3h-19zM12 6.5V20"/><path d="M12 6.5C10 3 6.5 3.5 7.5 5.5c.6 1.1 2.6 1 4.5 1zM12 6.5c2-3.5 5.5-3 4.5-1-.6 1.1-2.6 1-4.5 1z"/>',
  "arrow_down": '<path d="M12 4v15M6 13l6 6 6-6"/>',
}
def icon(name, size=56, color=PLUM, sw=1.5):
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name].replace("VAR", "none")}</svg>')

def deco(size, style, color="#E6C6CE", op=.5, w=1.2):
    return f'<div style="position:absolute;{style};opacity:{op}">{rosette_svg(size=size, width=w, stroke=color, center=color, inner=False)}</div>'

def frame(w, h, bg, inner):
    return f'<div style="position:relative;width:{w}px;height:{h}px;overflow:hidden;background:{bg};direction:rtl">{inner}</div>'

def save(html, name, w, h, png=False):
    out = f"kit/{name}.png"
    run(html, out, w, h)
    if not png:
        Image.open(out).convert("RGB").save(f"kit/{name}.jpg", quality=92, optimize=True, progressive=True); os.remove(out)

LIGHT_BG = f"radial-gradient(95% 70% at 50% 34%, #FFFFFF 0%, {IVORY} 52%, {ROSE} 100%)"
T = lambda txt, size, color=PLUM, fam="Almarai", weight=400, extra="": (
    f'<div style="font-family:{fam};font-weight:{weight};font-size:{size}px;color:{color};{extra}">{txt}</div>')

def services(color=PLUM, sub=MAUVE, top=1095):
    items = [("truck", "توصيل لكل مدن المملكة"), ("store", "استلام مجاني من المحل"), ("exchange", "استبدال خلال 3 أيام")]
    cols = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:300px">{icon(i, 52, color, 1.4)}'
                   f'<div style="font-family:Almarai;font-weight:700;font-size:25px;color:{color}">{t}</div></div>' for i, t in items)
    return f'<div style="position:absolute;top:{top}px;left:0;right:0;display:flex;justify-content:center;gap:10px">{cols}</div>'

def pill(txt, top, bg=PLUM, fg=IVORY, size=28):
    return (f'<div style="position:absolute;top:{top}px;left:0;right:0;display:flex;justify-content:center">'
            f'<div style="background:{bg};color:{fg};font-family:Almarai;font-weight:700;font-size:{size}px;padding:18px 46px;border-radius:999px">{txt}</div></div>')

# ---------- Post 1: opening ----------
def post_opening():
    inner = (deco(300, "left:-90px;top:-80px") + deco(120, "right:90px;top:250px", op=.45) + deco(220, "right:-70px;bottom:260px")
        + f'<div style="position:absolute;top:64px;left:0;right:0;text-align:center">{lockup(58)}</div>'
        + f'<div style="position:absolute;top:214px;left:0;right:0;text-align:center">'
        + T("افتتاح المتجر الإلكتروني", 30, MAUVE, weight=700, extra="letter-spacing:.02em")
        + T("من محلّنا في جدة<br>إلى باب بيتك", 98, PLUM, "Amiri", 700, "line-height:1.28;margin-top:10px") + '</div>'
        + '<div style="position:absolute;left:50%;top:590px;transform:translateX(-50%);width:840px;height:480px;border-radius:420px 420px 40px 40px;'
          'background:linear-gradient(180deg,rgba(243,220,224,.95) 0%,rgba(243,220,224,.35) 100%);border:2px solid rgba(154,95,112,.22)"></div>'
        + f'<div style="position:absolute;left:0;right:0;top:648px;display:flex;justify-content:center;align-items:flex-end;direction:ltr;filter:drop-shadow(0 14px 18px rgba(91,42,60,.12))">'
          f'<div style="margin-right:-40px">{baby_ruffle_dress(size=270)}</div><div style="position:relative;z-index:2">{tulle_dress(size=340)}</div>'
          f'<div style="margin-left:-40px">{floral_dress(size=290)}</div></div>'
        + services(top=1098) + pill("تسوّقي الآن · الرابط في البايو", 1240))
    save(frame(1080, 1350, LIGHT_BG, inner), "post-1-opening", 1080, 1350)

# ---------- Post 2: categories ----------
def post_categories():
    tiles = [(tulle_dress, "فساتين مناسبات", "أعياد · أعراس · حفلات", "#F7E3E7"),
             (floral_dress, "فساتين يومية", "قطن وكتان مريح", "#F9ECE5"),
             (baby_set, "ملابس بيبي", "من الولادة حتى 24 شهراً", "#EFE8F4"),
             (flower_headband, "إكسسوارات", "تكمل الإطلالة", "#F6ECE2")]
    cells = "".join(
        f'<div style="width:452px;height:402px;border-radius:30px;background:{bg};border:1.5px solid rgba(154,95,112,.18);position:relative;overflow:hidden">'
        f'<div style="position:absolute;top:6px;left:0;right:0;display:flex;justify-content:center">{fn(size=198)}</div>'
        f'<div style="position:absolute;bottom:22px;left:0;right:0;text-align:center">{T(t, 40, PLUM, "Amiri", 700, "line-height:1.1")}'
        f'{T(s, 22, MAUVE, extra="margin-top:6px")}</div></div>' for fn, t, s, bg in tiles)
    inner = (deco(240, "left:-80px;top:-70px") + deco(200, "right:-60px;bottom:-60px")
        + f'<div style="position:absolute;top:58px;left:0;right:0;text-align:center">{lockup(44, latin=False)}</div>'
        + f'<div style="position:absolute;top:150px;left:0;right:0;text-align:center">{T("كل ما تحتاجه أميرتك", 86, PLUM, "Amiri", 700, "line-height:1.3")}'
        + T("فساتين وملابس أطفال إسبانية مختارة بعناية", 28, MAUVE, extra="margin-top:4px") + '</div>'
        + f'<div style="position:absolute;top:365px;left:0;right:0;display:flex;flex-wrap:wrap;justify-content:center;gap:24px;padding:0 64px">{cells}</div>'
        + f'<div style="position:absolute;bottom:52px;left:0;right:0;text-align:center">{T("للبنات من سنتين إلى 11 سنة · وللمواليد من الولادة حتى 24 شهراً", 24, PLUM, weight=700)}</div>')
    save(frame(1080, 1350, LIGHT_BG, inner), "post-2-categories", 1080, 1350)

# ---------- Post 3: size guide ----------
def post_sizes():
    rows = [("2-3 سنوات", "92-98"), ("4-5 سنوات", "104-110"), ("6-7 سنوات", "116-122"), ("8-9 سنوات", "128-134"), ("10-11 سنة", "140-146")]
    trs = "".join(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:0 44px;height:84px;'
                  f'{"border-top:1.5px solid rgba(154,95,112,.16);" if i else ""}">'
                  f'<span style="font-family:Almarai;font-weight:700;font-size:34px;color:{PLUM}">{a}</span>'
                  f'<span style="font-family:Almarai;font-size:34px;color:{PLUM}">{b} <span style="font-size:24px;color:{MAUVE}">سم</span></span></div>'
                  for i, (a, b) in enumerate(rows))
    table = (f'<div style="position:absolute;top:448px;left:110px;right:110px;background:rgba(255,255,255,.82);border-radius:32px;'
             f'border:1.5px solid rgba(154,95,112,.2);box-shadow:0 18px 40px rgba(91,42,60,.08);overflow:hidden">'
             f'<div style="display:flex;justify-content:space-between;padding:22px 44px;background:{ROSE}">'
             f'<span style="font-family:Almarai;font-weight:800;font-size:26px;color:{MAUVE}">عمر ابنتك</span>'
             f'<span style="font-family:Almarai;font-weight:800;font-size:26px;color:{MAUVE}">طولها</span></div>{trs}</div>')
    tips = [("ruler", "قيسي الطول من الرأس إلى القدم وهي واقفة بدون حذاء"), ("heart", "بين مقاسين؟ اختاري الأكبر، خصوصاً في فساتين المناسبات")]
    tip_html = "".join(f'<div style="display:flex;align-items:center;gap:18px;margin-top:18px">{icon(i, 44, PLUM, 1.5)}'
                       f'<span style="font-family:Almarai;font-size:27px;color:{PLUM}">{t}</span></div>' for i, t in tips)
    inner = (deco(260, "left:-90px;top:-80px") + deco(180, "right:-60px;bottom:-40px")
        + f'<div style="position:absolute;top:60px;left:0;right:0;text-align:center">{lockup(40, latin=False)}</div>'
        + f'<div style="position:absolute;top:140px;left:0;right:0;text-align:center">{T("دليل المقاسات", 28, MAUVE, weight=700)}'
        + T("كيف تختارين المقاس؟", 92, PLUM, "Amiri", 700, "line-height:1.3;margin-top:6px")
        + T("المقاسات الإسبانية تُقاس بالطول قبل العمر", 30, PLUM, extra="margin-top:2px") + '</div>'
        + table
        + f'<div style="position:absolute;top:1030px;left:120px;right:120px">{tip_html}</div>'
        + f'<div style="position:absolute;bottom:50px;left:0;right:0;text-align:center">{T("الجدول الكامل للبنات والمواليد في متجرنا · الرابط في البايو", 24, MAUVE, weight=700)}</div>')
    save(frame(1080, 1350, LIGHT_BG, inner), "post-3-size-guide", 1080, 1350)

# ---------- Story: opening (plum) ----------
def story_opening():
    bg = f"radial-gradient(90% 60% at 50% 40%, #6E3A4E 0%, {PLUM} 70%, #4A2131 100%)"
    inner = (deco(420, "left:-150px;top:120px", "#86506A", .45) + deco(300, "right:-110px;bottom:420px", "#86506A", .45) + deco(140, "right:120px;top:300px", "#86506A", .4)
        + f'<div style="position:absolute;top:250px;left:0;right:0;text-align:center">{lockup(84, color="#FFFFFF", sub=ROSE)}</div>'
        + f'<div style="position:absolute;top:500px;left:0;right:0;text-align:center">{T("افتتحنا متجرنا<br>الإلكتروني", 118, "#FFFFFF", "Amiri", 700, "line-height:1.3")}'
        + T("فساتين وملابس أطفال إسبانية · نوصل لكل مدن المملكة", 32, ROSE, extra="margin-top:18px") + '</div>'
        + '<div style="position:absolute;left:50%;top:960px;transform:translateX(-50%);width:600px;height:560px;border-radius:300px 300px 40px 40px;'
          'background:linear-gradient(180deg,#F3DCE0 0%,#FBF7F4 100%)"></div>'
        + f'<div style="position:absolute;left:0;right:0;top:1000px;display:flex;justify-content:center;filter:drop-shadow(0 18px 22px rgba(0,0,0,.18))">{tulle_dress(size=400)}</div>'
        + f'<div style="position:absolute;top:1560px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px">'
          f'{T("اضغطي على الرابط وتسوّقي", 38, "#FFFFFF", weight=700)}{icon("arrow_down", 60, ROSE, 1.6)}</div>')
    save(frame(1080, 1920, bg, inner), "story-opening", 1080, 1920)

# ---------- Highlight covers ----------
def highlights():
    items = [("new", ("icon", "sparkle")), ("occasions", ("ill", tulle_dress)), ("baby", ("ill", baby_overall)),
             ("sizes", ("icon", "ruler")), ("delivery", ("icon", "truck")), ("reviews", ("icon", "heart"))]
    for name, (kind, val) in items:
        art = icon(val, 470, PLUM, .95) if kind == "icon" else val(size=640)
        html = frame(1080, 1920, f"radial-gradient(60% 40% at 50% 50%, #FFFFFF 0%, {ROSE} 100%)",
                     '<div style="position:absolute;left:50%;top:50%;width:760px;height:760px;transform:translate(-50%,-50%);border-radius:50%;'
                     'border:3px solid rgba(154,95,112,.35)"></div>'
                     f'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">{art}</div>')
        save(html, f"highlight-{name}", 1080, 1920)

# ---------- Profile picture ----------
def profile():
    html = frame(1080, 1080, f"radial-gradient(80% 80% at 50% 40%, #6E3A4E 0%, {PLUM} 75%)",
                 f'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-top:10px">'
                 f'{rose_svg(size=390, width=2.3, stroke=IVORY)}</div>')
    save(html, "profile-picture", 1080, 1080)

jobs = {"opening": post_opening, "categories": post_categories, "sizes": post_sizes, "story": story_opening,
        "highlights": highlights, "profile": profile}
for k in (sys.argv[1:] or jobs):
    jobs[k](); print("done", k)
