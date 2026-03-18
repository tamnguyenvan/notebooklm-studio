'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { X, Check } from 'lucide-react'
import { ArtifactType, GenerateConfig, Source } from '../../lib/ipc'
import { Select } from '../ui/Dropdown'

interface Props {
  artifactType: ArtifactType
  sources: Source[]
  onClose: () => void
  onGenerate: (config: GenerateConfig) => void
}

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' },
  { code: 'zh_Hans', label: '中文简体' }, { code: 'zh_Hant', label: '中文繁體' },
  { code: 'ko', label: '한국어' }, { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' },
  { code: 'pt_BR', label: 'Português' }, { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' }, { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' }, { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' }, { code: 'tr', label: 'Türkçe' },
]

const VIDEO_STYLES = [
  { id: 'auto', label: 'Auto' }, { id: 'classic', label: 'Classic' },
  { id: 'whiteboard', label: 'Whiteboard' }, { id: 'kawaii', label: 'Kawaii' },
  { id: 'anime', label: 'Anime' }, { id: 'watercolor', label: 'Watercolor' },
  { id: 'retro', label: 'Retro' }, { id: 'heritage', label: 'Heritage' },
  { id: 'paper_craft', label: 'Paper Craft' },
]

function SegmentedControl<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-separator)' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: value === opt.value ? 'var(--color-accent)' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

/** Checkbox list to pick a subset of sources. Empty selection = all sources. */
function SourceSelector({
  sources,
  selected,
  onChange,
}: {
  sources: Source[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (sources.length === 0) return null
  const hasSelection = selected.length > 0

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row — always same height */}
      <div className="flex items-center justify-between" style={{ minHeight: 18 }}>
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {hasSelection ? `Sources (${selected.length} selected)` : 'Sources (all)'}
        </label>
        <button
          onClick={() => onChange([])}
          className="text-xs transition-opacity"
          style={{
            color: 'var(--color-accent)',
            opacity: hasSelection ? 1 : 0,
            pointerEvents: hasSelection ? 'auto' : 'none',
          }}
        >
          Clear selection
        </button>
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--color-separator)', maxHeight: 140, overflowY: 'auto' }}
      >
        {sources.map((src, i) => {
          const checked = selected.includes(src.id)
          return (
            <button
              key={src.id}
              onClick={() => toggle(src.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{
                borderTop: i > 0 ? '1px solid var(--color-separator)' : undefined,
                background: checked ? 'var(--color-accent-subtle)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--color-app-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = checked ? 'var(--color-accent-subtle)' : 'transparent' }}
            >
              <div
                className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                style={{
                  border: checked ? 'none' : '1.5px solid var(--color-separator)',
                  background: checked ? 'var(--color-accent)' : 'transparent',
                }}
              >
                {checked && <Check size={10} color="#fff" strokeWidth={3} />}
              </div>
              <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>
                {src.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Form components ───────────────────────────────────────────────────────────

function AudioForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [format, setFormat] = useState<'deep_dive' | 'brief' | 'critique' | 'debate'>('deep_dive')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [language, setLanguage] = useState('en')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Audio Overview" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'audio', format, length, language, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Format">
        <SegmentedControl
          options={[{ value: 'deep_dive', label: 'Deep Dive' }, { value: 'brief', label: 'Brief' }, { value: 'critique', label: 'Critique' }, { value: 'debate', label: 'Debate' }]}
          value={format} onChange={setFormat}
        />
      </Field>
      <Field label="Length">
        <SegmentedControl
          options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Default' }, { value: 'long', label: 'Long' }]}
          value={length} onChange={setLength}
        />
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function VideoForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [format, setFormat] = useState<'standard' | 'shorts'>('standard')
  const [style, setStyle] = useState('auto')
  const [language, setLanguage] = useState('en')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Video Overview" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'video', format, style, language, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Format">
        <SegmentedControl
          options={[{ value: 'standard', label: 'Standard' }, { value: 'shorts', label: 'Shorts' }]}
          value={format} onChange={setFormat}
        />
      </Field>
      <Field label="Visual Style">
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className="py-2 px-1 rounded-lg border text-xs font-medium transition-colors"
              style={{
                borderColor: style === s.id ? 'var(--color-accent)' : 'var(--color-separator)',
                background: style === s.id ? 'var(--color-accent-subtle)' : 'transparent',
                color: style === s.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function SlidesForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [format, setFormat] = useState<'detailed' | 'presenter'>('detailed')
  const [length, setLength] = useState<'short' | 'medium'>('medium')
  const [language, setLanguage] = useState('en')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Slide Deck" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'slides', format, length, language, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Format">
        <SegmentedControl
          options={[{ value: 'detailed', label: 'Detailed' }, { value: 'presenter', label: 'Presenter' }]}
          value={format} onChange={setFormat}
        />
      </Field>
      <Field label="Length">
        <SegmentedControl
          options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Default' }]}
          value={length} onChange={setLength}
        />
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function QuizForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [quantity, setQuantity] = useState<'few' | 'standard' | 'many'>('standard')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Quiz" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'quiz', quantity, difficulty, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Quantity">
        <SegmentedControl
          options={[{ value: 'few', label: 'Few (5)' }, { value: 'standard', label: 'Standard (10)' }, { value: 'many', label: 'Many (20)' }]}
          value={quantity} onChange={setQuantity}
        />
      </Field>
      <Field label="Difficulty">
        <SegmentedControl
          options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }, { value: 'mixed', label: 'Mixed' }]}
          value={difficulty} onChange={setDifficulty}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function FlashcardsForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [quantity, setQuantity] = useState<'few' | 'standard' | 'many'>('standard')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Flashcards" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'flashcards', quantity, difficulty, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Quantity">
        <SegmentedControl
          options={[{ value: 'few', label: 'Few' }, { value: 'standard', label: 'Standard' }, { value: 'many', label: 'Many' }]}
          value={quantity} onChange={setQuantity}
        />
      </Field>
      <Field label="Difficulty">
        <SegmentedControl
          options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }, { value: 'mixed', label: 'Mixed' }]}
          value={difficulty} onChange={setDifficulty}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function InfographicForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [detail, setDetail] = useState<'overview' | 'standard' | 'detailed'>('standard')
  const [language, setLanguage] = useState('en')
  const [instructions, setInstructions] = useState('')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Infographic" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'infographic', orientation, detail, language, instructions: instructions || undefined, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Orientation">
        <SegmentedControl
          options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }, { value: 'square', label: 'Square' }]}
          value={orientation} onChange={setOrientation}
        />
      </Field>
      <Field label="Detail Level">
        <SegmentedControl
          options={[{ value: 'overview', label: 'Overview' }, { value: 'standard', label: 'Standard' }, { value: 'detailed', label: 'Detailed' }]}
          value={detail} onChange={setDetail}
        />
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <Field label="Instructions (optional)">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          rows={3} placeholder="Optional extra instructions…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function ReportForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [template, setTemplate] = useState<'briefing' | 'study_guide' | 'blog_post' | 'custom'>('study_guide')
  const [extra, setExtra] = useState('')
  const [language, setLanguage] = useState('en')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Report" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'report', template, extra_instructions: extra || undefined, language, source_ids: sourceIds.length ? sourceIds : undefined })}>
      <Field label="Template">
        <SegmentedControl
          options={[{ value: 'briefing', label: 'Briefing' }, { value: 'study_guide', label: 'Study Guide' }, { value: 'blog_post', label: 'Blog Post' }, { value: 'custom', label: 'Custom' }]}
          value={template} onChange={setTemplate}
        />
      </Field>
      <Field label={template === 'custom' ? 'Custom prompt' : 'Extra instructions (optional)'}>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)}
          rows={4} placeholder={template === 'custom' ? 'Describe the report you want…' : 'Optional extra instructions…'}
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function DataTableForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [language, setLanguage] = useState('en')
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Data Table" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'data_table', structure_prompt: prompt, language, source_ids: sourceIds.length ? sourceIds : undefined })}
      disableGenerate={!prompt.trim()}>
      <Field label="Describe the table structure">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          rows={4} placeholder="e.g. A comparison table of key metrics across all sources…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: 'var(--color-app-bg)', borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)', outline: 'none' }} />
      </Field>
      <Field label="Language">
        <Select
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={setLanguage}
          triggerClassName="w-full"
          triggerStyle={{ justifyContent: 'space-between' }}
        />
      </Field>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

