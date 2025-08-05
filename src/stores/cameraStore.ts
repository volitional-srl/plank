import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

// Zoom functionality - 5 zoom levels
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4]; // 25%, 50%, 100%, 200%, 400%
export const DEFAULT_ZOOM_INDEX = 2; // 100% zoom

// Camera state atoms
export const $zoomIndex = atom<number>(DEFAULT_ZOOM_INDEX);
export const $panOffset = atom<Point>({ x: 0, y: 0 });
export const $isPanning = atom<boolean>(false);
export const $isSpacePressed = atom<boolean>(false);
export const $lastPanPoint = atom<Point | null>(null);

// Computed values
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

// Camera actions
export const cameraActions = {
  // Zoom controls
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

  // Pan controls
  setPanOffset: (offset: Point) => {
    $panOffset.set(offset);
  },

  panBy: (deltaX: number, deltaY: number) => {
    const currentOffset = $panOffset.get();
    $panOffset.set({
      x: currentOffset.x + deltaX,
      y: currentOffset.y + deltaY,
    });
  },

  startPanning: (screenX: number, screenY: number) => {
    $isPanning.set(true);
    $lastPanPoint.set({ x: screenX, y: screenY });
  },

  stopPanning: () => {
    $isPanning.set(false);
    $lastPanPoint.set(null);
  },

  updatePanning: (screenX: number, screenY: number) => {
    const lastPoint = $lastPanPoint.get();
    if (lastPoint) {
      const deltaX = screenX - lastPoint.x;
      const deltaY = screenY - lastPoint.y;
      cameraActions.panBy(deltaX, deltaY);
      $lastPanPoint.set({ x: screenX, y: screenY });
    }
  },

  setSpacePressed: (pressed: boolean) => {
    $isSpacePressed.set(pressed);
  },

  // Coordinate transformation
  screenToCanvas: (screenX: number, screenY: number): Point => {
    const zoom = ZOOM_LEVELS[$zoomIndex.get()];
    const panOffset = $panOffset.get();
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  },
};