#!/usr/bin/env python3
"""Normalize generated UI artwork to an exact game-ready PNG size."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--remove-light-background", action="store_true")
    parser.add_argument("--trim", action="store_true")
    return parser.parse_args()


def remove_connected_light_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(pixel: tuple[int, int, int]) -> bool:
        return min(pixel) >= 220 and max(pixel) - min(pixel) <= 20

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    rgba = rgb.convert("RGBA")
    alpha = Image.new("L", rgb.size, 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        offset = y * width
        for x in range(width):
            if visited[offset + x]:
                alpha_pixels[x, y] = 0
    rgba.putalpha(alpha)
    return rgba


def main() -> None:
    args = parse_args()
    image = Image.open(args.input)
    if args.remove_light_background:
        image = remove_connected_light_background(image)
    else:
        image = image.convert("RGBA")

    if args.trim:
        bounds = image.getchannel("A").getbbox()
        if bounds:
            image = image.crop(bounds)

    image = image.resize((args.width, args.height), Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
