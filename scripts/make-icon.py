#!/usr/bin/env python3
"""
Generates the application icon as a 1024x1024 PNG, with no third-party
dependencies: a dark rounded square carrying a rising yield curve.

Used by scripts/build-desktop-app.sh, which converts the PNG into an .icns
with the macOS built-ins `sips` and `iconutil`.
"""

import math
import struct
import sys
import zlib

SIZE = 1024
CORNER = 225.0  # macOS "squircle" corner radius at 1024px

BACKGROUND_TOP = (15, 23, 42)  # slate-900
BACKGROUND_BOTTOM = (30, 58, 138)  # blue-900
CURVE = (56, 189, 248)  # sky-400
BASELINE = (100, 116, 139)  # slate-500


def rounded_rect_coverage(x: float, y: float) -> float:
    """Anti-aliased coverage of a rounded square, 0 outside, 1 inside."""
    margin = 40.0
    left, top = margin, margin
    right, bottom = SIZE - margin, SIZE - margin

    cx = min(max(x, left + CORNER), right - CORNER)
    cy = min(max(y, top + CORNER), bottom - CORNER)
    distance = math.hypot(x - cx, y - cy)

    if x < left or x > right or y < top or y > bottom:
        return 0.0
    return max(0.0, min(1.0, CORNER - distance + 0.5)) if distance > 0 else 1.0


def curve_y(x: float) -> float:
    """A yield curve: rising, concave, flattening at the long end."""
    t = (x - 180.0) / 664.0
    t = max(0.0, min(1.0, t))
    return 720.0 - 360.0 * (t ** 0.62)


def stroke_coverage(x: float, y: float, half_width: float) -> float:
    """Vertical distance to the curve, softened into an alpha ramp."""
    if x < 180 or x > 860:
        return 0.0
    distance = abs(y - curve_y(x))
    return max(0.0, min(1.0, half_width - distance + 0.5))


def blend(base, layer, alpha):
    return tuple(round(b + (l - b) * alpha) for b, l in zip(base, layer))


def build_rows():
    for y in range(SIZE):
        row = bytearray()
        gradient = y / (SIZE - 1)
        background = tuple(
            round(a + (b - a) * gradient) for a, b in zip(BACKGROUND_TOP, BACKGROUND_BOTTOM)
        )
        for x in range(SIZE):
            coverage = rounded_rect_coverage(x + 0.5, y + 0.5)
            if coverage <= 0.0:
                row += b"\x00\x00\x00\x00"
                continue

            colour = background

            # Baseline axis.
            if 180 <= x <= 860 and abs(y - 790) <= 5:
                colour = blend(colour, BASELINE, min(1.0, 5.5 - abs(y - 790)))

            # The curve itself, with a soft glow beneath it.
            glow = stroke_coverage(x + 0.5, y + 0.5, 34.0)
            if glow > 0:
                colour = blend(colour, CURVE, 0.18 * glow)
            line = stroke_coverage(x + 0.5, y + 0.5, 13.0)
            if line > 0:
                colour = blend(colour, CURVE, line)

            row += bytes(colour) + bytes((round(255 * coverage),))
        yield bytes(row)


def write_png(path: str) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + row for row in build_rows())
    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    with open(path, "wb") as handle:
        handle.write(
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b"")
        )


if __name__ == "__main__":
    write_png(sys.argv[1] if len(sys.argv) > 1 else "icon.png")
