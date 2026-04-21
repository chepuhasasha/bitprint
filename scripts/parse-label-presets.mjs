import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'https://www.label.kr'
const LIST_URL = `${BASE_URL}/Goods/a4label/ByMaterials/MPL`
const OUTPUT_DIR = path.resolve(__dirname, '../public/presets')
const CONCURRENCY = 8

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

const SPEC_LABELS = {
  labelWidthMm: ['\uB77C\uBCA8 \uB108\uBE44'],
  labelHeightMm: ['\uB77C\uBCA8 \uB192\uC774'],
  marginLeftMm: ['\uC67C\uCABD \uC5EC\uBC31'],
  marginRightMm: ['\uC624\uB978\uCABD \uC5EC\uBC31'],
  marginTopMm: ['\uC704\uCABD \uC5EC\uBC31'],
  marginBottomMm: ['\uC544\uB798\uCABD \uC5EC\uBC31'],
  gapVerticalMm: ['\uC0C1\uD558 \uAC04\uACA9'],
  gapHorizontalMm: ['\uC88C\uC6B0 \uAC04\uACA9'],
  labelsPerSheet: ['\uB77C\uBCA8 \uC218'],
}

const PAGE = {
  pageWidthMm: 210,
  pageHeightMm: 297,
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const toAbsoluteUrl = (href) => new URL(href, BASE_URL).toString()

const parseFirstNumber = (value) => {
  const normalized = cleanText(value).replace(/,/g, '')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value) => {
  const parsed = parseFirstNumber(value)
  if (parsed == null) {
    return null
  }
  return Math.trunc(parsed)
}

const findSpecField = (labelText) => {
  for (const [field, variants] of Object.entries(SPEC_LABELS)) {
    if (variants.some((variant) => labelText.includes(variant))) {
      return field
    }
  }
  return null
}

const fetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }

  return response.text()
}

const parseListProducts = (listHtml) => {
  const $ = cheerio.load(listHtml)
  const productCards = []
  const seen = new Set()

  $('.p-product-list.row.small-collapse.small-up-2.medium-up-3.large-up-4.u-margin-none a.p-product.c-card').each((_, element) => {
    const card = $(element)
    const item = card.closest('.p-product-list-item')
    const prosumer = cleanText(item.attr('data-prosumer'))

    // The page counter shows only regular items by default (212), excluding prosumer rows.
    if (prosumer !== '1') {
      return
    }

    const href = cleanText(card.attr('href'))
    if (!href) {
      return
    }

    const url = toAbsoluteUrl(href)
    if (seen.has(url)) {
      return
    }

    const title = cleanText(card.find('div.c-card-title.p-product-title').first().text())
    const subtitle = cleanText(card.find('div.c-card-subtitle').first().text())
    const sourceName = cleanText([title, subtitle].filter(Boolean).join(' '))
    if (!sourceName) {
      return
    }

    seen.add(url)
    productCards.push({ sourceName, url })
  })

  return productCards
}

const getMaterialCodeFromUrl = (detailUrl) => {
  const url = new URL(detailUrl)
  const parts = url.pathname.split('/').filter(Boolean)
  return parts.length >= 4 ? cleanText(parts[3]).toUpperCase() : ''
}

const selectMaterialRow = ($, detailUrl) => {
  const requestedMaterialCode = getMaterialCodeFromUrl(detailUrl)
  const materialItems = $('li.material-item')

  if (requestedMaterialCode) {
    const exactMatch = materialItems
      .filter((_, element) => {
        const code = cleanText($(element).attr('data-material-code')).toUpperCase()
        return code === requestedMaterialCode
      })
      .first()

    if (exactMatch.length > 0) {
      return exactMatch
    }
  }

  const selectedByClass = materialItems.filter('.is-selected').first()
  if (selectedByClass.length > 0) {
    return selectedByClass
  }

  return materialItems.first()
}

const parseProductDetail = (detailHtml, detailUrl) => {
  const $ = cheerio.load(detailHtml)
  const specs = {}

  $('.p-specs-table table tr').each((_, row) => {
    const label = cleanText($(row).find('th').first().text())
    const value = cleanText($(row).find('td').first().text())
    if (!label || !value) {
      return
    }
    const field = findSpecField(label)
    if (!field) {
      return
    }
    specs[field] = parseFirstNumber(value)
  })

  const materialRow = selectMaterialRow($, detailUrl)
  if (!materialRow || materialRow.length === 0) {
    throw new Error('Unable to find material row')
  }

  const goodsId = parseInteger(materialRow.attr('data-goods-id'))
  const materialCode = cleanText(materialRow.attr('data-material-code')).toUpperCase()
  const goodsCodeRaw = cleanText(materialRow.attr('data-goods-code')).toUpperCase()
  const goodsCodeText = cleanText(materialRow.find('.u-color-link-blue').first().text()).toUpperCase()
  const goodsCode = goodsCodeText || goodsCodeRaw

  if (!goodsId || !materialCode) {
    throw new Error('Unable to read goods-id or material-code')
  }

  const prosumerFlag = parseInteger(materialRow.attr('data-prosumer')) ?? 1
  const prosumerQty = parseInteger(materialRow.attr('data-prosumerqty')) ?? 1
  const minOrderQty = prosumerFlag === 5 ? Math.max(1, prosumerQty) : 1

  return {
    labelWidthMm: specs.labelWidthMm,
    labelHeightMm: specs.labelHeightMm,
    marginLeftMm: specs.marginLeftMm,
    marginRightMm: specs.marginRightMm,
    marginTopMm: specs.marginTopMm,
    marginBottomMm: specs.marginBottomMm,
    gapHorizontalMm: specs.gapHorizontalMm,
    gapVerticalMm: specs.gapVerticalMm,
    labelsPerSheet: specs.labelsPerSheet,
    goodsId,
    materialCode,
    minOrderQty,
    goodsCode,
  }
}

