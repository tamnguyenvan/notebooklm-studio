'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPickerModal({ onSelect, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelect = (em: any) => {
    onSelect(em.native)
    onClose()
  }

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          theme="auto"
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={2}
        />
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
