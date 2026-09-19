# -*- coding: utf-8 -*-
"""
Builds the Playza pricing PDF in Egyptian Arabic.

Pipeline: this script emits a flat-ODF text document (.fodt) and converts it
to PDF with headless LibreOffice, which handles Arabic shaping (contextual
letterforms) and RTL layout natively — unlike ReportLab.

Usage:  python3 generate_plans_pdf.py
Output: Playza-Plans-Egyptian-Arabic.fodt / .pdf next to this script.
"""
import os
import subprocess
import sys
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Palette (matches the Playza deck) ──────────────────────────
NAVY = "#0a1e3f"
NAVY_2 = "#132d50"
GREEN = "#0daa74"
GREEN_DK = "#087451"
GREEN_BG = "#eafbf5"
GRAY = "#6b7a8f"
BORDER = "#d8e0ea"
LIGHT = "#f6f9fc"
CAT_BG = "#eef2f7"

FONT = "Noto Sans Arabic"

# ── Content: prices (EGP) taken from src/components/checkout ───
# (feature, starter, plus, elite) — cell: True=✔ / False=— / str=value
ACADEMY_ROWS = [
    ("cat", "الأعضاء والأشخاص"),
    ("أعضاء بلا حدود", True, True, True),
    ("أدوار (مدير / عضو / مدرب)", True, True, True),
    ("تسجيل الأعضاء بكود دعوة", False, True, True),
    ("حضور QR وتسجيل سريع", False, True, True),
    ("تحليلات احتمالية الانقطاع عن التدريب", False, True, True),
    ("تقييمات اللاعبين (بطاقات وملاحظات المدرب)", False, False, True),
    ("cat", "الجدول والجلسات"),
    ("جدول التدريب والحجوزات والإلغاء", True, True, True),
    ("الملاعب / الفروع", "ملعب واحد", "3 ملاعب", "بلا حدود"),
    ("جداول متكررة + توليد الشهر بالكامل", False, True, True),
    ("جلسات الضيوف وحساب إيراد الجلسة", False, True, True),
    ("تصدير واشتراك التقويم (ICS)", False, False, True),
    ("cat", "الفلوس"),
    ("سجلات المدفوعات والفوترة", False, True, True),
    ("المصاريف وحاسبة التكلفة الشهرية", False, True, True),
    ("توقع الإيرادات وتحليل صافي الربح", False, False, True),
    ("رسوم الإيراد حسب طريقة الدفع والمصاريف", False, False, True),
    ("cat", "التقارير"),
    ("ملخص مالي + تصدير CSV", False, True, True),
    ("تحليلات شاملة (اتجاهات وأداء المدربين)", False, True, True),
    ("تقارير مجمّعة لكل الفروع", False, False, True),
    ("cat", "المجتمع"),
    ("إعلانات للأعضاء", False, True, True),
    ("مباريات ودية + نتائج + مباريات متكررة", False, True, True),
    ("خريطة الاكتشاف", True, True, True),
    ("لوحة الشرف", False, True, True),
    ("إشعارات المتصفح وجرس الإشعارات", True, True, True),
    ("cat", "السوق والمنافسة"),
    ("الفرق والبطولات ونتائج مباشرة", False, False, True),
    ("نشر حجوزات مدفوعة في السوق", False, False, True),
    ("دفق الفعاليات والبطولات", False, False, True),
    ("cat", "المنصة"),
    ("حد المدربين", "مدرب واحد", "بلا حدود", "بلا حدود"),
    ("مساعد المدرب الذكي (اقتراح جلسات بالذكاء الاصطناعي)", False, False, True),
    ("هوية الأكاديمية كاملة (لوجو وألوان)", False, False, True),
    ("دعم ذو أولوية", False, False, True),
]

