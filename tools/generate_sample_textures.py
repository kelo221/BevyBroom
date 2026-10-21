"""Writes the sample game's procedural textures into assets/textures (pure Python, no deps).

Run from the workspace root: python tools/generate_sample_textures.py
"""

import math
import os
import struct
import zlib

SIZE = 256
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "textures")


def write_png(name, pixels, channels):
    """Writes rows of byte tuples as an 8-bit RGB or RGBA PNG."""
    color_type = 6 if channels == 4 else 2
    raw = b"".join(b"\x00" + bytes(value for pixel in row for value in pixel) for row in pixels)

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, color_type, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(os.path.join(OUT, name), "wb") as file:
        file.write(data)


def noise(x, y, seed):
    """Cheap deterministic value noise in 0..1."""
    value = math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
    return value - math.floor(value)


def clamp(value):
    """Clamps to a byte."""
    return max(0, min(255, int(value)))


def brick_height(x, y):
    """1 on brick faces, 0 in mortar; tiles seamlessly at SIZE."""
    rows = 8
    row_height = SIZE / rows
    row = int(y // row_height)
    offset = (row % 2) * (SIZE / 8)
    brick_width = SIZE / 4
    local_x = (x + offset) % brick_width
    local_y = y % row_height
    mortar = 3
    edge = min(local_x, brick_width - local_x, local_y, row_height - local_y)
    return max(0.0, min(1.0, (edge - mortar) / 3.0)), row, int((x + offset) // brick_width)


def castle_wall():
    """Stone bricks: base color and a matching tangent-space normal map (+Y up)."""
    base, normal = [], []
    for y in range(SIZE):
        base_row, normal_row = [], []
        for x in range(SIZE):
            height, row, column = brick_height(x, y)
            tint = 0.75 + 0.25 * noise(row, column, 1)
            grain = 0.85 + 0.15 * noise(x, y, 2)
            stone = (150 * tint * grain, 140 * tint * grain, 125 * tint * grain)
            mortar = (90 * grain, 88 * grain, 82 * grain)
            mix = height
            base_row.append(tuple(clamp(m + (s - m) * mix) for s, m in zip(stone, mortar)))
            dx = brick_height((x + 1) % SIZE, y)[0] - brick_height((x - 1) % SIZE, y)[0]
            dy = brick_height(x, (y - 1) % SIZE)[0] - brick_height(x, (y + 1) % SIZE)[0]
            nx, ny, nz = -dx * 2.0, -dy * 2.0, 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            normal_row.append(tuple(clamp((c / length * 0.5 + 0.5) * 255) for c in (nx, ny, nz)))
        base.append(base_row)
        normal.append(normal_row)
    write_png("castle_wall_base.png", base, 3)
    write_png("castle_wall_normal.png", normal, 3)


def floor_planks():
    """Wooden planks running along U."""
    pixels = []
    for y in range(SIZE):
        row = []
        plank = y // 32
        for x in range(SIZE):
            seam = (y % 32) < 2 or ((x + plank * 97) % 256) < 2
            ring = 0.5 + 0.5 * math.sin((y % 32) * 0.6 + math.sin(x * 0.05 + plank) * 2.0)
            tone = 0.8 + 0.2 * noise(plank, 0, 3)
            if seam:
                row.append((40, 28, 18))
            else:
                row.append((clamp((120 + 40 * ring) * tone), clamp((80 + 25 * ring) * tone), clamp((45 + 15 * ring) * tone)))
        pixels.append(row)
    write_png("floor_planks_base.png", pixels, 3)


def ivy():
    """Leaves with transparent gaps for alpha testing."""
    pixels = []
    for y in range(SIZE):
        row = []
        for x in range(SIZE):
            cell_x, cell_y = x // 32, y // 32
            cx = cell_x * 32 + 16 + (noise(cell_x, cell_y, 4) - 0.5) * 10
            cy = cell_y * 32 + 16 + (noise(cell_x, cell_y, 5) - 0.5) * 10
            distance = math.hypot(x - cx, (y - cy) * 1.4)
            leaf = distance < 13
            shade = 0.6 + 0.4 * noise(cell_x, cell_y, 6)
            row.append((clamp(40 * shade), clamp(120 * shade), clamp(35 * shade), 255 if leaf else 0))
        pixels.append(row)
    write_png("ivy_base.png", pixels, 4)


def metal_panel():
    """Riveted metal: base color and glTF metallic-roughness (G roughness, B metallic)."""
    base, metal = [], []
    for y in range(SIZE):
        base_row, metal_row = [], []
        for x in range(SIZE):
            px, py = x % 128, y % 128
            rivet = min(math.hypot(px - cx, py - cy) for cx in (12, 116) for cy in (12, 116)) < 5
            seam = px < 2 or py < 2
            scratch = noise(x // 2, y, 7)
            value = 150 + 40 * scratch
            if seam:
                value = 60
            base_row.append((clamp(value), clamp(value * 1.02), clamp(value * 1.05)))
            roughness = 0.35 + 0.3 * scratch if not rivet else 0.2
            metal_row.append((0, clamp(roughness * 255), 255 if not seam else 80))
        base.append(base_row)
        metal.append(metal_row)
    write_png("metal_panel_base.png", base, 3)
    write_png("metal_panel_metal_roughness.png", metal, 3)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    castle_wall()
    floor_planks()
    ivy()
    metal_panel()
    print("textures written to", os.path.abspath(OUT))
