import { useState, useCallback } from 'react'
import type { AppView, ExtractedGraph, SimulationResult } from './types'
import { validateGraph } from './utils/validate'
import { extractGraph, simulateGraph } from './api'
import CameraView from './components/CameraView'
import ReviewView from './components/ReviewView'
import AnnotateView from './components/AnnotateView'

const EMPTY_GRAPH: ExtractedGraph = { states: [], transitions: [] }

function formatSimResult(result: SimulationResult): string {
  if ('pathText' in result) return result.pathText
  if ('path' in result) {
    const path = result.path
    if (path.length === 0) return '(empty path)'
    if (typeof path[0] === 'string') {
      return (path as string[]).join(' → ')
    }
    return (path as Array<{ state: string; t?: number }>)
      .map((p) => p.state)
      .join(' → ')
  }
  return JSON.stringify(result)
}

export default function App() {
  const [view, setView] = useState<AppView>('camera')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string>('')
  const [graph, setGraph] = useState<ExtractedGraph>(EMPTY_GRAPH)
  const [modelUuid, setModelUuid] = useState<string | null>(null)
  const [simOutput, setSimOutput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)

  const warnings = validateGraph(graph)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ---- Camera ----
  function handleCapture(blob: Blob, url: string) {
    setCapturedBlob(blob)
    setCapturedUrl(url)
    setView('review')
  }

  // ---- Review ----
  function handleRetake() {
    URL.revokeObjectURL(capturedUrl)
    setCapturedUrl('')
    setCapturedBlob(null)
    setView('camera')
  }

  function handleUsePhoto() {
    setView('annotate')
  }

  // ---- Annotate ----
  const handleExtract = useCallback(async () => {
    if (!capturedBlob) { showToast('No image to extract from'); return }
    setIsExtracting(true)
    try {
      const { graph: draft, uuid } = await extractGraph(capturedBlob)
      setGraph(draft)
      setModelUuid(uuid)
      showToast('Graph extracted!')
    } catch (err) {
      showToast(`Extract failed: ${(err as Error).message}`)
    } finally {
      setIsExtracting(false)
    }
  }, [capturedBlob])

  const handleSimulate = useCallback(async () => {
    if (!modelUuid) { showToast('Extract the image first to get a model ID'); return }
    setIsSimulating(true)
    try {
      const result = await simulateGraph(graph, modelUuid)
      setSimOutput(formatSimResult(result))
    } catch (err) {
      showToast(`Simulate failed: ${(err as Error).message}`)
    } finally {
      setIsSimulating(false)
    }
  }, [graph, modelUuid])

  function handleExport() {
    const json = JSON.stringify(graph, null, 2)
    // Copy to clipboard
    navigator.clipboard?.writeText(json).catch(() => {})
    // Download
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'markov-chain.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('JSON copied + downloaded!')
  }

  function handleReset() {
    setGraph(EMPTY_GRAPH)
    setSimOutput('')
    setModelUuid(null)
    setView('camera')
    URL.revokeObjectURL(capturedUrl)
    setCapturedUrl('')
    setCapturedBlob(null)
  }

  return (
    <>
      {view === 'camera' && <CameraView onCapture={handleCapture} />}
      {view === 'review' && capturedUrl && (
        <ReviewView
          imageUrl={capturedUrl}
          onRetake={handleRetake}
          onUse={handleUsePhoto}
        />
      )}
      {view === 'annotate' && capturedUrl && (
        <AnnotateView
          imageUrl={capturedUrl}
          graph={graph}
          warnings={warnings}
          simulationOutput={simOutput}
          isExtracting={isExtracting}
          isSimulating={isSimulating}
          onGraphChange={setGraph}
          onExtract={handleExtract}
          onSimulate={handleSimulate}
          onExport={handleExport}
          onReset={handleReset}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
