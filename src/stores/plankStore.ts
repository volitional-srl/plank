import { atom, computed } from "nanostores";
import type { Point } from "../lib/geometry";
import type { Plank } from "../lib/plank";
import { generateTessellation } from "../lib/tessellation";

interface PlankLoggingConfig {
  enabled: boolean;
  level: "debug" | "trace";
}

const $plankLogging = atom<PlankLoggingConfig>({
  enabled: true,
  level: "trace",
});

const createPlankLogger = (config: PlankLoggingConfig) => ({
  debug: (message: string, ...args: unknown[]) => {
    if (config.enabled) {
      console.debug(`[PLANK DEBUG] ${message}`, ...args);
    }
  },
  trace: (message: string, ...args: unknown[]) => {
    if (config.enabled && config.level === "trace") {
      console.debug(`[PLANK TRACE] ${message}`, ...args);
    }
  },
});

export interface PlankDimensions {
  length: number; // in mm
  width: number; // in mm
  gap: number; // fixed gap between planks in mm
  minRowOffset: number; // minimum offset between rows in mm
}

export interface Gap {
  x: number;
  y: number;
  rotation: number;
  requiredLength: number; // length needed to fill the gap
  width: number;
  shape?: Point[]; // arbitrary gap shape if not rectangular
  isArbitraryShape?: boolean; // true if gap has complex shape
}

// Default plank size: 1500mm x 240mm, 0mm gap, 300mm minimum row offset
export const DEFAULT_PLANK_LENGTH = 1500;
export const DEFAULT_PLANK_WIDTH = 240;
export const DEFAULT_PLANK_GAP = 0;
export const DEFAULT_MIN_ROW_OFFSET = 300;

// Plank state atoms
export const $plankDimensions = atom<PlankDimensions>({
  length: DEFAULT_PLANK_LENGTH,
  width: DEFAULT_PLANK_WIDTH,
  gap: DEFAULT_PLANK_GAP,
  minRowOffset: DEFAULT_MIN_ROW_OFFSET,
});

export const $planks = atom<Plank[]>([]);
export const $spares = atom<Plank[]>([]);
export const $gaps = atom<Gap[]>([]);
export const $isPlacingPlank = atom<boolean>(false);
export const $previewPlank = atom<Plank | null>(null);

// Computed values
export const $plankCount = computed($planks, (planks) => planks.length);

// Helper function to convert mm to pixels (using same conversion as polygon store)
const MM_TO_PIXELS = 1 / 10; // 1px = 10mm

export const plankActions = {
  // Debug logging controls
  enableDebugLogging: (enabled: boolean = true) => {
    $plankLogging.set({ ...$plankLogging.get(), enabled });
  },

  setLogLevel: (level: "debug" | "trace") => {
    $plankLogging.set({ ...$plankLogging.get(), level });
  },

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
      id: `plank-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      x: position.x,
      y: position.y,
      rotation,
      length: dimensions.length,
      width: dimensions.width,
    };

    const currentPlanks = $planks.get();
    $planks.set([...currentPlanks, plank]);
    $isPlacingPlank.set(false);
    $previewPlank.set(null);

    // Tessellation will be triggered from the component after first plank placement
  },

  // Remove all planks
  clearPlanks: () => {
    $planks.set([]);
    $spares.set([]);
    $gaps.set([]);
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

  // Generate tessellation with proper row-based layout and configurable gaps
  generateTessellation: (firstPlank: Plank, polygonPoints: Point[]) => {
    const dimensions = $plankDimensions.get();
    const plankLog = createPlankLogger($plankLogging.get());

    const result = generateTessellation(
      firstPlank,
      polygonPoints,
      dimensions,
      plankLog,
    );

    $planks.set(result.planks);
    $spares.set(result.spares);
    $gaps.set([]);
  },
};
