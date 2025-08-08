import type { Point } from "./geometry";
import type { Plank } from "./plank";
import {
  calculateIntersectionDistance,
  calculatePolygonArea,
  clipPolygonByPolygon,
  isPointInPolygon,
  isPointOnPolygonBoundary,
  lineIntersection,
  pixelsToMm,
} from "./geometry";
import { cutPlank, getPlankCorners, isPlankInPolygon } from "./plank";

const MM_TO_PIXELS = 1 / 10;

// Try to fit a plank by cutting it to an arbitrary shape
export const fitPlankByShapeCutting = (
  plank: Plank,
  polygonPoints: Point[],
): Plank | null => {
  const plankCorners = getPlankCorners(plank);
  const clippedShape = clipPolygonByPolygon(plankCorners, polygonPoints);

  if (clippedShape.length < 3) {
    return null;
  }

  const clippedArea = calculatePolygonArea(clippedShape);
  const originalArea =
    plank.length * plank.width * (MM_TO_PIXELS * MM_TO_PIXELS);

  const polygonArea = calculatePolygonArea(polygonPoints);
  const plankToPolygonRatio = originalArea / polygonArea;

  const minAreaRatio = plankToPolygonRatio > 0.5 ? 0.005 : 0.02;
  const minAbsoluteArea = plankToPolygonRatio > 0.5 ? 10 : 50;

  if (
    clippedArea < originalArea * minAreaRatio ||
    clippedArea < minAbsoluteArea
  ) {
    return null;
  }

  const allPointsInside = clippedShape.every((point) =>
    isPointInPolygon(point, polygonPoints),
  );

  if (!allPointsInside) {
    return null;
  }

  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const relativeShape = clippedShape.map((point) => ({
    x: (point.x - plank.x) * cos + (point.y - plank.y) * sin,
    y: -(point.x - plank.x) * sin + (point.y - plank.y) * cos,
  }));

  return {
    ...plank,
    id: `${plank.id}-shaped`,
    isArbitraryShape: true,
    shape: relativeShape,
    isSpare: plank.isSpare,
    originalLength: plank.originalLength || plank.length,
  };
};

// Try to perform a clean linear cut along plank length
export const tryLinearCut = (
  plank: Plank,
  polygonPoints: Point[],
): { fitted: Plank; spare: Plank } | null => {
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;

  const intersectionDistance = calculateIntersectionDistance(
    { x: plank.x, y: plank.y },
    lengthPx,
    widthPx,
    plank.rotation,
    polygonPoints,
  );

  if (!intersectionDistance || intersectionDistance >= lengthPx * 0.95) {
    return null;
  }

  const cutLengthMm = intersectionDistance * pixelsToMm(1);
  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const testCutPlank: Plank = {
    ...plank,
    length: cutLengthMm,
    x:
      plank.x -
      ((plank.length * MM_TO_PIXELS - intersectionDistance) / 2) * cos,
    y:
      plank.y -
      ((plank.length * MM_TO_PIXELS - intersectionDistance) / 2) * sin,
  };

  if (!isPlankInPolygon(testCutPlank, polygonPoints)) {
    return null;
  }

  const { fitted, spare } = cutPlank(plank, cutLengthMm);
  fitted.x = testCutPlank.x;
  fitted.y = testCutPlank.y;

  return { fitted, spare };
};

