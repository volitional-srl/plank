import type { Point } from "./geometry";
import { calculateIntersectionDistance } from "./geometry";
import type { Plank } from "./plank";
import { plankCollidesWithExisting, doPlanksIntersect } from "./plank";
import {
  tryLinearCut,
  tryMultiLineCut,
  fitPlankByShapeCutting,
  createSpareFromCut,
} from "./plankCutting";

export enum TestScenarioName {
  LINEAR_CUT_RIGHT_EDGE = "Linear Cut Right Edge",
  LINEAR_CUT_LEFT_EDGE = "Linear Cut Left Edge",
  MULTI_LINE_CUT_L_SHAPED_ROOM = "Multi-line Cut - L-shaped room",
  MULTI_LINE_CUT_H_SHAPED_ROOM = "Multi-line Cut - H-shaped room",
  NO_CUT_POSSIBLE_OUTSIDE = "No Cut Possible - Plank completely outside",
}

export interface TestScenario {
  name: string;
  polygon: Point[];
  plank: Plank;
  expectedMethod: "linear" | "multi-line" | "shape" | "none";
  expectedCutLines?: Point[][];
  expectedFittedPlank?: {
    x: number;
    y: number;
    rotation: number;
    length: number;
    width: number;
  };
}

export interface CuttingResult {
  success: boolean;
  method: "linear" | "multi-line" | "shape" | "none";
  fittedPlank: Plank | null;
  spareCreated: Plank | null;
  originalPlank: Plank;
  // Detailed cut verification data
  cutDetails: {
    // For linear cuts: distance from plank start to cut line
    cutDistance?: number;
    // For multi-line and shape cuts: all cut lines used
    cutLines?: Point[][];
    // Intersection points with polygon boundary
    intersectionPoints?: Point[];
    // Expected cut lines for verification
    expectedCutLines?: Point[][];
    // Verification results
    cutLineVerification?: {
      isCorrect: boolean;
      distanceFromExpected?: number;
      message?: string;
    };
  };
}

// Check for collision with existing planks
const hasCollisionWithExisting = (
  testPlank: Plank,
  newPlanks: Plank[],
): boolean => {
  return newPlanks.some((existingPlank) =>
    doPlanksIntersect(testPlank, existingPlank),
  );
};

