import AppKit
import Foundation

enum DeckSuit: String, CaseIterable {
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

  var courtCulture: String {
    switch self {
    case .diamond: return "desert"
    case .club: return "occult"
    case .heart: return "eastern"
    case .spade: return "northern"
    }
  }
}

struct PipLayout {
  let centers: [NSPoint]
  let size: CGFloat
}

let ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
let courtRanks = Set(["J", "Q", "K"])
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let deckRoot = root.appendingPathComponent("public/image/cards/dark-fate-deck")
let cards2xRoot = deckRoot.appendingPathComponent("cards/png-2x")
let cards1xRoot = deckRoot.appendingPathComponent("cards/png-1x")

func loadImage(_ url: URL) -> NSImage {
  guard let image = NSImage(contentsOf: url) else {
    fatalError("Missing image: \(url.path)")
  }
  return image
}

func makeBitmap(width: Int, height: Int) -> NSBitmapImageRep {
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
    fatalError("Unable to create \(width)x\(height) bitmap")
  }
  return bitmap
}

func writePNG(_ bitmap: NSBitmapImageRep, to url: URL) throws {
  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode PNG")
  }
  try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try png.write(to: url)
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

func pipLayout(for rank: String) -> PipLayout {
  let left: CGFloat = 49
  let right: CGFloat = 87
  let center: CGFloat = 68
  switch rank {
  case "A":
    return PipLayout(centers: [NSPoint(x: center, y: 95)], size: 52)
  case "2":
    return PipLayout(centers: [NSPoint(x: center, y: 126), NSPoint(x: center, y: 64)], size: 28)
  case "3":
    return PipLayout(
      centers: [NSPoint(x: center, y: 128), NSPoint(x: center, y: 95), NSPoint(x: center, y: 62)],
      size: 25
    )
  case "4":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 126), NSPoint(x: right, y: 126),
        NSPoint(x: left, y: 64), NSPoint(x: right, y: 64),
      ],
      size: 23
    )
  case "5":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 126), NSPoint(x: right, y: 126),
        NSPoint(x: center, y: 95),
        NSPoint(x: left, y: 64), NSPoint(x: right, y: 64),
      ],
      size: 22
    )
  case "6":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 128), NSPoint(x: right, y: 128),
        NSPoint(x: left, y: 95), NSPoint(x: right, y: 95),
        NSPoint(x: left, y: 62), NSPoint(x: right, y: 62),
      ],
      size: 20
    )
  case "7":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 128), NSPoint(x: right, y: 128),
        NSPoint(x: center, y: 112),
        NSPoint(x: left, y: 95), NSPoint(x: right, y: 95),
        NSPoint(x: left, y: 62), NSPoint(x: right, y: 62),
      ],
      size: 18
    )
  case "8":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 128), NSPoint(x: right, y: 128),
        NSPoint(x: center, y: 112),
        NSPoint(x: left, y: 95), NSPoint(x: right, y: 95),
        NSPoint(x: center, y: 78),
        NSPoint(x: left, y: 62), NSPoint(x: right, y: 62),
      ],
      size: 17
    )
  case "9":
    return PipLayout(
      centers: [
        NSPoint(x: left, y: 128), NSPoint(x: right, y: 128),
        NSPoint(x: left, y: 106), NSPoint(x: right, y: 106),
        NSPoint(x: center, y: 95),
        NSPoint(x: left, y: 84), NSPoint(x: right, y: 84),
        NSPoint(x: left, y: 62), NSPoint(x: right, y: 62),
      ],
      size: 16
    )
  case "10":
    return PipLayout(
      centers: [
        NSPoint(x: 50, y: 126), NSPoint(x: 86, y: 126),
        NSPoint(x: 50, y: 110), NSPoint(x: 86, y: 110),
        NSPoint(x: 50, y: 94), NSPoint(x: 86, y: 94),
        NSPoint(x: 50, y: 78), NSPoint(x: 86, y: 78),
        NSPoint(x: 50, y: 62), NSPoint(x: 86, y: 62),
      ],
      size: 15
    )
  default:
    fatalError("No pip layout for rank \(rank)")
  }
}

