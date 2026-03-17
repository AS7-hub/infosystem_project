"use client"

import { AlertCircle } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useState, useEffect, useRef, useReducer } from "react"
import { Video, GazePoint, AnalyticsResult, CalibrationAccuracyResult } from "@/types"
import VideoPlayer from "@/components/video-player"
import IdleScreen from "@/components/idle-screen"
import CalibrationOverlay from "@/components/calibration-overlay"
import AnalysisDashboard from "@/components/analysis-dashboard"

type WatchState = {
  status: "LOADING" | "IDLE" | "CALIBRATING" | "POST_CALIBRATION" | "MEASURING_ACCURACY" | "ACCURACY_RESULT" | "PLAYING" | "SUMMARY" | "ERROR"
  video: Video | null
  error: string | null
  gazeData: GazePoint[] | null
  analysisResult: AnalyticsResult | null
  accuracyResult: CalibrationAccuracyResult | null
}

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; payload: Video }
  | { type: "LOAD_FAIL"; payload: string }
  | { type: "START_CALIBRATION" }
  | { type: "SHOW_POST_CALIBRATION" }
  | { type: "START_MEASURING_ACCURACY" }
  | { type: "SET_ACCURACY_RESULT"; payload: CalibrationAccuracyResult }
  | { type: "RECALIBRATE" }
  | { type: "START_PLAYING" }
  | { type: "SET_GAZE_DATA"; payload: GazePoint[] }
  | { type: "LOAD_ANALYSIS"; payload: AnalyticsResult }
  | { type: "END_SESSION" }
  | { type: "SET_ERROR"; payload: string }

function reducer(state: WatchState, action: Action): WatchState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, status: "LOADING", error: null }
    case "LOAD_SUCCESS":
      return { ...state, status: "IDLE", video: action.payload }
    case "LOAD_FAIL":
      return { ...state, status: "ERROR", error: action.payload }
    case "START_CALIBRATION":
      return { ...state, status: "CALIBRATING", error: null, accuracyResult: null }
    case "SHOW_POST_CALIBRATION":
      return { ...state, status: "POST_CALIBRATION" }
    case "START_MEASURING_ACCURACY":
      return { ...state, status: "MEASURING_ACCURACY" }
    case "SET_ACCURACY_RESULT":
      return { ...state, status: "ACCURACY_RESULT", accuracyResult: action.payload }
    case "RECALIBRATE":
      return { ...state, status: "CALIBRATING", accuracyResult: null }
    case "START_PLAYING":
      return { ...state, status: "PLAYING" }
    case "SET_GAZE_DATA":
      return { ...state, gazeData: action.payload }
    case "LOAD_ANALYSIS":
      return { ...state, analysisResult: action.payload, status: "SUMMARY" }
    case "END_SESSION":
      return { ...state, status: "SUMMARY" }
    case "SET_ERROR":
      return { ...state, status: "ERROR", error: action.payload }
  }
}

const initialState: WatchState = {
  status: "LOADING",
  video: null,
  error: null,
  gazeData: null,
  analysisResult: null,
  accuracyResult: null,
}