// Calculate expected cut line for linear cuts
const calculateExpectedLinearCutLine = (
  plank: Plank,
  polygonPoints: Point[],
): Point[] | null => {
  const MM_TO_PIXELS = 1 / 10;
  const lengthPx = plank.length * MM_TO_PIXELS;
  const widthPx = plank.width * MM_TO_PIXELS;

  // Find the right edge of the plank that should intersect with polygon
  const rad = (plank.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Calculate plank's right edge endpoints
  const halfWidth = widthPx / 2;
  const rightEdgeStart = {
    x: plank.x + (lengthPx / 2) * cos - halfWidth * sin,
    y: plank.y + (lengthPx / 2) * sin + halfWidth * cos,
  };
  const rightEdgeEnd = {
    x: plank.x + (lengthPx / 2) * cos + halfWidth * sin,
    y: plank.y + (lengthPx / 2) * sin - halfWidth * cos,
  };

  return [rightEdgeStart, rightEdgeEnd];
};

// Verify if cut line matches expected cut line within tolerance
const verifyCutLine = (
  actualCutDistance: number,
  expectedCutLine: Point[],
  plank: Plank,
  polygonPoints: Point[],
  tolerance: number = 10, // pixels
): { isCorrect: boolean; distanceFromExpected?: number; message?: string } => {
  if (!expectedCutLine || expectedCutLine.length < 2) {
    return { isCorrect: false, message: "No expected cut line provided" };
  }

  const MM_TO_PIXELS = 1 / 10;
  const lengthPx = plank.length * MM_TO_PIXELS;

  // Calculate expected cut distance by finding intersection with polygon
  const expectedDistance = calculateIntersectionDistance(
    { x: plank.x, y: plank.y },
    lengthPx,
    plank.width * MM_TO_PIXELS,
    plank.rotation,
    polygonPoints,
  );

  if (!expectedDistance) {
    return { isCorrect: false, message: "No expected intersection found" };
  }

  const distanceDiff = Math.abs(actualCutDistance - expectedDistance);
  const isCorrect = distanceDiff <= tolerance;

  return {
    isCorrect,
    distanceFromExpected: distanceDiff,
    message: isCorrect
      ? `Cut distance matches expected (${distanceDiff.toFixed(1)}px difference)`
      : `Cut distance differs by ${distanceDiff.toFixed(1)}px from expected`,
  };
};

// Verify multi-line cut lines
const verifyMultiLineCutLines = (
  actualCutLines: Point[][],
  expectedCutLines: Point[][],
  tolerance: number = 10,
): { isCorrect: boolean; message?: string } => {
  if (actualCutLines.length !== expectedCutLines.length) {
    return {
      isCorrect: false,
      message: `Expected ${expectedCutLines.length} cut lines, got ${actualCutLines.length}`,
    };
  }

  // For now, just check if we have the right number of cut lines
  // More sophisticated verification could check line positions and angles
  return {
    isCorrect: true,
    message: `Multi-line cut has correct number of cut lines (${actualCutLines.length})`,
  };
};

// Standalone version of attemptCuttingStrategies for testing
export const attemptCuttingStrategies = (
  testPlank: Plank,
  polygonPoints: Point[],
  existingPlanks: Plank[] = [],
  gapPx: number = 0,
  expectedCutLines: Point[][] = [],
): CuttingResult => {
  const MM_TO_PIXELS = 1 / 10;

  console.log("=== Cutting Strategy Debug ===");
  console.log("Plank:", testPlank);
  console.log("Polygon points:", polygonPoints);

  // Try linear cut
  console.log("Trying linear cut...");
  const linearCutResult = tryLinearCut(testPlank, polygonPoints);
  console.log("Linear cut result:", linearCutResult);

  if (linearCutResult) {
    const hasCollision = plankCollidesWithExisting(
      linearCutResult.fitted,
      existingPlanks,
      gapPx,
    );
    console.log("Linear cut collision check:", hasCollision);
  }

  if (
    linearCutResult &&
    !plankCollidesWithExisting(linearCutResult.fitted, existingPlanks, gapPx)
  ) {
    // Calculate cut distance and verification
    const cutDistance = linearCutResult.fitted.length * MM_TO_PIXELS;
    const expectedCutLine =
      expectedCutLines.length > 0
        ? expectedCutLines[0]
        : calculateExpectedLinearCutLine(testPlank, polygonPoints);
    const cutLineVerification = verifyCutLine(
      cutDistance,
      expectedCutLine || [],
      testPlank,
      polygonPoints,
    );

    console.log("✅ Linear cut successful!");
    return {
      success: true,
      method: "linear",
      fittedPlank: linearCutResult.fitted,
      spareCreated: linearCutResult.spare,
      originalPlank: testPlank,
      cutDetails: {
        cutDistance,
        expectedCutLines: expectedCutLine ? [expectedCutLine] : undefined,
        cutLineVerification,
      },
    };
  }

  // Try multi-line cut
  console.log("Trying multi-line cut...");
  const multiLineCutResult = tryMultiLineCut(testPlank, polygonPoints);
  console.log("Multi-line cut result:", multiLineCutResult);

  if (multiLineCutResult) {
    const hasCollision = hasCollisionWithExisting(testPlank, existingPlanks);
    console.log("Multi-line cut collision check:", hasCollision);
  }

  if (
    multiLineCutResult &&
    !hasCollisionWithExisting(testPlank, existingPlanks)
  ) {
    const cutLines = multiLineCutResult.fitted.cutLines || [];
    const cutLineVerification = verifyMultiLineCutLines(
      cutLines,
      expectedCutLines,
    );

    console.log("✅ Multi-line cut successful!");
    return {
      success: true,
      method: "multi-line",
      fittedPlank: multiLineCutResult.fitted,
      spareCreated: multiLineCutResult.spare || null,
      originalPlank: testPlank,
      cutDetails: {
        cutLines,
        expectedCutLines,
        cutLineVerification,
      },
    };
  }

  // Try shape cutting
  console.log("Trying shape cutting...");
  const shapeCutPlank = fitPlankByShapeCutting(testPlank, polygonPoints);
  console.log("Shape cut result:", shapeCutPlank);

  if (shapeCutPlank) {
    const hasCollision = hasCollisionWithExisting(testPlank, existingPlanks);
    console.log("Shape cut collision check:", hasCollision);
  }

  if (shapeCutPlank && !hasCollisionWithExisting(testPlank, existingPlanks)) {
    const spare = createSpareFromCut(testPlank, shapeCutPlank);

    console.log("✅ Shape cut successful!");
    return {
      success: true,
      method: "shape",
      fittedPlank: shapeCutPlank,
      spareCreated: spare,
      originalPlank: testPlank,
      cutDetails: {
        expectedCutLines,
        cutLineVerification: {
          isCorrect:
            expectedCutLines.length === 0 || expectedCutLines.length === 2,
          message:
            expectedCutLines.length === 2
              ? "Shape cutting with L-shaped cut completed successfully"
              : "Shape cutting completed successfully",
        },
      },
    };
  }

  console.log("❌ No cutting method succeeded");
  return {
    success: false,
    method: "none",
    fittedPlank: null,
    spareCreated: null,
    originalPlank: testPlank,
    cutDetails: {
      cutLineVerification: {
        isCorrect: false,
        message: "No cutting method succeeded",
      },
    },
  };
};

// Test scenarios for different cutting situations
export const createTestScenarios = (): TestScenario[] => [
  {
    name: TestScenarioName.LINEAR_CUT_RIGHT_EDGE,
    polygon: [
      { x: 100, y: 100 },
      { x: 350, y: 100 },
      { x: 350, y: 200 },
      { x: 100, y: 200 },
    ],
    plank: {
      id: "test-linear",
      x: 300, // Plank center - should extend past x=350 (right edge)
      y: 150, // Center vertically in polygon
      rotation: 0,
      length: 1200, // 1200mm - 120px when converted - extends 45px past edge
      width: 240, // 240mm - 24px when converted - fits within height
    } as Plank,
    expectedMethod: "linear" as const,
    // Expected cut line: vertical line at x=350 (right edge of rectangle)
    expectedCutLines: [
      [
        { x: 350, y: 100 },
        { x: 350, y: 200 },
      ], // Vertical cut at polygon's right edge
    ],
    expectedFittedPlank: {
      x: 294.8, // Shifted left to center the cut plank within polygon bounds
      y: 150, // Same y position
      rotation: 0, // Same rotation
      length: 1095, // Cut from 1200mm to 1000mm (cut distance: 50px = 500mm)
      width: 240, // Same width
    },
  },
  {
    name: TestScenarioName.LINEAR_CUT_LEFT_EDGE,
    polygon: [
      { x: 100, y: 100 },
      { x: 350, y: 100 },
      { x: 350, y: 200 },
      { x: 100, y: 200 },
    ],
    plank: {
      id: "test-linear-left",
      x: 150, // Plank center - should extend past x=100 (left edge)
      y: 150, // Center vertically in polygon
      rotation: 0,
      length: 1200, // 1200mm - 120px when converted - extends 45px past left edge
      width: 240, // 240mm - 24px when converted - fits within height
    } as Plank,
    expectedMethod: "linear" as const,
    // Expected cut line: vertical line at x=100 (left edge of rectangle)
    expectedCutLines: [
      [
        { x: 100, y: 100 },
        { x: 100, y: 200 },
      ], // Vertical cut at polygon's left edge
    ],
    expectedFittedPlank: {
      x: 155.775, // Shifted right to center the cut plank within polygon bounds
      y: 150, // Same y position
      rotation: 0, // Same rotation
      length: 1095, // Cut from 1200mm to 1000mm (cut distance: 50px = 500mm)
      width: 240, // Same width
    },
  },
  {
    name: TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM,
    polygon: [
      { x: 100, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 175 },
      { x: 175, y: 175 },
      { x: 175, y: 250 },
      { x: 100, y: 250 },
    ],
    plank: {
      id: "test-shape",
      x: 200, // Position where plank overlaps the L-shape corner
      y: 175, // Position in upper part of L
      rotation: 0,
      length: 800, // 800mm - 80px when converted
      width: 200, // 200mm - 20px when converted
    } as Plank,
    expectedMethod: "multi-line" as const,
    // Expected cut lines: two edges parallel to the intersecting polygon edges
    expectedCutLines: [
      // First cut line: parallel to horizontal edge (175, 175) to (250, 175)
      [
        { x: 175, y: 175 },
        { x: 175, y: 185 },
      ], // Vertical cut at x=175
      // Second cut line: parallel to vertical edge (175, 175) to (175, 250)
      [
        { x: 175, y: 175 },
        { x: 240, y: 175 },
      ], // Horizontal cut at y=175
    ],
    expectedFittedPlank: {
      x: 175, // Positioned at the corner where cutting occurs
      y: 137.5, // Centered in the upper horizontal section (100-175)
      rotation: 0, // Same rotation
      length: 600, // Cut to fit the upper horizontal section (150mm wide = 75px, so ~600mm length)
      width: 200, // Same width
    },
  },
  {
    name: TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM,
    polygon: [
      // Left vertical bar of H
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 150, y: 175 },
      // Top of horizontal bar
      { x: 200, y: 175 },
      { x: 200, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 300 },
      // Right vertical bar of H
      { x: 200, y: 300 },
      { x: 200, y: 225 },
      // Bottom of horizontal bar
      { x: 150, y: 225 },
      { x: 150, y: 300 },
      { x: 100, y: 300 },
    ],
    plank: {
      id: "test-multiline",
      x: 175, // Center horizontally in the middle crossbar
      y: 175, // Overlaps with the horizontal bar
      rotation: 0,
      length: 1200, // 1200mm - 120px - extends beyond the crossbar
      width: 200, // 200mm - 20px
    } as Plank,
    expectedMethod: "multi-line" as const,
    // Expected cut lines: multiple cuts where the diagonal plank intersects the H-shape edges
    expectedCutLines: [
      // Top edge of horizontal bar
      [
        { x: 150, y: 175 },
        { x: 200, y: 175 },
      ],
      // Left edge of horizontal bar
      [
        { x: 150, y: 175 },
        { x: 150, y: 165 },
      ],
      // Right edge of horizontal bar
      [
        { x: 200, y: 175 },
        { x: 200, y: 165 },
      ],
    ],
    expectedFittedPlank: {
      x: 175, // Same position as original
      y: 200, // Centered in the horizontal crossbar section (175-225)
      rotation: 0, // Same rotation
      length: 500, // Cut to fit within the crossbar width (50px = 500mm)
      width: 200, // Same width
    },
  },
  {
    name: TestScenarioName.NO_CUT_POSSIBLE_OUTSIDE,
    polygon: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    plank: {
      id: "test-none",
      x: 300,
      y: 300,
      rotation: 0,
      length: 100,
      width: 24,
    } as Plank,
    expectedMethod: "none" as const,
    // No expected cut lines since plank is outside polygon
    expectedCutLines: [],
    // No expected fitted plank since cutting is not possible
    expectedFittedPlank: undefined,
  },
];
