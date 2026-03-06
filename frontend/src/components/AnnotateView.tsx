import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExtractedGraph, StateNode, Transition } from '../types'
import type { ValidationWarning } from '../utils/validate'
import { normToPixel, pixelToNorm, clamp01 } from '../utils/coords'
import BottomSheet from './BottomSheet'
import ModelCheckModal from './ModelCheckModal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function buildArrowPath(
  x1: number, y1: number,
  x2: number, y2: number,
  r = 22,
  selfLoop = false,
): string {
  if (selfLoop) {
    return `M ${x1} ${y1 - r} C ${x1 - 55} ${y1 - 85} ${x1 + 55} ${y1 - 85} ${x1} ${y1 - r}`
  }
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / len
  const uy = dy / len
  const sx = x1 + ux * r
  const sy = y1 + uy * r
  const ex = x2 - ux * r
  const ey = y2 - uy * r
  return `M ${sx} ${sy} L ${ex} ${ey}`
}

type InteractionMode = 'select' | 'addEdge'

interface Props {
  imageUrl: string
  graph: ExtractedGraph
  warnings: ValidationWarning[]
  simulationOutput: string
  modelCheckOutput: string
  isExtracting: boolean
  isSimulating: boolean
  isModelChecking: boolean
  onGraphChange: (g: ExtractedGraph) => void
  onExtract: () => void
  onSimulate: () => void
  onModelCheck: (prop: string) => void
  onExport: () => void
  onReset: () => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AnnotateView({
  imageUrl,
  graph,
  warnings,
  simulationOutput,
  modelCheckOutput,
  isExtracting,
  isSimulating,
  isModelChecking,
  onGraphChange,
  onExtract,
  onSimulate,
  onModelCheck,
  onExport,
  onReset,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0, offsetLeft: 0, offsetTop: 0 })
  const [mode, setMode] = useState<InteractionMode>('select')
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null)
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [showModelCheck, setShowModelCheck] = useState(false)
  const dragging = useRef<{ id: string; startNx: number; startNy: number } | null>(null)
  const pointerStart = useRef<{ px: number; py: number } | null>(null)

  const measureImage = useCallback(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return
    const imgRect = img.getBoundingClientRect()
    const conRect = container.getBoundingClientRect()
    setDims({
      width: imgRect.width,
      height: imgRect.height,
      offsetLeft: imgRect.left - conRect.left,
      offsetTop: imgRect.top - conRect.top,
    })
  }, [])

  useEffect(() => {
    measureImage()
    window.addEventListener('resize', measureImage)
    return () => window.removeEventListener('resize', measureImage)
  }, [measureImage, imageUrl])

  function addState(nx: number, ny: number) {
    const id = uid()
    const label = `s${graph.states.length}`
    onGraphChange({ ...graph, states: [...graph.states, { id, label, x: nx, y: ny }] })
    setSelectedStateId(id)
  }

  function updateStatePos(id: string, nx: number, ny: number) {
    onGraphChange({
      ...graph,
      states: graph.states.map((s) => s.id === id ? { ...s, x: clamp01(nx), y: clamp01(ny) } : s),
    })
  }

  function renameState(id: string, label: string) {
    onGraphChange({ ...graph, states: graph.states.map((s) => s.id === id ? { ...s, label } : s) })
  }

  function deleteState(id: string) {
    onGraphChange({
      ...graph,
      states: graph.states.filter((s) => s.id !== id),
      transitions: graph.transitions.filter((t) => t.from !== id && t.to !== id),
    })
    if (selectedStateId === id) setSelectedStateId(null)
  }

  function addEdge(fromId: string, toId: string) {
    if (graph.transitions.some((t) => t.from === fromId && t.to === toId)) return
    const id = uid()
    onGraphChange({ ...graph, transitions: [...graph.transitions, { id, from: fromId, to: toId, probability: null }] })
  }

  function setEdgeProbability(id: string, p: number | null) {
    onGraphChange({ ...graph, transitions: graph.transitions.map((t) => t.id === id ? { ...t, probability: p } : t) })
  }

  function deleteEdge(id: string) {
    onGraphChange({ ...graph, transitions: graph.transitions.filter((t) => t.id !== id) })
    if (selectedEdgeId === id) setSelectedEdgeId(null)
  }

  function svgCoords(clientX: number, clientY: number) {
    const conRect = containerRef.current?.getBoundingClientRect()
    if (!conRect) return { px: 0, py: 0 }
    return { px: clientX - conRect.left - dims.offsetLeft, py: clientY - conRect.top - dims.offsetTop }
  }

  function onSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return
    if (dims.width === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { px, py } = svgCoords(e.clientX, e.clientY)
    pointerStart.current = { px, py }
  }

  function onSvgPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const { px, py } = svgCoords(e.clientX, e.clientY)
    if (Math.hypot(px - start.px, py - start.py) > 6) return
    if (mode === 'select') {
      const { nx, ny } = pixelToNorm(px, py, dims)
      addState(nx, ny)
      setSelectedEdgeId(null)
    }
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const node = graph.states.find((s) => s.id === id)
    if (node) {
      dragging.current = { id, startNx: node.x, startNy: node.y }
      pointerStart.current = { px: e.clientX, py: e.clientY }
    }
  }

  function onNodePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const { px: sx, py: sy } = pointerStart.current!
    const dx = e.clientX - sx
    const dy = e.clientY - sy
    if (dims.width === 0) return
    updateStatePos(dragging.current.id, dragging.current.startNx + dx / dims.width, dragging.current.startNy + dy / dims.height)
  }

  function onNodePointerUp(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    const start = pointerStart.current
    dragging.current = null
    pointerStart.current = null
    if (!start) return
    if (Math.hypot(e.clientX - start.px, e.clientY - start.py) < 6) {
      if (mode === 'select') { setSelectedStateId(id); setSelectedEdgeId(null) }
      else if (mode === 'addEdge') {
        if (!edgeFrom) { setEdgeFrom(id) }
        else { addEdge(edgeFrom, id); setEdgeFrom(null) }
      }
    }
  }

  function onEdgeClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelectedEdgeId(id)
    setSelectedStateId(null)
  }

  const NODE_R = 22

  function renderEdge(t: Transition) {
    const from = graph.states.find((s) => s.id === t.from)
    const to = graph.states.find((s) => s.id === t.to)
    if (!from || !to || dims.width === 0) return null

    const { px: x1, py: y1 } = normToPixel(from.x, from.y, dims)
    const { px: x2, py: y2 } = normToPixel(to.x, to.y, dims)
    const selfLoop = t.from === t.to
    const path = buildArrowPath(x1, y1, x2, y2, NODE_R, selfLoop)

    const mx = selfLoop ? x1 : (x1 + x2) / 2
    const my = selfLoop ? y1 - 65 : (y1 + y2) / 2 - 14

    const isSelected = selectedEdgeId === t.id
    const label = t.probability !== null ? t.probability.toFixed(2) : ''

    return (
      <g key={t.id}>
        <path className="edge-hitbox" d={path} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => onEdgeClick(e, t.id)} />
        <path className={`edge-path${isSelected ? ' selected' : ''}`} d={path} markerEnd="url(#arrow)" onClick={(e) => onEdgeClick(e, t.id)} />
        {label && (
          <>
            <rect className="edge-label-bg" x={mx - 18} y={my - 11} width={36} height={16} rx={8} />
            <text className="edge-label" x={mx} y={my} textAnchor="middle">{label}</text>
          </>
        )}
      </g>
    )
  }

  function renderNode(s: StateNode) {
    if (dims.width === 0) return null
    const { px, py } = normToPixel(s.x, s.y, dims)
    const isSelected = selectedStateId === s.id
    const isEdgeSource = edgeFrom === s.id

    return (
      <g
        key={s.id}
        className={`state-node${isSelected ? ' selected' : ''}`}
        style={{ cursor: mode === 'addEdge' ? 'pointer' : 'grab' }}
        onPointerDown={(e) => onNodePointerDown(e, s.id)}
        onPointerMove={onNodePointerMove}
        onPointerUp={(e) => onNodePointerUp(e, s.id)}
      >
        <circle cx={px} cy={py} r={NODE_R} style={isEdgeSource ? { stroke: 'var(--accent)', fill: '#2a1a3e' } : undefined} />
        <text x={px} y={py} textAnchor="middle" dominantBaseline="middle">{s.label}</text>
      </g>
    )
  }

  return (
    <div className="annotate-view">
      {/* Top bar */}
      <div className="annotate-topbar">
        <button className="topbar-btn primary" onClick={onExtract} disabled={isExtracting} title="Extract graph from image">
          {isExtracting ? <span className="spinner" /> : <span className="topbar-icon">✦</span>}
          <span className="topbar-label">Extract</span>
        </button>

        <button className="topbar-btn" onClick={onSimulate} disabled={isSimulating || graph.states.length === 0} title="Run simulation">
          {isSimulating ? <span className="spinner" /> : <span className="topbar-icon">▶</span>}
          <span className="topbar-label">Simulate</span>
        </button>

        <button className="topbar-btn" onClick={() => setShowModelCheck(true)} disabled={isModelChecking} title="Model check">
          {isModelChecking ? <span className="spinner" /> : <span className="topbar-icon">✔</span>}
          <span className="topbar-label">Model Check</span>
        </button>

        <div className="topbar-divider" />

        <button
          className={`topbar-btn${mode === 'addEdge' ? ' active' : ''}`}
          onClick={() => { setMode((m) => m === 'addEdge' ? 'select' : 'addEdge'); setEdgeFrom(null) }}
          title={mode === 'addEdge' ? 'Cancel edge' : 'Add edge'}
        >
          <span className="topbar-icon">{mode === 'addEdge' ? '✕' : '+'}</span>
          <span className="topbar-label">{mode === 'addEdge' ? 'Cancel' : 'Edge'}</span>
        </button>

        <button className="topbar-btn" onClick={onExport} title="Export JSON">
          <span className="topbar-icon">⤓</span>
          <span className="topbar-label">Export</span>
        </button>

        <button className="topbar-btn danger" onClick={onReset} title="Reset">
          <span className="topbar-icon">↺</span>
          <span className="topbar-label">Reset</span>
        </button>
      </div>

      {/* Edge mode hint */}
      {mode === 'addEdge' && (
        <div className="mode-hint">
          {edgeFrom
            ? `Tap target state (from: ${graph.states.find((s) => s.id === edgeFrom)?.label ?? edgeFrom})`
            : 'Tap source state'}
        </div>
      )}

      {/* Canvas */}
      <div className="annotate-canvas-area" ref={containerRef}>
        <img ref={imgRef} src={imageUrl} alt="Annotate" onLoad={measureImage} draggable={false} />
        {dims.width > 0 && (
          <svg
            className="overlay"
            width={dims.width}
            height={dims.height}
            style={{ left: dims.offsetLeft, top: dims.offsetTop }}
            onPointerDown={onSvgPointerDown}
            onPointerUp={onSvgPointerUp}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6 Z" fill="var(--accent2)" />
              </marker>
            </defs>
            {graph.transitions.map(renderEdge)}
            {graph.states.map(renderNode)}
          </svg>
        )}
      </div>

      {/* Bottom sheet */}
      <BottomSheet
        graph={graph}
        selectedStateId={selectedStateId}
        selectedEdgeId={selectedEdgeId}
        simulationOutput={simulationOutput}
        modelCheckOutput={modelCheckOutput}
        warnings={warnings}
        onSelectState={(id) => { setSelectedStateId(id); setSelectedEdgeId(null) }}
        onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedStateId(null) }}
        onRenameState={renameState}
        onDeleteState={deleteState}
        onSetEdgeProbability={setEdgeProbability}
        onDeleteEdge={deleteEdge}
      />

      {/* Model check modal */}
      {showModelCheck && (
        <ModelCheckModal
          isChecking={isModelChecking}
          onSubmit={(prop) => { onModelCheck(prop); setShowModelCheck(false) }}
          onClose={() => setShowModelCheck(false)}
        />
      )}
    </div>
  )
}