export default function WatchPage() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [showReentryDialog, setShowReentryDialog] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const gazeDataRef = useRef<GazePoint[]>([])
  const viewportRef = useRef<{ width: number; height: number } | null>(null)

  const slotRef = useRef<HTMLDivElement>(null)
  const videoContainer = document.getElementById("webgazerVideoContainer")

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const videoId = window.location.pathname.split('/')[2];
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/videos/${videoId}`)
        if (response.ok) {
          const video = await response.json()
          await webgazer.showVideo(true).begin()
          dispatch({ type: "LOAD_SUCCESS", payload: video })
        } else {
          console.error("Failed to fetch video")
          webgazer.end()
          dispatch({ type: "LOAD_FAIL", payload: "Unable to fetch content" })
        }
      } catch (error) {
        console.error("Error fetching video:", error)
        webgazer.end()
        dispatch({ type: "LOAD_FAIL", payload: "An error occurred while fetching content" })
      }
    };

    fetchVideo();
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (
          state.status === "CALIBRATING" ||
          state.status === "POST_CALIBRATION" ||
          state.status === "MEASURING_ACCURACY" ||
          state.status === "ACCURACY_RESULT" ||
          state.status === "PLAYING"
        ) {
          setShowReentryDialog(true)
        }
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [state.status])

  useEffect(() => {    
    const slot = slotRef.current
    const video = document.getElementById("webgazerVideoFeed")

    if (videoContainer && video &&  slot && state.status === "IDLE") {
      slot.appendChild(videoContainer)
      
      videoContainer.style.position = "relative" 
      videoContainer.style.top = "auto"
      videoContainer.style.left = "auto"
      videoContainer.style.margin = "0"
      videoContainer.style.borderRadius = "1rem"
      videoContainer.style.overflow = "hidden"
      videoContainer.style.border = "2px solid hsl(var(--border))"
      videoContainer.style.transform = "scale(1.5)"
    }
  }, [state.status])

  // Set up gaze data collection when entering PLAYING state
  useEffect(() => {
    if (state.status === "PLAYING") {
      webgazer.showPredictionPoints(false)

      gazeDataRef.current = []
      viewportRef.current = {
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      }
      console.log("👀 Gaze collection started (PLAYING state)")
      
      webgazer.setGazeListener((data: any, timestamp: number) => {
        if (data) {
          gazeDataRef.current.push({
            x: data.x,
            y: data.y,
            timestamp: timestamp,
          })
          console.log(`📍 Gaze point collected (total: ${gazeDataRef.current.length})`)
        }
      })

      return () => {
        console.log(`🛑 Gaze collection stopped. Total points collected: ${gazeDataRef.current.length}`)
        webgazer.clearGazeListener()
      }
    }
  }, [state.status])

  const transitionToSummary = async () => {
    console.log("📤 Transitioning to SUMMARY, sending gaze data. Points collected:", gazeDataRef.current.length)
    
    if (gazeDataRef.current.length > 0) {
      try {
        const body: { gaze_data: GazePoint[]; viewport_width?: number; viewport_height?: number } = {
          gaze_data: gazeDataRef.current,
        }
        if (viewportRef.current && viewportRef.current.width > 0 && viewportRef.current.height > 0) {
          body.viewport_width = viewportRef.current.width
          body.viewport_height = viewportRef.current.height
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        console.log("Response status:", response.status)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: AnalyticsResult = await response.json()
        dispatch({ type: "LOAD_ANALYSIS", payload: data })
        console.log("✅ Gaze analysis result:", data)
      } catch (error) {
        console.error("❌ Error sending gaze data to backend:", error)
        dispatch({ type: "END_SESSION" })
      }
    } else {
      console.warn("⚠️ No gaze data collected, transitioning to SUMMARY without analysis")
      dispatch({ type: "END_SESSION" })
    }
  }

  const handleVideoEnd = async () => {
    console.log("🎬 Video ended event triggered")
    dispatch({ type: "SET_GAZE_DATA", payload: gazeDataRef.current })
    await transitionToSummary()
  }

  const enterFullscreenAndStart = async () => {
    if (!containerRef.current) return
    if (process.env.NEXT_PUBLIC_SHOW_PREDICTION_DOT == "true")
      webgazer.showPredictionPoints(true)
    const gazeDot = document.getElementById("webgazerGazeDot")

    try {
      containerRef.current.appendChild(gazeDot!)
      await containerRef.current.requestFullscreen()
      if (!videoContainer)
        throw new Error("Critical Error: Video Stream Lost")

      document.body.appendChild(videoContainer)
      videoContainer.style.position = "fixed"
      videoContainer.style.top = "0px"
      videoContainer.style.left = "0px"
      videoContainer.style.transform = "scale(1)"
      webgazer.showVideo(false)

      dispatch({ type: "START_CALIBRATION" })
    } catch (err) {
      console.warn("Fullscreen denied:", err)
      webgazer.end()
      dispatch({ type: "SET_ERROR", payload: "Fullscreen is required to proceed. Please allow fullscreen access" })
    }
  }

  const finishCalibration = () => {
    dispatch({ type: "SHOW_POST_CALIBRATION" })
  }

  const handleStopSession = async () => {
    console.log("🛑 Stop session triggered, current status:", state.status)
    setShowReentryDialog(false)
    webgazer.showPredictionPoints(false).end()
    
    if (state.status === "CALIBRATING") {
      dispatch({ type: "SET_ERROR", payload: "Calibration cancelled. Please refresh and try again" })
    } else if (
      state.status === "POST_CALIBRATION" ||
      state.status === "MEASURING_ACCURACY" ||
      state.status === "ACCURACY_RESULT"
    ) {
      dispatch({ type: "SET_ERROR", payload: "Session cancelled. Please refresh and try again" })
    } else if (state.status === "PLAYING") {
      // User exited fullscreen during playback - send gaze data before transitioning to SUMMARY
      console.log("User exited during PLAYING state, sending gaze data")
      dispatch({ type: "SET_GAZE_DATA", payload: gazeDataRef.current })
      await transitionToSummary()
    } else {
      dispatch({ type: "END_SESSION" })
    }
  }

  const handleResumeFullscreen = async () => {
    if (containerRef.current) {
      try {
        await containerRef.current.requestFullscreen()
        setShowReentryDialog(false)
      } catch (e) {
        console.error("Failed to re-enter fullscreen")
      }
    }
  }

  return (
    <div ref={containerRef} className="bg-background">
      {state.status === "IDLE" && (
        <IdleScreen onStart={enterFullscreenAndStart} slotRef={slotRef} />
      )}

      {state.status === "LOADING" &&
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground font-semibold">Loading content...</div>
        </div>
      }

      {state.status === "ERROR" && (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <div className="text-lg font-semibold text-foreground">
            Error
          </div>
          <p className=" text-muted-foreground">
            {state.error || "An unexpected error occurred"}
          </p>
        </div>
      )}


      {state.status === "CALIBRATING" && (
        <CalibrationOverlay onComplete={finishCalibration} onCancel={() => {}}/>
      )}

      {state.status === "POST_CALIBRATION" && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center">
          <div className="bg-card border shadow-sm p-6 rounded-lg max-w-md text-center space-y-4">
            <h2 className="font-semibold text-lg">Calibration complete</h2>
            <p className="text-sm text-muted-foreground">Measure accuracy or proceed to video.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium cursor-pointer"
                onClick={() => dispatch({ type: "START_MEASURING_ACCURACY" })}
              >
                Measure accuracy
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md border bg-background font-medium cursor-pointer"
                onClick={() => dispatch({ type: "START_PLAYING" })}
              >
                Proceed to video
              </button>
            </div>
          </div>
        </div>
      )}

      {state.status === "MEASURING_ACCURACY" && (
        <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center">
          <p className="text-muted-foreground font-medium">Measuring accuracy...</p>
        </div>
      )}

      {state.status === "ACCURACY_RESULT" && state.accuracyResult && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center">
          <div className="bg-card border shadow-sm p-6 rounded-lg max-w-md text-center space-y-4">
            <h2 className="font-semibold text-lg">Calibration accuracy</h2>
            <p className="text-2xl font-bold text-foreground">
              {state.accuracyResult.accuracy_percent.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Mean error: {state.accuracyResult.mean_error_px.toFixed(1)} px
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md border bg-background font-medium cursor-pointer"
                onClick={() => dispatch({ type: "RECALIBRATE" })}
              >
                Recalibrate
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium cursor-pointer"
                onClick={() => dispatch({ type: "START_PLAYING" })}
              >
                Proceed to video
              </button>
            </div>
          </div>
        </div>
      )}

      {state.status === "PLAYING" && (
        <div className="container mx-auto">
          <VideoPlayer video={state.video} onVideoEnd={handleVideoEnd} />
        </div>
      )}

      {state.status === "SUMMARY" && (
        <AnalysisDashboard result={state.analysisResult} />
      )}

      {showReentryDialog && (
        <div className="fixed inset-0 z-[999] bg-background/20 backdrop-blur-md transition-all duration-100 animate-in fade-in" />
      )}

      <AlertDialog open={showReentryDialog}>
        <AlertDialogContent className="z-[1000]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="font-extrabold">Fullscreen Paused</div>
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
                {state.status === "CALIBRATING"
                  ? "Calibration requires fullscreen. Resume to continue, or stop to cancel."
                  : state.status === "POST_CALIBRATION" ||
                    state.status === "MEASURING_ACCURACY" ||
                    state.status === "ACCURACY_RESULT"
                    ? "Resume fullscreen to continue, or stop to cancel."
                    : "Playback requires fullscreen. Resume to watch, or finish the session."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStopSession} className="cursor-pointer">
              {state.status === "CALIBRATING"
                ? "Stop Calibration"
                : state.status === "POST_CALIBRATION" ||
                  state.status === "MEASURING_ACCURACY" ||
                  state.status === "ACCURACY_RESULT"
                  ? "Stop"
                  : "Finish Session"}
            </AlertDialogCancel>
            
            <AlertDialogAction onClick={handleResumeFullscreen} className="cursor-pointer">
              Resume Fullscreen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