const parseSelectedQtyList = (selectionHtml) => {
  const match = selectionHtml.match(/var\s+selectedQtyList\s*=\s*(\[[\s\S]*?\]);/)
  if (!match) {
    return []
  }

  try {
    const parsed = JSON.parse(match[1])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseQtyOptions = (selectionHtml) => {
  const $ = cheerio.load(selectionHtml)
  const options = []
  const selectedQtyList = parseSelectedQtyList(selectionHtml)
  const selectedQtyBySheets = new Map()

  for (const row of selectedQtyList) {
    const sheets = Number(row?.PaperQuantity)
    if (!Number.isFinite(sheets) || sheets <= 0) {
      continue
    }
    selectedQtyBySheets.set(Math.trunc(sheets), row)
  }

  $('.v-quantity-selection').each((_, element) => {
    const node = $(element)
    const sheets = parseInteger(node.attr('data-qty'))
    const price = parseInteger(node.attr('data-price'))
    if (!sheets || !price) {
      return
    }

    const selectedQtyRow = selectedQtyBySheets.get(sheets)
    const labelsFromNode = parseInteger(node.find('.changeLabelCut').first().text())
    const labelsFromScript = Number(selectedQtyRow?.LabelQuantity)
    const labels = Number.isFinite(labelsFromScript) && labelsFromScript > 0
      ? Math.trunc(labelsFromScript)
      : labelsFromNode

    const sheetPriceFromScript = Number(selectedQtyRow?.SheetPrice)
    const fallbackPricePerSheet = Math.round(price / sheets)
    const pricePerSheet = Number.isFinite(sheetPriceFromScript) && sheetPriceFromScript > 0
      ? Math.trunc(sheetPriceFromScript)
      : fallbackPricePerSheet

    options.push({
      sheets,
      labels: labels ?? sheets,
      price_per_sheet: pricePerSheet,
      price,
    })
  })

  const deduped = new Map()
  for (const option of options) {
    if (!deduped.has(option.sheets)) {
      deduped.set(option.sheets, option)
    }
  }

  return [...deduped.values()].sort((left, right) => left.sheets - right.sheets)
}

const formatDimension = (value) => {
  if (!Number.isFinite(value)) {
    return '0'
  }
  return String(value).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

const toFileDimension = (value) => formatDimension(value).replace(/\./g, '_')

const sanitizeCode = (code) => {
  const cleaned = cleanText(code).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned || 'UNKNOWN'
}

const buildPresetName = ({ labelWidthMm, labelHeightMm, goodsCode }) => {
  const width = formatDimension(Number(labelWidthMm))
  const height = formatDimension(Number(labelHeightMm))
  const code = sanitizeCode(goodsCode)
  return `${width} x ${height} mm [${code}]`
}

const makePresetFileName = (goodsCode, widthMm, heightMm, usedFileNames) => {
  const codePart = sanitizeCode(goodsCode)
  const sizePart = `${toFileDimension(widthMm)}x${toFileDimension(heightMm)}`
  const baseName = `${codePart}_${sizePart}`

  if (!usedFileNames.has(`${baseName}.json`)) {
    const directName = `${baseName}.json`
    usedFileNames.add(directName)
    return directName
  }

  let index = 2
  while (true) {
    const candidate = `${baseName}_${index}.json`
    if (!usedFileNames.has(candidate)) {
      usedFileNames.add(candidate)
      return candidate
    }
    index += 1
  }
}

const createPresetPayload = (spec) => {
  const width = Number(spec.labelWidthMm)
  const height = Number(spec.labelHeightMm)

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Invalid label width/height')
  }

  const fields = [
    'marginLeftMm',
    'marginRightMm',
    'marginTopMm',
    'marginBottomMm',
    'gapHorizontalMm',
    'gapVerticalMm',
  ]

  for (const field of fields) {
    const value = Number(spec[field])
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${field}`)
    }
  }

  return {
    labelWidthMm: width,
    labelHeightMm: height,
    manualLabelCount: 1,
    printSheet: {
      ...PAGE,
      marginLeftMm: Number(spec.marginLeftMm),
      marginRightMm: Number(spec.marginRightMm),
      marginTopMm: Number(spec.marginTopMm),
      marginBottomMm: Number(spec.marginBottomMm),
      gapHorizontalMm: Number(spec.gapHorizontalMm),
      gapVerticalMm: Number(spec.gapVerticalMm),
    },
    pdfCopies: 1,
    elements: [
      {
        id: 'diag_1',
        type: 'line',
        dataSource: 'static',
        csvColumn: '0',
        x1: 0,
        y1: 0,
        x2: width,
        y2: height,
        thickness: 0.3,
      },
      {
        id: 'diag_2',
        type: 'line',
        dataSource: 'static',
        csvColumn: '0',
        x1: width,
        y1: 0,
        x2: 0,
        y2: height,
        thickness: 0.3,
      },
    ],
  }
}

const mapLimit = async (items, limit, mapper) => {
  const results = new Array(items.length)
  let index = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await mapper(items[current], current)
    }
  })

  await Promise.all(workers)
  return results
}

const clearPresetJsonFiles = async () => {
  const files = await fs.readdir(OUTPUT_DIR, { withFileTypes: true })
  const targets = files
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(OUTPUT_DIR, entry.name))

  await Promise.all(targets.map((target) => fs.unlink(target)))
}

const main = async () => {
  const startedAt = Date.now()

  console.log(`[parse] list URL: ${LIST_URL}`)
  console.log(`[parse] concurrency: ${CONCURRENCY}`)

  const listHtml = await fetchHtml(LIST_URL)
  const products = parseListProducts(listHtml)

  if (products.length === 0) {
    throw new Error('No products found on list page')
  }

  console.log(`[parse] found products: ${products.length}`)

  const failures = []
  const skipped = []
  const usedFileNames = new Set()

  const parsedProducts = await mapLimit(products, CONCURRENCY, async (product, idx) => {
    const position = `${idx + 1}/${products.length}`

    try {
      const detailHtml = await fetchHtml(product.url)
      const detail = parseProductDetail(detailHtml, product.url)
      const normalizedGoodsCode = sanitizeCode(detail.goodsCode)

      if (normalizedGoodsCode.startsWith('SL')) {
        skipped.push({
          url: product.url,
          goodsCode: normalizedGoodsCode,
        })
        console.log(`[parse] ${position} SKIP ${normalizedGoodsCode} (SL prefix)`)
        return null
      }

      const selectionUrl = `${BASE_URL}/Goods/SelectionQty/${detail.goodsId}/${detail.materialCode}/${detail.minOrderQty}/0/false`
      const selectionHtml = await fetchHtml(selectionUrl)
      const prices = parseQtyOptions(selectionHtml)

      if (prices.length === 0) {
        throw new Error('No quantity options found')
      }

      const presetPayload = createPresetPayload(detail)
      const fileName = makePresetFileName(
        detail.goodsCode || String(detail.goodsId),
        detail.labelWidthMm,
        detail.labelHeightMm,
        usedFileNames,
      )

      console.log(`[parse] ${position} OK ${fileName}`)

      return {
        indexRow: {
          name: buildPresetName(detail),
          file: fileName,
          prices,
        },
        fileName,
        payload: presetPayload,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({
        url: product.url,
        name: product.sourceName,
        message,
      })
      console.warn(`[parse] ${position} FAIL ${product.url} :: ${message}`)
      return null
    }
  })

  const successful = parsedProducts.filter(Boolean)
  if (successful.length === 0) {
    throw new Error('No preset files were generated')
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await clearPresetJsonFiles()

  for (const row of successful) {
    const filePath = path.join(OUTPUT_DIR, row.fileName)
    await fs.writeFile(filePath, `${JSON.stringify(row.payload, null, 2)}\n`, 'utf8')
  }

  const indexPayload = successful.map((row) => row.indexRow)
  const indexPath = path.join(OUTPUT_DIR, 'index.json')
  await fs.writeFile(indexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8')

  console.log(`[parse] generated presets: ${successful.length}`)
  console.log(`[parse] skipped presets: ${skipped.length}`)
  console.log(`[parse] failed presets: ${failures.length}`)
  console.log(`[parse] output dir: ${OUTPUT_DIR}`)
  console.log(`[parse] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)

  if (failures.length > 0) {
    const failurePath = path.join(OUTPUT_DIR, 'parse-errors.log')
    const failureLog = failures
      .map((item) => `${item.name}\n${item.url}\n${item.message}\n`)
      .join('\n')
    await fs.writeFile(failurePath, failureLog, 'utf8')
    console.warn(`[parse] details saved to: ${failurePath}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`[parse] fatal: ${message}`)
  process.exitCode = 1
})
