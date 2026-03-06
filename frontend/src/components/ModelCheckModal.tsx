import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit: (prop: string) => void
  onClose: () => void
  isChecking: boolean
}

export default function ModelCheckModal({ onSubmit, onClose, isChecking }: Props) {
  const [prop, setProp] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = prop.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Model Check">
        <div className="modal-header">
          <h2 className="modal-title">Model Check</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="modal-hint">
          Enter a PRCTL / temporal logic property to verify against the model.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="modal-textarea"
            value={prop}
            onChange={(e) => setProp(e.target.value)}
            placeholder='e.g. P>=0.5 [ F "done" ]'
            rows={4}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e as unknown as React.FormEvent)
              if (e.key === 'Escape') onClose()
            }}
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isChecking}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={isChecking || !prop.trim()}
            >
              {isChecking && <span className="spinner" />}
              Check
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
