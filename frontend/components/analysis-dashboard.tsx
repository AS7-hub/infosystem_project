"use client"

import { AnalyticsResult, GazePoint } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText } from "lucide-react"

interface AnalysisDashboardProps {
  result: AnalyticsResult | null
  isLoading?: boolean
  gazeData?: GazePoint[] | null
}

export default function AnalysisDashboard({ result, isLoading = false, gazeData }: AnalysisDashboardProps) {
  const downloadGazeCSV = () => {
    if (!gazeData || gazeData.length === 0) return
    const header = "timestamp,x,y\n"
    const rows = gazeData.map((p) => `${p.timestamp},${p.x},${p.y}`).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "gaze_data.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPDF = async () => {
    if (!result || result.status !== "success") return
    const { jsPDF } = await import("jspdf")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const W = 210
    const margin = 16
    const contentW = W - 2 * margin
    const P = { r: 124, g: 58, b: 237 }   // primary purple
    const LP = { r: 237, g: 233, b: 254 }  // light purple tint
    let y = 0

    // ── Page 1 header banner ────────────────────────────────────────────────
    doc.setFillColor(P.r, P.g, P.b)
    doc.rect(0, 0, W, 42, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    doc.text("Gaze Analysis Report", margin, 17)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("Detailed insights from your eye-tracking session", margin, 25)
    const now = new Date()
    doc.setFontSize(8)
    doc.setTextColor(220, 200, 255)
    doc.text(`Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, margin, 34)
    y = 52

    // ── Session overview box ─────────────────────────────────────────────────
    if (gazeData && gazeData.length > 0) {
      const durationSec = ((gazeData[gazeData.length - 1].timestamp - gazeData[0].timestamp) / 1000).toFixed(1)
      doc.setFillColor(LP.r, LP.g, LP.b)
      doc.roundedRect(margin, y, contentW, 20, 3, 3, "F")
      doc.setDrawColor(P.r, P.g, P.b)
      doc.setLineWidth(0.3)
      doc.roundedRect(margin, y, contentW, 20, 3, 3, "S")
      doc.setFillColor(P.r, P.g, P.b)
      doc.roundedRect(margin, y, 3, 20, 1.5, 1.5, "F")
      doc.setTextColor(P.r, P.g, P.b)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.text("SESSION OVERVIEW", margin + 7, y + 8)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(60, 40, 100)
      doc.text(`Gaze Points Collected: ${gazeData.length}`, margin + 7, y + 16)
      doc.text(`Session Duration: ${durationSec}s`, margin + 90, y + 16)
      y += 28
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const checkPageBreak = (needed: number) => {
      if (y + needed > 278) {
        doc.addPage()
        y = 16
      }
    }

    const drawSectionHeader = (title: string, subtitle?: string) => {
      checkPageBreak(18)
      doc.setFillColor(245, 243, 255)
      doc.rect(margin, y, contentW, 12, "F")
      doc.setFillColor(P.r, P.g, P.b)
      doc.rect(margin, y, 3, 12, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(P.r, P.g, P.b)
      doc.text(title, margin + 7, y + 8.5)
      if (subtitle) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(130, 110, 160)
        doc.text(subtitle, W - margin, y + 8.5, { align: "right" })
      }
      y += 16
    }

    const drawSubHeading = (label: string) => {
      checkPageBreak(10)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.5)
      doc.setTextColor(P.r, P.g, P.b)
      doc.text(label.toUpperCase(), margin + 2, y)
      y += 5
    }

    const drawMetricRow = (x: number, rowY: number, colW: number, key: string, value: any, rowIdx: number) => {
      if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 249, 255)
        doc.rect(x, rowY - 4.5, colW - 1, 6.5, "F")
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(90, 90, 115)
      doc.text(formatLabel(key), x + 2, rowY)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.setTextColor(50, 30, 90)
      const valStr = typeof value === "number" ? value.toFixed(2) : String(value)
      doc.text(valStr, x + colW - 3, rowY, { align: "right" })
    }

    const drawMetricRows = (obj: Record<string, any>) => {
      const entries = Object.entries(obj)
      const half = Math.ceil(entries.length / 2)
      const left = entries.slice(0, half)
      const right = entries.slice(half)
      const colW = contentW / 2
      for (let i = 0; i < left.length; i++) {
        checkPageBreak(8)
        const rowY = y
        const [lk, lv] = left[i]
        drawMetricRow(margin, rowY, colW, lk, lv, i)
        if (right[i]) {
          const [rk, rv] = right[i]
          drawMetricRow(margin + colW, rowY, colW, rk, rv, i)
        }
        y += 7
      }
      y += 3
    }

    const { metrics, plots } = result

    // ── Spatial Metrics ───────────────────────────────────────────────────────
    drawSectionHeader("Spatial Metrics", "Position statistics across the screen")
    if (metrics.spatial?.x_stats) { drawSubHeading("Horizontal (X)"); drawMetricRows(metrics.spatial.x_stats) }
    if (metrics.spatial?.y_stats) { drawSubHeading("Vertical (Y)"); drawMetricRows(metrics.spatial.y_stats) }
    if (metrics.spatial?.outliers) { drawSubHeading("Data Quality"); drawMetricRows(metrics.spatial.outliers) }
    y += 4

    // ── Temporal Metrics ──────────────────────────────────────────────────────
    drawSectionHeader("Temporal Metrics", "Time-based measurements")
    if (metrics.temporal) drawMetricRows(metrics.temporal)

    // ── Attention Metrics ─────────────────────────────────────────────────────
    drawSectionHeader("Attention Metrics", "Focus and engagement")
    if (metrics.attention) drawMetricRows(metrics.attention)

    // ── Distraction Metrics ───────────────────────────────────────────────────
    drawSectionHeader("Distraction Metrics", "Off-screen time analysis")
    if (metrics.distraction) drawMetricRows(metrics.distraction)

    // ── Plot pages ────────────────────────────────────────────────────────────
    const plotList = [
      { key: "heatmap",             title: "Gaze Heatmap",              desc: "Areas of high fixation during playback" },
      { key: "scatter_path",        title: "Gaze Path",                 desc: "Temporal sequencing of gaze points" },
      { key: "x_time_series",       title: "X Coordinate Time Series",  desc: "Horizontal gaze position over time" },
      { key: "y_time_series",       title: "Y Coordinate Time Series",  desc: "Vertical gaze position over time" },
      { key: "aoi_heatmap",         title: "Area of Interest Heatmap",  desc: "Attention distribution across zones (5×5 grid)" },
      { key: "distraction_timeline",title: "Attention Timeline",        desc: "Focus vs distraction periods over time" },
    ]
    const plotsObj = plots as Record<string, string>

    const getImgDims = (src: string): Promise<{ w: number; h: number }> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.src = src
      })

    for (const { key, title, desc } of plotList) {
      if (!plotsObj[key]) continue
      const src = `data:image/png;base64,${plotsObj[key]}`
      const { w, h } = await getImgDims(src)
      const imgH = contentW * (h / w)

      doc.addPage()
      // Mini page header
      doc.setFillColor(P.r, P.g, P.b)
      doc.rect(0, 0, W, 24, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text(title, margin, 13)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(220, 200, 255)
      doc.text(desc, margin, 20)

      doc.addImage(src, "PNG", margin, 30, contentW, imgH)
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(200, 190, 230)
      doc.setLineWidth(0.3)
      doc.line(margin, 289, W - margin, 289)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(160, 150, 185)
      doc.text("Gaze Analysis Report  ·  Infosystem Eye Tracking", margin, 294)
      doc.text(`Page ${i} of ${totalPages}`, W - margin, 294, { align: "right" })
    }

    doc.save("gaze_analysis_report.pdf")
  }
  // Helper function to format metric labels
  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char, index, str) => {
        // Don't capitalize if inside parentheses
        const beforeParen = str.lastIndexOf('(', index)
        const afterParen = str.indexOf(')', index)
        if (beforeParen !== -1 && (afterParen === -1 || afterParen > index)) {
          return char.toLowerCase()
        }
        return char.toUpperCase()
      })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <div className="text-muted-foreground font-semibold">Analysing session data...</div>
      </div>
    )
  }

  if (!result || result.status !== "success") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground font-semibold">No analysis data available</div>
      </div>
    )
  }

  const { metrics, plots } = result

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gaze Analysis Results</h1>
            <p className="text-muted-foreground mt-2">
              Detailed insights from your viewing session
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gazeData && gazeData.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadGazeCSV}
                className="cursor-pointer gap-2"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
            )}
            {result && result.status === "success" && (
              <Button
                variant="default"
                size="sm"
                onClick={downloadPDF}
                className="cursor-pointer gap-2"
              >
                <FileText className="w-4 h-4" />
                Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="space-y-6">
          {/* Spatial Metrics - Full Width */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold tracking-tight">Spatial Metrics</CardTitle>
              <CardDescription className="text-xs">Position statistics across the screen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* X Statistics */}
                {metrics.spatial?.x_stats && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Horizontal (X)
                    </div>
                    <div className="pl-3 space-y-2 border-l-2 border-purple-200 dark:border-purple-800">
                      {Object.entries(metrics.spatial.x_stats).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-baseline max-w-xs">
                          <span className="text-sm text-muted-foreground leading-none">
                            {formatLabel(key)}
                          </span>
                          <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Y Statistics */}
                {metrics.spatial?.y_stats && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Vertical (Y)
                    </div>
                    <div className="pl-3 space-y-2 border-l-2 border-purple-200 dark:border-purple-800">
                      {Object.entries(metrics.spatial.y_stats).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-baseline max-w-xs">
                          <span className="text-sm text-muted-foreground leading-none">
                            {formatLabel(key)}
                          </span>
                          <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outliers */}
                {metrics.spatial?.outliers && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Data Quality
                    </div>
                    <div className="pl-3 space-y-2 border-l-2 border-purple-200 dark:border-purple-800">
                      {Object.entries(metrics.spatial.outliers).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-baseline max-w-xs">
                          <span className="text-sm text-muted-foreground leading-none">
                            {formatLabel(key)}
                          </span>
                          <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                            {typeof value === 'number' ? `${value.toFixed(2)}%` : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Temporal & Attention Metrics - Side by Side */}
          <div className="flex flex-wrap justify-center gap-6">
            {/* Temporal Metrics */}
            <Card className="min-w-80">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Temporal Metrics</CardTitle>
                <CardDescription className="text-xs">Time-based measurements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.temporal && Object.entries(metrics.temporal).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-baseline max-w-xs">
                    <span className="text-sm text-muted-foreground leading-none">
                      {formatLabel(key)}
                    </span>
                    <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                      {typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Attention Metrics */}
            <Card className="min-w-80">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Attention Metrics</CardTitle>
                <CardDescription className="text-xs">Focus and engagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.attention && Object.entries(metrics.attention).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-baseline max-w-xs">
                    <span className="text-sm text-muted-foreground leading-none">
                      {formatLabel(key)}
                    </span>
                    <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                      {typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Distraction Metrics */}
            <Card className="min-w-80">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Distraction Metrics</CardTitle>
                <CardDescription className="text-xs">Off-screen time analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.distraction && Object.entries(metrics.distraction).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-baseline max-w-xs">
                    <span className="text-sm text-muted-foreground leading-none">
                      {formatLabel(key)}
                    </span>
                    <span className="text-base font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                      {typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Visualizations */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visualizations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive visual analysis of gaze patterns
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Heatmap */}
            {plots.heatmap && (
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold">Gaze Heatmap</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Areas of high fixation during playback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg overflow-hidden">
                    <img
                      src={`data:image/png;base64,${plots.heatmap}`}
                      alt="Gaze Heatmap"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scatter Path */}
            {plots.scatter_path && (
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold">Gaze Path</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Temporal sequencing of gaze points
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg overflow-auto">
                    <img
                      src={`data:image/png;base64,${plots.scatter_path}`}
                      alt="Gaze Path"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Time Series */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {plots.x_time_series && (
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold">X Coordinate Time Series</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Horizontal gaze position over time during the session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg overflow-auto">
                    <img
                      src={`data:image/png;base64,${plots.x_time_series}`}
                      alt="X Time Series"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {plots.y_time_series && (
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold">Y Coordinate Time Series</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Vertical gaze position over time during the session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg overflow-auto">
                    <img
                      src={`data:image/png;base64,${plots.y_time_series}`}
                      alt="Y Time Series"
                      className="w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AOI Heatmap */}
          <div className="flex justify-center">
            {plots.aoi_heatmap && (
              <Card className="overflow-hidden w-fit hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold">Area of Interest Heatmap</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Attention distribution across screen zones (5×5 grid)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg overflow-auto">
                    <img
                      src={`data:image/png;base64,${plots.aoi_heatmap}`}
                      alt="AOI Heatmap"
                      className="h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Distraction Timeline - Moved to end */}
          {plots.distraction_timeline && (
            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Attention Timeline</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Focus vs distraction periods over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg overflow-auto">
                  <img
                    src={`data:image/png;base64,${plots.distraction_timeline}`}
                    alt="Attention Timeline"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
