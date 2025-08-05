import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

// Unit conversion: 1px = 100mm
export const PIXELS_TO_MM = 10;
export const MM_TO_PIXELS = 1 / PIXELS_TO_MM;

export const $points = atom<Point[]>([]);
export const $isComplete = atom<boolean>(false);
export const $angleSnapEnabled = atom<boolean>(false);
export const $gridSnapEnabled = atom<boolean>(false);
export const $isShiftPressed = atom<boolean>(false);
export const $mousePosition = atom<Point | null>(null);

// Zoom functionality - 5 zoom levels
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4]; // 25%, 50%, 100%, 200%, 400%
export const DEFAULT_ZOOM_INDEX = 2; // 100% zoom
export const $zoomIndex = atom<number>(DEFAULT_ZOOM_INDEX);
export const $panOffset = atom<Point>({ x: 0, y: 0 });
export const $isPanning = atom<boolean>(false);
export const $isSpacePressed = atom<boolean>(false);
export const $lastPanPoint = atom<Point | null>(null);

export const $isAngleSnapActive = computed(
  [$angleSnapEnabled, $isShiftPressed],
  (angleSnapEnabled, isShiftPressed) => angleSnapEnabled || isShiftPressed,
);

export const $isGridSnapActive = computed(
  [$gridSnapEnabled],
  (gridSnapEnabled) => gridSnapEnabled,
);

export const $currentZoom = computed(
  $zoomIndex,
  (zoomIndex) => ZOOM_LEVELS[zoomIndex],
);

export const $zoomTransform = computed(
  [$currentZoom, $panOffset],
  (zoom, panOffset) =>
    `translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`,
);

export const $canZoomIn = computed(
  $zoomIndex,
  (zoomIndex) => zoomIndex < ZOOM_LEVELS.length - 1,
);
export const $canZoomOut = computed($zoomIndex, (zoomIndex) => zoomIndex > 0);

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

  toggleAngleSnap: () => {
    $angleSnapEnabled.set(!$angleSnapEnabled.get());
  },

  toggleGridSnap: () => {
    $gridSnapEnabled.set(!$gridSnapEnabled.get());
  },

  setShiftPressed: (pressed: boolean) => {
    $isShiftPressed.set(pressed);
  },

  setSpacePressed: (pressed: boolean) => {
    $isSpacePressed.set(pressed);
  },

  startPanning: (screenX: number, screenY: number) => {
    $isPanning.set(true);
    $lastPanPoint.set({ x: screenX, y: screenY });
  },

  stopPanning: () => {
    $isPanning.set(false);
    $lastPanPoint.set(null);
  },

  setMousePosition: (position: Point | null) => {
    $mousePosition.set(position);
  },

  zoomIn: () => {
    const currentIndex = $zoomIndex.get();
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      $zoomIndex.set(currentIndex + 1);
    }
  },

  zoomOut: () => {
    const currentIndex = $zoomIndex.get();
    if (currentIndex > 0) {
      $zoomIndex.set(currentIndex - 1);
    }
  },

  setZoomIndex: (index: number) => {
    if (index >= 0 && index < ZOOM_LEVELS.length) {
      $zoomIndex.set(index);
    }
  },

  resetZoom: () => {
    $zoomIndex.set(DEFAULT_ZOOM_INDEX);
    $panOffset.set({ x: 0, y: 0 });
  },

  setPanOffset: (offset: Point) => {
    $panOffset.set(offset);
  },

  // Pan by a delta amount
  panBy: (deltaX: number, deltaY: number) => {
    const currentOffset = $panOffset.get();
    $panOffset.set({
      x: currentOffset.x + deltaX,
      y: currentOffset.y + deltaY,
    });
  },

  // Update panning with new mouse position
  updatePanning: (screenX: number, screenY: number) => {
    const lastPoint = $lastPanPoint.get();
    if (lastPoint) {
      const deltaX = screenX - lastPoint.x;
      const deltaY = screenY - lastPoint.y;
      polygonActions.panBy(deltaX, deltaY);
      $lastPanPoint.set({ x: screenX, y: screenY });
    }
  },

  // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
  screenToCanvas: (screenX: number, screenY: number): Point => {
    const zoom = ZOOM_LEVELS[$zoomIndex.get()];
    const panOffset = $panOffset.get();
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  },

  snapToGrid: (x: number, y: number, gridSize: number = 10): Point => {
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  },

  snapToAngle: (x: number, y: number, previousPoint: Point): Point => {
    const dx = x - previousPoint.x;
    const dy = y - previousPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const angle = Math.atan2(dy, dx);
    const snapIncrement = Math.PI / 8; // π/8 radians = 22.5 degrees
    const snappedAngle = Math.round(angle / snapIncrement) * snapIncrement;

    return {
      x: previousPoint.x + Math.cos(snappedAngle) * distance,
      y: previousPoint.y + Math.sin(snappedAngle) * distance,
    };
  },

  applySnapping: (x: number, y: number, previousPoint?: Point): Point => {
    let point = { x, y };

    // Apply grid snapping first if enabled
    if ($gridSnapEnabled.get()) {
      point = polygonActions.snapToGrid(point.x, point.y);
    }

    // Apply angle snapping if enabled and we have a previous point
    if (($angleSnapEnabled.get() || $isShiftPressed.get()) && previousPoint) {
      point = polygonActions.snapToAngle(point.x, point.y, previousPoint);
    }

    return point;
  },
};
