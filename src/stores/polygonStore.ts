import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

// Unit conversion: 1px = 10mm (updated from original)
export const PIXELS_TO_MM = 10;
export const MM_TO_PIXELS = 1 / PIXELS_TO_MM;

// Polygon state atoms
export const $points = atom<Point[]>([]);
export const $isComplete = atom<boolean>(false);
export const $mousePosition = atom<Point | null>(null);

// Computed polygon properties
export const $polygonPath = computed($points, (points) => {
  if (points.length === 0) return "";

  const pathData = points
    .map((point, index) => {
      return index === 0
        ? `M ${point.x} ${point.y}`
        : `L ${point.x} ${point.y}`;
    })
    .join(" ");

  return pathData;
});

export const $polygonPathClosed = computed(
  [$polygonPath, $isComplete],
  (path, isComplete) => (isComplete ? `${path} Z` : path),
);

// Calculate polygon area in square millimeters
export const $polygonArea = computed($points, (points) => {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  const areaInPixels = Math.abs(area) / 2;
  return areaInPixels * PIXELS_TO_MM * PIXELS_TO_MM; // Convert to mm²
});

// Calculate polygon perimeter in millimeters
export const $polygonPerimeter = computed($points, (points) => {
  if (points.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter * PIXELS_TO_MM; // Convert to mm
});

// Get edge lengths in millimeters
export const $edgeLengths = computed($points, (points) => {
  if (points.length < 2) return [];

  const edges = [];
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    const lengthInPixels = Math.sqrt(dx * dx + dy * dy);
    edges.push({
      from: points[i],
      to: points[j],
      lengthMm: lengthInPixels * PIXELS_TO_MM,
      lengthPx: lengthInPixels,
    });
  }

  return edges;
});

// Utility functions for unit conversion and formatting
export const unitUtils = {
  pxToMm: (pixels: number): number => pixels * PIXELS_TO_MM,
  mmToPx: (mm: number): number => mm * MM_TO_PIXELS,

  formatMm: (mm: number): string => {
    if (mm >= 1000) {
      return `${(mm / 1000).toFixed(2)}m`;
    }
    return `${Math.round(mm)}mm`;
  },

  formatArea: (areaMm2: number): string => {
    if (areaMm2 >= 1000000) {
      return `${(areaMm2 / 1000000).toFixed(2)}m²`;
    }
    return `${Math.round(areaMm2)}mm²`;
  },
};

// Polygon editing actions
export const polygonActions = {
  addPoint: (point: Point) => {
    $points.set([...$points.get(), point]);
  },

  completePolygon: () => {
    if ($points.get().length >= 3) {
      $isComplete.set(true);
    }
  },

  clearPolygon: () => {
    $points.set([]);
    $isComplete.set(false);
  },

  setMousePosition: (position: Point | null) => {
    $mousePosition.set(position);
  },
};