MEMBER_ROWS = [
    ("لوحة التحكم والملف الشخصي وكود QR للحضور", True, True),
    ("سجل الحضور والحصص", True, True),
    ("تقويم الجلسات وتفاصيل الحصة والتقييمات", True, True),
    ("الإعلانات وجرس الإشعارات وإشعارات المتصفح", True, True),
    ("البحث في الأكاديميات والتقييم والانضمام", True, True),
    ("تصفح الجيمز والانضمام وإنشاء جيم", True, True),
    ("دليل الأعضاء والبلاغات والحظر", True, True),
    ("الخريطة", True, True),
    ("تصفح وحجز جلسات السوق", True, True),
    ("شارة Pro على البروفايل", False, True),
    ("تصدير التقويم (ICS)", False, True),
    ("جيمز متكررة + تسجيل نتائج الجيمز", False, True),
    ("الفعاليات والبطولات", False, True),
    ("لوحة الشرف الإقليمية", False, True),
    ("الاستكشاف (Scouting)", False, True),
]


# ── ODF helpers ────────────────────────────────────────────────
def esc(s: str) -> str:
    return escape(s)


def p(style: str, content: str) -> str:
    return f'<text:p text:style-name="{style}">{content}</text:p>'


def sp(style: str, content: str) -> str:
    return f'<text:span text:style-name="{style}">{content}</text:span>'


def cell_p(style: str, cell) -> str:
    """Render a comparison-table cell value."""
    if cell is True:
        return p(style, sp("TCheck", "✔"))
    if cell is False:
        return p(style, sp("TMute", "—"))
    return p(style, esc(str(cell)))


# ── Automatic styles ───────────────────────────────────────────
def para(name, *, size=10.5, weight="normal", color="#1c2b3a", align="start",
         bg=None, before="0.10cm", after="0.10cm", line="150%", border=None,
         padding=None, break_before=False, keep=False):
    props = [
        f'fo:break-before="page"' if break_before else None,
        f'fo:margin-top="{before}"',
        f'fo:margin-bottom="{after}"',
        f'fo:line-height="{line}"',
        f'fo:text-align="{align}"',
        f'fo:background-color="{bg}"' if bg else None,
        f'fo:border="{border}"' if border else None,
        f'fo:padding="{padding}"' if padding else None,
        f'fo:keep-with-next="{keep}"' if keep else None,
    ]
    props = [x for x in props if x]
    return f'''<style:style style:name="{name}" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties style:writing-mode="rl-tb" {' '.join(props)}/>
  <style:text-properties style:font-name-complex="{FONT}" fo:font-family="{FONT}"
    fo:font-size="{size}pt" style:font-size-complex="{size}pt"
    fo:font-weight="{weight}" style:font-weight-complex="{weight}"
    fo:color="{color}" fo:language="ar" fo:country="EG"/>
</style:style>'''


def text_style(name, *, size=10.5, weight="normal", color="#1c2b3a"):
    return (f'<style:style style:name="{name}" style:family="text">'
            f'<style:text-properties style:font-name-complex="{FONT}" fo:font-family="{FONT}" '
            f'fo:font-size="{size}pt" style:font-size-complex="{size}pt" '
            f'fo:font-weight="{weight}" style:font-weight-complex="{weight}" fo:color="{color}" '
            f'fo:language="ar" fo:country="EG"/></style:style>')


def cell_style(name, *, bg="transparent", pad="0.06cm"):
    return (f'<style:style style:name="{name}" style:family="table-cell">'
            f'<style:table-cell-properties fo:background-color="{bg}" '
            f'fo:border="0.5pt solid {BORDER}" fo:padding="{pad}" '
            f'style:writing-mode="rl-tb" fo:vertical-align="middle"/></style:style>')


def col_style(name, width):
    return (f'<style:style style:name="{name}" style:family="table-column">'
            f'<style:table-column-properties style:column-width="{width}"/></style:style>')


def table_style(name):
    return (f'<style:style style:name="{name}" style:family="table">'
            f'<style:table-properties style:width="18.2cm" table:align="margins" '
            f'style:writing-mode="rl-tb"/></style:style>')


def cell(name, style, spanned=1, content=""):
    span_open = f' table:number-columns-spanned="{spanned}"' if spanned > 1 else ""
    return (f'<table:table-cell table:style-name="{style}"{span_open} '
            f'office:value-type="string">{content}</table:table-cell>')


