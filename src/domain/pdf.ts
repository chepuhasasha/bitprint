const MM_PER_POINT = 25.4 / 72
const MM_PER_INCH = 25.4

const TARGET_PRINTER_DPI = 1200
const RENDER_PX_PER_MM = TARGET_PRINTER_DPI / MM_PER_INCH
const MIN_RENDER_EDGE_PX = 280
const MAX_RENDER_EDGE_PX = 4096

type PdfRuntime = Awaited<ReturnType<typeof importPdfRuntime>>

let pdfRuntimePromise: Promise<PdfRuntime> | null = null

const importPdfRuntime = async () => {
  const [pdfjsModule, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])

  pdfjsModule.GlobalWorkerOptions.workerSrc = workerModule.default
  return pdfjsModule
}

const getPdfRuntime = async (): Promise<PdfRuntime> => {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = importPdfRuntime().catch((error) => {
      pdfRuntimePromise = null
      throw error
    })
  }

  return pdfRuntimePromise
}

const pointsToMm = (points: number): number => {
  if (!Number.isFinite(points) || points <= 0) {
    return 0
  }

  return Math.round(points * MM_PER_POINT * 100) / 100
}

const getRenderScale = (widthPoints: number, heightPoints: number): number => {
  const pageWidthMm = pointsToMm(widthPoints)
  const pageHeightMm = pointsToMm(heightPoints)
  const targetWidthPx = pageWidthMm * RENDER_PX_PER_MM
  const targetHeightPx = pageHeightMm * RENDER_PX_PER_MM
  const targetLongestEdgePx = Math.min(
    MAX_RENDER_EDGE_PX,
    Math.max(MIN_RENDER_EDGE_PX, targetWidthPx, targetHeightPx),
  )
  const longestEdge = Math.max(widthPoints, heightPoints)

  if (!Number.isFinite(longestEdge) || longestEdge <= 0) {
    return 1
  }

  return targetLongestEdgePx / longestEdge
}

export interface LoadedPdfLabels {
  pageCount: number
  pageWidthMm: number
  pageHeightMm: number
  pageImages: string[]
}

export const loadPdfLabels = async (
  file: File,
  onProgress?: (processedPages: number, totalPages: number) => void,
): Promise<LoadedPdfLabels> => {
  const runtime = await getPdfRuntime()
  const buffer = await file.arrayBuffer()
  const loadingTask = runtime.getDocument({ data: buffer })
  const pdfDocument = await loadingTask.promise

  const pageImages: string[] = []
  let pageWidthMm = 0
  let pageHeightMm = 0

  try {
    onProgress?.(0, pdfDocument.numPages)

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = getRenderScale(baseViewport.width, baseViewport.height)
      const renderViewport = page.getViewport({ scale })

      if (pageNumber === 1) {
        pageWidthMm = pointsToMm(baseViewport.width)
        pageHeightMm = pointsToMm(baseViewport.height)
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(renderViewport.width))
      canvas.height = Math.max(1, Math.round(renderViewport.height))

      const renderTask = page.render({
        canvas,
        viewport: renderViewport,
        background: 'rgb(255,255,255)',
      })
      await renderTask.promise
      pageImages.push(canvas.toDataURL('image/png'))
      page.cleanup()
      onProgress?.(pageNumber, pdfDocument.numPages)
    }
  } finally {
    await pdfDocument.destroy()
  }

  return {
    pageCount: pdfDocument.numPages,
    pageWidthMm,
    pageHeightMm,
    pageImages,
  }
}
