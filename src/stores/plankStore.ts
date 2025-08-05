import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

export interface PlankDimensions {
  length: number; // in mm
  width: number;  // in mm
}

export interface Plank {
  id: string;
  x: number;      // position in canvas coordinates
  y: number;
  rotation: number; // rotation in degrees
  length: number;   // in mm
  width: number;    // in mm
}

// Default plank size: 1500mm x 240mm
export const DEFAULT_PLANK_LENGTH = 1500;
export const DEFAULT_PLANK_WIDTH = 240;

// Plank state atoms
export const $plankDimensions = atom<PlankDimensions>({
  length: DEFAULT_PLANK_LENGTH,
  width: DEFAULT_PLANK_WIDTH,
});

export const $planks = atom<Plank[]>([]);
export const $isPlacingPlank = atom<boolean>(false);
export const $previewPlank = atom<Plank | null>(null);

// Computed values
export const $plankCount = computed($planks, (planks) => planks.length);

// Helper function to convert mm to pixels (using same conversion as polygon store)
const MM_TO_PIXELS = 1 / 10; // 1px = 10mm

export const plankActions = {
  // Plank dimension management
  setPlankDimensions: (dimensions: PlankDimensions) => {
    $plankDimensions.set(dimensions);
  },

  setPlankLength: (length: number) => {
    const current = $plankDimensions.get();
    $plankDimensions.set({ ...current, length });
  },

  setPlankWidth: (width: number) => {
    const current = $plankDimensions.get();
    $plankDimensions.set({ ...current, width });
  },

  // Plank placement
  startPlacingPlank: () => {
    $isPlacingPlank.set(true);
  },

  stopPlacingPlank: () => {
    $isPlacingPlank.set(false);
    $previewPlank.set(null);
  },

  // Preview plank for placement
  setPreviewPlank: (position: Point, rotation: number = 0) => {
    const dimensions = $plankDimensions.get();
    const plank: Plank = {
      id: `preview-${Date.now()}`,
      x: position.x,
      y: position.y,
      rotation,
      length: dimensions.length,
      width: dimensions.width,
    };
    $previewPlank.set(plank);
  },

  // Place a plank (confirm preview plank)
  placePlank: (position: Point, rotation: number = 0) => {
    const dimensions = $plankDimensions.get();
    const plank: Plank = {
      id: `plank-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: position.x,
      y: position.y,
      rotation,
      length: dimensions.length,
      width: dimensions.width,
    };
    
    $planks.set([...$planks.get(), plank]);
    $isPlacingPlank.set(false);
    $previewPlank.set(null);
  },

  // Remove all planks
  clearPlanks: () => {
    $planks.set([]);
    $isPlacingPlank.set(false);
    $previewPlank.set(null);
  },

  // Convert plank dimensions from mm to pixels for rendering
  getPlankPixelDimensions: () => {
    const dimensions = $plankDimensions.get();
    return {
      length: dimensions.length * MM_TO_PIXELS,
      width: dimensions.width * MM_TO_PIXELS,
    };
  },

  // Convert individual measurements
  mmToPixels: (mm: number): number => mm * MM_TO_PIXELS,
  pixelsToMm: (pixels: number): number => pixels / MM_TO_PIXELS,
};