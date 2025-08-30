import type { Point } from "./geometry";
import type { Plank } from "./plank";
import { mmToPixels } from "./geometry";

export const PLANK_FILL_RGB_SPARE = "rgba(34, 197, 94, 0.7)";
export const PLANK_FILL_RGB_MULTILINE_CUT = "rgba(236, 72, 153, 0.7)";
export const PLANK_FILL_RGB_REGULAR_CUT = "rgba(147, 51, 234, 0.7)";
export const PLANK_FILL_RGB_LINEAR_CUT = "rgba(251, 146, 60, 0.7)";
export const PLANK_FILL_RGB_FULL = "rgba(139, 69, 19, 0.7)";
export interface PlankRenderInfo {
  isSpare: boolean;
  isCut: boolean;
  isArbitraryShape: boolean;
  isMultiLineCut: boolean;
  fillColor: string;
  strokeColor: string;
}

// Analyze plank properties for rendering
export const analyzePlankForRendering = (plank: Plank): PlankRenderInfo => {
  console.log(plank);
  const isSpare = plank.isSpare || false;
  const isCut = plank.originalLength
    ? plank.length < plank.originalLength
    : false;
  const isArbitraryShape = plank.isArbitraryShape && plank.shape ? true : false;
  const isMultiLineCut = plank.isMultiLineCut || false;

  let fillColor: string;
  let strokeColor: string;

  if (isSpare) {
    fillColor = PLANK_FILL_RGB_SPARE; // Green
    strokeColor = "#22C55E";
  } else if (isArbitraryShape) {
    if (isMultiLineCut) {
      fillColor = PLANK_FILL_RGB_MULTILINE_CUT; // Pink for multi-line cuts
      strokeColor = "#EC4899";
    } else {
      fillColor = PLANK_FILL_RGB_REGULAR_CUT; // Purple for regular shape cuts
      strokeColor = "#8B5CF6";
    }
  } else if (isCut) {
    fillColor = PLANK_FILL_RGB_LINEAR_CUT; // Orange for linear cuts
    strokeColor = "#F97316";
  } else {
    fillColor = PLANK_FILL_RGB_FULL; // Brown for full planks
    strokeColor = "#8B4513";
  }

  return {
    isSpare,
    isCut,
    isArbitraryShape,
    isMultiLineCut,
    fillColor,
    strokeColor,
  };
};

// Convert plank shape to world coordinates
export const plankShapeToWorldCoordinates = (plank: Plank): Point[] => {
  if (!plank.shape) return [];

  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return plank.shape.map((point) => ({
    x: plank.x + (point.x * cos - point.y * sin),
    y: plank.y + (point.x * sin + point.y * cos),
  }));
};

// Generate SVG path data from points
export const pointsToSVGPath = (points: Point[]): string => {
  return (
    points
      .map((point, index) =>
        index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
      )
      .join(" ") + " Z"
  );
};

// Get plank rectangle dimensions in pixels
export const getPlankPixelDimensions = (plank: Plank) => ({
  length: mmToPixels(plank.length),
  width: mmToPixels(plank.width),
});

// Get snap indicator color based on active snap modes
export const getSnapIndicatorColor = (
  isAngleSnapActive: boolean,
  isGridSnapActive: boolean,
): string => {
  if (isAngleSnapActive && isGridSnapActive) return "#8b5cf6"; // Purple
  if (isAngleSnapActive) return "#10b981"; // Green
  if (isGridSnapActive) return "#3b82f6"; // Blue
  return "#94a3b8"; // Gray
};
