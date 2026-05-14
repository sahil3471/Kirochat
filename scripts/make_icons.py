"""Generate solid-color PNG icons with a centered rounded square, using only stdlib."""
import struct, zlib, os, sys

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
OUT_DIR = os.path.abspath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)


def make_png(path, size, bg, fg):
    w = h = size
    margin = size // 8
    inner = size - 2 * margin
    radius = inner // 5
    cx_left = margin + radius
    cx_right = size - margin - radius - 1
    cy_top = margin + radius
    cy_bot = size - margin - radius - 1

    pixels = bytearray()
    for y in range(h):
        pixels.append(0)  # filter byte per row
        for x in range(w):
            if x < margin or x >= size - margin or y < margin or y >= size - margin:
                r, g, b, a = bg
            else:
                in_corner = False
                if x < cx_left and y < cy_top:
                    in_corner = (cx_left - x) ** 2 + (cy_top - y) ** 2 > radius ** 2
                elif x > cx_right and y < cy_top:
                    in_corner = (x - cx_right) ** 2 + (cy_top - y) ** 2 > radius ** 2
                elif x < cx_left and y > cy_bot:
                    in_corner = (cx_left - x) ** 2 + (y - cy_bot) ** 2 > radius ** 2
                elif x > cx_right and y > cy_bot:
                    in_corner = (x - cx_right) ** 2 + (y - cy_bot) ** 2 > radius ** 2
                r, g, b, a = (bg if in_corner else fg)
            pixels.extend([r, g, b, a])

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(pixels), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


BG = (15, 23, 42, 255)        # slate-900
FG = (251, 146, 60, 255)      # orange-400

make_png(os.path.join(OUT_DIR, "icon-192.png"), 192, BG, FG)
make_png(os.path.join(OUT_DIR, "icon-512.png"), 512, BG, FG)
make_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180, BG, FG)
make_png(os.path.join(OUT_DIR, "favicon-32.png"), 32, BG, FG)
