import { atom, computed } from "nanostores";

/**
 * Plank layout rules:
 * - Full-size planks are all a constant configurable size (defaults to 1500mm by 240mm).
 * - There is a constant configurable fixed gap between planks (defaults to 0).
 * - The polygon must be 100% covered by planks and the fixed-size gaps between planks.
 * - Planks must be layed within the polygon and never outside the polygon.
 * - Planks that cannot fit inside the polygon must be cut to size to meet the edge of the polygon.
 * - Planks that are cut will produce 2 cut planks: one that is placed and another that may be placed later or discarded.
 * - Planks can be cut into arbitrary shapes to fit within the edges of the polygon.
 * - Each new row of planks must be offset by the previous row by a configurable minimum distance (defaults to 300mm).
 */

export interface Point {
  x: number;
  y: number;
}

export interface PlankDimensions {
  length: number; // in mm
  width: number; // in mm
  gap: number; // fixed gap between planks in mm
  minRowOffset: number; // minimum offset between rows in mm
}

export interface Plank {
  id: string;
  x: number; // position in canvas coordinates
  y: number;
  rotation: number; // rotation in degrees
  length: number; // in mm
  width: number; // in mm
  isSpare?: boolean; // true if this is a cut spare piece
  originalLength?: number; // original length before cutting (for spares)
  shape?: Point[]; // custom shape points if cut to arbitrary shape (relative to center)
  isArbitraryShape?: boolean; // true if cut into non-rectangular shape
  isMultiLineCut?: boolean; // true if created through multi-line cutting
  cutLines?: Point[][]; // the cut lines used to create this plank (for visualization)
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

  // Convert individual measurements
  mmToPixels: (mm: number): number => mm * MM_TO_PIXELS,
  pixelsToMm: (pixels: number): number => pixels / MM_TO_PIXELS,

  // Sutherland-Hodgman polygon clipping algorithm
  clipPolygonByPolygon: (
    subjectPolygon: Point[],
    clipPolygon: Point[],
  ): Point[] => {
    if (subjectPolygon.length === 0 || clipPolygon.length === 0) return [];

    let outputList = [...subjectPolygon];

    for (let i = 0; i < clipPolygon.length; i++) {
      const clipVertex1 = clipPolygon[i];
      const clipVertex2 = clipPolygon[(i + 1) % clipPolygon.length];

      const inputList = outputList;
      outputList = [];

      if (inputList.length === 0) break;

      let s = inputList[inputList.length - 1];

      for (const e of inputList) {
        if (plankActions.isInsideEdge(e, clipVertex1, clipVertex2)) {
          if (!plankActions.isInsideEdge(s, clipVertex1, clipVertex2)) {
            const intersection = plankActions.computeIntersection(
              s,
              e,
              clipVertex1,
              clipVertex2,
            );
            if (intersection) outputList.push(intersection);
          }
          outputList.push(e);
        } else if (plankActions.isInsideEdge(s, clipVertex1, clipVertex2)) {
          const intersection = plankActions.computeIntersection(
            s,
            e,
            clipVertex1,
            clipVertex2,
          );
          if (intersection) outputList.push(intersection);
        }
        s = e;
      }
    }

    return outputList;
  },

