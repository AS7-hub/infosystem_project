"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { CheckCircle2, MousePointerClick } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CardTitle, CardDescription } from "@/components/ui/card"

const CALIBRATION_POINTS = [
  { x: 5, y: 5 }, { x: 50, y: 5 }, { x: 95, y: 5 },
  { x: 5, y: 50 }, { x: 50, y: 50 }, { x: 95, y: 50 },
  { x: 5, y: 95 }, { x: 50, y: 95 }, { x: 95, y: 95 },
]

const CLICKS_REQUIRED = process.env.NEXT_PUBLIC_CLICKS_REQUIRED ? parseInt(process.env.NEXT_PUBLIC_CLICKS_REQUIRED) : 3

const SAMPLE_INTERVAL_MS = 100
const MEASURE_DURATION_MS = 6000
const DISCARD_FIRST_MS = 1000

type Phase = "calibration" | "choice" | "measurement" | "result"

type AccuracyResult = { mean_error_px: number; accuracy_percent: number }

interface CalibrationOverlayProps {
  onComplete: () => void
  onCancel?: () => void
}

export default function CalibrationOverlay({ onComplete, onCancel }: CalibrationOverlayProps) {
  const [clickCounts, setClickCounts] = useState<number[]>(new Array(9).fill(0))
  const [phase, setPhase] = useState<Phase>("calibration")
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(null)
  const [measureCountdown, setMeasureCountdown] = useState(6)
  const samplesRef = useRef<{ x: number; y: number; timestamp: number }[]>([])
  const lastSampleTsRef = useRef<number>(0)
  const measureStartRef = useRef<number>(0)

  useEffect(() => {
    if (phase === "calibration" && clickCounts.every((c) => c >= CLICKS_REQUIRED)) {
      const t = setTimeout(() => setPhase("choice"), 500)
      return () => clearTimeout(t)
    }
  }, [phase, clickCounts])

  useEffect(() => {
    if (phase !== "measurement") return
    setMeasureCountdown(6)
    const targetX = typeof window !== "undefined" ? window.innerWidth / 2 : 0
    const targetY = typeof window !== "undefined" ? window.innerHeight / 2 : 0
    samplesRef.current = []
    lastSampleTsRef.current = 0
    measureStartRef.current = Date.now()

    const interval = setInterval(() => {
      const elapsed = (Date.now() - measureStartRef.current) / 1000
      const left = Math.max(0, Math.ceil(MEASURE_DURATION_MS / 1000 - elapsed))
      setMeasureCountdown(left)
    }, 200)

    const listener = (data: { x: number; y: number } | null, timestamp: number) => {
      if (!data || timestamp - lastSampleTsRef.current < SAMPLE_INTERVAL_MS) return
      lastSampleTsRef.current = timestamp
      samplesRef.current.push({ x: data.x, y: data.y, timestamp })
    }
    webgazer.setGazeListener(listener)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      webgazer.clearGazeListener()
      const startTs = measureStartRef.current
      const used = samplesRef.current.filter((p) => p.timestamp - startTs >= DISCARD_FIRST_MS)
      if (used.length === 0) {
        setPhase("choice")
        return
      }
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/calibration/accuracy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaze_samples: used, target_x: targetX, target_y: targetY }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) return
          setAccuracyResult({
            mean_error_px: data.mean_error_px,
            accuracy_percent: data.accuracy_percent,
          })
          setPhase("result")
        })
        .catch(() => setPhase("choice"))
    }, MEASURE_DURATION_MS)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
      webgazer.clearGazeListener()
    }
  }, [phase])

  // // Unused since calibration cancellation is being handled by fullscreen exit
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.key === "Escape") {
  //       onCancel()
  //     }
  //   }

  //   const handleFullscreenChange = () => {
  //     if (!document.fullscreenElement) {
  //       onCancel()
  //     }
  //   }

  //   document.addEventListener("keydown", handleKeyDown)
  //   document.addEventListener("fullscreenchange", handleFullscreenChange)

  //   return () => {
  //     document.removeEventListener("keydown", handleKeyDown)
  //     document.removeEventListener("fullscreenchange", handleFullscreenChange)
  //   }
  // }, [onCancel])

  const handlePointClick = useCallback((index: number) => {
    setClickCounts((prev) => {
      const newCounts = [...prev]
      if (newCounts[index] < CLICKS_REQUIRED) {
        newCounts[index] += 1
      }
      return newCounts
    })
  }, [])

  const totalClicks = clickCounts.reduce((a, b) => a + b, 0)
  const totalRequired = CALIBRATION_POINTS.length * CLICKS_REQUIRED
  const progressPercentage = Math.round((totalClicks / totalRequired) * 100)



  if (phase === "measurement") {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-card border shadow-sm p-6 rounded-lg max-w-md text-center space-y-4">
          <h2 className="font-semibold text-lg">Measure accuracy</h2>
          <p className="text-sm text-muted-foreground">
            Do not move your mouse. Focus on the center of the screen for 5 seconds (first second is discarded).
          </p>
          <p className="text-2xl font-bold">{measureCountdown}</p>
        </div>
      </div>
    )
  }

  if (phase === "result" && accuracyResult) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-card border shadow-sm p-6 rounded-lg max-w-md text-center space-y-4">
          <h2 className="font-semibold text-lg">Calibration accuracy</h2>
          <p className="text-2xl font-bold text-foreground">{accuracyResult.accuracy_percent.toFixed(1)}%</p>
          <p className="text-sm text-muted-foreground">Mean error: {accuracyResult.mean_error_px.toFixed(1)} px</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md border bg-background font-medium cursor-pointer"
              onClick={() => { setPhase("calibration"); setClickCounts(new Array(9).fill(0)); setAccuracyResult(null) }}
            >
              Recalibrate
            </button>
            <button type="button" className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium cursor-pointer" onClick={onComplete}>
              Proceed to video
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 pointer-events-none max-w-md w-full px-4 z-10">
        <div className="bg-card border shadow-sm p-4 rounded-lg pointer-events-auto">
          {phase === "calibration" &&
            <>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-primary font-bold" />
                Calibration
              </h2>
              <p className="text-sm font-medium text-muted-foreground m-1">
                Click each red dot <strong>{CLICKS_REQUIRED} times</strong> while looking directly at it.<br />
                Keep your head still.
              </p>
              <div className="mt-3 h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </>
          }
          {phase === "choice" &&
            <>
              <CardTitle className="text-lg m-1 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary font-bold" />
                Calibration complete
              </CardTitle>
              <CardDescription className="font-medium m-1 text-center">Measure accuracy or proceed to video</CardDescription>
              <div className="mt-3 h-2 w-full bg-secondary rounded-full overflow-hidden" />
              <div className="flex gap-3 justify-center mt-3">
                <Button className="mx-2 cursor-pointer" type="button" onClick={() => setPhase("measurement")}>
                  Measure accuracy
                </Button>
                <Button className="mx-2 cursor-pointer" type="button" variant="outline" onClick={onComplete}>
                  Proceed to video
                </Button>
              </div>
            </>
          }
        </div>
      </div>

      {CALIBRATION_POINTS.map((point, index) => {
        const clicks = clickCounts[index]
        const isComplete = clicks >= CLICKS_REQUIRED

        let colorClass = "bg-destructive ring-destructive/30"
        if (isComplete) {
          colorClass = "bg-primary ring-primary"
        } else if (clicks > 0) {
          colorClass = "bg-chart-1 ring-chart-1/30"
        }

        const opacityClass = isComplete ? "opacity-50" : "opacity-100"

        return (
          <button
            key={index}
            onClick={() => handlePointClick(index)}
            disabled={isComplete}
            className={cn(
              "absolute w-8 h-8 -ml-4 -mt-4 rounded-full transition-all duration-100 ease-out",
              "ring-4 ring-offset-2 focus:outline-none focus:ring-offset-4",
              !isComplete && "hover:scale-125",
              colorClass,
              opacityClass,
              isComplete ? "cursor-default" : "cursor-pointer"
            )}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
          >
            {isComplete && (
              <CheckCircle2 className="w-full h-full text-primary-foreground p-1" />
            )}
          </button>
        )
      })}
    </div>
  )
}
