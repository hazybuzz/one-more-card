import AppKit
import CoreText
import Foundation

struct RankStyle {
  let name: String
  let fill: NSColor
  let outline: NSColor
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let deckRoot = root.appendingPathComponent("public/image/cards/dark-fate-deck")
let fontURL = deckRoot.appendingPathComponent("fonts/AlmendraSC-Regular.ttf")
let outputRoot = deckRoot.appendingPathComponent("ranks/master")

guard FileManager.default.fileExists(atPath: fontURL.path) else {
  fatalError("Missing font: \(fontURL.path)")
}

var registrationError: Unmanaged<CFError>?
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &registrationError)

let ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
let styles = [
  RankStyle(
    name: "red",
    fill: NSColor(srgbRed: 0.62, green: 0.12, blue: 0.18, alpha: 1),
    outline: NSColor(srgbRed: 0.22, green: 0.035, blue: 0.06, alpha: 1)
  ),
  RankStyle(
    name: "black",
    fill: NSColor(srgbRed: 0.13, green: 0.17, blue: 0.21, alpha: 1),
    outline: NSColor(srgbRed: 0.025, green: 0.04, blue: 0.055, alpha: 1)
  ),
]

func renderRank(_ rank: String, style: RankStyle, outputURL: URL) throws {
  let width = rank == "10" ? 88 : 64
  let height = 80
  let isNumericRank = Int(rank) != nil
  let fontSize: CGFloat = isNumericRank ? 62 : 54
  guard let font = NSFont(name: "Almendra SC", size: fontSize) else {
    fatalError("Unable to load Almendra SC")
  }
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
    fatalError("Unable to create rank bitmap")
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: width, height: height).fill(using: .copy)

  let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: style.fill,
    .strokeColor: style.outline,
    .strokeWidth: -4.5,
  ]
  let text = NSAttributedString(string: rank, attributes: attributes)
  let bounds = text.boundingRect(
    with: NSSize(width: 256, height: 128),
    options: [.usesFontLeading, .usesLineFragmentOrigin]
  )
  let origin = NSPoint(
    x: (CGFloat(width) - bounds.width) / 2 - bounds.origin.x,
    y: (CGFloat(height) - bounds.height) / 2 - bounds.origin.y + 1
  )
  text.draw(at: origin)
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode rank PNG")
  }
  try FileManager.default.createDirectory(
    at: outputURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  try png.write(to: outputURL)
}

for style in styles {
  for rank in ranks {
    let filename = rank == "10" ? "10.png" : "\(rank.lowercased()).png"
    let outputURL = outputRoot.appendingPathComponent(style.name).appendingPathComponent(filename)
    try renderRank(rank, style: style, outputURL: outputURL)
  }
}

func renderPreview() throws {
  let cellWidth = 52
  let rowHeight = 54
  let padding = 12
  let width = padding * 2 + ranks.count * cellWidth
  let height = padding * 2 + styles.count * rowHeight
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
    fatalError("Unable to create rank preview")
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSColor(srgbRed: 0.84, green: 0.83, blue: 0.78, alpha: 1).setFill()
  NSRect(x: 0, y: 0, width: width, height: height).fill()

  for (styleIndex, style) in styles.enumerated() {
    for (rankIndex, rank) in ranks.enumerated() {
      let filename = rank == "10" ? "10.png" : "\(rank.lowercased()).png"
      let sourceURL = outputRoot.appendingPathComponent(style.name).appendingPathComponent(filename)
      guard let source = NSImage(contentsOf: sourceURL) else { continue }
      let targetWidth: CGFloat = rank == "10" ? 44 : 32
      let targetHeight: CGFloat = 40
      let cellX = CGFloat(padding + rankIndex * cellWidth)
      let cellY = CGFloat(padding + (styles.count - 1 - styleIndex) * rowHeight)
      source.draw(
        in: NSRect(
          x: cellX + (CGFloat(cellWidth) - targetWidth) / 2,
          y: cellY + (CGFloat(rowHeight) - targetHeight) / 2,
          width: targetWidth,
          height: targetHeight
        ),
        from: .zero,
        operation: .sourceOver,
        fraction: 1
      )
    }
  }
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode rank preview")
  }
  try png.write(to: deckRoot.appendingPathComponent("ranks/rank-style-preview.png"))
}

try renderPreview()
print("Generated rank masters at \(outputRoot.path)")
