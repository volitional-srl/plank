import { atom, computed } from 'nanostores';

export interface Point {
  x: number;
  y: number;
}

export const $points = atom<Point[]>([]);
export const $isComplete = atom<boolean>(false);
export const $angleSnapEnabled = atom<boolean>(false);
export const $isShiftPressed = atom<boolean>(false);
export const $mousePosition = atom<Point | null>(null);

export const $isAngleSnapActive = computed(
  [$angleSnapEnabled, $isShiftPressed],
  (angleSnapEnabled, isShiftPressed) => angleSnapEnabled || isShiftPressed
);

export const $polygonPath = computed($points, (points) => {
  if (points.length === 0) return '';
  
  const pathData = points.map((point, index) => {
    return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
  }).join(' ');
  
  return pathData;
});

export const $polygonPathClosed = computed(
  [$polygonPath, $isComplete],
  (path, isComplete) => isComplete ? `${path} Z` : path
);

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
  
  setShiftPressed: (pressed: boolean) => {
    $isShiftPressed.set(pressed);
  },
  
  setMousePosition: (position: Point | null) => {
    $mousePosition.set(position);
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
      y: previousPoint.y + Math.sin(snappedAngle) * distance
    };
  }
};