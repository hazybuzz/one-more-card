import AppKit
import Foundation

enum Suit: String {
  case diamond
  case club
  case heart
  case spade

  var colorName: String {
    switch self {
    case .diamond, .heart: return "red"
    case .club, .spade: return "black"
    }
  }
}

struct CardSpec {
  let rank: String
  let suit: Suit
  let pipCenters: [NSPoint]
  let pipSize: CGFloat
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let deckRoot = root.appendingPathComponent("public/image/cards/dark-fate-deck")
let templateURL = deckRoot.appendingPathComponent("card-frame-2x.png")
let outputRoot = deckRoot.appendingPathComponent("samples/png-2x")

let samples = [
  CardSpec(rank: "A", suit: .spade, pipCenters: [NSPoint(x: 68, y: 95)], pipSize: 52),
  CardSpec(
    rank: "5",
    suit: .heart,
    pipCenters: [
      NSPoint(x: 49, y: 126), NSPoint(x: 87, y: 126),
      NSPoint(x: 68, y: 95),
      NSPoint(x: 49, y: 64), NSPoint(x: 87, y: 64),
    ],
    pipSize: 22
  ),
  CardSpec(
    rank: "10",
    suit: .diamond,
    pipCenters: [
      NSPoint(x: 50, y: 126), NSPoint(x: 86, y: 126),
      NSPoint(x: 50, y: 110), NSPoint(x: 86, y: 110),
      NSPoint(x: 50, y: 94), NSPoint(x: 86, y: 94),
      NSPoint(x: 50, y: 78), NSPoint(x: 86, y: 78),
      NSPoint(x: 50, y: 62), NSPoint(x: 86, y: 62),
    ],
    pipSize: 15
  ),
]

guard let template = NSImage(contentsOf: templateURL) else {
  fatalError("Missing card template: \(templateURL.path)")
}

func image(at url: URL) -> NSImage {
  guard let image = NSImage(contentsOf: url) else {
    fatalError("Missing image: \(url.path)")
  }
  return image
}

func drawRotated(_ source: NSImage, in rect: NSRect) {
  guard let context = NSGraphicsContext.current?.cgContext else { return }
  context.saveGState()
  context.translateBy(x: rect.midX, y: rect.midY)
  context.rotate(by: .pi)
  source.draw(
    in: NSRect(x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
  context.restoreGState()
}

func render(_ spec: CardSpec) throws -> URL {
  let width = 136
  let height = 190
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    fatalError("Unable to create card bitmap")
  }

  let rankFilename = spec.rank == "10" ? "10.png" : "\(spec.rank.lowercased()).png"
  let rankURL = deckRoot
    .appendingPathComponent("ranks/master")
    .appendingPathComponent(spec.suit.colorName)
    .appendingPathComponent(rankFilename)
  let suitURL = deckRoot.appendingPathComponent("suits/png-2x/\(spec.suit.rawValue).png")
  let rankImage = image(at: rankURL)
  let suitImage = image(at: suitURL)
  let cornerRankWidth: CGFloat = spec.rank == "10" ? 54 : 40
  let cornerRankHeight: CGFloat = 50
  let cornerSuitSize: CGFloat = 18
  let edgeInset: CGFloat = 6

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  template.draw(in: NSRect(x: 0, y: 0, width: width, height: height))

  rankImage.draw(
    in: NSRect(
      x: edgeInset,
      y: CGFloat(height) - edgeInset - cornerRankHeight,
      width: cornerRankWidth,
      height: cornerRankHeight
    ),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
  suitImage.draw(
    in: NSRect(
      x: edgeInset + (cornerRankWidth - cornerSuitSize) / 2,
      y: CGFloat(height) - edgeInset - cornerRankHeight - 13,
      width: cornerSuitSize,
      height: cornerSuitSize
    ),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )

  drawRotated(
    rankImage,
    in: NSRect(
      x: CGFloat(width) - edgeInset - cornerRankWidth,
      y: edgeInset,
      width: cornerRankWidth,
      height: cornerRankHeight
    )
  )
  drawRotated(
    suitImage,
    in: NSRect(
      x: CGFloat(width) - edgeInset - (cornerRankWidth + cornerSuitSize) / 2,
      y: edgeInset + cornerRankHeight - 5,
      width: cornerSuitSize,
      height: cornerSuitSize
    )
  )

  for center in spec.pipCenters {
    suitImage.draw(
      in: NSRect(
        x: center.x - spec.pipSize / 2,
        y: center.y - spec.pipSize / 2,
        width: spec.pipSize,
        height: spec.pipSize
      ),
      from: .zero,
      operation: .sourceOver,
      fraction: 1
    )
  }
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode card PNG")
  }
  try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)
  let outputURL = outputRoot.appendingPathComponent("\(spec.rank.lowercased())-\(spec.suit.rawValue).png")
  try png.write(to: outputURL)
  return outputURL
}

let renderedCards = try samples.map(render)

let previewWidth = 136 * renderedCards.count + 24 * (renderedCards.count + 1)
let previewHeight = 190 + 48
guard let preview = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: previewWidth,
  pixelsHigh: previewHeight,
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fatalError("Unable to create card preview")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: preview)
NSColor(srgbRed: 0.035, green: 0.045, blue: 0.06, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: previewWidth, height: previewHeight).fill()
for (index, cardURL) in renderedCards.enumerated() {
  let card = image(at: cardURL)
  card.draw(
    in: NSRect(x: 24 + index * 160, y: 24, width: 136, height: 190),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
}
NSGraphicsContext.restoreGraphicsState()

guard let previewPNG = preview.representation(using: .png, properties: [:]) else {
  fatalError("Unable to encode card preview")
}
let previewURL = deckRoot.appendingPathComponent("samples/test-cards-preview.png")
try FileManager.default.createDirectory(at: previewURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try previewPNG.write(to: previewURL)

print("Generated sample cards at \(outputRoot.path)")
