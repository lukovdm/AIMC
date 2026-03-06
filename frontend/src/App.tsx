import { useState, useCallback } from 'react'
import type { AppView, ExtractedGraph, SimulationResult } from './types'
import { validateGraph } from './utils/validate'
import { extractGraph, simulateGraph, checkModel } from './api'
import CameraView from './components/CameraView'
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
  const [modelCheckOutput, setModelCheckOutput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isModelChecking, setIsModelChecking] = useState(false)

  const warnings = validateGraph(graph)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ---- Camera ----
  function handleCapture(blob: Blob, url: string) {
    setCapturedBlob(blob)
    setCapturedUrl(url)
    setView('annotate')
  }

  // ---- Extract ----
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

  // ---- Simulate ----
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

  // ---- Model check ----
  const handleModelCheck = useCallback(async (prop: string) => {
    if (!modelUuid) { showToast('Extract the image first to get a model ID'); return }
    setIsModelChecking(true)
    try {
      const result = await checkModel(modelUuid, prop)
      setModelCheckOutput(result != null ? JSON.stringify(result, null, 2) : '(no result)')
    } catch (err) {
      showToast(`Model check failed: ${(err as Error).message}`)
    } finally {
      setIsModelChecking(false)
    }
  }, [modelUuid])

  // ---- Export ----
  function handleExport() {
    const json = JSON.stringify(graph, null, 2)
    navigator.clipboard?.writeText(json).catch(() => {})
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'markov-chain.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('JSON copied + downloaded!')
  }

  // ---- Reset ----
  function handleReset() {
    setGraph(EMPTY_GRAPH)
    setSimOutput('')
    setModelCheckOutput('')
    setModelUuid(null)
    setView('camera')
    URL.revokeObjectURL(capturedUrl)
    setCapturedUrl('')
    setCapturedBlob(null)
  }

  return (
    <>
      {view === 'camera' && <CameraView onCapture={handleCapture} />}
      {view === 'annotate' && capturedUrl && (
        <AnnotateView
          imageUrl={capturedUrl}
          graph={graph}
          warnings={warnings}
          simulationOutput={simOutput}
          modelCheckOutput={modelCheckOutput}
          isExtracting={isExtracting}
          isSimulating={isSimulating}
          isModelChecking={isModelChecking}
          onGraphChange={setGraph}
          onExtract={handleExtract}
          onSimulate={handleSimulate}
          onModelCheck={handleModelCheck}
          onExport={handleExport}
          onReset={handleReset}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
