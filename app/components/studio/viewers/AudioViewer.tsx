'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { ipc, ArtifactType } from '../../../lib/ipc'
import { Select } from '../../ui/Dropdown'
import { Slider } from '../../ui/Slider'

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

export function AudioViewer({ notebookId, artifactType }: Props) {
  const [url, setUrl]             = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [playing, setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]   = useState(0)
  const [speed, setSpeed]         = useState('1')
  const [volume, setVolume]       = useState(1)
  const [dragging, setDragging]   = useState(false)
  const audioRef  = useRef<HTMLAudioElement>(null)
  const trackRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ipc.getArtifactStreamUrl(notebookId, artifactType)
      .then(setUrl)
      .catch((e) => setError(String(e)))
  }, [notebookId, artifactType])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime     = () => setCurrentTime(audio.currentTime)
    const onMeta     = () => setDuration(audio.duration)
    const onEnded    = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
    }
  }, [url])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = Number(speed)
  }, [speed])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else         { audio.play();  setPlaying(true)  }
  }

  const seek = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + delta))
  }

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * duration
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekToRatio((e.clientX - rect.left) / rect.width)
  }

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    const rect = e.currentTarget.getBoundingClientRect()
    seekToRatio((e.clientX - rect.left) / rect.width)

    const onMove = (ev: MouseEvent) => {
      const r = trackRef.current?.getBoundingClientRect()
      if (r) seekToRatio((ev.clientX - r.left) / r.width)
    }
    const onUp = () => {
      setDragging(false)
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
    <div className="flex flex-col h-full items-center justify-center p-6 gap-6">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Album art */}
      <img
        src="/thumbnails/audio.webp"
        alt="Audio"
        className="w-28 h-28 rounded-2xl object-cover shrink-0"
      />

      {/* Time labels */}
      <div className="w-full flex flex-col gap-2">
        {/* Scrubber track */}
        <div
          ref={trackRef}
          className="relative h-1.5 rounded-full cursor-pointer group"
          style={{ background: 'var(--color-separator)' }}
          onClick={handleTrackClick}
          onMouseDown={handleTrackMouseDown}
        >
          {/* Filled */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
            style={{ width: `${progress}%`, background: 'var(--color-accent)' }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-opacity"
            style={{
              left: `${progress}%`,
              background: 'var(--color-accent)',
              boxShadow: '0 0 0 3px var(--color-accent-subtle)',
              opacity: dragging ? 1 : 0,
            }}
          />
          {/* Show thumb on hover via group */}
          <style>{`.group:hover > div:last-child { opacity: 1 !important; }`}</style>
        </div>

        <div className="flex justify-between">
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{fmt(currentTime)}</span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => seek(-10)}
          className="p-2 rounded-full transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Back 10s"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ background: 'var(--color-accent)', color: '#fff', boxShadow: 'var(--shadow-md)' }}
        >
          {playing
            ? <Pause  className="w-5 h-5" />
            : <Play   className="w-5 h-5 ml-0.5" />}
        </button>

        <button
          onClick={() => seek(10)}
          className="p-2 rounded-full transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Forward 10s"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Speed + Volume row */}
      <div className="w-full flex items-center justify-between">
        <Select
          options={SPEED_OPTIONS}
          value={speed}
          onChange={setSpeed}
          align="left"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVolume(v => v > 0 ? 0 : 1)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {volume === 0
              ? <VolumeX className="w-3.5 h-3.5" />
              : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <Slider value={volume} onChange={setVolume} width={80} />
        </div>
      </div>
    </div>
  )
}
