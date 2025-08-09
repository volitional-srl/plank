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
  console.log("  📏 Linear cut: Calculating intersection distance...");
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;
  console.log("  📏 Plank dimensions in pixels:", { lengthPx, widthPx });

  const intersectionDistance = calculateIntersectionDistance(
    { x: plank.x, y: plank.y },
    lengthPx,
    widthPx,
    plank.rotation,
    polygonPoints,
  );

  console.log("  📏 Intersection distance:", intersectionDistance);
  console.log("  📏 Length threshold (95%):", lengthPx * 0.95);

  if (!intersectionDistance || intersectionDistance >= lengthPx * 0.95) {
    console.log(
      "  ❌ Linear cut failed: No intersection or distance too large",
    );
    return null;
  }

  const cutLengthMm = intersectionDistance * pixelsToMm(1);
  console.log("  📏 Cut length in mm:", cutLengthMm);

  // Try both positive and negative offsets to determine which side of plank to keep
  const offsetMm = 5;
  const offsetPx = offsetMm / pixelsToMm(1);

  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Try negative offset first (cut from right/end side)
  const negativeAdjustedDistance = intersectionDistance - offsetPx;
  const negativeCutLengthMm = negativeAdjustedDistance * pixelsToMm(1);

  const negativeTestPlank: Plank = {
    ...plank,
    length: negativeCutLengthMm,
    x:
      plank.x -
      ((plank.length * MM_TO_PIXELS - negativeAdjustedDistance) / 2) * cos,
    y:
      plank.y -
      ((plank.length * MM_TO_PIXELS - negativeAdjustedDistance) / 2) * sin,
  };

  console.log("  📏 Trying negative offset:", {
    negativeAdjustedDistance,
    negativeTestPlank,
  });

  if (
    negativeCutLengthMm > 0 &&
    isPlankInPolygon(negativeTestPlank, polygonPoints)
  ) {
    console.log("  ✅ Negative offset works - using right/end side");

    const fitted: Plank = {
      ...plank,
      id: `${plank.id}-fitted`,
      length: negativeCutLengthMm,
      x: negativeTestPlank.x,
      y: negativeTestPlank.y,
    };

    const spareLength = plank.length - negativeCutLengthMm;
    const spare: Plank = {
      ...plank,
      id: `${plank.id}-spare-${Date.now()}`,
      length: spareLength,
      x:
        plank.x +
        ((plank.length * MM_TO_PIXELS + negativeAdjustedDistance) / 2) * cos,
      y:
        plank.y +
        ((plank.length * MM_TO_PIXELS + negativeAdjustedDistance) / 2) * sin,
      isSpare: true,
      originalLength: plank.originalLength || plank.length,
    };

    console.log("  ✅ Linear cut successful! (negative offset)", {
      fitted,
      spare,
    });
    return { fitted, spare };
  }

  // Try positive offset (cut from left/start side)
  const positiveAdjustedDistance = intersectionDistance + offsetPx;
  const positiveCutLengthMm =
    (plank.length * MM_TO_PIXELS - positiveAdjustedDistance) * pixelsToMm(1);

  const positiveTestPlank: Plank = {
    ...plank,
    length: positiveCutLengthMm,
    x:
      plank.x +
      ((plank.length * MM_TO_PIXELS - positiveAdjustedDistance) / 2) * cos,
    y:
      plank.y +
      ((plank.length * MM_TO_PIXELS - positiveAdjustedDistance) / 2) * sin,
  };

  console.log("  📏 Trying positive offset:", {
    positiveAdjustedDistance,
    positiveTestPlank,
  });

  if (
    positiveCutLengthMm > 0 &&
    isPlankInPolygon(positiveTestPlank, polygonPoints)
  ) {
    console.log("  ✅ Positive offset works - using left/start side");

    const fitted: Plank = {
      ...plank,
      id: `${plank.id}-fitted`,
      length: positiveCutLengthMm,
      x: positiveTestPlank.x,
      y: positiveTestPlank.y,
    };

    const spareLength = plank.length - positiveCutLengthMm;
    const spare: Plank = {
      ...plank,
      id: `${plank.id}-spare-${Date.now()}`,
      length: spareLength,
      x:
        plank.x -
        ((plank.length * MM_TO_PIXELS - positiveAdjustedDistance) / 2) * cos,
      y:
        plank.y -
        ((plank.length * MM_TO_PIXELS - positiveAdjustedDistance) / 2) * sin,
      isSpare: true,
      originalLength: plank.originalLength || plank.length,
    };

    console.log("  ✅ Linear cut successful! (positive offset)", {
      fitted,
      spare,
    });
    return { fitted, spare };
  }

  console.log("  ❌ Linear cut failed: Neither offset produces valid plank");
  return null;
};

