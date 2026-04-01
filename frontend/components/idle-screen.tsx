"use client"

import { Maximize, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardTitle, CardDescription } from "@/components/ui/card"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const LUMA_THRESHOLD = 100   // out of 255 — below this is considered too dark
const POLL_INTERVAL_MS = 500

type Props = {
  onStart: () => void
  slotRef: React.RefObject<HTMLDivElement | null>
}

function sampleLuma(): number | null {
  const video = document.getElementById("webgazerVideoFeed") as HTMLVideoElement | null
  if (!video || video.readyState < 2) return null

  const W = 80, H = 60
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)

  let total = 0
  const pixels = W * H
  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    total += 0.299 * r + 0.587 * g + 0.114 * b
  }
  return total / pixels
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
        : <XCircle className="w-4 h-4 text-destructive shrink-0" />
      }
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  )
}

export default function IdleScreen({ onStart, slotRef }: Props) {
  const [showOverlay, setShowOverlay] = useState(true)
  const [faceDetected, setFaceDetected] = useState(false)
  const [lightingOk, setLightingOk] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Attach dummy listener to force WebGazer to continuously generate predictions
    // without this, WebGazer pauses prediction logic if there is no active listener.
    const dummyListener = () => {}
    webgazer.setGazeListener(dummyListener)

    const poll = async () => {
      // Face detection
      try {
        const prediction = await webgazer.getCurrentPrediction()
        setFaceDetected(prediction !== null)
      } catch {
        setFaceDetected(false)
      }

      // Lighting
      const luma = sampleLuma()
      setLightingOk(luma !== null && luma >= LUMA_THRESHOLD)
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      webgazer.clearGazeListener()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const onToggleOverlay = () => {
    webgazer.showFaceOverlay(!showOverlay).showFaceFeedbackBox(!showOverlay)
    setShowOverlay(!showOverlay)
  }

  const allChecksPassed = faceDetected && lightingOk

  return (
    <div className="flex-1 grid grid-cols-2 h-[calc(100vh-3.6rem)] mx-64">
      <div className="flex flex-col items-center justify-center gap-6">
        <div ref={slotRef} id="video-preview-slot" className="flex items-center justify-center" />
        <Button variant="outline" onClick={onToggleOverlay} className="gap-2 font-semibold cursor-pointer">
          Toggle Face Overlay
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center space-y-6 p-12">
        <h1 className="text-3xl font-extrabold">Ready to Start?</h1>
        <p className="text-muted-foreground max-w-md text-center font-medium">
          This session requires fullscreen mode for accurate eye tracking.
          Please sit comfortably and ensure your face is well-lit.
        </p>

        {/* Pre-calibration status panel */}
        <Card className="w-full max-w-xs py-4 gap-3">
          <div className="px-4 space-y-1">
            <CardTitle className="text-sm">Camera checks</CardTitle>
          </div>
          <div className="px-4 space-y-2">
            <CheckRow ok={faceDetected} label="Face detected" />
            <CheckRow ok={lightingOk} label="Adequate lighting" />
          </div>
        </Card>

        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={onStart}
            disabled={!allChecksPassed}
            className="gap-2 font-bold px-10 py-5 cursor-pointer"
          >
            <Maximize className="w-5 h-5" />
            Enter Fullscreen & Start
          </Button>
          {!allChecksPassed && (
            <p className="text-muted-foreground text-sm font-medium text-center">
              {!faceDetected && !lightingOk
                ? "Position your face in frame and improve lighting to continue"
                : !faceDetected
                  ? "Position your face in the camera frame to continue"
                  : "Improve room lighting to continue"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}