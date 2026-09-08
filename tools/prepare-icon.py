#!/usr/bin/env python3
import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Normalize a transparent icon to the game icon specification.')
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--logical-size', type=int, default=64)
    parser.add_argument('--runtime-size', type=int, default=128)
    parser.add_argument('--subject-size', type=int, default=54)
    parser.add_argument('--colors', type=int, default=7)
    parser.add_argument('--palette', help='Comma-separated hex colors that must survive quantization.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = Image.open(args.input).convert('RGBA')
    alpha = image.getchannel('A')
    bbox = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
    if not bbox:
        raise SystemExit('Icon subject is empty.')

    image = image.crop(bbox)
    scale = min(args.subject_size / image.width, args.subject_size / image.height)
    subject_dimensions = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    image = image.resize(subject_dimensions, Image.Resampling.LANCZOS)
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 128 else 0)

    outline = (21, 19, 26)
    rgb = Image.new('RGB', image.size, outline)
    rgb.paste(image.convert('RGB'), mask=alpha)
    if args.palette:
        colors = [color.strip().lstrip('#') for color in args.palette.split(',')]
        if len(colors) > 256:
            raise SystemExit('Palette cannot contain more than 256 colors.')
        palette_values = [channel for color in colors for channel in bytes.fromhex(color)]
        palette_values.extend([0] * (768 - len(palette_values)))
        palette = Image.new('P', (1, 1))
        palette.putpalette(palette_values)
        quantized = rgb.quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB')
    else:
        quantized = rgb.quantize(
            colors=args.colors,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.NONE,
        ).convert('RGB')
    artwork = quantized.convert('RGBA')
    artwork.putalpha(alpha)

    logical = Image.new('RGBA', (args.logical_size, args.logical_size), (0, 0, 0, 0))
    position = (
        (args.logical_size - subject_dimensions[0]) // 2,
        (args.logical_size - subject_dimensions[1]) // 2,
    )
    logical.alpha_composite(artwork, position)
    runtime = logical.resize((args.runtime_size, args.runtime_size), Image.Resampling.NEAREST)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(args.output, optimize=True)

    visible_colors = {
        pixel[:3]
        for pixel in runtime.getdata()
        if pixel[3] > 0
    }
    print(
        f'Wrote {args.output}: {runtime.size}, '
        f'visible colors={len(visible_colors)}, subject={subject_dimensions}'
    )


if __name__ == '__main__':
    main()
