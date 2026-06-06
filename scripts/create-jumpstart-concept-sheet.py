from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "grants"
W, H = 1800, 2100

PAPER = "#F6EEDC"
WARM = "#EFE2C7"
FIELD = "#F9F4E8"
INK = "#12110F"
SOFT = "#2C2924"
BLUE = "#176BB3"
GREEN = "#2F7D3B"
CORAL = "#C94E3B"
GOLD = "#C58A16"
YELLOW = "#F1C94C"
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


def wrapped(draw, box, value, size, fill=INK, bold=False, spacing=8):
    x, y, width = box
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


def panel(draw, box, fill=FIELD, outline=INK, width=6):
    draw.rounded_rectangle(box, radius=12, fill=fill, outline=outline, width=width)


def crop(path, size):
    return ImageOps.fit(Image.open(path).convert("RGB"), size, method=Image.Resampling.LANCZOS)


def arrow(draw, start, end, fill=BLUE, width=9):
    draw.line([start, end], fill=fill, width=width)
    x, y = end
    draw.polygon([(x, y), (x - 22, y - 15), (x - 22, y + 15)], fill=fill)


def roadmap_box(draw, x, y, width, height, number, title, body, accent):
    panel(draw, (x, y, x + width, y + height), fill=FIELD, outline=accent, width=7)
    draw.ellipse((x + 22, y + 22, x + 82, y + 82), fill=accent)
    text(draw, (x + 52, y + 52), str(number), 31, fill=FIELD, bold=True, anchor="mm")
    text(draw, (x + 104, y + 28), title, 31, fill=accent, bold=True)
    wrapped(draw, (x + 28, y + 112, width - 56), body, 26, fill=SOFT, spacing=7)


def bubble(draw, x, y, width, height, value, side, accent):
    tail = 30
    if side == "left":
        points = [(x + 28, y + height - 36), (x - tail, y + height + 12), (x + 62, y + height - 12)]
    else:
        points = [(x + width - 28, y + height - 36), (x + width + tail, y + height + 12), (x + width - 62, y + height - 12)]
    draw.polygon(points, fill=FIELD, outline=accent)
    panel(draw, (x, y, x + width, y + height), fill=FIELD, outline=accent, width=6)
    wrapped(draw, (x + 24, y + 22, width - 48), value, 29, fill=SOFT, spacing=7)


def ai_layer(draw, x, y, width, number, title, body, accent):
    panel(draw, (x, y, x + width, y + 230), fill=FIELD, outline=accent, width=6)
    draw.ellipse((x + 22, y + 22, x + 80, y + 80), fill=accent)
    text(draw, (x + 51, y + 51), str(number), 28, fill=FIELD, bold=True, anchor="mm")
    text(draw, (x + 100, y + 28), title, 29, fill=accent, bold=True)
    wrapped(draw, (x + 26, y + 106, width - 52), body, 25, fill=SOFT, spacing=6)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)

    # Header
    text(draw, (90, 72), "KOKOROE", 92, fill=INK, bold=True)
    text(draw, (94, 176), "Messaging that grows into a shared visual world", 36, fill=BLUE, bold=True)
    wrapped(
        draw,
        (94, 236, 1560),
        "Kokoroe is a manga- and comic-inspired communication platform. People still write "
        "to each other. The innovation is that conversation can carry more emotion, identity, "
        "and visual imagination as it unfolds.",
        29,
        fill=SOFT,
        spacing=6,
    )

    # Generated concept art: conversation moves between physically separate people.
    concept_path = OUT / "assets" / "kokoroe-messaging-vision-concept.png"
    concept = crop(concept_path, (1620, 500))
    panel(draw, (84, 374, 1716, 886), fill=WARM, outline=INK, width=8)
    canvas.paste(concept, (90, 380))
    draw.rectangle((90, 820, 1710, 880), fill=INK)
    text(draw, (120, 838), "THE CORE IDEA: A MESSAGE CAN BECOME MORE EXPRESSIVE AS THE CONVERSATION UNFOLDS", 26, fill=FIELD, bold=True)

    # Actual exchange
    text(draw, (90, 950), "START WITH PEOPLE TALKING TO EACH OTHER", 39, fill=INK, bold=True)
    text(draw, (90, 1002), "The product is a communication space first. AI remains optional and supports the exchange.", 28, fill=SOFT)
    panel(draw, (90, 1060, 1710, 1358), fill=WARM, outline=INK, width=6)
    draw.ellipse((130, 1100, 236, 1206), fill=BLUE)
    text(draw, (183, 1153), "A", 48, fill=FIELD, bold=True, anchor="mm")
    text(draw, (134, 1224), "FRIEND A", 22, fill=BLUE, bold=True)
    bubble(draw, 274, 1100, 560, 112, "I made it. Save me the window seat?", "left", BLUE)
    draw.ellipse((1564, 1200, 1670, 1306), fill=GREEN)
    text(draw, (1617, 1253), "B", 48, fill=FIELD, bold=True, anchor="mm")
    text(draw, (1535, 1320), "FRIEND B", 22, fill=GREEN, bold=True)
    bubble(draw, 864, 1192, 650, 112, "Already claimed it. Hurry before the bell.", "right", GREEN)

    # AI layers surrounding conversation
    text(draw, (90, 1435), "OPTIONAL AI LAYERS ADD EXPRESSIVE RANGE", 39, fill=INK, bold=True)
    text(draw, (90, 1487), "Different models can support the same conversation at different levels of complexity.", 28, fill=SOFT)
    ai_layer(
        draw,
        90,
        1545,
        508,
        1,
        "PRESENT THE FEELING",
        "Lightweight models interpret tone and context so messages can appear with fitting comic-style expression.",
        BLUE,
    )
    ai_layer(
        draw,
        646,
        1545,
        508,
        2,
        "MASK, WHEN ASKED",
        "A user can ask AI to adapt wording to an avatar and world while preserving the intended meaning.",
        CORAL,
    )
    ai_layer(
        draw,
        1202,
        1545,
        508,
        3,
        "GROW THE WORLD",
        "Longer multi-user context can guide relevant scene art and short comic-style animations as chat evolves.",
        GREEN,
    )

    # Footer
    draw.line((90, 1848, 1710, 1848), fill=GRAY, width=3)
    text(draw, (90, 1880), "CURRENT MVP: GITHUB.COM/SAFWANKAMAL/KOKOROE", 25, fill=INK, bold=True)
    text(draw, (1710, 1880), "KOKOROE  |  HUMAN CONVERSATION, EXPANDED", 24, fill=SOFT, bold=True, anchor="ra")

    png_path = OUT / "kokoroe-jumpstart-concept-sheet.png"
    pdf_path = OUT / "kokoroe-jumpstart-concept-sheet.pdf"
    canvas.save(png_path, quality=95)
    canvas.save(pdf_path, "PDF", resolution=150)
    print(png_path)
    print(pdf_path)


if __name__ == "__main__":
    main()