def build_rows(rows, highlight_col=4):
    """Comparison rows for the academy table (4 columns)."""
    out = []
    for row in rows:
        if row[0] == "cat":
            out.append(
                '<table:table-row>'
                + cell("c", "ceCat", 4, p("PCat", esc(row[1])))
                + "</table:table-row>"
            )
        else:
            feat, *vals = row
            cells = [cell("c", "ceFeat", 1, p("PCellFeat", esc(feat)))]
            for i, v in enumerate(vals, start=2):
                cs = "ceHi" if i == highlight_col else "ceStd"
                ps = "PCellHi" if i == highlight_col else "PCell"
                cells.append(cell("c", cs, 1, cell_p(ps, v)))
            out.append("<table:table-row>" + "".join(cells) + "</table:table-row>")
    return "\n".join(out)


def build_member_rows(rows):
    out = []
    for feat, free, pro in rows:
        out.append(
            "<table:table-row>"
            + cell("c", "ceFeat", 1, p("PCellFeat", esc(feat)))
            + cell("c", "ceStd", 1, cell_p("PCell", free))
            + cell("c", "ceHi", 1, cell_p("PCellHi", pro))
            + "</table:table-row>"
        )
    return "\n".join(out)


# ── Document ───────────────────────────────────────────────────
def build_fodt() -> str:
    auto = []
    # Paragraph styles
    auto.append(para("PTitle", size=26, weight="bold", color=NAVY, before="0.1cm", after="0.05cm", line="1.05cm"))
    auto.append(para("PSub", size=12, color=GRAY, after="0.35cm", line="0.55cm"))
    auto.append(para("PBanner", size=13, weight="bold", color="#ffffff", bg=GREEN, align="center",
                     before="0.35cm", after="0.05cm", padding="0.28cm", keep=True))
    auto.append(para("PBanner2", size=10, color="#ffffff", bg=GREEN, align="center",
                     before="0cm", after="0.4cm", padding="0.25cm", line="135%"))
    auto.append(para("PH2", size=15, weight="bold", color=NAVY, before="0.35cm", after="0.12cm", keep=True, line="0.65cm"))
    auto.append(para("PBody", size=10.5, before="0.08cm", after="0.08cm"))
    auto.append(para("PNum", size=10, before="0.11cm", after="0.11cm", line="0.52cm"))
    auto.append(para("PNote", size=9, color=NAVY, bg=LIGHT, border=f'0.8pt solid {BORDER}',
                     padding="0.25cm", before="0.3cm", after="0.3cm", line="0.46cm"))
    auto.append(para("PCardName", size=13, weight="bold", color=NAVY, align="center", before="0.12cm", after="0.02cm", line="0.55cm"))
    auto.append(para("PCardPrice", size=17, weight="bold", color=GREEN_DK, align="center", before="0.05cm", after="0.02cm", line="0.7cm"))
    auto.append(para("PCardPriceSub", size=8, color=GRAY, align="center", before="0cm", after="0.15cm", line="0.35cm"))
    auto.append(para("PFeat", size=8.8, before="0.05cm", after="0.05cm", line="0.42cm"))
    auto.append(para("PSmall", size=8.5, color=GRAY, before="0.2cm", after="0.08cm"))
    auto.append(para("PCat", size=9, weight="bold", color=NAVY, before="0.03cm", after="0.03cm", line="0.42cm"))
    auto.append(para("PCell", size=8.8, align="center", before="0.02cm", after="0.02cm", line="0.42cm"))
    auto.append(para("PCellHi", size=8.8, weight="bold", color=GREEN_DK, align="center", before="0.02cm", after="0.02cm", line="0.42cm"))
    auto.append(para("PCellFeat", size=8.8, before="0.02cm", after="0.02cm", line="0.42cm"))
    auto.append(para("PHead", size=9.5, weight="bold", color="#ffffff", align="center", before="0.03cm", after="0.03cm", line="0.45cm"))
    auto.append(para("PPageBreak", size=1, before="0cm", after="0cm", break_before=True))

    # Text styles
    auto.append(text_style("TCheck", size=11, weight="bold", color=GREEN))
    auto.append(text_style("TMute", size=10, color="#9aa7b5"))
    auto.append(text_style("TBoldNavy", size=10.5, weight="bold", color=NAVY))
    auto.append(text_style("TGreen", size=10.5, weight="bold", color=GREEN_DK))
    auto.append(text_style("TWhite", size=13, weight="bold", color="#ffffff"))
    auto.append(text_style("TGray", size=9.5, color=GRAY))
    auto.append(text_style("TCardName", size=14, weight="bold", color=NAVY))
    auto.append(text_style("TGm", size=10, weight="bold", color=GRAY))

    # Table + column + cell styles
    auto.append(table_style("TComp"))
    auto.append(table_style("TMember"))
    for n, w in [("coFeat", "6.4cm"), ("co3", "3.93cm"), ("co2", "5.6cm"),
                 ("coCard", "6.06cm"), ("coCardE", "6.06cm")]:
        auto.append(col_style(n, w))
    auto.append(cell_style("ceHead", bg=NAVY))
    auto.append(cell_style("ceCat", bg=CAT_BG))
    auto.append(cell_style("ceFeat", bg="#ffffff"))
    auto.append(cell_style("ceStd", bg="#ffffff"))
    auto.append(cell_style("ceHi", bg=GREEN_BG))
    auto.append(cell_style("ceCard", bg=LIGHT))
    auto.append(cell_style("ceCardE", bg=GREEN_BG))

    # Page layout with footer
    auto.append('''<style:page-layout style:name="pm1">
  <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"
    style:print-orientation="portrait" fo:margin-top="1.15cm" fo:margin-bottom="0.95cm"
    fo:margin-left="1.3cm" fo:margin-right="1.3cm" style:writing-mode="rl-tb"/>
</style:page-layout>''')

    footer = p(
        "PFoot",
        "بلايزا Playza · باقات وأسعار · سبتمبر 2026 · الأسعار بالجنيه المصري ومرجعية لتاريخ المستند",
    )
    auto.append(para("PFoot", size=8, color=GRAY, align="center", before="0cm", after="0cm"))
    auto.append(f'''<style:master-page style:name="Standard" style:page-layout-name="pm1">
  <style:footer>{footer}</style:footer>
</style:master-page>''')

    # ── Page 1: cover + explainer ──
    body = []
    body.append(p("PTitle", "باقات بلايزا: الأسعار والمميزات"))
    body.append(p("PSub", "كل اللي محتاج تعرفه عن باقات الأعضاء وباقات الأكاديميات — بالمصري وببساطة."))
    body.append(p("PBanner", sp("TWhite", "🎁 تجربة مجانية 30 يوم على باقة Enterprise")))
    body.append(p(
        "PBanner2",
        "من غير كريدت كارد ولا أي التزام. أول ما تنشئ أكاديميتك بتاخد المنصة كاملة بباقاتها أعلى لمدة شهر، "
        "ولو ما اشتركتش بعد التجربة بترجع تلقائيًا للباقة المجانية من غير ما يتسحب منك جنيه.",
    ))
    body.append(p("PH2", "قبل ما نقارن: فيه 3 حاجات مختلفة اسمها «اشتراك» — متخلطش بينهم"))
    body.append(p("PNum", sp("TGreen", "1) خطة تدريب الأكاديمية: ") + "دي اللي أنت بتحددها كصاحب أكاديمية على أعضائك — سعر الشهر وعدد الحصص. "
                 + "دي فلوس تدريب الأطفال، وبتتحصّل وتتجدد من غير تدخل المنصة، ومش داخلة في سعر أي باقة هنا."))
    body.append(p("PNum", sp("TGreen", "2) باقة العضو (للاعب): ") + "للعضو نفسه — Free أو Pro. "
                 + "بتفتح مميزات المجتمع والمنافسة زي الجيمز المتكررة ولوحة الشرف والفعاليات والاستكشاف."))
    body.append(p("PNum", sp("TGreen", "3) باقة الأكاديمية (لصاحب الأكاديمية): ") + "ستارتر مجانية أو Plus أو Enterprise. "
                 + "دي اللي بتحدد أدوات إدارة الأكاديمية وحدودها: عدد الملاعب والمدربين، الحضور والمدفوعات، البطولات، والذكاء الاصطناعي."))
    body.append(p("PNote", sp("TBoldNavy", "مهم: ") + "اشتراك Pro للأعضاء أو باقة Enterprise للأكاديمية مش معناه إن تدريب الأطفال بقى مجاني أو مشمول. "
                 + "فلوس التدريب وإيجار الملاعب بقايم منفصلة بتحددها الأكاديمية بنفسها."))
    body.append(p("PSmall", "داخل المستند: صفحة 2 باقات الأكاديمية بالتفصيل · صفحة 3 جدول مقارنة باقات الأكاديمية · صفحة 4 باقات الأعضاء Free و Pro."))

    # ── Page 2: academy cards ──
    body.append(p("PPageBreak", ""))
    body.append(p("PH2", "باقات الأكاديمية — لصاحب الأكاديمية"))

    def card(paras: str, cellstyle: str) -> str:
        return f'<table:table-cell table:style-name="{cellstyle}" office:value-type="string">{paras}</table:table-cell>'

    starter_card = card(
        p("PCardName", "ستارتر (مجانية)")
        + p("PCardPrice", "0 " + sp("TGm", "ج.م"))
        + p("PCardPriceSub", "مجانية للأبد — من غير بطاقة")
        + p("PFeat", sp("TGreen", "• ") + "للمين؟ أكاديمية صغيرة بتبدأ وبتجرب المنصة.")
        + p("PFeat", sp("TGreen", "• ") + "أعضاء بلا حدود وأدوار كاملة.")
        + p("PFeat", sp("TGreen", "• ") + "ملعب واحد ومدرب واحد.")
        + p("PFeat", sp("TGreen", "• ") + "جدول تدريب وحجوزات وإلغاء.")
        + p("PFeat", sp("TGreen", "• ") + "خريطة الاكتشاف والإشعارات.")
        + p("PFeat", sp("TGreen", "• ") + "تصفح الجيمز والانضمام ليها."),
        "ceCard",
    )
    plus_card = card(
        p("PCardName", "بلس Plus")
        + p("PCardPrice", "600 " + sp("TGm", "ج.م/شهر"))
        + p("PCardPriceSub", "أو 6,000 ج.م في السنة (وفّر 600 ج.م)")
        + p("PFeat", sp("TGreen", "• ") + "للمين؟ أكاديمية بتكبر وعندها أكتر من ملعب.")
        + p("PFeat", sp("TGreen", "• ") + "حتى 3 ملاعب/فروع ومدربين بلا حدود.")
        + p("PFeat", sp("TGreen", "• ") + "حضور QR ومدفوعات ومصاريف.")
        + p("PFeat", sp("TGreen", "• ") + "جداول متكررة وجلسات ضيوف.")
        + p("PFeat", sp("TGreen", "• ") + "تحليلات وملخصات مالية وتصدير CSV.")
        + p("PFeat", sp("TGreen", "• ") + "إعلانات ومباريات ودية ولوحة شرف."),
        "ceCard",
    )
    elite_card = card(
        p("PCardName", "إنتربرايز Enterprise")
        + p("PCardPrice", "999 " + sp("TGm", "ج.م/شهر"))
        + p("PCardPriceSub", "أو 9,990 ج.م في السنة (وفّر 1,000 ج.م)")
        + p("PFeat", sp("TGreen", "• ") + "للمين؟ النوادي والأكاديميات الكبيرة متعددة الفروع.")
        + p("PFeat", sp("TGreen", "• ") + "ملاعب ومدربين بلا حدود.")
        + p("PFeat", sp("TGreen", "• ") + "الفرق والبطولات ونتائج مباشرة وأدوار.")
        + p("PFeat", sp("TGreen", "• ") + "مساعد المدرب الذكي: تخطيط جلسات التدريب بالذكاء الاصطناعي.")
        + p("PFeat", sp("TGreen", "• ") + "توقعات إيرادات وتقارير مجمّعة لكل الفروع.")
        + p("PFeat", sp("TGreen", "• ") + "نشر جلسات في السوق + هوية كاملة ودعم ذو أولوية."),
        "ceCardE",
    )

    body.append(
        '<table:table table:style-name="TCards">'
        '<table:table-column table:style-name="coCard"/><table:table-column table:style-name="coCard"/>'
        '<table:table-column table:style-name="coCard"/>'
        + '<table:table-row>' + starter_card + plus_card + elite_card + '</table:table-row>'
        + "</table:table>"
    )
    body.append(p("PSmall", "💡 الأكاديمية الجديدة بتاخد تجربة 30 يوم على Enterprise من غير كريدت كارد. بعد التجربة بترجع تلقائيًا للمجانية، "
                 + "أو تقدر تشترك في Plus أو Enterprise من صفحة الترقية داخل التطبيق. الدفع بإنستاباي أو المحفظة الإلكترونية."))

    # ── Page 3: academy comparison table ──
    body.append(p("PPageBreak", ""))
    body.append(p("PH2", "جدول مقارنة باقات الأكاديمية"))
    head_row = (
        "<table:table-header-rows><table:table-row>"
        + cell("c", "ceHead", 1, p("PHead", "الميزة"))
        + cell("c", "ceHead", 1, p("PHead", "ستارتر (مجانية)"))
        + cell("c", "ceHead", 1, p("PHead", "بلس Plus"))
        + cell("c", "ceHead", 1, p("PHead", "إنتربرايز Enterprise"))
        + "</table:table-row></table:table-header-rows>"
    )
    body.append(
        '<table:table table:style-name="TComp">'
        '<table:table-column table:style-name="coFeat"/>'
        '<table:table-column table:style-name="co3"/>'
        '<table:table-column table:style-name="co3"/>'
        '<table:table-column table:style-name="co3"/>'
        + head_row + build_rows(ACADEMY_ROWS)
        + "</table:table>"
    )

    # ── Page 4: member plans ──
    body.append(p("PPageBreak", ""))
    body.append(p("PH2", "باقات الأعضاء — للاعب"))

    free_card = card(
        p("PCardName", "Free (مجانية)")
        + p("PCardPrice", "0 " + sp("TGm", "ج.م"))
        + p("PCardPriceSub", "مجانية للأبد")
        + p("PFeat", sp("TGreen", "• ") + "لوحة التحكم والملف الشخصي و QR الحضور.")
        + p("PFeat", sp("TGreen", "• ") + "تقويم الجلسات وتفاصيلها والتقييمات.")
        + p("PFeat", sp("TGreen", "• ") + "البحث في الأكاديميات والانضمام.")
        + p("PFeat", sp("TGreen", "• ") + "تصفح الجيمز والانضمام وإنشاء جيم."),
        "ceCard",
    )
    pro_card = card(
        p("PCardName", "Pro")
        + p("PCardPrice", "100 " + sp("TGm", "ج.م/شهر"))
        + p("PCardPriceSub", "أو 500 ج.م لـ6 شهور · أو 1,000 ج.م في السنة")
        + p("PFeat", sp("TGreen", "• ") + "كل مميزات الـFree زي ما هي.")
        + p("PFeat", sp("TGreen", "• ") + "جيمز متكررة وتسجيل نتائج.")
        + p("PFeat", sp("TGreen", "• ") + "الفعاليات والبطولات ولوحة الشرف الإقليمية.")
        + p("PFeat", sp("TGreen", "• ") + "الاستكشاف (Scouting) + شارة Pro + تصدير التقويم."),
        "ceCard",
    )
    body.append(
        '<table:table table:style-name="TCards2">'
        '<table:table-column table:style-name="co2"/><table:table-column table:style-name="co2"/>'
        + '<table:table-row>' + free_card + pro_card + '</table:table-row>'
        + "</table:table>"
    )

    body.append(p("PH2", "جدول مقارنة باقات الأعضاء"))
    head2 = (
        "<table:table-header-rows><table:table-row>"
        + cell("c", "ceHead", 1, p("PHead", "الميزة"))
        + cell("c", "ceHead", 1, p("PHead", "Free"))
        + cell("c", "ceHead", 1, p("PHead", "Pro"))
        + "</table:table-row></table:table-header-rows>"
    )
    body.append(
        '<table:table table:style-name="TMember">'
        '<table:table-column table:style-name="coFeat"/>'
        '<table:table-column table:style-name="co2"/>'
        '<table:table-column table:style-name="co2"/>'
        + head2 + build_member_rows(MEMBER_ROWS)
        + "</table:table>"
    )
    body.append(p("PNote", sp("TBoldNavy", "افتكر: ") + "باقة العضو دي بتاعة المنصة (المجتمع والمتابعة)، ومالهاش دعوة بالتدريب داخل الأكاديمية — "
                 + "اشتراك التدريب وعدد حصصه بيحددهم صاحب الأكاديمية بأسعاره هو."))
    body.append(p("PSmall", "الأسعار دي مرجعية من إعدادات التطبيق وقت إعداد المستند (سبتمبر 2026) وممكن تتغير، ودي مش عرض سعر ملزم. "
                 + "للأسعار المحدّثة افتح صفحة الترقية داخل التطبيق."))

    cards_style = table_style("TCards")
    cards_style2 = table_style("TCards2")

    auto.append(cards_style)
    auto.append(cards_style2)

    ns = (
        'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
        'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
        'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
        'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
        'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" '
        'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
        'xmlns:xlink="http://www.w3.org/1999/xlink" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" '
        'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" '
        'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" '
        'xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2"'
    )

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<office:document {ns} office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:meta><dc:title>باقات بلايزا — أسعار ومميزات</dc:title></office:meta>
<office:font-face-decls>
  <style:font-face style:name="{FONT}" svg:font-family="'{FONT}'" style:font-family-generic="swiss" style:font-pitch="variable"/>
