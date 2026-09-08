#!/usr/bin/env python3
"""Prepare an ImageGen 2x2 character sheet for Phaser spritesheet loading."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--cell-scale", type=float, default=1.0)
    parser.add_argument("--frame-scales", default="1,1,1,1")
    parser.add_argument("--frame-offset-y", default="0,0,0,0")
    parser.add_argument("--layout-reference", type=Path)
    parser.add_argument("--alpha-reference", type=Path)
    parser.add_argument("--alpha-reference-padding", type=int, default=0)
    parser.add_argument("--remove-light-components-min-size", type=int, default=0)
    parser.add_argument("--remove-light-edge-passes", type=int, default=0)
    parser.add_argument("--resize-cells", action="store_true")
    parser.add_argument("--clear-bottom-top-band", type=int, default=0)
    parser.add_argument("--bottom-seam-band", type=int, default=0)
    parser.add_argument("--top-bottom-arc-depth", type=int, default=0)
    return parser.parse_args()


def is_background(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return min(pixel) >= 218 and max(pixel) - min(pixel) <= 18


def remove_connected_light_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba

    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

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

    result = rgb.convert("RGBA")
    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if visited[row + x]:
                alpha_pixels[x, y] = 0
    result.putalpha(alpha)
    return result


def scale_cells(image: Image.Image, scale: float) -> Image.Image:
    if scale == 1:
        return image
    if not 0 < scale <= 1:
        raise SystemExit("--cell-scale must be greater than 0 and at most 1.")

    width, height = image.size
    cell_width = width // 2
    cell_height = height // 2
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    target_width = max(1, round(cell_width * scale))
    target_height = max(1, round(cell_height * scale))
    for row in range(2):
        for column in range(2):
            left = column * cell_width
            top = row * cell_height
            cell = image.crop((left, top, left + cell_width, top + cell_height))
            cell = cell.resize((target_width, target_height), Image.Resampling.LANCZOS)
            result.alpha_composite(cell, (
                left + (cell_width - target_width) // 2,
                top + (cell_height - target_height) // 2,
            ))
    return result


def resize_cells(image: Image.Image, size: int) -> Image.Image:
    source_width, source_height = image.size
    source_cell_width = source_width // 2
    source_cell_height = source_height // 2
    target_cell_size = size // 2
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for row in range(2):
        for column in range(2):
            cell = image.crop((
                column * source_cell_width,
                row * source_cell_height,
                (column + 1) * source_cell_width,
                (row + 1) * source_cell_height,
            ))
            cell = cell.resize((target_cell_size, target_cell_size), Image.Resampling.LANCZOS)
            result.alpha_composite(cell, (column * target_cell_size, row * target_cell_size))
    return result


def parse_frame_values(raw: str, option: str, cast: type[float] | type[int]) -> list[float] | list[int]:
    try:
        values = [cast(value.strip()) for value in raw.split(",")]
    except ValueError as error:
        raise SystemExit(f"{option} must contain four comma-separated numbers.") from error
    if len(values) != 4:
        raise SystemExit(f"{option} must contain exactly four values.")
    return values


def transform_frames(image: Image.Image, scales: list[float], offset_y: list[int]) -> Image.Image:
    if scales == [1, 1, 1, 1] and offset_y == [0, 0, 0, 0]:
        return image

    width, height = image.size
    cell_width = width // 2
    cell_height = height // 2
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for index, (scale, y_shift) in enumerate(zip(scales, offset_y)):
        if not 0 < scale <= 1:
            raise SystemExit("--frame-scales values must be greater than 0 and at most 1.")
        column = index % 2
        row = index // 2
        left = column * cell_width
        top = row * cell_height
        cell = image.crop((left, top, left + cell_width, top + cell_height))
        target_width = max(1, round(cell_width * scale))
        target_height = max(1, round(cell_height * scale))
        cell = cell.resize((target_width, target_height), Image.Resampling.LANCZOS)
        result.alpha_composite(cell, (
            left + (cell_width - target_width) // 2,
            top + (cell_height - target_height) // 2 + y_shift,
        ))
    return result


def clear_bottom_top_band(image: Image.Image, band_height: int) -> Image.Image:
    if band_height <= 0:
        return image

    width, height = image.size
    cell_height = height // 2
    result = image.copy()
    result.paste((0, 0, 0, 0), (0, cell_height, width, min(height, cell_height + band_height)))
    return result


def match_reference_layout(image: Image.Image, reference_path: Path) -> Image.Image:
    reference = Image.open(reference_path).convert("RGBA").resize(image.size, Image.Resampling.NEAREST)
    width, height = image.size
    cell_width = width // 2
    cell_height = height // 2
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))

    for index in range(4):
        column = index % 2
        row = index // 2
        left = column * cell_width
        top = row * cell_height
        box = (left, top, left + cell_width, top + cell_height)
        source_cell = image.crop(box)
        reference_cell = reference.crop(box)
        source_bounds = source_cell.getchannel("A").getbbox()
        target_bounds = reference_cell.getchannel("A").getbbox()
        if not source_bounds or not target_bounds:
            continue

        source_content = source_cell.crop(source_bounds)
        source_width, source_height = source_content.size
        target_width = target_bounds[2] - target_bounds[0]
        target_height = target_bounds[3] - target_bounds[1]
        scale = min(target_width / source_width, target_height / source_height)
        fitted_width = max(1, round(source_width * scale))
        fitted_height = max(1, round(source_height * scale))
        source_content = source_content.resize((fitted_width, fitted_height), Image.Resampling.LANCZOS)

        target_center_x = (target_bounds[0] + target_bounds[2]) / 2
        paste_x = left + round(target_center_x - fitted_width / 2)
        paste_y = top + target_bounds[3] - fitted_height
        result.alpha_composite(source_content, (paste_x, paste_y))

    return result


def constrain_to_reference_alpha(
    image: Image.Image,
    reference_path: Path,
    padding: int,
) -> Image.Image:
    if padding < 0:
        raise SystemExit("--alpha-reference-padding must be at least 0.")

    reference = Image.open(reference_path).convert("RGBA")
    reference_alpha = reference.getchannel("A")
    if padding:
        reference_alpha = reference_alpha.filter(ImageFilter.MaxFilter(padding * 2 + 1))
    reference_alpha = reference_alpha.resize(image.size, Image.Resampling.LANCZOS)

    result = image.copy()
    source_alpha = result.getchannel("A")
    constrained_alpha = ImageChops.darker(source_alpha, reference_alpha)
    result.putalpha(constrained_alpha)
    return result


def remove_large_light_components(image: Image.Image, minimum_size: int) -> Image.Image:
    if minimum_size <= 0:
        return image

    result = image.copy()
    pixels = result.load()
    width, height = result.size
    visited = bytearray(width * height)

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index]:
                continue
            red, green, blue, alpha = pixels[start_x, start_y]
            if alpha < 16 or not is_background((red, green, blue)):
                visited[start_index] = 1
                continue

            queue = deque([(start_x, start_y)])
            visited[start_index] = 1
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for neighbor_x, neighbor_y in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                ):
                    if not (0 <= neighbor_x < width and 0 <= neighbor_y < height):
                        continue
                    index = neighbor_y * width + neighbor_x
                    if visited[index]:
                        continue
                    neighbor = pixels[neighbor_x, neighbor_y]
                    if neighbor[3] >= 16 and is_background(neighbor[:3]):
                        visited[index] = 1
                        queue.append((neighbor_x, neighbor_y))

            if len(component) >= minimum_size:
                for x, y in component:
                    pixels[x, y] = (0, 0, 0, 0)

    return result


def remove_light_edge_pixels(image: Image.Image, passes: int) -> Image.Image:
    result = image.copy()
    width, height = result.size

    for _ in range(max(0, passes)):
        pixels = result.load()
        remove: list[tuple[int, int]] = []
        for y in range(height):
            for x in range(width):
                red, green, blue, alpha = pixels[x, y]
                if alpha < 16 or not is_background((red, green, blue)):
                    continue
                for neighbor_x, neighbor_y in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                    (x + 1, y + 1),
                ):
                    if not (0 <= neighbor_x < width and 0 <= neighbor_y < height):
                        remove.append((x, y))
                        break
                    if pixels[neighbor_x, neighbor_y][3] < 16:
                        remove.append((x, y))
                        break
        for x, y in remove:
            pixels[x, y] = (0, 0, 0, 0)

    return result


def clear_bottom_seam_artifacts(image: Image.Image, band_height: int) -> Image.Image:
    if band_height <= 0:
        return image

    width, height = image.size
    cell_width = width // 2
    cell_height = height // 2
    result = image.copy()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()

    for column in range(2):
        left = column * cell_width
        top = cell_height
        visited: set[tuple[int, int]] = set()
        components: list[list[tuple[int, int]]] = []
        for local_y in range(cell_height):
            for local_x in range(cell_width):
                point = (local_x, local_y)
                if point in visited or alpha_pixels[left + local_x, top + local_y] < 32:
                    continue
                queue = deque([point])
                visited.add(point)
                component: list[tuple[int, int]] = []
                while queue:
                    x, y = queue.popleft()
                    component.append((x, y))
                    for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        nx, ny = neighbor
                        if not (0 <= nx < cell_width and 0 <= ny < cell_height) or neighbor in visited:
                            continue
                        if alpha_pixels[left + nx, top + ny] < 32:
                            continue
                        visited.add(neighbor)
                        queue.append(neighbor)
                components.append(component)

        if not components:
            continue
        largest = max(components, key=len)
        for component in components:
            if component is largest or max(y for _, y in component) >= band_height:
                continue
            for x, y in component:
                alpha_pixels[left + x, top + y] = 0

    result.putalpha(alpha)
    return result


def round_top_cell_bottoms(image: Image.Image, depth: int) -> Image.Image:
    if depth <= 0:
        return image

    width, height = image.size
    cell_width = width // 2
    cell_height = height // 2
    result = image.copy()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    center_x = (cell_width - 1) / 2
    radius = max(center_x, 1)
    base_trim = 0
    curve_depth = depth
    feather = max(2, depth // 5)

    for column in range(2):
        left = column * cell_width
        for local_x in range(cell_width):
            distance = abs(local_x - center_x) / radius
            cutoff = cell_height - 1 - base_trim - round(curve_depth * distance)
            for local_y in range(max(0, cutoff - feather + 1), cutoff + 1):
                current = alpha_pixels[left + local_x, local_y]
                distance_to_edge = cutoff - local_y
                alpha_pixels[left + local_x, local_y] = current * distance_to_edge // feather
            for local_y in range(cutoff + 1, cell_height):
                alpha_pixels[left + local_x, local_y] = 0

    result.putalpha(alpha)
    return result


def main() -> None:
    args = parse_args()
    source = Image.open(args.input)
    prepared = remove_connected_light_background(source)
    prepared = resize_cells(prepared, args.size) if args.resize_cells else prepared.resize(
        (args.size, args.size),
        Image.Resampling.LANCZOS,
    )
    prepared = scale_cells(prepared, args.cell_scale)
    prepared = clear_bottom_top_band(prepared, args.clear_bottom_top_band)
    frame_scales = parse_frame_values(args.frame_scales, "--frame-scales", float)
    frame_offset_y = parse_frame_values(args.frame_offset_y, "--frame-offset-y", int)
    prepared = transform_frames(prepared, frame_scales, frame_offset_y)
    prepared = round_top_cell_bottoms(prepared, args.top_bottom_arc_depth)
    prepared = clear_bottom_seam_artifacts(prepared, args.bottom_seam_band)
    if args.layout_reference:
        prepared = match_reference_layout(prepared, args.layout_reference)
    if args.alpha_reference:
        prepared = constrain_to_reference_alpha(
            prepared,
            args.alpha_reference,
            args.alpha_reference_padding,
        )
    prepared = remove_large_light_components(
        prepared,
        args.remove_light_components_min_size,
    )
    prepared = remove_light_edge_pixels(prepared, args.remove_light_edge_passes)

    alpha = prepared.getchannel("A").point(lambda value: 0 if value < 16 else value)
    prepared.putalpha(alpha)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    prepared.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
