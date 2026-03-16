'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Maximize2, Volume2 } from 'lucide-react'
import { ipc, ArtifactType } from '../../../lib/ipc'

interface Props {
  notebookId: string
  artifactType: ArtifactType
}

export function VideoViewer({ notebookId, artifactType }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ipc.getArtifactStreamUrl(notebookId, artifactType)
      .then(setUrl)
      .catch((e) => setError(String(e)))
  }, [notebookId, artifactType])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onDuration = () => setDuration(v.duration)
    const onEnded = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onDuration)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onDuration)
      v.removeEventListener('ended', onEnded)
    }
  }, [url])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
    </div>
  )

  if (!url) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div
      className="relative flex flex-col h-full bg-black"
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        src={url}
        className="flex-1 w-full object-contain"
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 transition-opacity duration-200"
        style={{
          opacity: showControls ? 1 : 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}
      >
        {/* Seek bar */}
        <div
          className="w-full h-1 rounded-full mb-3 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.3)' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            if (videoRef.current) videoRef.current.currentTime = ratio * duration
          }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: 'var(--color-accent)' }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white p-1">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-white text-xs font-mono">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs rounded px-1 py-0.5 bg-black/50 text-white border border-white/20"
            >
              {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>
            <button
              onClick={() => videoRef.current?.requestFullscreen()}
              className="text-white p-1"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