// Try advanced multi-line cutting to create complex cut shapes
export const tryMultiLineCut = (
  plank: Plank,
  polygonPoints: Point[],
): { fitted: Plank; spare?: Plank } | null => {
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;
  const plankCorners = getPlankCorners(plank);

  const intersections: {
    point: Point;
    edge: number;
    plankEdge: number;
    distance: number;
  }[] = [];

  for (let plankEdgeIdx = 0; plankEdgeIdx < plankCorners.length; plankEdgeIdx++) {
    const corner1 = plankCorners[plankEdgeIdx];
    const corner2 = plankCorners[(plankEdgeIdx + 1) % plankCorners.length];

    for (let polyEdgeIdx = 0; polyEdgeIdx < polygonPoints.length; polyEdgeIdx++) {
      const p1 = polygonPoints[polyEdgeIdx];
      const p2 = polygonPoints[(polyEdgeIdx + 1) % polygonPoints.length];

      const intersection = lineIntersection(corner1, corner2, p1, p2);

      if (intersection) {
        const distance = Math.sqrt(
          (intersection.x - corner1.x) ** 2 +
            (intersection.y - corner1.y) ** 2,
        );
        intersections.push({
          point: intersection,
          edge: polyEdgeIdx,
          plankEdge: plankEdgeIdx,
          distance,
        });
      }
    }
  }

  if (intersections.length < 2) {
    return null;
  }

  intersections.sort(
    (a, b) => a.plankEdge - b.plankEdge || a.distance - b.distance,
  );

  const cutLines: Point[][] = [];

  for (let i = 0; i < intersections.length - 1; i++) {
    const int1 = intersections[i];
    const int2 = intersections[i + 1];

    const segmentLength = Math.sqrt(
      (int2.point.x - int1.point.x) ** 2 + (int2.point.y - int1.point.y) ** 2,
    );

    if (segmentLength > 20) {
      cutLines.push([int1.point, int2.point]);
    }
  }

  if (cutLines.length === 0) {
    return null;
  }

  const cutShape = buildMultiLineCutShape(
    plank,
    polygonPoints,
    cutLines,
    intersections,
  );

  if (!cutShape || cutShape.length < 3) {
    return null;
  }

  const cutArea = calculatePolygonArea(cutShape);
  const originalArea = lengthPx * widthPx;

  if (cutArea < originalArea * 0.15) {
    return null;
  }

  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const relativeShape = cutShape.map((point) => ({
    x: (point.x - plank.x) * cos + (point.y - plank.y) * sin,
    y: -(point.x - plank.x) * sin + (point.y - plank.y) * cos,
  }));

  const fittedPlank: Plank = {
    ...plank,
    id: `${plank.id}-multicut`,
    isArbitraryShape: true,
    isMultiLineCut: true,
    shape: relativeShape,
    cutLines: cutLines,
    originalLength: plank.originalLength || plank.length,
  };

  const spareArea = originalArea - cutArea;
  const spare = createSpareFromRemainingArea(plank, spareArea);

  return { fitted: fittedPlank, spare: spare || undefined };
};

// Build a complex cut shape from multiple cut lines
const buildMultiLineCutShape = (
  plank: Plank,
  polygonPoints: Point[],
  cutLines: Point[][],
  intersections: {
    point: Point;
    edge: number;
    plankEdge: number;
    distance: number;
  }[],
): Point[] | null => {
  const plankCorners = getPlankCorners(plank);

  const insideCorners = plankCorners.filter((corner) =>
    isPointInPolygon(corner, polygonPoints),
  );

  if (insideCorners.length === 0) {
    return null;
  }

  const shapePoints: Point[] = [];

  insideCorners.forEach((corner) => shapePoints.push(corner));

  const boundaryIntersections = intersections.filter((int) => {
    return isPointOnPolygonBoundary(int.point, polygonPoints);
  });

  boundaryIntersections.forEach((int) => shapePoints.push(int.point));

  if (shapePoints.length < 3) {
    return null;
  }

  const center = {
    x: shapePoints.reduce((sum, p) => sum + p.x, 0) / shapePoints.length,
    y: shapePoints.reduce((sum, p) => sum + p.y, 0) / shapePoints.length,
  };

  shapePoints.sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x);
    const angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });

  return shapePoints;
};

// Create spare from remaining area calculation
const createSpareFromRemainingArea = (
  originalPlank: Plank,
  spareAreaPx: number,
): Plank | null => {
  if (spareAreaPx < 1000) {
    return null;
  }

  const spareLength = Math.min(Math.sqrt(spareAreaPx), originalPlank.length);
  const spareWidth = Math.min(spareAreaPx / spareLength, originalPlank.width);

  if (spareLength < 200 || spareWidth < 50) {
    return null;
  }

  return {
    ...originalPlank,
    id: `${originalPlank.id}-spare-${Date.now()}`,
    length: pixelsToMm(spareLength),
    width: pixelsToMm(spareWidth),
    isSpare: true,
    originalLength: originalPlank.originalLength || originalPlank.length,
  };
};

// Create a spare from the unused part of a plank (simplified for arbitrary shapes)
export const createSpareFromCut = (
  originalPlank: Plank,
  fittedPlank: Plank,
): Plank | null => {
  if (!fittedPlank.isArbitraryShape || !fittedPlank.shape) return null;

  const originalArea = originalPlank.length * originalPlank.width;
  const fittedArea =
    calculatePolygonArea(fittedPlank.shape) * pixelsToMm(1) ** 2;
  const spareArea = originalArea - fittedArea;

  if (spareArea < 50 * 50) return null;

  const spareLength = Math.sqrt(spareArea);
  const spareWidth = Math.min(originalPlank.width, spareLength);

  return {
    ...originalPlank,
    id: `${originalPlank.id}-spare-${Date.now()}`,
    length: spareLength,
    width: spareWidth,
    isSpare: true,
    originalLength: originalPlank.originalLength || originalPlank.length,
  };
};