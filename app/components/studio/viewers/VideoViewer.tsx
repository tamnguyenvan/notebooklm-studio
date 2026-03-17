'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Maximize2 } from 'lucide-react'
import { ipc, ArtifactType } from '../../../lib/ipc'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any

interface Props {
  notebookId: string
  artifactType: ArtifactType
}

const SPEED_OPTIONS = [
  { value: '0.75', label: '0.75×' },
  { value: '1',    label: '1×'    },
  { value: '1.25', label: '1.25×' },
  { value: '1.5',  label: '1.5×'  },
  { value: '2',    label: '2×'    },
]

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VideoViewer({ notebookId, artifactType }: Props) {
  const [url, setUrl]           = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [playing, setPlaying]   = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed]       = useState('1')
  const [speedOpen, setSpeedOpen] = useState(false)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const trackRef   = useRef<HTMLDivElement>(null)
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ipc.getArtifactStreamUrl(notebookId, artifactType)
      .then(setUrl)
      .catch((e) => setError(String(e)))
  }, [notebookId, artifactType])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime  = () => setCurrentTime(v.currentTime)
    const onMeta  = () => setDuration(v.duration)
    const onEnded = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('ended', onEnded)
    }
  }, [url])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = Number(speed)
  }, [speed])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else         { v.play();  setPlaying(true)  }
  }

  const nudgeControls = () => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  const seekToRatio = (ratio: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(1, ratio)) * duration
  }

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    seekToRatio((e.clientX - rect.left) / rect.width)
    const onMove = (ev: MouseEvent) => {
      const r = trackRef.current?.getBoundingClientRect()
      if (r) seekToRatio((ev.clientX - r.left) / r.width)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
    </div>
  )

  if (!url) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div
      className="relative flex flex-col h-full bg-black"
      onMouseMove={nudgeControls}
      onMouseLeave={() => { if (playing) setShowControls(false) }}
    >
      <video
        ref={videoRef}
        src={url}
        className="flex-1 w-full object-contain"
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 pt-8 pb-3 flex flex-col gap-2.5 transition-opacity duration-200"
        style={{
          opacity: showControls ? 1 : 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
          pointerEvents: showControls ? 'auto' : 'none',
        }}
      >
        {/* Scrubber */}
        <div
          ref={trackRef}
          className="relative h-1 rounded-full cursor-pointer group"
          style={{ background: 'rgba(255,255,255,0.25)' }}
          onMouseDown={handleTrackMouseDown}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${progress}%`, background: 'var(--color-accent)' }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              left: `${progress}%`,
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white p-1 transition-opacity hover:opacity-75">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-white text-xs font-mono tabular-nums opacity-80">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed picker */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setSpeedOpen(v => !v) }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium tabular-nums transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              >
                {speed}×
              </button>
              <AP>
                {speedOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute bottom-[calc(100%+6px)] right-0 rounded-xl py-1.5 z-50 overflow-hidden"
                    style={{
                      background: 'rgba(30,30,32,0.92)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(12px)',
                      minWidth: 80,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {SPEED_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => { setSpeed(o.value); setSpeedOpen(false) }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors"
                        style={{ color: o.value === speed ? '#fff' : 'rgba(255,255,255,0.6)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="tabular-nums">{o.label}</span>
                        {o.value === speed && (
                          <span style={{ color: 'var(--color-accent)', fontSize: 10 }}>✓</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AP>
            </div>
            <button
              onClick={() => videoRef.current?.requestFullscreen()}
              className="text-white p-1 transition-opacity hover:opacity-75"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
