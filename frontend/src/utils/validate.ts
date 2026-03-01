import type { ExtractedGraph, StateNode } from "../types";

export interface ValidationWarning {
  stateId: string;
  message: string;
}

/**
 * Validate outgoing probability sums per state.
 * A warning is emitted when:
 *   - A state has ≥1 outgoing transition
 *   - ALL outgoing transitions have non-null probability
 *   - The sum differs from 1.0 by more than 0.02
 */
export function validateGraph(graph: ExtractedGraph): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const stateMap = new Map<string, StateNode>(
    graph.states.map((s) => [s.id, s]),
  );

  for (const state of graph.states) {
    const outgoing = graph.transitions.filter((t) => t.from === state.id);
    if (outgoing.length === 0) continue;

    // Skip if any probability is null (user may not have filled them all in yet)
    if (outgoing.some((t) => t.probability === null)) continue;

    const sum = outgoing.reduce((acc, t) => acc + (t.probability as number), 0);
    if (Math.abs(sum - 1) > 0.02) {
      const label = stateMap.get(state.id)?.label ?? state.id;
      warnings.push({
        stateId: state.id,
        message: `Outgoing probabilities from "${label}" sum to ${sum.toFixed(4)}`,
      });
    }
  }

  return warnings;
}
