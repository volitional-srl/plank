import type { Point } from "./geometry";
import type { Plank } from "./plank";
import type { PlankDimensions } from "../stores/plankStore";
import {
  calculateOptimalRowOffset,
  findSuitableSpare,
  isPlankInPolygon,
  plankCollidesWithExisting,
  plankOverlapsPolygon,
  doPlanksIntersect,
} from "./plank";
import {
  createSpareFromCut,
  fitPlankByShapeCutting,
  tryLinearCut,
  tryMultiLineCut,
} from "./plankCutting";

const MM_TO_PIXELS = 1 / 10;

export interface TessellationResult {
  planks: Plank[];
  spares: Plank[];
}

// Main tessellation algorithm with row-based layout
export const generateTessellation = (
  firstPlank: Plank,
  polygonPoints: Point[],
  dimensions: PlankDimensions,
  plankLog: {
    debug: (message: string, ...args: unknown[]) => void;
    trace: (message: string, ...args: unknown[]) => void;
  },
): TessellationResult => {
  plankLog.debug("=== Starting tessellation procedure ===");

  if (polygonPoints.length < 3) {
    plankLog.debug("Insufficient polygon points, aborting tessellation");
    return { planks: [firstPlank], spares: [] };
  }

  const lengthPx = dimensions.length * MM_TO_PIXELS;
  const widthPx = dimensions.width * MM_TO_PIXELS;
  const gapPx = dimensions.gap * MM_TO_PIXELS;
  const minRowOffsetPx = dimensions.minRowOffset * MM_TO_PIXELS;

  const newPlanks: Plank[] = [firstPlank];
  const newSpares: Plank[] = [];
  let plankId = 1;

  const { minX, maxX, minY, maxY } = calculateBoundingBox(polygonPoints);
  
  const { startX, startY, rotation } = extractPlankPosition(firstPlank);
  const { plankSpacingX, plankSpacingY, rowSpacingX, rowSpacingY } = 
    calculateSpacing(lengthPx, widthPx, gapPx, rotation);

  plankLog.debug("Starting row-based tessellation");
  
  for (let rowIndex = -20; rowIndex <= 20; rowIndex++) {
    const offsetForThisRow = calculateOptimalRowOffset(
      rowIndex,
      minRowOffsetPx,
      lengthPx + gapPx,
      newSpares,
    );

    for (let plankInRow = -20; plankInRow <= 20; plankInRow++) {
      if (rowIndex === 0 && plankInRow === 0) continue;

      const { plankX, plankY } = calculatePlankPosition(
        startX, startY, plankInRow, rowIndex,
        plankSpacingX, plankSpacingY, rowSpacingX, rowSpacingY,
        offsetForThisRow, rotation
      );

      if (isOutsideBounds(plankX, plankY, minX, maxX, minY, maxY, lengthPx, widthPx)) {
        continue;
      }

      const testPlank = createTestPlank(plankId++, plankX, plankY, rotation, dimensions, rowIndex, plankInRow);

      if (!plankOverlapsPolygon(testPlank, polygonPoints)) {
        continue;
      }

      if (plankCollidesWithExisting(testPlank, newPlanks, gapPx)) {
        continue;
      }

      attemptPlankPlacement(
        testPlank,
        polygonPoints,
        newPlanks,
        newSpares,
        gapPx,
        plankLog,
      );
    }
  }

  plankLog.debug("Starting secondary gap-filling pass");
  fillRemainingGaps(newPlanks, newSpares, polygonPoints, dimensions, gapPx, plankLog);

  plankLog.debug(`=== Tessellation complete ===`);
  return { planks: newPlanks, spares: newSpares };
};

// Calculate bounding box of polygon
const calculateBoundingBox = (polygonPoints: Point[]) => ({
  minX: Math.min(...polygonPoints.map(p => p.x)),
  maxX: Math.max(...polygonPoints.map(p => p.x)),
  minY: Math.min(...polygonPoints.map(p => p.y)),
  maxY: Math.max(...polygonPoints.map(p => p.y)),
});

// Extract position and rotation from first plank
const extractPlankPosition = (firstPlank: Plank) => ({
  startX: firstPlank.x,
  startY: firstPlank.y,
  rotation: firstPlank.rotation,
});

// Calculate spacing between planks and rows
const calculateSpacing = (lengthPx: number, widthPx: number, gapPx: number, rotation: number) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    plankSpacingX: (lengthPx + gapPx) * cos,
    plankSpacingY: (lengthPx + gapPx) * sin,
    rowSpacingX: -(widthPx + gapPx) * sin,
    rowSpacingY: (widthPx + gapPx) * cos,
  };
};

// Calculate position for a plank in the grid
const calculatePlankPosition = (
  startX: number, startY: number, plankInRow: number, rowIndex: number,
  plankSpacingX: number, plankSpacingY: number, rowSpacingX: number, rowSpacingY: number,
  offsetForThisRow: number, rotation: number
) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    plankX: startX + plankInRow * plankSpacingX + rowIndex * rowSpacingX + offsetForThisRow * cos,
    plankY: startY + plankInRow * plankSpacingY + rowIndex * rowSpacingY + offsetForThisRow * sin,
  };
};

// Check if plank position is outside bounding box
const isOutsideBounds = (
  plankX: number, plankY: number, minX: number, maxX: number, 
  minY: number, maxY: number, lengthPx: number, widthPx: number
): boolean => {
  return plankX < minX - lengthPx || plankX > maxX + lengthPx ||
         plankY < minY - widthPx || plankY > maxY + widthPx;
};

