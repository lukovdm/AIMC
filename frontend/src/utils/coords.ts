/**
 * Coordinate helpers – convert between normalised [0,1] image space
 * and actual pixel space of the rendered image/SVG overlay.
 */

export interface Dims {
  width: number;
  height: number;
}

/** Normalised → pixel */
export function normToPixel(
  nx: number,
  ny: number,
  dims: Dims,
): { px: number; py: number } {
  return { px: nx * dims.width, py: ny * dims.height };
}

/** Pixel → normalised */
export function pixelToNorm(
  px: number,
  py: number,
  dims: Dims,
): { nx: number; ny: number } {
  return { nx: px / dims.width, ny: py / dims.height };
}

/** Clamp a value to [0, 1] */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
