export interface ThermalFont {
  height: number
  chars: Record<string, string[]>
}

const glyphModules = import.meta.glob('./glyphs/*.glyph.txt', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const decodeGlyphPath = (filePath: string): string | null => {
  const match = filePath.match(/\/([0-9A-Fa-f]{4,6})(?:__[^/]+)?\.glyph\.txt$/)
  if (!match) {
    return null
  }

  const codepoint = Number.parseInt(match[1], 16)
  if (Number.isNaN(codepoint)) {
    return null
  }

  return String.fromCodePoint(codepoint)
}

const parseGlyphRows = (raw: string): string[] => {
  const normalized = raw.replace(/\r/g, '')
  const rows = normalized.split('\n')

  // Keep rows exactly as authored (including empty ones and leading/trailing spaces).
  // Drop only one trailing empty line that appears from file ending newline.
  if (rows.length > 0 && rows.at(-1) === '') {
    rows.pop()
  }

  return rows
}

const chars: Record<string, string[]> = {}

for (const [filePath, raw] of Object.entries(glyphModules)) {
  const char = decodeGlyphPath(filePath)
  if (!char) {
    continue
  }

  chars[char] = parseGlyphRows(raw)
}

if (!chars[' ']) {
  chars[' '] = ['   ']
}

export const THERMAL_FONT: ThermalFont = {
  height: 11,
  chars,
}
