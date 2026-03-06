import { useRef, useState, useEffect, useCallback } from 'react'
import type { ExtractedGraph } from '../types'
import type { ValidationWarning } from '../utils/validate'

interface Props {
  graph: ExtractedGraph
  selectedStateId: string | null
  selectedEdgeId: string | null
  simulationOutput: string
  modelCheckOutput: string
  warnings: ValidationWarning[]
  onSelectState: (id: string) => void
  onSelectEdge: (id: string) => void
  onRenameState: (id: string, label: string) => void
  onDeleteState: (id: string) => void
  onSetEdgeProbability: (id: string, p: number | null) => void
  onDeleteEdge: (id: string) => void
}

const SNAP_PEEK = 72    // px: just the handle + header visible
const SNAP_HALF = 0.45  // fraction of viewport height
const SNAP_FULL = 0.85  // fraction of viewport height

export default function BottomSheet({
  graph,
  selectedStateId,
  selectedEdgeId,
  simulationOutput,
  modelCheckOutput,
  warnings,
  onSelectState,
  onSelectEdge,
  onRenameState,
  onDeleteState,
  onSetEdgeProbability,
  onDeleteEdge,
}: Props) {
  const [snapIndex, setSnapIndex] = useState(0) // 0=peek, 1=half, 2=full
  const [dragging, setDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartH, setDragStartH] = useState(SNAP_PEEK)
  const [height, setHeight] = useState(SNAP_PEEK)
  const sheetRef = useRef<HTMLDivElement>(null)

  const [editingStateId, setEditingStateId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingProb, setEditingProb] = useState('')

  const snapHeights = useCallback(() => {
    const vh = window.innerHeight
    return [SNAP_PEEK, Math.round(vh * SNAP_HALF), Math.round(vh * SNAP_FULL)]
  }, [])

  // Sync snap points when window resizes
  useEffect(() => {
    function onResize() {
      const snaps = snapHeights()
      setHeight(snaps[snapIndex])
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [snapIndex, snapHeights])

  function goToSnap(idx: number) {
    const snaps = snapHeights()
    setSnapIndex(idx)
    setHeight(snaps[idx])
  }

  function handleDragStart(clientY: number) {
    setDragging(true)
    setDragStartY(clientY)
    setDragStartH(height)
  }

  function handleDragMove(clientY: number) {
    if (!dragging) return
    const delta = dragStartY - clientY
    const snaps = snapHeights()
    const newH = Math.max(SNAP_PEEK, Math.min(snaps[2], dragStartH + delta))
    setHeight(newH)
  }

  function handleDragEnd(clientY: number) {
    if (!dragging) return
    setDragging(false)
    const delta = dragStartY - clientY
    const snaps = snapHeights()
    const currentH = dragStartH + delta
    // Find nearest snap
    let nearest = 0
    let nearestDist = Infinity
    snaps.forEach((s, i) => {
      const d = Math.abs(currentH - s)
      if (d < nearestDist) { nearestDist = d; nearest = i }
    })
    // Flick detection: if fast drag up/down, advance/retreat one snap
    if (Math.abs(delta) > 60) {
      if (delta > 0) nearest = Math.min(2, snapIndex + 1)
      else nearest = Math.max(0, snapIndex - 1)
    }
    goToSnap(nearest)
  }

  // Touch handlers
  function onTouchStart(e: React.TouchEvent) {
    handleDragStart(e.touches[0].clientY)
  }
  function onTouchMove(e: React.TouchEvent) {
    handleDragMove(e.touches[0].clientY)
  }
  function onTouchEnd(e: React.TouchEvent) {
    handleDragEnd(e.changedTouches[0].clientY)
  }

  // Mouse handlers (for desktop testing)
  function onMouseDown(e: React.MouseEvent) {
    handleDragStart(e.clientY)
  }
  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) { handleDragMove(e.clientY) }
    function onUp(e: MouseEvent) { handleDragEnd(e.clientY) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, dragStartY, dragStartH])

  const stateLabel = (id: string) =>
    graph.states.find((s) => s.id === id)?.label ?? id

  function commitRename(id: string) {
    if (editingLabel.trim()) onRenameState(id, editingLabel.trim())
    setEditingStateId(null)
  }

  function commitProb(id: string) {
    const val = parseFloat(editingProb)
    onSetEdgeProbability(id, isNaN(val) ? null : val)
    setEditingEdgeId(null)
  }

  const handleClick = () => {
    if (snapIndex === 0) goToSnap(1)
  }

  return (
    <div
      ref={sheetRef}
      className={`bottom-sheet${dragging ? ' dragging' : ''}`}
      style={{ height }}
      onClick={snapIndex === 0 ? handleClick : undefined}
    >
      {/* Drag handle */}
      <div
        className="sheet-handle-area"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        <div className="sheet-handle" />
        <span className="sheet-title">
          {graph.states.length} states · {graph.transitions.length} transitions
          {warnings.length > 0 && <span className="sheet-warn-badge"> ⚠ {warnings.length}</span>}
        </span>
        <button
          className="sheet-close-btn"
          onClick={(e) => { e.stopPropagation(); goToSnap(snapIndex === 0 ? 1 : 0) }}
          aria-label={snapIndex === 0 ? 'Expand' : 'Collapse'}
        >
          {snapIndex === 0 ? '↑' : '↓'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="sheet-content">
        {/* States */}
        <div className="sheet-section">
          <h3 className="sheet-section-title">States</h3>
          {graph.states.length === 0 && (
            <p className="sheet-empty">Extract or tap the canvas to add states.</p>
          )}
          {graph.states.map((s) => (
            <div
              key={s.id}
              className={`sheet-item${selectedStateId === s.id ? ' selected' : ''}`}
              onClick={() => onSelectState(s.id)}
            >
              <div className="sheet-item-main">
                {s.initialState && <span className="initial-arrow">→</span>}
                {editingStateId === s.id ? (
                  <input
                    type="text"
                    value={editingLabel}
                    autoFocus
                    className="sheet-inline-input"
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(s.id)
                      if (e.key === 'Escape') setEditingStateId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="sheet-item-label">{s.label}</span>
                )}
                {s.confidence !== undefined && (
                  <span className="sheet-conf">{Math.round(s.confidence * 100)}%</span>
                )}
              </div>
              <div className="sheet-item-actions">
                <button
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingStateId(s.id)
                    setEditingLabel(s.label)
                  }}
                >✎</button>
                <button
                  className="danger"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteState(s.id) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Transitions */}
        <div className="sheet-section">
          <h3 className="sheet-section-title">Transitions</h3>
          {graph.transitions.length === 0 && (
            <p className="sheet-empty">Use "+ Edge" mode, then tap two states.</p>
          )}
          {graph.transitions.map((t) => (
            <div
              key={t.id}
              className={`sheet-item${selectedEdgeId === t.id ? ' selected' : ''}`}
              onClick={() => onSelectEdge(t.id)}
            >
              <div className="sheet-item-main">
                <span className="sheet-item-label">
                  {stateLabel(t.from)} → {stateLabel(t.to)}
                </span>
                {editingEdgeId === t.id ? (
                  <input
                    type="number"
                    step="0.01" min="0" max="1"
                    value={editingProb}
                    autoFocus
                    className="sheet-inline-input sheet-inline-input--prob"
                    onChange={(e) => setEditingProb(e.target.value)}
                    onBlur={() => commitProb(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitProb(t.id)
                      if (e.key === 'Escape') setEditingEdgeId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="sheet-prob-badge"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingEdgeId(t.id)
                      setEditingProb(t.probability !== null ? String(t.probability) : '')
                    }}
                    title="Tap to edit probability"
                  >
                    {t.probability !== null ? t.probability.toFixed(3) : '—'}
                  </span>
                )}
                {t.confidence !== undefined && (
                  <span className="sheet-conf">{Math.round(t.confidence * 100)}%</span>
                )}
              </div>
              <div className="sheet-item-actions">
                <button
                  className="danger"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteEdge(t.id) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="sheet-section">
            <h3 className="sheet-section-title">⚠ Warnings</h3>
            {warnings.map((w) => (
              <div key={w.stateId} className="warning-item">{w.message}</div>
            ))}
          </div>
        )}

        {/* Simulation output */}
        {simulationOutput && (
          <div className="sheet-section">
            <h3 className="sheet-section-title">Simulation</h3>
            <div className="sim-output">{simulationOutput}</div>
          </div>
        )}

        {/* Model check output */}
        {modelCheckOutput && (
          <div className="sheet-section">
            <h3 className="sheet-section-title">Model Check</h3>
            <div className="sim-output">{modelCheckOutput}</div>
          </div>
        )}
      </div>
    </div>
  )
}