// Try advanced multi-line cutting to create complex cut shapes
export const tryMultiLineCut = (
  plank: Plank,
  polygonPoints: Point[],
): { fitted: Plank; spare?: Plank } | null => {
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;
  const plankCorners = getPlankCorners(plank);

  // Find polygon edges that intersect with the plank
  const intersectingEdges: {
    edgeIndex: number;
    edgeStart: Point;
    edgeEnd: Point;
    cutLine: Point[];
  }[] = [];

  for (let polyEdgeIdx = 0; polyEdgeIdx < polygonPoints.length; polyEdgeIdx++) {
    const p1 = polygonPoints[polyEdgeIdx];
    const p2 = polygonPoints[(polyEdgeIdx + 1) % polygonPoints.length];

    // Check if this polygon edge intersects with the plank
    const plankBounds = {
      minX: Math.min(...plankCorners.map((c) => c.x)),
      maxX: Math.max(...plankCorners.map((c) => c.x)),
      minY: Math.min(...plankCorners.map((c) => c.y)),
      maxY: Math.max(...plankCorners.map((c) => c.y)),
    };

    // Check if polygon edge overlaps with plank bounds
    const edgeOverlapsX =
      Math.max(Math.min(p1.x, p2.x), plankBounds.minX) <=
      Math.min(Math.max(p1.x, p2.x), plankBounds.maxX);
    const edgeOverlapsY =
      Math.max(Math.min(p1.y, p2.y), plankBounds.minY) <=
      Math.min(Math.max(p1.y, p2.y), plankBounds.maxY);

    if (edgeOverlapsX && edgeOverlapsY) {
      // This polygon edge intersects the plank area
      // Create a cut line along this edge (clipped to plank bounds)
      let cutStart = p1;
      let cutEnd = p2;

      // For horizontal edges, clip to plank width
      if (Math.abs(p1.y - p2.y) < 1) {
        // Horizontal edge
        cutStart = {
          x: Math.max(Math.min(p1.x, p2.x), plankBounds.minX),
          y: p1.y,
        };
        cutEnd = {
          x: Math.min(Math.max(p1.x, p2.x), plankBounds.maxX),
          y: p1.y,
        };
      }
      // For vertical edges, clip to plank height
      else if (Math.abs(p1.x - p2.x) < 1) {
        // Vertical edge
        cutStart = {
          x: p1.x,
          y: Math.max(Math.min(p1.y, p2.y), plankBounds.minY),
        };
        cutEnd = {
          x: p1.x,
          y: Math.min(Math.max(p1.y, p2.y), plankBounds.maxY),
        };
      }

      // Only add if cut line has reasonable length
      const cutLength = Math.sqrt(
        (cutEnd.x - cutStart.x) ** 2 + (cutEnd.y - cutStart.y) ** 2,
      );
      if (cutLength > 5) {
        intersectingEdges.push({
          edgeIndex: polyEdgeIdx,
          edgeStart: p1,
          edgeEnd: p2,
          cutLine: [cutStart, cutEnd],
        });
      }
    }
  }

  if (intersectingEdges.length < 2) {
    return null;
  }

  // Don't use multi-line cutting for simple cases that should be linear cuts
  // If we only have edges in one direction (all horizontal or all vertical),
  // it's probably a simple linear cut case
  const hasHorizontalEdges = intersectingEdges.some(
    (edge) => Math.abs(edge.edgeStart.y - edge.edgeEnd.y) < 1,
  );
  const hasVerticalEdges = intersectingEdges.some(
    (edge) => Math.abs(edge.edgeStart.x - edge.edgeEnd.x) < 1,
  );

  // If we only have edges going in one direction, it's likely a linear cut case
  if (!(hasHorizontalEdges && hasVerticalEdges)) {
    return null;
  }

  const cutLines = intersectingEdges.map((edge) => edge.cutLine);

  const cutShape = buildMultiLineCutShape(plank, polygonPoints, cutLines, []);

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