// Create test plank for position
const createTestPlank = (
  plankId: number, plankX: number, plankY: number, rotation: number, 
  dimensions: PlankDimensions, rowIndex: number, plankInRow: number
): Plank => ({
  id: `row${rowIndex}-plank${plankInRow}-${plankId}`,
  x: plankX,
  y: plankY,
  rotation: rotation,
  length: dimensions.length,
  width: dimensions.width,
});

// Attempt to place a plank using various strategies
const attemptPlankPlacement = (
  testPlank: Plank,
  polygonPoints: Point[],
  newPlanks: Plank[],
  newSpares: Plank[],
  gapPx: number,
  plankLog: { debug: (message: string, ...args: unknown[]) => void; trace: (message: string, ...args: unknown[]) => void },
): boolean => {
  // Try using existing spare first
  const suitableSpare = findSuitableSpare(testPlank, polygonPoints, newSpares);
  if (suitableSpare) {
    return applySparePiece(testPlank, suitableSpare, newPlanks, newSpares, plankLog);
  }

  // Try full plank
  if (isPlankInPolygon(testPlank, polygonPoints)) {
    plankLog.debug(`Full plank ${testPlank.id} fits completely`);
    newPlanks.push(testPlank);
    return true;
  }

  // Try cutting strategies
  return attemptCuttingStrategies(testPlank, polygonPoints, newPlanks, newSpares, gapPx, plankLog);
};

// Use a spare piece
const applySparePiece = (
  testPlank: Plank,
  suitableSpare: Plank,
  newPlanks: Plank[],
  newSpares: Plank[],
  plankLog: { debug: (message: string, ...args: unknown[]) => void },
): boolean => {
  const spareIndex = newSpares.indexOf(suitableSpare);
  if (spareIndex >= 0) {
    plankLog.debug(`Using spare piece (${suitableSpare.length}mm) for plank ${testPlank.id}`);
    newSpares.splice(spareIndex, 1);
    const sparePlank = {
      ...suitableSpare,
      x: testPlank.x,
      y: testPlank.y,
      rotation: testPlank.rotation,
    };
    newPlanks.push(sparePlank);
    return true;
  }
  return false;
};

// Attempt various cutting strategies
const attemptCuttingStrategies = (
  testPlank: Plank,
  polygonPoints: Point[],
  newPlanks: Plank[],
  newSpares: Plank[],
  gapPx: number,
  plankLog: { debug: (message: string, ...args: unknown[]) => void; trace: (message: string, ...args: unknown[]) => void },
): boolean => {
  // Try linear cut
  const linearCutResult = tryLinearCut(testPlank, polygonPoints);
  if (linearCutResult && !plankCollidesWithExisting(linearCutResult.fitted, newPlanks, gapPx)) {
    plankLog.debug(`Linear cut plank ${testPlank.id} placed successfully`);
    newPlanks.push(linearCutResult.fitted);
    newSpares.push(linearCutResult.spare);
    return true;
  }

  // Try multi-line cut
  const multiLineCutResult = tryMultiLineCut(testPlank, polygonPoints);
  if (multiLineCutResult && !hasCollisionWithExisting(testPlank, newPlanks)) {
    plankLog.debug(`Multi-line cut plank ${testPlank.id} placed successfully`);
    newPlanks.push(multiLineCutResult.fitted);
    if (multiLineCutResult.spare) {
      newSpares.push(multiLineCutResult.spare);
    }
    return true;
  }

  // Try shape cutting
  const shapeCutPlank = fitPlankByShapeCutting(testPlank, polygonPoints);
  if (shapeCutPlank && !hasCollisionWithExisting(testPlank, newPlanks)) {
    plankLog.debug(`Shape cut plank ${testPlank.id} placed successfully`);
    newPlanks.push(shapeCutPlank);
    const spare = createSpareFromCut(testPlank, shapeCutPlank);
    if (spare) {
      newSpares.push(spare);
    }
    return true;
  }

  return false;
};

// Check for collision with existing planks
const hasCollisionWithExisting = (testPlank: Plank, newPlanks: Plank[]): boolean => {
  return newPlanks.some(existingPlank => doPlanksIntersect(testPlank, existingPlank));
};

// Fill remaining gaps to ensure 100% polygon coverage
const fillRemainingGaps = (
  newPlanks: Plank[],
  newSpares: Plank[],
  polygonPoints: Point[],
  dimensions: PlankDimensions,
  gapPx: number,
  plankLog: { debug: (message: string, ...args: unknown[]) => void; trace: (message: string, ...args: unknown[]) => void },
) => {
  const lengthPx = dimensions.length * MM_TO_PIXELS;
  const widthPx = dimensions.width * MM_TO_PIXELS;
  const { minX, maxX, minY, maxY } = calculateBoundingBox(polygonPoints);
  const stepSize = Math.min(lengthPx, widthPx) * 0.25;
  let plankId = 10000;

  for (let x = minX; x <= maxX; x += stepSize) {
    for (let y = minY; y <= maxY; y += stepSize) {
      const testPlank: Plank = {
        id: `gap-fill-${plankId++}`,
        x: x,
        y: y,
        rotation: 0, // Use default rotation for gap filling
        length: dimensions.length,
        width: dimensions.width,
      };

      if (!plankOverlapsPolygon(testPlank, polygonPoints) ||
          plankCollidesWithExisting(testPlank, newPlanks, gapPx)) {
        continue;
      }

      attemptPlankPlacement(testPlank, polygonPoints, newPlanks, newSpares, gapPx, plankLog);
    }
  }
};