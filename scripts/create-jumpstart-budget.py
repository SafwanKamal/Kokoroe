from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "grants"
W, H = 1650, 2380

PAPER = "#F6EEDC"
FIELD = "#F9F4E8"
INK = "#12110F"
SOFT = "#2C2924"
BLUE = "#176BB3"
CORAL = "#C94E3B"
GREEN = "#2F7D3B"
GOLD = "#C58A16"
GRAY = "#B9AEA0"


def font(size, bold=False):
    path = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf"
    )
    return ImageFont.truetype(path, size)


def text(draw, xy, value, size, fill=INK, bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def wrapped(draw, x, y, width, value, size, fill=SOFT, bold=False, spacing=6):
    words = value.split()
    lines, line = [], ""
    face = font(size, bold)
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textbbox((0, 0), trial, font=face)[2] <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    draw.multiline_text((x, y), "\n".join(lines), font=face, fill=fill, spacing=spacing)
    return y + len(lines) * (size + spacing)


def category(draw, y, title, total, items, accent):
    line_height = 47
    height = 102 + len(items) * line_height
    draw.rounded_rectangle((76, y, 1574, y + height), 10, fill=FIELD, outline=accent, width=5)
    draw.rectangle((76, y, 105, y + height), fill=accent)
    text(draw, (136, y + 22), title.upper(), 26, fill=accent, bold=True)
    text(draw, (1508, y + 22), total, 31, fill=INK, bold=True, anchor="ra")
    item_y = y + 78
    for label, amount in items:
        text(draw, (142, item_y), "•", 26, fill=accent, bold=True)
        text(draw, (174, item_y), label, 24, fill=SOFT)
        text(draw, (1508, item_y), amount, 24, fill=INK, bold=True, anchor="ra")
        item_y += line_height
    return y + height


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)

    text(draw, (76, 62), "KOKOROE", 86, bold=True)
    text(draw, (80, 160), "JumpStart Microgrant Prototype Budget", 38, fill=BLUE, bold=True)
    text(draw, (80, 218), "Requested funding tier: $2,500", 29, fill=SOFT, bold=True)
    wrapped(
        draw,
        80,
        274,
        1470,
        "This budget supports an expanded browser-based MVP for Kokoroe, a manga- and "
        "comic-inspired social messaging platform. Expenses are tied directly to prototype "
        "development, testing, and early product validation. No funds will be used for "
        "founder compensation, travel, or meals.",
        27,
    )

    y = 438
    y = category(
        draw,
        y,
        "Software and Licensing Fees",
        "$700",
        [
            ("Cloud deployment and managed database services for the beta MVP", "$280"),
            ("Limited AI API credits for context classification and opt-in masking tests", "$250"),
            ("Browser, accessibility, and device-testing tools", "$100"),
            ("Design, asset-processing, and development-platform licenses", "$70"),
        ],
        BLUE,
    ) + 22
    y = category(
        draw,
        y,
        "Technical Services",
        "$1,500",
        [
            ("Independent security and privacy review of authentication and messaging", "$300"),
            ("Accessibility and responsive-interface review", "$175"),
            ("Facilitated usability review before broader beta testing", "$175"),
            ("Contracted room-theme illustration refinement for testable chat worlds", "$300"),
            ("Contracted avatar identity-asset refinement", "$250"),
            ("Contracted bubble-shell and comic-style interface-asset refinement", "$300"),
        ],
        CORAL,
    ) + 22
    y = category(
        draw,
        y,
        "Market Analysis and Validation",
        "$300",
        [
            ("Survey and structured beta-feedback tooling after customer discovery", "$120"),
            ("Approved beta-test recruitment or participant incentives", "$180"),
        ],
        GREEN,
    ) + 30

    draw.line((76, y, 1574, y), fill=INK, width=5)
    text(draw, (92, y + 30), "TOTAL REQUEST", 34, fill=INK, bold=True)
    text(draw, (1508, y + 30), "$2,500", 40, fill=INK, bold=True, anchor="ra")

    y += 112
    text(draw, (80, y), "EXPECTED MVP OUTCOME", 29, fill=BLUE, bold=True)
    wrapped(
        draw,
        80,
        y + 48,
        1460,
        "A browser-testable multi-user messaging prototype with polished illustrated worlds, "
        "expressive message presentations, improved reliability and usability, and early "
        "validation of narrowly scoped AI-assisted expression features.",
        25,
    )

    y += 156
    text(draw, (80, y), "BUDGET NOTE", 27, fill=CORAL, bold=True)
    wrapped(
        draw,
        80,
        y + 44,
        1460,
        "Market-validation expenses will be used after customer discovery or I-Corps participation. "
        "Any participant incentives will be used only with Innovation Hub guidance and applicable "
        "Texas Tech approval.",
        24,
    )

    draw.line((76, 2260, 1574, 2260), fill=GRAY, width=3)
    text(draw, (80, 2292), "KOKOROE  |  JUMPSTART FUND APPLICATION 2026", 23, fill=SOFT, bold=True)

    png = OUT / "kokoroe-jumpstart-budget-2500.png"
    pdf = OUT / "kokoroe-jumpstart-budget-2500.pdf"
    canvas.save(png, quality=95)
    canvas.save(pdf, "PDF", resolution=150)
    print(png)
    print(pdf)


if __name__ == "__main__":
    main()
