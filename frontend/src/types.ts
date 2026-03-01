// ---------------------------------------------------------------------------
// Data model types
// ---------------------------------------------------------------------------

export type StateNode = {
  id: string;
  label: string;
  /** Normalized x coordinate in [0, 1] relative to rendered image width */
  x: number;
  /** Normalized y coordinate in [0, 1] relative to rendered image height */
  y: number;
  initialState?: boolean;
  confidence?: number;
};

export type Transition = {
  id: string;
  from: string;
  to: string;
  probability: number | null;
  /** Exact text copied from the image near the arrow */
  rawText?: string | null;
  /** Chain-of-thought reasoning for the probability conversion */
  reasoning?: string | null;
  confidence?: number;
};

export type ExtractedGraph = {
  states: StateNode[];
  transitions: Transition[];
  notes?: string[];
};

// ---------------------------------------------------------------------------
// Simulation response – flexible union
// ---------------------------------------------------------------------------

export type SimulationResult =
  | { pathText: string }
  | { path: string[] }
  | { path: Array<{ state: string; t?: number }> };

// ---------------------------------------------------------------------------
// App views
// ---------------------------------------------------------------------------

export type AppView = "camera" | "review" | "annotate";
