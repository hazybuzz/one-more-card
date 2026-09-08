import AppKit
import Foundation

enum CourtSuit: String {
  case diamond
  case heart
  case club
  case spade

  var colorName: String {
    switch self {
    case .diamond, .heart: return "red"
    case .club, .spade: return "black"
    }
  }
}

struct CourtSpec {
  let rank: String
  let suit: CourtSuit
  let sourceName: String
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let deckRoot = root.appendingPathComponent("public/image/cards/dark-fate-deck")
let outputRoot = deckRoot.appendingPathComponent("courts/samples/png-2x")
let specs = [
  CourtSpec(rank: "J", suit: .diamond, sourceName: "j-diamond-desert.png"),
  CourtSpec(rank: "Q", suit: .diamond, sourceName: "q-diamond-desert.png"),
  CourtSpec(rank: "K", suit: .diamond, sourceName: "k-diamond-desert.png"),
  CourtSpec(rank: "J", suit: .club, sourceName: "j-club-occult.png"),
  CourtSpec(rank: "Q", suit: .club, sourceName: "q-club-occult.png"),
  CourtSpec(rank: "K", suit: .club, sourceName: "k-club-occult.png"),
  CourtSpec(rank: "J", suit: .heart, sourceName: "j-heart-eastern.png"),
  CourtSpec(rank: "Q", suit: .heart, sourceName: "q-heart-eastern.png"),
  CourtSpec(rank: "K", suit: .heart, sourceName: "k-heart-eastern.png"),
  CourtSpec(rank: "J", suit: .spade, sourceName: "j-spade-northern.png"),
  CourtSpec(rank: "Q", suit: .spade, sourceName: "q-spade-northern.png"),
  CourtSpec(rank: "K", suit: .spade, sourceName: "k-spade-northern.png"),
]

func loadImage(_ url: URL) -> NSImage {
  guard let image = NSImage(contentsOf: url) else {
    fatalError("Missing image: \(url.path)")
  }
  return image
}

func aspectFitRect(for image: NSImage, inside rect: NSRect) -> NSRect {
  let scale = min(rect.width / image.size.width, rect.height / image.size.height)
  let size = NSSize(width: image.size.width * scale, height: image.size.height * scale)
  return NSRect(
    x: rect.midX - size.width / 2,
    y: rect.midY - size.height / 2,
    width: size.width,
    height: size.height
  )
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

func render(_ spec: CourtSpec) throws -> URL {
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
    fatalError("Unable to create court card bitmap")
  }

  let template = loadImage(deckRoot.appendingPathComponent("card-frame-2x.png"))
  let portrait = loadImage(deckRoot.appendingPathComponent("courts/source-flat/\(spec.sourceName)"))
  let rank = loadImage(
    deckRoot.appendingPathComponent("ranks/master/\(spec.suit.colorName)/\(spec.rank.lowercased()).png")
  )
  let suit = loadImage(deckRoot.appendingPathComponent("suits/png-2x/\(spec.suit.rawValue).png"))

  let rankWidth: CGFloat = 40
  let rankHeight: CGFloat = 50
  let suitSize: CGFloat = 18
  let inset: CGFloat = 6

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  template.draw(in: NSRect(x: 0, y: 0, width: width, height: height))

  // Keep both diagonal corner indices clear without sacrificing face readability.
  let portraitWindow = NSRect(x: 26, y: 35, width: 84, height: 124)
  portrait.draw(
    in: aspectFitRect(for: portrait, inside: portraitWindow),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )

  rank.draw(
    in: NSRect(x: inset, y: CGFloat(height) - inset - rankHeight, width: rankWidth, height: rankHeight),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
  suit.draw(
    in: NSRect(
      x: inset + (rankWidth - suitSize) / 2,
      y: CGFloat(height) - inset - rankHeight - 13,
      width: suitSize,
      height: suitSize
    ),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )

  drawRotated(
    rank,
    in: NSRect(
      x: CGFloat(width) - inset - rankWidth,
      y: inset,
      width: rankWidth,
      height: rankHeight
    )
  )
  drawRotated(
    suit,
    in: NSRect(
      x: CGFloat(width) - inset - (rankWidth + suitSize) / 2,
      y: inset + rankHeight - 5,
      width: suitSize,
      height: suitSize
    )
  )

  NSGraphicsContext.restoreGraphicsState()
  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode court card")
  }
  try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)
  let output = outputRoot.appendingPathComponent("\(spec.rank.lowercased())-\(spec.suit.rawValue).png")
  try png.write(to: output)
  return output
}

let cards = try specs.map(render)
let gap = 20
let previewColumns = 3
let previewRows = Int(ceil(Double(cards.count) / Double(previewColumns)))
let previewWidth = previewColumns * 136 + (previewColumns + 1) * gap
let previewHeight = previewRows * 190 + (previewRows + 1) * gap
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
  fatalError("Unable to create court preview")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: preview)
NSColor(srgbRed: 0.035, green: 0.045, blue: 0.06, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: previewWidth, height: previewHeight).fill()
for (index, cardURL) in cards.enumerated() {
  let column = index % previewColumns
  let row = index / previewColumns
  loadImage(cardURL).draw(
    in: NSRect(
      x: gap + column * (136 + gap),
      y: gap + (previewRows - 1 - row) * (190 + gap),
      width: 136,
      height: 190
    ),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
}
NSGraphicsContext.restoreGraphicsState()

guard let previewPNG = preview.representation(using: .png, properties: [:]) else {
  fatalError("Unable to encode court preview")
}
let previewURL = deckRoot.appendingPathComponent("courts/samples/court-style-preview.png")
try FileManager.default.createDirectory(at: previewURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try previewPNG.write(to: previewURL)
print("Generated court samples at \(outputRoot.path)")