func drawCornerIndices(rank: String, rankImage: NSImage, suitImage: NSImage, width: Int, height: Int) {
  let rankWidth: CGFloat = rank == "10" ? 54 : 40
  let rankHeight: CGFloat = 50
  let suitSize: CGFloat = 18
  let inset: CGFloat = 6

  rankImage.draw(
    in: NSRect(x: inset, y: CGFloat(height) - inset - rankHeight, width: rankWidth, height: rankHeight),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
  )
  suitImage.draw(
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
    rankImage,
    in: NSRect(
      x: CGFloat(width) - inset - rankWidth,
      y: inset,
      width: rankWidth,
      height: rankHeight
    )
  )
  drawRotated(
    suitImage,
    in: NSRect(
      x: CGFloat(width) - inset - (rankWidth + suitSize) / 2,
      y: inset + rankHeight - 5,
      width: suitSize,
      height: suitSize
    )
  )
}

func renderCard(rank: String, suit: DeckSuit) throws -> URL {
  let width = 136
  let height = 190
  let bitmap = makeBitmap(width: width, height: height)
  let template = loadImage(deckRoot.appendingPathComponent("card-frame-2x.png"))
  let rankFilename = rank == "10" ? "10.png" : "\(rank.lowercased()).png"
  let rankImage = loadImage(
    deckRoot.appendingPathComponent("ranks/master/\(suit.colorName)/\(rankFilename)")
  )
  let suitImage = loadImage(deckRoot.appendingPathComponent("suits/png-2x/\(suit.rawValue).png"))

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSGraphicsContext.current?.imageInterpolation = .high
  template.draw(in: NSRect(x: 0, y: 0, width: width, height: height))

  if courtRanks.contains(rank) {
    let portraitURL = deckRoot.appendingPathComponent(
      "courts/source-flat/\(rank.lowercased())-\(suit.rawValue)-\(suit.courtCulture).png"
    )
    let portrait = loadImage(portraitURL)
    let portraitWindow = NSRect(x: 26, y: 35, width: 84, height: 124)
    portrait.draw(
      in: aspectFitRect(for: portrait, inside: portraitWindow),
      from: .zero,
      operation: .sourceOver,
      fraction: 1
    )
  } else {
    let layout = pipLayout(for: rank)
    for center in layout.centers {
      suitImage.draw(
        in: NSRect(
          x: center.x - layout.size / 2,
          y: center.y - layout.size / 2,
          width: layout.size,
          height: layout.size
        ),
        from: .zero,
        operation: .sourceOver,
        fraction: 1
      )
    }
  }

  drawCornerIndices(rank: rank, rankImage: rankImage, suitImage: suitImage, width: width, height: height)
  NSGraphicsContext.restoreGraphicsState()

  let output = cards2xRoot.appendingPathComponent("\(rank.lowercased())-\(suit.rawValue).png")
  try writePNG(bitmap, to: output)
  return output
}

func resizeCard(_ sourceURL: URL, outputURL: URL) throws {
  let bitmap = makeBitmap(width: 68, height: 95)
  let source = loadImage(sourceURL)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSGraphicsContext.current?.imageInterpolation = .high
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: 68, height: 95).fill(using: .copy)
  source.draw(in: NSRect(x: 0, y: 0, width: 68, height: 95), from: .zero, operation: .sourceOver, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  try writePNG(bitmap, to: outputURL)
}

var cardURLs: [DeckSuit: [URL]] = [:]
for suit in DeckSuit.allCases {
  cardURLs[suit] = []
  for rank in ranks {
    let source = try renderCard(rank: rank, suit: suit)
    let output = cards1xRoot.appendingPathComponent("\(rank.lowercased())-\(suit.rawValue).png")
    try resizeCard(source, outputURL: output)
    cardURLs[suit, default: []].append(output)
  }
}

let sheetWidth = 926
let sheetHeight = 391
let frameWidth = 68
let frameHeight = 95
let margin = 2
let columnStep = 71
let rowStep = 97
let sheet = makeBitmap(width: sheetWidth, height: sheetHeight)

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: sheet)
NSGraphicsContext.current?.imageInterpolation = .none
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: sheetWidth, height: sheetHeight).fill(using: .copy)
for (row, suit) in DeckSuit.allCases.enumerated() {
  for (column, cardURL) in (cardURLs[suit] ?? []).enumerated() {
    let x = margin + column * columnStep
    let topY = margin + row * rowStep
    let y = sheetHeight - topY - frameHeight
    loadImage(cardURL).draw(
      in: NSRect(x: x, y: y, width: frameWidth, height: frameHeight),
      from: .zero,
      operation: .sourceOver,
      fraction: 1
    )
  }
}
NSGraphicsContext.restoreGraphicsState()

let sheetURL = deckRoot.appendingPathComponent("card-fronts-dark-fate.png")
try writePNG(sheet, to: sheetURL)
print("Generated 52-card deck at \(sheetURL.path)")
