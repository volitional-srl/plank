import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

// Grid and snapping state atoms
export const $gridSnapEnabled = atom<boolean>(false);
export const $angleSnapEnabled = atom<boolean>(false);
export const $isShiftPressed = atom<boolean>(false);

// Computed snapping states
export const $isAngleSnapActive = computed(
  [$angleSnapEnabled, $isShiftPressed],
  (angleSnapEnabled, isShiftPressed) => angleSnapEnabled || isShiftPressed,
);

export const $isGridSnapActive = computed(
  [$gridSnapEnabled],
  (gridSnapEnabled) => gridSnapEnabled,
);

// Grid and snapping actions
export const gridActions = {
  toggleGridSnap: () => {
    $gridSnapEnabled.set(!$gridSnapEnabled.get());
  },

  toggleAngleSnap: () => {
    $angleSnapEnabled.set(!$angleSnapEnabled.get());
  },

  setShiftPressed: (pressed: boolean) => {
    $isShiftPressed.set(pressed);
  },

  // Grid snapping functionality
  snapToGrid: (x: number, y: number, gridSize: number = 10): Point => {
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  },

  // Angle snapping functionality
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

  // Apply all active snapping modes
  applySnapping: (x: number, y: number, previousPoint?: Point): Point => {
    let point = { x, y };

    // Apply grid snapping first if enabled
    if ($gridSnapEnabled.get()) {
      point = gridActions.snapToGrid(point.x, point.y);
    }

    // Apply angle snapping if enabled and we have a previous point
    if (($angleSnapEnabled.get() || $isShiftPressed.get()) && previousPoint) {
      point = gridActions.snapToAngle(point.x, point.y, previousPoint);
    }

    return point;
  },
};