</office:font-face-decls>
<office:styles>
  <style:default-style style:family="paragraph">
    <style:paragraph-properties style:writing-mode="rl-tb"/>
    <style:text-properties style:font-name-complex="{FONT}" fo:font-family="{FONT}"
      fo:font-size="10.5pt" style:font-size-complex="10.5pt" fo:language="ar" fo:country="EG"/>
  </style:default-style>
  <style:style style:name="Standard" style:family="paragraph"/>
</office:styles>
<office:automatic-styles>
{''.join(auto)}
</office:automatic-styles>
<office:master-styles>
  <style:master-page style:name="Standard" style:page-layout-name="pm1">
    <style:footer>{p("PFoot", "بلايزا Playza · باقات وأسعار · سبتمبر 2026 · الأسعار بالجنيه المصري")}</style:footer>
  </style:master-page>
</office:master-styles>
<office:body><office:text>
{p("PB0", "")}
{''.join(body)}
</office:text></office:body>
</office:document>'''


def main() -> int:
    auto_extra = para("PB0", size=1, before="0cm", after="0cm")  # tiny spacer
    fodt = build_fodt()
    # inject the spacer style
    fodt = fodt.replace("</office:automatic-styles>", auto_extra + "\n</office:automatic-styles>")

    fodt_path = os.path.join(HERE, "Playza-Plans-Egyptian-Arabic.fodt")
    with open(fodt_path, "w", encoding="utf-8") as f:
        f.write(fodt)
    print(f"wrote {fodt_path}")

    cmd = [
        "soffice", "--headless",
        "-env:UserInstallation=file:///tmp/lo_playza_pdf",
        "--convert-to", "pdf", "--outdir", HERE, fodt_path,
    ]
    print(" ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    print(r.stdout.strip() or r.stderr.strip())
    pdf_path = os.path.join(HERE, "Playza-Plans-Egyptian-Arabic.pdf")
    if not os.path.exists(pdf_path):
        print("ERROR: PDF was not produced", file=sys.stderr)
        return 1
    size = os.path.getsize(pdf_path)
    print(f"OK: {pdf_path} ({size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
