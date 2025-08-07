import { MM_TO_PIXELS } from "@/stores/polygonStore";
import {
  doLinesIntersect,
  doRectanglesIntersect,
  isPointInPolygon,
  isPointInRectangle,
  Point,
} from "./geometry";

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
// FIXME this doesnt work in all cases. Instead try to check edge intersections
export const isPlankInPolygon = (
  plank: Plank,
  polygonPoints: Point[],
): boolean => {
  const corners = getPlankCorners(plank);

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
