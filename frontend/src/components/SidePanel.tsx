import { useState } from 'react'
import type { ExtractedGraph } from '../types'
import type { ValidationWarning } from '../utils/validate'

interface Props {
  graph: ExtractedGraph
  selectedStateId: string | null
  selectedEdgeId: string | null
  simulationOutput: string
  warnings: ValidationWarning[]
  onSelectState: (id: string) => void
  onSelectEdge: (id: string) => void
  onRenameState: (id: string, label: string) => void
  onDeleteState: (id: string) => void
  onSetEdgeProbability: (id: string, p: number | null) => void
  onDeleteEdge: (id: string) => void
}

export default function SidePanel({
  graph,
  selectedStateId,
  selectedEdgeId,
  simulationOutput,
  warnings,
  onSelectState,
  onSelectEdge,
  onRenameState,
  onDeleteState,
  onSetEdgeProbability,
  onDeleteEdge,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingStateId, setEditingStateId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingProb, setEditingProb] = useState('')

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

  return (
    <div className={`side-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="side-panel-header">
        <button
          className="side-panel-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '◀' : '▶'}
        </button>
        <h2>Panel</h2>
      </div>

      <div className="side-panel-content">
        {/* ---- States ---- */}
        <div className="panel-section">
          <h3>States ({graph.states.length})</h3>
          {graph.states.map((s) => (
            <div
              key={s.id}
              className={`panel-item${selectedStateId === s.id ? ' selected' : ''}`}
              onClick={() => onSelectState(s.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                {s.initialState && (
                  <span title="Initial state" style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>→</span>
                )}
                {editingStateId === s.id ? (
                  <input
                    type="text"
                    value={editingLabel}
                    autoFocus
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(s.id)
                      if (e.key === 'Escape') setEditingStateId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="item-label">{s.label}</span>
                )}
                {s.confidence !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {Math.round(s.confidence * 100)}%
                  </span>
                )}
              </div>
              <span className="item-actions">
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteState(s.id)
                  }}
                >✕</button>
              </span>
            </div>
          ))}
          {graph.states.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Tap the image to add states.
            </p>
          )}
        </div>

        {/* ---- Transitions ---- */}
        <div className="panel-section">
          <h3>Transitions ({graph.transitions.length})</h3>
          {graph.transitions.map((t) => (
            <div
              key={t.id}
              className={`panel-item panel-item--column${selectedEdgeId === t.id ? ' selected' : ''}`}
              onClick={() => onSelectEdge(t.id)}
            >
              {/* Row 1: source → target, probability editor, delete */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
                <span className="item-label">
                  {stateLabel(t.from)} → {stateLabel(t.to)}
                </span>
                {editingEdgeId === t.id ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={editingProb}
                    autoFocus
                    style={{ width: 60 }}
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
                    style={{ color: 'var(--accent2)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingEdgeId(t.id)
                      setEditingProb(t.probability !== null ? String(t.probability) : '')
                    }}
                    title="Click to edit probability"
                  >
                    {t.probability !== null ? t.probability.toFixed(3) : '—'}
                  </span>
                )}
                {t.confidence !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {Math.round(t.confidence * 100)}%
                  </span>
                )}
                <span className="item-actions" style={{ marginLeft: 'auto' }}>
                  <button
                    className="danger"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteEdge(t.id)
                    }}
                  >✕</button>
                </span>
              </div>
              {/* Row 2: raw text from image */}
              {t.rawText != null && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', paddingLeft: 4 }}>
                  <span style={{ color: 'var(--accent2)' }}>raw:</span> "{t.rawText}"
                </div>
              )}
              {/* Row 3: reasoning */}
              {t.reasoning != null && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic', paddingLeft: 4 }}>
                  {t.reasoning}
                </div>
              )}
            </div>
          ))}
          {graph.transitions.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Select "Add edge" mode, then tap two states.
            </p>
          )}
        </div>

        {/* ---- Warnings ---- */}
        {warnings.length > 0 && (
          <div className="panel-section">
            <h3>⚠ Warnings</h3>
            {warnings.map((w) => (
              <div key={w.stateId} className="warning-item">{w.message}</div>
            ))}
          </div>
        )}

        {/* ---- Simulation output ---- */}
        {simulationOutput && (
          <div className="panel-section">
            <h3>Simulation</h3>
            <div className="sim-output">{simulationOutput}</div>
          </div>
        )}
      </div>
    </div>
  )
}
