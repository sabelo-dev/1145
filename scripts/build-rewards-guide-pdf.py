"""Build the downloadable rewards guide PDF from the same content as the
in-app page (src/content/rewards-guide.json).

    pip install reportlab
    python scripts/build-rewards-guide-pdf.py

Writes public/docs/1145-rewards-guide.pdf. Re-run after editing the JSON.
"""

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "content" / "rewards-guide.json"
OUTPUT = ROOT / "public" / "docs" / "1145-rewards-guide.pdf"

# App design tokens (src/index.css)
BRAND = colors.HexColor("#1E3A5F")
TEXT = colors.HexColor("#202532")
MUTED = colors.HexColor("#66707F")
RULE = colors.HexColor("#DDE2EA")
TINT = colors.HexColor("#EEF2F7")

def style(name, bold=False, **overrides):
    """ParagraphStyle on the shared base; keyword overrides win."""
    opts = {"fontName": "Helvetica-Bold" if bold else "Helvetica", "textColor": TEXT, "alignment": TA_LEFT}
    opts.update(overrides)
    return ParagraphStyle(name, **opts)


S = {
    "eyebrow": style("eyebrow", bold=True, fontSize=9, leading=12, textColor=BRAND, spaceAfter=4),
    "title": style("title", bold=True, fontSize=26, leading=31, spaceAfter=4),
    "subtitle": style("subtitle", fontSize=13, leading=17, textColor=MUTED, spaceAfter=4),
    "meta": style("meta", fontSize=8.5, leading=11, textColor=MUTED, spaceAfter=10),
    "intro": style("intro", fontSize=11, leading=16, spaceAfter=6),
    "h2": style("h2", bold=True, fontSize=15, leading=19, textColor=BRAND, spaceBefore=14, spaceAfter=6),
    "body": style("body", fontSize=10, leading=14.5, textColor=MUTED, spaceAfter=6),
    "li": style("li", fontSize=10, leading=14.5),
    "th": style("th", bold=True, fontSize=9, leading=12, textColor=colors.white),
    "td": style("td", fontSize=9, leading=12.5),
    "td_bold": style("td_bold", bold=True, fontSize=9, leading=12.5),
    "note": style("note", fontSize=9.5, leading=13.5),
    "q": style("q", bold=True, fontSize=10, leading=14, spaceBefore=6),
    "a": style("a", fontSize=10, leading=14.5, textColor=MUTED),
}


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def table(spec, width):
    cols = spec["columns"]
    # First column wider; description-like last column wider still.
    if len(cols) == 3:
        widths = [0.27, 0.16, 0.57]
    else:
        widths = [0.46, 0.16, 0.19, 0.19]
    data = [[Paragraph(esc(c), S["th"]) for c in cols]]
    for row in spec["rows"]:
        data.append([Paragraph(esc(cell), S["td_bold"] if i == 0 else S["td"]) for i, cell in enumerate(row)])
    t = Table(data, colWidths=[w * width for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TINT]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(esc(i), S["li"]), leftIndent=12, value="circle") for i in items],
        bulletType="bullet", start="•", leftIndent=12, bulletFontSize=8, bulletColor=BRAND, spaceAfter=6,
    )


def note(text, width):
    t = Table([[Paragraph(esc(text), S["note"])]], colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TINT),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def on_page(guide):
    def draw(canvas, doc):
        canvas.saveState()
        w, h = A4
        canvas.setFillColor(BRAND)
        canvas.rect(0, h - 6 * mm, w, 6 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, 12 * mm, f"{guide['title']}  |  Last updated {guide['updated']}  |  1145.io/rewards-guide")
        canvas.drawRightString(w - doc.rightMargin, 12 * mm, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def build():
    guide = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=22 * mm,
        title=guide["title"], subject=guide["subtitle"], author="1145 Lifestyle", creator="1145 Lifestyle",
    )
    width = doc.width
    story = [
        Paragraph("UCOIN", S["eyebrow"]),
        Paragraph(esc(guide["title"]), S["title"]),
        Paragraph(esc(guide["subtitle"]), S["subtitle"]),
        Paragraph(f"Last updated {esc(guide['updated'])}", S["meta"]),
        Paragraph(esc(guide["intro"]), S["intro"]),
    ]

    for section in guide["sections"]:
        block = [Paragraph(esc(section["title"]), S["h2"])]
        for item in section.get("list", []) and [bullets(section["list"])]:
            block.append(item)
        for p in section.get("body", []):
            block.append(Paragraph(esc(p), S["body"]))
        # Keep the heading with its first content so it never ends a page.
        story.append(KeepTogether(block))
        if "table" in section:
            story.append(Spacer(1, 2))
            story.append(table(section["table"], width))
        if "note" in section:
            story.append(Spacer(1, 6))
            story.append(note(section["note"], width))
        for q, a in section.get("faq", []):
            story.append(KeepTogether([Paragraph(esc(q), S["q"]), Paragraph(esc(a), S["a"])]))

    doc.build(story, onFirstPage=on_page(guide), onLaterPages=on_page(guide))
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