  // Check if point is inside the edge (left side of directed line)
  isInsideEdge: (point: Point, edgeStart: Point, edgeEnd: Point): boolean => {
    return (
      (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
        (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >=
      0
    );
  },

  // Compute intersection of two line segments
  computeIntersection: (
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point,
  ): Point | null => {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-10) return null;

    const t =
      ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  },

  // Calculate polygon area (for checking if shape is valid)
  calculatePolygonArea: (points: Point[]): number => {
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  },

  // Get rectangle corners as polygon
  getRectangleCorners: (plank: Plank): Point[] => {
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
  },

  // Check if two planks (rectangles) intersect using Separating Axis Theorem
  // Returns true only for actual overlaps, not just edge-touching
  doPlanksIntersect: (plankA: Plank, plankB: Plank): boolean => {
    const cornersA = plankActions.getRectangleCorners(plankA);
    const cornersB = plankActions.getRectangleCorners(plankB);

    // Get the axes to test (perpendicular to edges of both rectangles)
    const axes = [
      // PlankA axes
      { x: cornersA[1].x - cornersA[0].x, y: cornersA[1].y - cornersA[0].y },
      { x: cornersA[2].x - cornersA[1].x, y: cornersA[2].y - cornersA[1].y },
      // PlankB axes
      { x: cornersB[1].x - cornersB[0].x, y: cornersB[1].y - cornersB[0].y },
      { x: cornersB[2].x - cornersB[1].x, y: cornersB[2].y - cornersB[1].y },
    ];

    // Test each axis
    for (const axis of axes) {
      const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
      if (length === 0) continue;

      const normalizedAxis = { x: axis.x / length, y: axis.y / length };

      // Project both rectangles onto this axis
      const projA = cornersA.map(
        (corner) => corner.x * normalizedAxis.x + corner.y * normalizedAxis.y,
      );
      const projB = cornersB.map(
        (corner) => corner.x * normalizedAxis.x + corner.y * normalizedAxis.y,
      );

      const minA = Math.min(...projA);
      const maxA = Math.max(...projA);
      const minB = Math.min(...projB);
      const maxB = Math.max(...projB);

      // Use a small tolerance to allow edge-touching but prevent overlaps
      const tolerance = 0.1; // 0.1 pixel tolerance

      // If projections don't overlap on this axis (with tolerance), rectangles don't intersect
      if (maxA <= minB + tolerance || maxB <= minA + tolerance) {
        return false;
      }
    }

    // If we get here, rectangles intersect on all axes
    return true;
  },

  // Check if a point is inside a rectangle (plank)
  isPointInRectangle: (point: Point, plank: Plank): boolean => {
    const corners = plankActions.getRectangleCorners(plank);

    // Use the same ray casting algorithm but with the rectangle corners
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x;
      const yi = corners[i].y;
      const xj = corners[j].x;
      const yj = corners[j].y;

      if (
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  },

  // Check if a point is inside a polygon using ray casting algorithm
  isPointInPolygon: (point: Point, polygonPoints: Point[]): boolean => {
    if (polygonPoints.length < 3) return false;

    let inside = false;
    for (
      let i = 0, j = polygonPoints.length - 1;
      i < polygonPoints.length;
      j = i++
    ) {
      const xi = polygonPoints[i].x;
      const yi = polygonPoints[i].y;
      const xj = polygonPoints[j].x;
      const yj = polygonPoints[j].y;

      if (
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  },

  // Check if a plank (as rectangle or arbitrary shape) is fully inside the polygon
  isPlankInPolygon: (plank: Plank, polygonPoints: Point[]): boolean => {
    let corners: Point[];

    if (plank.isArbitraryShape && plank.shape) {
      // Transform shape points to world coordinates
      const rad = (plank.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      corners = plank.shape.map((point) => ({
        x: plank.x + (point.x * cos - point.y * sin),
        y: plank.y + (point.x * sin + point.y * cos),
      }));
    } else {
      // Use rectangle corners
      corners = plankActions.getRectangleCorners(plank);
    }

    // All corners must be inside the polygon
    return corners.every((corner) =>
      plankActions.isPointInPolygon(corner, polygonPoints),
    );
  },

  // Try to fit a plank by cutting it to an arbitrary shape
  fitPlankByShapeCutting: (
    plank: Plank,
    polygonPoints: Point[],
  ): Plank | null => {
    // Get the plank's rectangle corners
    const plankCorners = plankActions.getRectangleCorners(plank);

    // Check if any part of the plank is actually inside the polygon
    const insideCorners = plankCorners.filter((corner) =>
      plankActions.isPointInPolygon(corner, polygonPoints),
    );

    // Don't reject immediately - even if no corners are inside,
    // the plank could still intersect and create a valid shape-cut piece

    // Clip the plank rectangle against the room polygon
    const clippedShape = plankActions.clipPolygonByPolygon(
      plankCorners,
      polygonPoints,
    );

    if (clippedShape.length < 3) {
      return null; // Not enough area
    }

    const clippedArea = plankActions.calculatePolygonArea(clippedShape);
    const originalArea =
      plank.length * plank.width * (MM_TO_PIXELS * MM_TO_PIXELS);
    const areaRatio = clippedArea / originalArea;

    // Calculate polygon area to determine adaptive thresholds
    const polygonArea = plankActions.calculatePolygonArea(polygonPoints);
    const plankToPolygonRatio = originalArea / polygonArea;

    // Adaptive thresholds: smaller minimum area when plank is much larger than room
    const minAreaRatio = plankToPolygonRatio > 0.5 ? 0.005 : 0.02; // 0.5% for large planks, 2% for smaller ones
    const minAbsoluteArea = plankToPolygonRatio > 0.5 ? 10 : 50; // 10px² for large planks, 50px² for smaller ones

    if (
      clippedArea < originalArea * minAreaRatio ||
      clippedArea < minAbsoluteArea
    ) {
      return null;
    }

    // Verify all clipped shape points are actually inside the polygon
    const allPointsInside = clippedShape.every((point) =>
      plankActions.isPointInPolygon(point, polygonPoints),
    );

    if (!allPointsInside) {
      return null; // Shape extends outside polygon
    }

    // Convert clipped shape to relative coordinates (relative to plank center)
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
  },

  // Create a spare from the unused part of a plank (simplified for arbitrary shapes)
  createSpareFromCut: (
    originalPlank: Plank,
    fittedPlank: Plank,
  ): Plank | null => {
    if (!fittedPlank.isArbitraryShape || !fittedPlank.shape) return null;

    const originalArea = originalPlank.length * originalPlank.width;
    const fittedArea =
      plankActions.calculatePolygonArea(fittedPlank.shape) *
      plankActions.pixelsToMm(1) ** 2;
    const spareArea = originalArea - fittedArea;

    // Create a simplified spare (as a rectangle for now)
    // In reality, this would be more complex shape analysis
    if (spareArea < 50 * 50) return null; // Minimum 50mm x 50mm spare

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
  },

  // Try advanced multi-line cutting to create complex cut shapes
  tryMultiLineCut: (
    plank: Plank,
    polygonPoints: Point[],
  ): { fitted: Plank; spare?: Plank } | null => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    const plankCorners = plankActions.getRectangleCorners(plank);

    // Find all intersection points between plank edges and polygon edges
    const intersections: {
      point: Point;
      edge: number;
      plankEdge: number;
      distance: number;
    }[] = [];

    for (
      let plankEdgeIdx = 0;
      plankEdgeIdx < plankCorners.length;
      plankEdgeIdx++
    ) {
      const corner1 = plankCorners[plankEdgeIdx];
      const corner2 = plankCorners[(plankEdgeIdx + 1) % plankCorners.length];

      for (
        let polyEdgeIdx = 0;
        polyEdgeIdx < polygonPoints.length;
        polyEdgeIdx++
      ) {
        const p1 = polygonPoints[polyEdgeIdx];
        const p2 = polygonPoints[(polyEdgeIdx + 1) % polygonPoints.length];

        const intersection = plankActions.lineIntersection(
          corner1.x,
          corner1.y,
          corner2.x,
          corner2.y,
          p1.x,
          p1.y,
          p2.x,
          p2.y,
        );

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
      return null; // Need at least 2 intersections for a meaningful cut
    }

    // Sort intersections to create a logical cutting path
    intersections.sort(
      (a, b) => a.plankEdge - b.plankEdge || a.distance - b.distance,
    );

    // Generate cut lines (multiple segments)
    const cutLines: Point[][] = [];

    // Create cut segments based on intersection patterns
    for (let i = 0; i < intersections.length - 1; i++) {
      const int1 = intersections[i];
      const int2 = intersections[i + 1];

      // Only create cut lines between intersections on different plank edges
      // or intersections that are reasonably far apart
      const segmentLength = Math.sqrt(
        (int2.point.x - int1.point.x) ** 2 + (int2.point.y - int1.point.y) ** 2,
      );

      if (segmentLength > 20) {
        // Minimum 200mm segment
        cutLines.push([int1.point, int2.point]);
      }
    }

    if (cutLines.length === 0) {
      return null; // No valid cut lines found
    }

    // Build the cut shape by tracing the polygon boundary and cut lines
    const cutShape = plankActions.buildMultiLineCutShape(
      plank,
      polygonPoints,
      cutLines,
      intersections,
    );

    if (!cutShape || cutShape.length < 3) {
      return null;
    }

    // Validate cut shape area
    const cutArea = plankActions.calculatePolygonArea(cutShape);
    const originalArea = lengthPx * widthPx;

    if (cutArea < originalArea * 0.15) {
      // At least 15% of original area
      return null;
    }

    // Convert to relative coordinates for the plank shape
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

    // Create spare from remaining area
    const spareArea = originalArea - cutArea;
    const spare = plankActions.createSpareFromRemainingArea(plank, spareArea);

    return { fitted: fittedPlank, spare };
  },

  // Build a complex cut shape from multiple cut lines
  buildMultiLineCutShape: (
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
    const plankCorners = plankActions.getRectangleCorners(plank);

    // Start with corners that are inside the polygon
    const insideCorners = plankCorners.filter((corner) =>
      plankActions.isPointInPolygon(corner, polygonPoints),
    );

    if (insideCorners.length === 0) {
      return null; // No part of plank is inside
    }

    // Build shape by combining inside corners and intersection points
    const shapePoints: Point[] = [];

    // Add inside corners
    insideCorners.forEach((corner) => shapePoints.push(corner));

    // Add intersection points that form the cutting boundary
    const boundaryIntersections = intersections.filter((int) => {
      // Only include intersections that lie on the polygon boundary
      return plankActions.isPointOnPolygonBoundary(int.point, polygonPoints);
    });

    boundaryIntersections.forEach((int) => shapePoints.push(int.point));

    if (shapePoints.length < 3) {
      return null;
    }

    // Sort points to form a valid polygon (clockwise order)
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
  },

  // Check if a point lies on the polygon boundary
  isPointOnPolygonBoundary: (
    point: Point,
    polygonPoints: Point[],
    tolerance: number = 1,
  ): boolean => {
    for (let i = 0; i < polygonPoints.length; i++) {
      const j = (i + 1) % polygonPoints.length;
      const p1 = polygonPoints[i];
      const p2 = polygonPoints[j];

      const distance = plankActions.distanceFromPointToLineSegment(
        point,
        p1,
        p2,
      );
      if (distance <= tolerance) {
        return true;
      }
    }
    return false;
  },

  // Calculate distance from point to line segment
  distanceFromPointToLineSegment: (
    point: Point,
    lineStart: Point,
    lineEnd: Point,
  ): number => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }

    const param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Create spare from remaining area calculation
  createSpareFromRemainingArea: (
    originalPlank: Plank,
    spareAreaPx: number,
  ): Plank | null => {
    if (spareAreaPx < 1000) {
      // Minimum 1000px² = ~1m²
      return null;
    }

    // Estimate dimensions for rectangular spare
    const spareLength = Math.min(Math.sqrt(spareAreaPx), originalPlank.length);
    const spareWidth = Math.min(spareAreaPx / spareLength, originalPlank.width);

    if (spareLength < 200 || spareWidth < 50) {
      // Minimum viable spare dimensions
      return null;
    }

    return {
      ...originalPlank,
      id: `${originalPlank.id}-spare-${Date.now()}`,
      length: plankActions.pixelsToMm(spareLength),
      width: plankActions.pixelsToMm(spareWidth),
      isSpare: true,
      originalLength: originalPlank.originalLength || originalPlank.length,
    };
  },

  // Try to perform a clean linear cut along plank length (enhanced for single cuts)
  tryLinearCut: (
    plank: Plank,
    polygonPoints: Point[],
  ): { fitted: Plank; spare?: Plank } | null => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;

    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Check if we can make a clean cut along the plank length direction
    // Cast rays from both width edges of the plank along its length
    const halfLength = lengthPx / 2;
    const halfWidth = widthPx / 2;

    // Get the four corners of the plank to understand its orientation
    const corners = plankActions.getRectangleCorners(plank);

    // Cast rays from the front edge of the plank towards the back
    const edges = [
      {
        // Top edge of plank
        startX: plank.x - halfLength * cos - halfWidth * sin,
        startY: plank.y - halfLength * sin + halfWidth * cos,
        endX: plank.x + halfLength * cos - halfWidth * sin,
        endY: plank.y + halfLength * sin + halfWidth * cos,
      },
      {
        // Bottom edge of plank
        startX: plank.x - halfLength * cos + halfWidth * sin,
        startY: plank.y - halfLength * sin - halfWidth * cos,
        endX: plank.x + halfLength * cos + halfWidth * sin,
        endY: plank.y + halfLength * sin - halfWidth * cos,
      },
    ];

    let minIntersectionDistance = lengthPx;
    let hasIntersection = false;

    for (const edge of edges) {
      // Test intersection with each polygon edge
      for (let i = 0; i < polygonPoints.length; i++) {
        const j = (i + 1) % polygonPoints.length;
        const p1 = polygonPoints[i];
        const p2 = polygonPoints[j];

        // Find intersection between plank edge and polygon edge
        const intersection = plankActions.lineIntersection(
          edge.startX,
          edge.startY,
          edge.endX,
          edge.endY,
          p1.x,
          p1.y,
          p2.x,
          p2.y,
        );

        if (intersection) {
          // Calculate distance from plank start to intersection
          const distance = Math.sqrt(
            (intersection.x - edge.startX) ** 2 +
              (intersection.y - edge.startY) ** 2,
          );

          // Check if this intersection is within the plank bounds and meaningful
          if (distance > 25 && distance < lengthPx - 25) {
            // At least 25px = 250mm from each end
            minIntersectionDistance = Math.min(
              minIntersectionDistance,
              distance,
            );
            hasIntersection = true;
          }
        }
      }
    }

    if (!hasIntersection) {
      return null; // No clean cut possible
    }

    if (minIntersectionDistance >= lengthPx * 0.95) {
      return null; // Cut would be too small
    }

    // Check if this is truly an orthogonal cut by seeing if both edges hit at similar distances
    const cutLengthMm = minIntersectionDistance * plankActions.pixelsToMm(1);

    // Verify the cut plank would fit inside the polygon
    const testCutPlank: Plank = {
      ...plank,
      length: cutLengthMm,
      x:
        plank.x -
        ((plank.length * MM_TO_PIXELS - minIntersectionDistance) / 2) * cos,
      y:
        plank.y -
        ((plank.length * MM_TO_PIXELS - minIntersectionDistance) / 2) * sin,
    };

    if (!plankActions.isPlankInPolygon(testCutPlank, polygonPoints)) {
      return null; // Cut plank doesn't fit cleanly
    }

    // Create the cut plank and spare
    const { fitted, spare } = plankActions.cutPlank(plank, cutLengthMm);
    fitted.x = testCutPlank.x;
    fitted.y = testCutPlank.y;

    return { fitted, spare };
  },

  // Calculate the shape of a gap that needs to be filled
  calculateGapShape: (plank: Plank, polygonPoints: Point[]): Point[] | null => {
    // This is a simplified version - in reality, gap shapes are complex
    // For now, we'll represent gaps as the intersection of the plank area that's outside the room
    const plankCorners = plankActions.getRectangleCorners(plank);

    // Find which corners are outside the polygon
    const outsideCorners = plankCorners.filter(
      (corner) => !plankActions.isPointInPolygon(corner, polygonPoints),
    );

    if (outsideCorners.length === 0) return null;

    // For simplicity, return the outside corners as the gap shape
    // In a real implementation, this would calculate the exact boundary
    return outsideCorners.length >= 3 ? outsideCorners : null;
  },

  // Calculate intersection distance along plank length when it hits polygon edge
  calculateIntersectionDistance: (
    plank: Plank,
    polygonPoints: Point[],
  ): number | null => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    const halfWidth = widthPx / 2;

    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Direction vector along plank length
    const lengthDirX = cos;
    const lengthDirY = sin;

    // Check both edges of the plank (top and bottom)
    const edges = [
      {
        // Top edge
        startX: plank.x - halfWidth * sin,
        startY: plank.y + halfWidth * cos,
      },
      {
        // Bottom edge
        startX: plank.x + halfWidth * sin,
        startY: plank.y - halfWidth * cos,
      },
    ];

    let minIntersectionDistance = lengthPx;

    for (const edge of edges) {
      // Cast ray from back of plank along length direction
      const rayStartX = edge.startX - (lengthPx / 2) * lengthDirX;
      const rayStartY = edge.startY - (lengthPx / 2) * lengthDirY;

      // Find intersection with polygon edges
      for (let i = 0; i < polygonPoints.length; i++) {
        const j = (i + 1) % polygonPoints.length;
        const p1 = polygonPoints[i];
        const p2 = polygonPoints[j];

        const intersection = plankActions.lineIntersection(
          rayStartX,
          rayStartY,
          rayStartX + lengthPx * lengthDirX,
          rayStartY + lengthPx * lengthDirY,
          p1.x,
          p1.y,
          p2.x,
          p2.y,
        );

        if (intersection) {
          const distance = Math.sqrt(
            (intersection.x - rayStartX) ** 2 +
              (intersection.y - rayStartY) ** 2,
          );
          minIntersectionDistance = Math.min(minIntersectionDistance, distance);
        }
      }
    }

    return minIntersectionDistance < lengthPx ? minIntersectionDistance : null;
  },

  // Line intersection helper
  lineIntersection: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
  ): Point | null => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      };
    }

    return null;
  },

  // Cut a plank into two pieces
  cutPlank: (
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
  },

  // Find a spare that can fit in a gap
  findSpareForGap: (gap: Gap): Plank | null => {
    const spares = $spares.get();

    // Find spare that is exactly the right size or larger
    for (const spare of spares) {
      if (spare.length >= gap.requiredLength && spare.width === gap.width) {
        return spare;
      }
    }

    return null;
  },

  // Generate tessellation with proper row-based layout and configurable gaps
  generateTessellation: (firstPlank: Plank, polygonPoints: Point[]) => {
    if (polygonPoints.length < 3) return;

    const dimensions = $plankDimensions.get();
    const lengthPx = dimensions.length * MM_TO_PIXELS;
    const widthPx = dimensions.width * MM_TO_PIXELS;
    const gapPx = dimensions.gap * MM_TO_PIXELS;
    const minRowOffsetPx = dimensions.minRowOffset * MM_TO_PIXELS;

    const newPlanks: Plank[] = [firstPlank];
    const newSpares: Plank[] = [];
    let plankId = 1;

    // Calculate bounding box of polygon
    const minX = Math.min(...polygonPoints.map((p) => p.x));
    const maxX = Math.max(...polygonPoints.map((p) => p.x));
    const minY = Math.min(...polygonPoints.map((p) => p.y));
    const maxY = Math.max(...polygonPoints.map((p) => p.y));

    const startX = firstPlank.x;
    const startY = firstPlank.y;
    const rotation = firstPlank.rotation;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Calculate spacing between planks (including gaps)
    const plankSpacingX = (lengthPx + gapPx) * cos;
    const plankSpacingY = (lengthPx + gapPx) * sin;
    const rowSpacingX = -(widthPx + gapPx) * sin;
    const rowSpacingY = (widthPx + gapPx) * cos;

    // Row-based tessellation (like real flooring)
    for (let rowIndex = -20; rowIndex <= 20; rowIndex++) {
      // Calculate optimal row offset (≥ minimum) to maximize spare reuse
      const offsetForThisRow = plankActions.calculateOptimalRowOffset(
        rowIndex,
        minRowOffsetPx,
        lengthPx + gapPx,
        newSpares,
      );

      for (let plankInRow = -20; plankInRow <= 20; plankInRow++) {
        // Skip the first plank position (already placed)
        if (rowIndex === 0 && plankInRow === 0) continue;

        // Calculate position with row offset
        const plankX =
          startX +
          plankInRow * plankSpacingX +
          rowIndex * rowSpacingX +
          offsetForThisRow * cos;
        const plankY =
          startY +
          plankInRow * plankSpacingY +
          rowIndex * rowSpacingY +
          offsetForThisRow * sin;

        // Skip if outside polygon bounding box
        if (
          plankX < minX - lengthPx ||
          plankX > maxX + lengthPx ||
          plankY < minY - widthPx ||
          plankY > maxY + widthPx
        ) {
          continue;
        }

        const testPlank: Plank = {
          id: `row${rowIndex}-plank${plankInRow}-${plankId++}`,
          x: plankX,
          y: plankY,
          rotation: rotation,
          length: dimensions.length,
          width: dimensions.width,
        };

        // Check if plank overlaps with polygon
        if (!plankActions.plankOverlapsPolygon(testPlank, polygonPoints)) {
          continue;
        }

        // Check for collisions with existing planks (with gap tolerance)
        if (
          plankActions.plankCollidesWithExisting(testPlank, newPlanks, gapPx)
        ) {
          continue;
        }

        // Try to place the plank - check for spare reuse first
        let plankPlaced = false;

        // First, try to use an existing spare piece if available
        const suitableSpare = plankActions.findSuitableSpare(
          testPlank,
          polygonPoints,
          newSpares,
        );
        if (suitableSpare) {
          const spareIndex = newSpares.indexOf(suitableSpare);
          if (spareIndex >= 0) {
            newSpares.splice(spareIndex, 1);
            const sparePlank = {
              ...suitableSpare,
              x: testPlank.x,
              y: testPlank.y,
              rotation: testPlank.rotation,
            };
            newPlanks.push(sparePlank);
            plankPlaced = true;
          }
        }

        // If no suitable spare, try placing a full plank
        if (!plankPlaced) {
          if (plankActions.isPlankInPolygon(testPlank, polygonPoints)) {
            // Full plank fits completely
            newPlanks.push(testPlank);
            plankPlaced = true;
          }
        }

        // If full plank doesn't fit, try cutting (multiple approaches)
        if (!plankPlaced) {
          // Try cutting approaches in order of preference:
          // 1. Linear cut (single straight line)
          // 2. Multi-line cut (multiple segments for complex shapes)
          // 3. Arbitrary shape cutting (fallback for any geometry)

          const linearCutResult = plankActions.tryLinearCut(
            testPlank,
            polygonPoints,
          );
          if (linearCutResult) {
            // Check if linear cut plank fits with gaps
            if (
              !plankActions.plankCollidesWithExisting(
                linearCutResult.fitted,
                newPlanks,
                gapPx,
              )
            ) {
              newPlanks.push(linearCutResult.fitted);
              if (linearCutResult.spare) {
                newSpares.push(linearCutResult.spare);
              }
              plankPlaced = true;
            }
          }

          // If linear cut failed, try multi-line cutting
          if (!plankPlaced) {
            const multiLineCutResult = plankActions.tryMultiLineCut(
              testPlank,
              polygonPoints,
            );
            if (multiLineCutResult) {
              // Check collision for multi-line cut planks
              const multiCutHasCollision = newPlanks.some((existingPlank) =>
                plankActions.doPlanksIntersect(testPlank, existingPlank),
              );

              if (!multiCutHasCollision) {
                newPlanks.push(multiLineCutResult.fitted);
                if (multiLineCutResult.spare) {
                  newSpares.push(multiLineCutResult.spare);
                }
                plankPlaced = true;
              }
            }
          }

          // If multi-line cut failed, try arbitrary shape cutting as fallback
          if (!plankPlaced) {
            const shapeCutPlank = plankActions.fitPlankByShapeCutting(
              testPlank,
              polygonPoints,
            );
            if (shapeCutPlank) {
              // Check collision for shape-cut planks
              const shapeCutHasCollision = newPlanks.some((existingPlank) =>
                plankActions.doPlanksIntersect(testPlank, existingPlank),
              );

              if (!shapeCutHasCollision) {
                newPlanks.push(shapeCutPlank);

                // Create spare from the unused portion
                const spare = plankActions.createSpareFromCut(
                  testPlank,
                  shapeCutPlank,
                );
                if (spare) {
                  newSpares.push(spare);
                }
                plankPlaced = true;
              }
            }
          }
        }
      }
    }

    // Secondary pass: Fill remaining gaps to ensure 100% coverage
    plankActions.fillRemainingGaps(
      newPlanks,
      newSpares,
      polygonPoints,
      dimensions,
      gapPx,
      startX,
      startY,
      rotation,
    );

    $planks.set(newPlanks);
    $spares.set(newSpares);
    $gaps.set([]);
  },

  // Helper: Check if plank overlaps with polygon
  plankOverlapsPolygon: (plank: Plank, polygonPoints: Point[]): boolean => {
    const plankCorners = plankActions.getRectangleCorners(plank);

    // Check if any plank corner is inside polygon
    const hasPointInside =
      plankCorners.some((corner) =>
        plankActions.isPointInPolygon(corner, polygonPoints),
      ) ||
      plankActions.isPointInPolygon({ x: plank.x, y: plank.y }, polygonPoints);

    // Check if any polygon vertex is inside plank
    const polygonInPlank = polygonPoints.some((point) =>
      plankActions.isPointInRectangle(point, plank),
    );

    return hasPointInside || polygonInPlank;
  },

  // Helper: Check if plank collides with existing planks (considering gaps)
  plankCollidesWithExisting: (
    plank: Plank,
    existingPlanks: Plank[],
    gapPx: number,
  ): boolean => {
    return existingPlanks.some((existing) => {
      // Create expanded rectangles that include the gap
      const expandedExisting: Plank = {
        ...existing,
        length: existing.length + plankActions.pixelsToMm(gapPx),
        width: existing.width + plankActions.pixelsToMm(gapPx),
      };

      return plankActions.doPlanksIntersect(plank, expandedExisting);
    });
  },

  // Calculate optimal row offset to maximize spare reuse
  calculateOptimalRowOffset: (
    rowIndex: number,
    minOffsetPx: number,
    fullPlankLengthPx: number,
    availableSpares: Plank[],
  ): number => {
    // For the first few rows, use standard pattern
    if (Math.abs(rowIndex) <= 1) {
      return (rowIndex * minOffsetPx) % fullPlankLengthPx;
    }

    // For subsequent rows, try to align with available spare lengths
    let optimalOffset = (rowIndex * minOffsetPx) % fullPlankLengthPx;

    if (availableSpares.length > 0) {
      // Find the most common spare length
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

      // If we have a common spare length, try to use it
      if (mostCommonLength > 0 && maxCount >= 2) {
        const spareBasedOffset = mostCommonLength;
        // Ensure it meets minimum offset requirement
        if (spareBasedOffset >= minOffsetPx) {
          optimalOffset = spareBasedOffset;
        } else {
          // Use multiple of spare length that meets minimum
          const multiplier = Math.ceil(minOffsetPx / spareBasedOffset);
          optimalOffset = spareBasedOffset * multiplier;
        }
      }
    }

    return optimalOffset;
  },

  // Find a suitable spare piece for the current position
  findSuitableSpare: (
    testPlank: Plank,
    polygonPoints: Point[],
    availableSpares: Plank[],
  ): Plank | null => {
    // Sort spares by length descending to use larger pieces first
    const sortedSpares = [...availableSpares].sort(
      (a, b) => b.length - a.length,
    );

    for (const spare of sortedSpares) {
      // Create test plank with spare dimensions
      const spareTestPlank: Plank = {
        ...testPlank,
        length: spare.length,
        width: spare.width,
      };

      // Check if spare fits completely in this position
      if (plankActions.isPlankInPolygon(spareTestPlank, polygonPoints)) {
        return spare;
      }
    }

    return null;
  },

  // Fill remaining gaps to ensure 100% polygon coverage
  fillRemainingGaps: (
    newPlanks: Plank[],
    newSpares: Plank[],
    polygonPoints: Point[],
    dimensions: PlankDimensions,
    gapPx: number,
    startX: number,
    startY: number,
    rotation: number,
  ) => {
    const lengthPx = dimensions.length * MM_TO_PIXELS;
    const widthPx = dimensions.width * MM_TO_PIXELS;

    // Calculate bounding box
    const minX = Math.min(...polygonPoints.map((p) => p.x));
    const maxX = Math.max(...polygonPoints.map((p) => p.x));
    const minY = Math.min(...polygonPoints.map((p) => p.y));
    const maxY = Math.max(...polygonPoints.map((p) => p.y));

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let plankId = 10000; // Use high IDs for gap-fill planks

    // Fine-grained grid search to fill all remaining gaps
    const stepSize = Math.min(lengthPx, widthPx) * 0.25; // Quarter plank steps

    for (let x = minX; x <= maxX; x += stepSize) {
      for (let y = minY; y <= maxY; y += stepSize) {
        const testPlank: Plank = {
          id: `gap-fill-${plankId++}`,
          x: x,
          y: y,
          rotation: rotation,
          length: dimensions.length,
          width: dimensions.width,
        };

        // Skip if no overlap with polygon
        if (!plankActions.plankOverlapsPolygon(testPlank, polygonPoints)) {
          continue;
        }

        // Skip if collides with existing planks (with gap tolerance)
        if (
          plankActions.plankCollidesWithExisting(testPlank, newPlanks, gapPx)
        ) {
          continue;
        }

        // Try to place full plank, spare, or cut plank
        let placed = false;

        // 1. Try using existing spare
        const suitableSpare = plankActions.findSuitableSpare(
          testPlank,
          polygonPoints,
          newSpares,
        );
        if (suitableSpare && !placed) {
          const spareIndex = newSpares.indexOf(suitableSpare);
          if (spareIndex >= 0) {
            newSpares.splice(spareIndex, 1);
            const sparePlank = {
              ...suitableSpare,
              x: testPlank.x,
              y: testPlank.y,
              rotation: testPlank.rotation,
            };
            newPlanks.push(sparePlank);
            placed = true;
          }
        }

        // 2. Try full plank
        if (
          !placed &&
          plankActions.isPlankInPolygon(testPlank, polygonPoints)
        ) {
          newPlanks.push(testPlank);
          placed = true;
        }

        // 3. Try linear cut
        if (!placed) {
          const linearCutResult = plankActions.tryLinearCut(
            testPlank,
            polygonPoints,
          );
          if (
            linearCutResult &&
            !plankActions.plankCollidesWithExisting(
              linearCutResult.fitted,
              newPlanks,
              gapPx,
            )
          ) {
            newPlanks.push(linearCutResult.fitted);
            if (linearCutResult.spare) {
              newSpares.push(linearCutResult.spare);
            }
            placed = true;
          }
        }

        // 4. Try multi-line cut
        if (!placed) {
          const multiLineCutResult = plankActions.tryMultiLineCut(
            testPlank,
            polygonPoints,
          );
          if (multiLineCutResult) {
            const multiCutHasCollision = newPlanks.some((existingPlank) =>
              plankActions.doPlanksIntersect(testPlank, existingPlank),
            );

            if (!multiCutHasCollision) {
              newPlanks.push(multiLineCutResult.fitted);
              if (multiLineCutResult.spare) {
                newSpares.push(multiLineCutResult.spare);
              }
              placed = true;
            }
          }
        }

        // 5. Try shape cutting (fallback)
        if (!placed) {
          const shapeCutPlank = plankActions.fitPlankByShapeCutting(
            testPlank,
            polygonPoints,
          );
          if (shapeCutPlank) {
            const shapeCutHasCollision = newPlanks.some((existingPlank) =>
              plankActions.doPlanksIntersect(testPlank, existingPlank),
            );

            if (!shapeCutHasCollision) {
              newPlanks.push(shapeCutPlank);
              const spare = plankActions.createSpareFromCut(
                testPlank,
                shapeCutPlank,
              );
              if (spare) {
                newSpares.push(spare);
              }
              placed = true;
            }
          }
        }
      }
    }
  },
};
