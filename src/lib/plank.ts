import type { Point } from "./geometry";
import {
  doLinesIntersect,
  doRectanglesIntersect,
  isPointInPolygon,
  isPointInRectangle,
  pixelsToMm,
} from "./geometry";

const MM_TO_PIXELS = 1 / 10;

export interface Plank {
  id: string;
  x: number;
  y: number;
  rotation: number;
  length: number;
  width: number;
  isSpare?: boolean;
  originalLength?: number;
  shape?: Point[];
  isArbitraryShape?: boolean;
  isMultiLineCut?: boolean;
  cutLines?: Point[][];
}

// Get rectangle corners as polygon
export const getPlankCorners = (plank: Plank): Point[] => {
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;
  const halfLength = lengthPx / 2;
  const halfWidth = widthPx / 2;

  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return [
    {
      x: plank.x + (-halfLength * cos - -halfWidth * sin),
      y: plank.y + (-halfLength * sin + -halfWidth * cos),
    },
    {
      x: plank.x + (halfLength * cos - -halfWidth * sin),
      y: plank.y + (halfLength * sin + -halfWidth * cos),
    },
    {
      x: plank.x + (halfLength * cos - halfWidth * sin),
      y: plank.y + (halfLength * sin + halfWidth * cos),
    },
    {
      x: plank.x + (-halfLength * cos - halfWidth * sin),
      y: plank.y + (-halfLength * sin + halfWidth * cos),
    },
  ];
};

// Check if two planks intersect
export const doPlanksIntersect = (plankA: Plank, plankB: Plank): boolean => {
  const cornersA = getPlankCorners(plankA);
  const cornersB = getPlankCorners(plankB);
  return doRectanglesIntersect(cornersA, cornersB);
};

// Check if a point is inside a plank
export const isPointOnPlank = (point: Point, plank: Plank): boolean => {
  const corners = getPlankCorners(plank);
  return isPointInRectangle(point, corners);
};

// Check if a plank (as rectangle or arbitrary shape) is fully inside the polygon
export const isPlankInPolygon = (
  plank: Plank,
  polygonPoints: Point[],
): boolean => {
  const corners = getPlankCorners(plank);

  if (!corners.some((corner) => isPointInPolygon(corner, polygonPoints))) {
    return false;
  }

  // check for intersections between plank edges and polygon edges
  for (
    let polygonPointsIndex = 0;
    polygonPointsIndex < polygonPoints.length;
    polygonPointsIndex++
  ) {
    const polygonPoint1 = polygonPoints[polygonPointsIndex];
    const polygonPoint2 =
      polygonPoints[(polygonPointsIndex + 1) % polygonPoints.length];
    for (let cornersIndex = 0; cornersIndex < corners.length; cornersIndex++) {
      const plankPoint1 = corners[cornersIndex];
      const plankPoint2 = corners[(cornersIndex + 1) % corners.length];
      if (
        doLinesIntersect(polygonPoint1, polygonPoint2, plankPoint1, plankPoint2)
      ) {
        return false;
      }
    }
  }

  return true;
};

// Check if plank overlaps with polygon
export const plankOverlapsPolygon = (
  plank: Plank,
  polygonPoints: Point[],
): boolean => {
  const plankCorners = getPlankCorners(plank);

  const hasPointInside =
    plankCorners.some((corner) => isPointInPolygon(corner, polygonPoints)) ||
    isPointInPolygon({ x: plank.x, y: plank.y }, polygonPoints);

  const polygonInPlank = polygonPoints.some((point) =>
    isPointInRectangle(point, plankCorners),
  );

  return hasPointInside || polygonInPlank;
};

// Check if plank collides with existing planks (considering gaps)
export const plankCollidesWithExisting = (
  plank: Plank,
  existingPlanks: Plank[],
  gapPx: number,
): boolean => {
  return existingPlanks.some((existing) => {
    const expandedExisting: Plank = {
      ...existing,
      length: existing.length + pixelsToMm(gapPx),
      width: existing.width + pixelsToMm(gapPx),
    };

    return doPlanksIntersect(plank, expandedExisting);
  });
};

// Find a suitable spare piece for the current position
// TODO: implement these constraints for choosing a spare:
// - The cut edge of the spare cannot meet other plank edges
// - The cut edge of the spare can only meet edges of the polygon
// - The uncut edges of the spare must meet edges of other planks or edges of the polygon
// - The spare must 100% fill the space where it will be placed
export const findSuitableSpare = (
  testPlank: Plank,
  polygonPoints: Point[],
  availableSpares: Plank[],
): Plank | null => {
  // this function is a placeholder

  return null;
};

// Calculate optimal row offset to maximize spare reuse
export const calculateOptimalRowOffset = (
  rowIndex: number,
  minOffsetPx: number,
  fullPlankLengthPx: number,
  availableSpares: Plank[],
): number => {
  if (Math.abs(rowIndex) <= 1) {
    return (rowIndex * minOffsetPx) % fullPlankLengthPx;
  }

  let optimalOffset = (rowIndex * minOffsetPx) % fullPlankLengthPx;

  if (availableSpares.length > 0) {
    const spareLengths = availableSpares.map(
      (spare) => spare.length * MM_TO_PIXELS,
    );
    const lengthCounts = new Map<number, number>();

    spareLengths.forEach((length) => {
      lengthCounts.set(length, (lengthCounts.get(length) || 0) + 1);
    });

    let mostCommonLength = 0;
    let maxCount = 0;
    for (const [length, count] of lengthCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLength = length;
      }
    }

    if (mostCommonLength > 0 && maxCount >= 2) {
      const spareBasedOffset = mostCommonLength;
      if (spareBasedOffset >= minOffsetPx) {
        optimalOffset = spareBasedOffset;
      } else {
        const multiplier = Math.ceil(minOffsetPx / spareBasedOffset);
        optimalOffset = spareBasedOffset * multiplier;
      }
    }
  }

  return optimalOffset;
};

// Cut a plank into two pieces
export const cutPlank = (
  plank: Plank,
  cutLengthMm: number,
): { fitted: Plank; spare: Plank } => {
  const fitted: Plank = {
    ...plank,
    id: `${plank.id}-fitted`,
    length: cutLengthMm,
  };

  const spare: Plank = {
    ...plank,
    id: `${plank.id}-spare-${Date.now()}`,
    length: plank.length - cutLengthMm,
    isSpare: true,
    originalLength: plank.originalLength || plank.length,
  };

  return { fitted, spare };
};
