import { atom, computed } from "nanostores";
import {
  Point,
  pixelsToMm,
  clipPolygonByPolygon,
  calculatePolygonArea,
  isPointInRectangle,
  isPointInPolygon,
  isPointOnPolygonBoundary,
  lineIntersection,
} from "../lib/geometry";
import {
  doPlanksIntersect,
  getPlankCorners,
  isPlankInPolygon,
  Plank,
} from "@/lib/plank";

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

// Debug logging configuration
interface PlankLoggingConfig {
  enabled: boolean;
  level: "debug" | "trace";
}

const $plankLogging = atom<PlankLoggingConfig>({
  enabled: false,
  level: "debug",
});

const plankLog = {
  debug: (message: string, ...args: unknown[]) => {
    const config = $plankLogging.get();
    if (config.enabled) {
      console.debug(`[PLANK DEBUG] ${message}`, ...args);
    }
  },
  trace: (message: string, ...args: unknown[]) => {
    const config = $plankLogging.get();
    if (config.enabled && config.level === "trace") {
      console.debug(`[PLANK TRACE] ${message}`, ...args);
    }
  },
};

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
    plankLog.debug(`Debug logging ${enabled ? "enabled" : "disabled"}`);
  },

  setLogLevel: (level: "debug" | "trace") => {
    $plankLogging.set({ ...$plankLogging.get(), level });
    plankLog.debug(`Log level set to ${level}`);
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

  // Try to fit a plank by cutting it to an arbitrary shape
  fitPlankByShapeCutting: (
    plank: Plank,
    polygonPoints: Point[],
  ): Plank | null => {
    plankLog.trace(`Attempting shape cutting for plank ${plank.id}`);
    // Get the plank's rectangle corners
    const plankCorners = getPlankCorners(plank);

    // Check if any part of the plank is actually inside the polygon
    const insideCorners = plankCorners.filter((corner) =>
      isPointInPolygon(corner, polygonPoints),
    );

    // Don't reject immediately - even if no corners are inside,
    // the plank could still intersect and create a valid shape-cut piece

    // Clip the plank rectangle against the room polygon
    const clippedShape = clipPolygonByPolygon(plankCorners, polygonPoints);

    if (clippedShape.length < 3) {
      plankLog.trace(
        `Shape cutting: Clipped shape insufficient for plank ${plank.id} (${clippedShape.length} points)`,
      );
      return null; // Not enough area
    }

    const clippedArea = calculatePolygonArea(clippedShape);
    const originalArea =
      plank.length * plank.width * (MM_TO_PIXELS * MM_TO_PIXELS);
    const areaRatio = clippedArea / originalArea;

    // Calculate polygon area to determine adaptive thresholds
    const polygonArea = calculatePolygonArea(polygonPoints);
    const plankToPolygonRatio = originalArea / polygonArea;

    // Adaptive thresholds: smaller minimum area when plank is much larger than room
    const minAreaRatio = plankToPolygonRatio > 0.5 ? 0.005 : 0.02; // 0.5% for large planks, 2% for smaller ones
    const minAbsoluteArea = plankToPolygonRatio > 0.5 ? 10 : 50; // 10px² for large planks, 50px² for smaller ones

    if (
      clippedArea < originalArea * minAreaRatio ||
      clippedArea < minAbsoluteArea
    ) {
      plankLog.trace(
        `Shape cutting: Area too small for plank ${plank.id} (${clippedArea.toFixed(1)}px² vs min ${minAbsoluteArea}px²)`,
      );
      return null;
    }

    // Verify all clipped shape points are actually inside the polygon
    const allPointsInside = clippedShape.every((point) =>
      isPointInPolygon(point, polygonPoints),
    );

    if (!allPointsInside) {
      plankLog.trace(
        `Shape cutting: Cut shape extends outside polygon for plank ${plank.id}`,
      );
      return null; // Shape extends outside polygon
    }

    plankLog.trace(
      `Shape cutting: Valid cut shape created for plank ${plank.id} (${(areaRatio * 100).toFixed(1)}% of original)`,
    );

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
      calculatePolygonArea(fittedPlank.shape) * pixelsToMm(1) ** 2;
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
    plankLog.trace(`Attempting multi-line cut for plank ${plank.id}`);
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    const plankCorners = getPlankCorners(plank);

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
      plankLog.trace(
        `Multi-line cut: Insufficient intersections (${intersections.length}) for plank ${plank.id}`,
      );
      return null; // Need at least 2 intersections for a meaningful cut
    }

    plankLog.trace(
      `Multi-line cut: Found ${intersections.length} intersections for plank ${plank.id}`,
    );

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
      plankLog.trace(
        `Multi-line cut: No valid cut lines found for plank ${plank.id}`,
      );
      return null; // No valid cut lines found
    }

    plankLog.trace(
      `Multi-line cut: Generated ${cutLines.length} cut lines for plank ${plank.id}`,
    );

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
    const cutArea = calculatePolygonArea(cutShape);
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

    return { fitted: fittedPlank, spare: spare || undefined };
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
    const plankCorners = getPlankCorners(plank);

    // Start with corners that are inside the polygon
    const insideCorners = plankCorners.filter((corner) =>
      isPointInPolygon(corner, polygonPoints),
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
      return isPointOnPolygonBoundary(int.point, polygonPoints);
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
      length: pixelsToMm(spareLength),
      width: pixelsToMm(spareWidth),
      isSpare: true,
      originalLength: originalPlank.originalLength || originalPlank.length,
    };
  },

  // Try to perform a clean linear cut along plank length (enhanced for single cuts)
  tryLinearCut: (
    plank: Plank,
    polygonPoints: Point[],
  ): { fitted: Plank; spare?: Plank } | null => {
    plankLog.trace(`Attempting linear cut for plank ${plank.id}`);
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
    const corners = getPlankCorners(plank);

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
        const intersection = lineIntersection(
          { x: edge.startX, y: edge.startY },
          { x: edge.endX, y: edge.endY },
          p1,
          p2,
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
      plankLog.trace(`Linear cut: No intersection found for plank ${plank.id}`);
      return null; // No clean cut possible
    }

    if (minIntersectionDistance >= lengthPx * 0.95) {
      plankLog.trace(
        `Linear cut: Cut would be too small (${((minIntersectionDistance / lengthPx) * 100).toFixed(1)}%)`,
      );
      return null; // Cut would be too small
    }

    // Check if this is truly an orthogonal cut by seeing if both edges hit at similar distances
    const cutLengthMm = minIntersectionDistance * pixelsToMm(1);

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

    if (!isPlankInPolygon(testCutPlank, polygonPoints)) {
      plankLog.trace(
        `Linear cut: Test cut plank doesn't fit cleanly in polygon`,
      );
      return null; // Cut plank doesn't fit cleanly
    }

    // Create the cut plank and spare
    const { fitted, spare } = plankActions.cutPlank(plank, cutLengthMm);
    fitted.x = testCutPlank.x;
    fitted.y = testCutPlank.y;

    plankLog.trace(
      `Linear cut successful: fitted ${fitted.length}mm, spare ${spare.length}mm`,
    );
    return { fitted, spare };
  },

  // Calculate the shape of a gap that needs to be filled
  calculateGapShape: (plank: Plank, polygonPoints: Point[]): Point[] | null => {
    // This is a simplified version - in reality, gap shapes are complex
    // For now, we'll represent gaps as the intersection of the plank area that's outside the room
    const plankCorners = getPlankCorners(plank);

    // Find which corners are outside the polygon
    const outsideCorners = plankCorners.filter(
      (corner) => !isPointInPolygon(corner, polygonPoints),
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

        const intersection = lineIntersection(
          { x: rayStartX, y: rayStartY },
          {
            x: rayStartX + lengthPx * lengthDirX,
            y: rayStartY + lengthPx * lengthDirY,
          },
          p1,
          p2,
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
  lineIntersection,

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
    plankLog.debug("=== Starting tessellation procedure ===");
    plankLog.debug("First plank:", firstPlank);
    plankLog.debug("Polygon points:", polygonPoints.length);

    if (polygonPoints.length < 3) {
      plankLog.debug("Insufficient polygon points, aborting tessellation");
      return;
    }

    const dimensions = $plankDimensions.get();
    const lengthPx = dimensions.length * MM_TO_PIXELS;
    const widthPx = dimensions.width * MM_TO_PIXELS;
    const gapPx = dimensions.gap * MM_TO_PIXELS;
    const minRowOffsetPx = dimensions.minRowOffset * MM_TO_PIXELS;

    plankLog.debug("Tessellation configuration:", {
      plankLength: dimensions.length,
      plankWidth: dimensions.width,
      gap: dimensions.gap,
      minRowOffset: dimensions.minRowOffset,
    });

    const newPlanks: Plank[] = [firstPlank];
    const newSpares: Plank[] = [];
    let plankId = 1;

    // Calculate bounding box of polygon
    const minX = Math.min(...polygonPoints.map((p) => p.x));
    const maxX = Math.max(...polygonPoints.map((p) => p.x));
    const minY = Math.min(...polygonPoints.map((p) => p.y));
    const maxY = Math.max(...polygonPoints.map((p) => p.y));

    plankLog.debug("Polygon bounding box:", { minX, maxX, minY, maxY });

    const startX = firstPlank.x;
    const startY = firstPlank.y;
    const rotation = firstPlank.rotation;

    plankLog.debug("Starting position:", { startX, startY, rotation });

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Calculate spacing between planks (including gaps)
    const plankSpacingX = (lengthPx + gapPx) * cos;
    const plankSpacingY = (lengthPx + gapPx) * sin;
    const rowSpacingX = -(widthPx + gapPx) * sin;
    const rowSpacingY = (widthPx + gapPx) * cos;

    // Row-based tessellation (like real flooring)
    plankLog.debug("Starting row-based tessellation");
    for (let rowIndex = -20; rowIndex <= 20; rowIndex++) {
      // Calculate optimal row offset (≥ minimum) to maximize spare reuse
      const offsetForThisRow = plankActions.calculateOptimalRowOffset(
        rowIndex,
        minRowOffsetPx,
        lengthPx + gapPx,
        newSpares,
      );

      plankLog.debug(
        `Processing row ${rowIndex}, offset: ${offsetForThisRow}px`,
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

        plankLog.trace(
          `Testing plank position: ${testPlank.id} at (${plankX.toFixed(1)}, ${plankY.toFixed(1)})`,
        );

        // Check if plank overlaps with polygon
        if (!plankActions.plankOverlapsPolygon(testPlank, polygonPoints)) {
          plankLog.trace(
            `Plank ${testPlank.id} does not overlap polygon, skipping`,
          );
          continue;
        }

        // Check for collisions with existing planks (with gap tolerance)
        if (
          plankActions.plankCollidesWithExisting(testPlank, newPlanks, gapPx)
        ) {
          plankLog.trace(`Plank ${testPlank.id} collides with existing planks`);
          continue;
        }

        // Try to place the plank - check for spare reuse first
        let plankPlaced = false;

        plankLog.debug(`Attempting to place plank: ${testPlank.id}`);

        // First, try to use an existing spare piece if available
        const suitableSpare = plankActions.findSuitableSpare(
          testPlank,
          polygonPoints,
          newSpares,
        );
        if (suitableSpare) {
          const spareIndex = newSpares.indexOf(suitableSpare);
          if (spareIndex >= 0) {
            plankLog.debug(
              `Using spare piece (${suitableSpare.length}mm) for plank ${testPlank.id}`,
            );
            newSpares.splice(spareIndex, 1);
            const sparePlank = {
              ...suitableSpare,
              x: testPlank.x,
              y: testPlank.y,
              rotation: testPlank.rotation,
            };
            newPlanks.push(sparePlank);
            plankPlaced = true;
          } else {
            plankLog.trace(`No suitable spare found for plank ${testPlank.id}`);
          }
        }

        // If no suitable spare, try placing a full plank
        if (!plankPlaced) {
          if (isPlankInPolygon(testPlank, polygonPoints)) {
            plankLog.debug(`Full plank ${testPlank.id} fits completely`);
            newPlanks.push(testPlank);
            plankPlaced = true;
          } else {
            plankLog.trace(
              `Full plank ${testPlank.id} does not fit in polygon, will try cutting`,
            );
          }
        }

        // If full plank doesn't fit, try cutting (multiple approaches)
        if (!plankPlaced) {
          // Try cutting approaches in order of preference:
          // 1. Linear cut (single straight line)
          // 2. Multi-line cut (multiple segments for complex shapes)
          // 3. Arbitrary shape cutting (fallback for any geometry)

          plankLog.debug(`Trying cutting methods for plank ${testPlank.id}`);

          const linearCutResult = plankActions.tryLinearCut(
            testPlank,
            polygonPoints,
          );
          if (linearCutResult) {
            plankLog.trace(
              `Linear cut successful: ${linearCutResult.fitted.length}mm fitted, spare: ${linearCutResult.spare?.length || 0}mm`,
            );
            // Check if linear cut plank fits with gaps
            if (
              !plankActions.plankCollidesWithExisting(
                linearCutResult.fitted,
                newPlanks,
                gapPx,
              )
            ) {
              plankLog.debug(
                `Linear cut plank ${testPlank.id} placed successfully`,
              );
              newPlanks.push(linearCutResult.fitted);
              if (linearCutResult.spare) {
                newSpares.push(linearCutResult.spare);
              }
              plankPlaced = true;
            } else {
              plankLog.trace(
                `Linear cut plank ${testPlank.id} collision detected, trying next method`,
              );
            }
          } else {
            plankLog.trace(`Linear cut failed for plank ${testPlank.id}`);
          }

          // If linear cut failed, try multi-line cutting
          if (!plankPlaced) {
            const multiLineCutResult = plankActions.tryMultiLineCut(
              testPlank,
              polygonPoints,
            );
            if (multiLineCutResult) {
              plankLog.trace(
                `Multi-line cut successful for plank ${testPlank.id}, spare: ${multiLineCutResult.spare?.length || 0}mm`,
              );
              // Check collision for multi-line cut planks
              const multiCutHasCollision = newPlanks.some((existingPlank) =>
                doPlanksIntersect(testPlank, existingPlank),
              );

              if (!multiCutHasCollision) {
                plankLog.debug(
                  `Multi-line cut plank ${testPlank.id} placed successfully`,
                );
                newPlanks.push(multiLineCutResult.fitted);
                if (multiLineCutResult.spare) {
                  newSpares.push(multiLineCutResult.spare);
                }
                plankPlaced = true;
              } else {
                plankLog.trace(
                  `Multi-line cut plank ${testPlank.id} collision detected`,
                );
              }
            } else {
              plankLog.trace(`Multi-line cut failed for plank ${testPlank.id}`);
            }
          }

          // If multi-line cut failed, try arbitrary shape cutting as fallback
          if (!plankPlaced) {
            const shapeCutPlank = plankActions.fitPlankByShapeCutting(
              testPlank,
              polygonPoints,
            );
            if (shapeCutPlank) {
              plankLog.trace(
                `Shape cutting successful for plank ${testPlank.id}`,
              );
              // Check collision for shape-cut planks
              const shapeCutHasCollision = newPlanks.some((existingPlank) =>
                doPlanksIntersect(testPlank, existingPlank),
              );

              if (!shapeCutHasCollision) {
                plankLog.debug(
                  `Shape cut plank ${testPlank.id} placed successfully`,
                );
                newPlanks.push(shapeCutPlank);

                // Create spare from the unused portion
                const spare = plankActions.createSpareFromCut(
                  testPlank,
                  shapeCutPlank,
                );
                if (spare) {
                  plankLog.trace(
                    `Created spare (${spare.length}mm) from shape cut`,
                  );
                  newSpares.push(spare);
                }
                plankPlaced = true;
              } else {
                plankLog.trace(
                  `Shape cut plank ${testPlank.id} collision detected`,
                );
              }
            } else {
              plankLog.trace(
                `Shape cutting failed for plank ${testPlank.id} - no viable cut found`,
              );
            }
          }
        }

        if (!plankPlaced) {
          plankLog.trace(
            `All placement methods failed for plank ${testPlank.id}`,
          );
        }
      }
    }

    plankLog.debug(
      `Primary tessellation complete. Placed ${newPlanks.length} planks, created ${newSpares.length} spares`,
    );

    // Secondary pass: Fill remaining gaps to ensure 100% coverage
    plankLog.debug("Starting secondary gap-filling pass");
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

    plankLog.debug(`=== Tessellation complete ===`);
    plankLog.debug(
      `Final result: ${newPlanks.length} planks placed, ${newSpares.length} spares available`,
    );

    $planks.set(newPlanks);
    $spares.set(newSpares);
    $gaps.set([]);
  },

  // Helper: Check if plank overlaps with polygon
  plankOverlapsPolygon: (plank: Plank, polygonPoints: Point[]): boolean => {
    const plankCorners = getPlankCorners(plank);

    // Check if any plank corner is inside polygon
    const hasPointInside =
      plankCorners.some((corner) => isPointInPolygon(corner, polygonPoints)) ||
      isPointInPolygon({ x: plank.x, y: plank.y }, polygonPoints);

    // Check if any polygon vertex is inside plank
    const polygonInPlank = polygonPoints.some((point) =>
      isPointInRectangle(point, plankCorners),
    );

    return hasPointInside || polygonInPlank;
  },

  /* Helper: Check if plank collides with existing planks (considering gaps) */
  plankCollidesWithExisting: (
    plank: Plank,
    existingPlanks: Plank[],
    gapPx: number,
  ): boolean => {
    return existingPlanks.some((existing) => {
      // Create expanded rectangles that include the gap
      const expandedExisting: Plank = {
        ...existing,
        length: existing.length + pixelsToMm(gapPx),
        width: existing.width + pixelsToMm(gapPx),
      };

      return doPlanksIntersect(plank, expandedExisting);
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
      if (isPlankInPolygon(spareTestPlank, polygonPoints)) {
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
        if (!placed && isPlankInPolygon(testPlank, polygonPoints)) {
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
          } else {
            console.log(
              `fillRemainingGaps: Linear cut not placed`,
              linearCutResult?.fitted,
            );
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
              doPlanksIntersect(testPlank, existingPlank),
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
              doPlanksIntersect(testPlank, existingPlank),
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
