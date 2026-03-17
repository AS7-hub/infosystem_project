"use client"

import { useRef } from "react"
import { Video, GazePoint } from "@/types"

interface VideoPlayerProps {
  video: Video | null
  onVideoEnd: () => void
}

export default function VideoPlayer({ video, onVideoEnd }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  if (!video) {
    return <div className="p-4 text-center text-destructive">Video data is unavailable</div>
  }

  if (video.source_type === "REMOTE") {
    // Note: 'enablejsapi=1' is REQUIRED for onEnded detection
    const embedSrc = `${video.meta.embed_url}?rel=0&autoplay=1&fs=0&modestbranding=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black w-screen h-screen">
        <iframe
          src={embedSrc}
          title={video.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        />
      </div>
    )
  }

  if (video.source_type === "LOCAL") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black w-screen h-screen">
        <video
          ref={videoRef}
          controls
          autoPlay
          className="h-full w-full"
          poster={video.meta.thumbnail_url || undefined}
          onEnded={onVideoEnd}
        >
          <source src={video.meta.cdn_url} type={video.meta.mime_type} />
          Your browser does not support the video tag
        </video>
      </div>
    )
  }

  return <div className="p-4 text-center text-red-500">Unsupported Video Type</div>
}