function MindMapForm({ sources, onGenerate, onClose }: { sources: Source[]; onGenerate: (c: GenerateConfig) => void; onClose: () => void }) {
  const [sourceIds, setSourceIds] = useState<string[]>([])
  return (
    <ModalShell title="Generate Mind Map" onClose={onClose}
      onGenerate={() => onGenerate({ type: 'mind_map', source_ids: sourceIds.length ? sourceIds : undefined })}>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        A mind map will be generated from your notebook sources. Optionally select specific sources below.
      </p>
      <SourceSelector sources={sources} selected={sourceIds} onChange={setSourceIds} />
    </ModalShell>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({
  title, onClose, onGenerate, disableGenerate, children,
}: {
  title: string
  onClose: () => void
  onGenerate: () => void
  disableGenerate?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(4px)' }}
      initial={{ background: 'rgba(0,0,0,0)' }}
      animate={{ background: 'rgba(0,0,0,0.4)' }}
      exit={{ background: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.15 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          width: '480px',
          height: 'min-content',
          maxHeight: '80vh',
          background: 'var(--color-elevated)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-separator)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto" style={{ minHeight: 0 }}>{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--color-separator)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            Cancel
          </button>
          <button onClick={onGenerate} disabled={disableGenerate}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: 'var(--color-accent)', color: '#fff', opacity: disableGenerate ? 0.4 : 1 }}>
            Generate
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function GenerateModal({ artifactType, sources, onClose, onGenerate }: Props) {
  const props = { sources, onGenerate, onClose }
  return (
    <AP>
      {(() => {
        switch (artifactType) {
          case 'audio':       return <AudioForm {...props} />
          case 'video':       return <VideoForm {...props} />
          case 'slides':      return <SlidesForm {...props} />
          case 'quiz':        return <QuizForm {...props} />
          case 'flashcards':  return <FlashcardsForm {...props} />
          case 'infographic': return <InfographicForm {...props} />
          case 'report':      return <ReportForm {...props} />
          case 'data_table':  return <DataTableForm {...props} />
          case 'mind_map':    return <MindMapForm {...props} />
          default:            return null
        }
      })()}
    </AP>
  )
}
