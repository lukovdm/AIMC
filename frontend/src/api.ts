import type { ExtractedGraph, SimulationResult } from "./types";

// Vite replaces import.meta.env at build time; declare the shape for TS
declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

// In dev (BASE=""), Vite proxies /api/* → http://localhost:8000/api/*.
// In production, set VITE_API_BASE_URL to the backend origin; the backend serves under /api.
const ORIGIN =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";
const BASE = `${ORIGIN}/api`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Backend model shapes (as returned by aimc/ocr.py)
// ---------------------------------------------------------------------------

interface BackendState {
  id: string;
  label: string;
  initial_state: boolean;
  center: { x: number; y: number };
  confidence: number;
}

interface BackendTransition {
  from_state: string;
  to_state: string;
  action: string | null;
  probability: number | null;
  label_text: string | null;
  confidence: number;
}

interface BackendModel {
  states: BackendState[];
  transitions: BackendTransition[];
  unattached_text: unknown[];
  notes: string[];
}

interface UploadResponse {
  uuid: string;
  model: BackendModel;
}

// ---------------------------------------------------------------------------
// Conversion: BackendModel → ExtractedGraph
// Backend states have a `center: {x, y}` in pixel coords.
// We normalize them to [0,1] using the max extent so layout is preserved.
// ---------------------------------------------------------------------------

function backendToGraph(model: BackendModel): ExtractedGraph {
  // Find bounding box for normalization (fallback to 1 to avoid /0)
  const xs = model.states.map((s) => s.center.x ?? 0);
  const ys = model.states.map((s) => s.center.y ?? 0);
  const maxX = Math.max(...xs, 1);
  const maxY = Math.max(...ys, 1);

  const states = model.states.map((s) => ({
    id: s.id,
    label: s.label,
    x: (s.center.x ?? 0) / maxX,
    y: (s.center.y ?? 0) / maxY,
  }));

  const transitions = model.transitions.map((t, i) => ({
    id: `t-${i}`,
    from: t.from_state,
    to: t.to_state,
    probability: t.probability,
    labelText: t.label_text,
  }));

  return { states, transitions, notes: model.notes };
}

// ---------------------------------------------------------------------------
// Conversion: ExtractedGraph → BackendModel (for PUT /model/{uuid})
// ---------------------------------------------------------------------------

function graphToBackend(graph: ExtractedGraph): BackendModel {
  const states: BackendState[] = graph.states.map((s) => ({
    id: s.id,
    label: s.label,
    initial_state: false,
    center: { x: Math.round(s.x * 1000), y: Math.round(s.y * 1000) },
    confidence: 1,
  }));

  const transitions: BackendTransition[] = graph.transitions.map((t) => ({
    from_state: t.from,
    to_state: t.to,
    action: null,
    probability: t.probability,
    label_text: t.labelText ?? null,
    confidence: 1,
  }));

  return { states, transitions, unattached_text: [], notes: graph.notes ?? [] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * POST /uploadfile
 * Uploads an image; runs OCR via Mistral; returns draft ExtractedGraph + uuid.
 */
export async function extractGraph(
  image: Blob,
): Promise<{ graph: ExtractedGraph; uuid: string }> {
  const form = new FormData();
  form.append("file", image, "capture.jpg");
  const res = await fetch(`${BASE}/uploadfile`, {
    method: "POST",
    body: form,
  });
  const data = await handleResponse<UploadResponse>(res);
  return { graph: backendToGraph(data.model), uuid: data.uuid };
}

/**
 * PUT /model/{uuid}   — persist the user's edits back to the server
 * POST /model/{uuid}/simulate?steps=N  — run the simulator
 */
export async function simulateGraph(
  graph: ExtractedGraph,
  uuid: string,
  steps = 20,
): Promise<SimulationResult> {
  // 1. Save current edits
  const putRes = await fetch(`${BASE}/model/${uuid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graphToBackend(graph)),
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => putRes.statusText);
    throw new Error(`Save failed – HTTP ${putRes.status}: ${text}`);
  }

  // 2. Run simulation
  const simRes = await fetch(`${BASE}/model/${uuid}/simulate?steps=${steps}`, {
    method: "POST",
  });
  return handleResponse<SimulationResult>(simRes);
}
