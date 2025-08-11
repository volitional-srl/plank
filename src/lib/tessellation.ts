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
import { createLogger } from "./logger";

const MM_TO_PIXELS = 1 / 10;
const logger = createLogger("tessellation");

export interface TessellationResult {
  planks: Plank[];
  spares: Plank[];
}

// Main tessellation algorithm with row-based layout
export const generateTessellation = (
  firstPlank: Plank,
  polygonPoints: Point[],
  dimensions: PlankDimensions,
): TessellationResult => {
  logger.debug("=== Starting tessellation procedure ===");
  logger.trace("Input parameters:", {
    firstPlank,
    dimensions,
    polygonPoints: polygonPoints.length + " points",
  });

  if (polygonPoints.length < 3) {
    logger.debug("Insufficient polygon points, aborting tessellation");
    return { planks: [firstPlank], spares: [] };
  }

  const lengthPx = dimensions.length * MM_TO_PIXELS;
  const widthPx = dimensions.width * MM_TO_PIXELS;
  const gapPx = dimensions.gap * MM_TO_PIXELS;
  const minRowOffsetPx = dimensions.minRowOffset * MM_TO_PIXELS;

  logger.trace("Converted dimensions to pixels:", {
    lengthPx,
    widthPx,
    gapPx,
    minRowOffsetPx,
  });

  const newPlanks: Plank[] = [firstPlank];
  const newSpares: Plank[] = [];
  let plankId = 1;

  const { minX, maxX, minY, maxY } = calculateBoundingBox(polygonPoints);
  logger.trace("Polygon bounding box:", { minX, maxX, minY, maxY });

  const { startX, startY, rotation } = extractPlankPosition(firstPlank);
  const { plankSpacingX, plankSpacingY, rowSpacingX, rowSpacingY } =
    calculateSpacing(lengthPx, widthPx, gapPx, rotation);

  logger.trace("First plank position:", { startX, startY, rotation });
  logger.trace("Calculated spacing:", {
    plankSpacingX,
    plankSpacingY,
    rowSpacingX,
    rowSpacingY,
  });

  logger.debug("Starting row-based tessellation");

  // Calculate reasonable search bounds based on polygon size and plank dimensions
  const polygonWidth = maxX - minX;
  const polygonHeight = maxY - minY;
  const maxRowsNeeded = Math.ceil(polygonHeight / widthPx) + 2; // Add small buffer
  const maxPlanksNeeded = Math.ceil(polygonWidth / lengthPx) + 2; // Add small buffer

  logger.trace(
    `Search bounds: ${maxRowsNeeded} rows, ${maxPlanksNeeded} planks per row`,
  );

  for (let rowIndex = -maxRowsNeeded; rowIndex <= maxRowsNeeded; rowIndex++) {
    const offsetForThisRow = calculateOptimalRowOffset(
      rowIndex,
      minRowOffsetPx,
      lengthPx + gapPx,
      newSpares,
    );

    logger.trace(
      `Processing row ${rowIndex} with offset ${offsetForThisRow.toFixed(2)}px`,
    );

    for (
      let plankInRow = -maxPlanksNeeded;
      plankInRow <= maxPlanksNeeded;
      plankInRow++
    ) {
      if (rowIndex === 0 && plankInRow === 0) continue;

      const { plankX, plankY } = calculatePlankPosition(
        startX,
        startY,
        plankInRow,
        rowIndex,
        plankSpacingX,
        plankSpacingY,
        rowSpacingX,
        rowSpacingY,
        offsetForThisRow,
        rotation,
      );

      if (
        isOutsideBounds(
          plankX,
          plankY,
          minX,
          maxX,
          minY,
          maxY,
          lengthPx,
          widthPx,
        )
      ) {
        logger.trace(
          `Plank [${rowIndex},${plankInRow}] at (${plankX.toFixed(1)}, ${plankY.toFixed(1)}) is outside bounds`,
        );
        continue;
      }

      const testPlank = createTestPlank(
        plankId++,
        plankX,
        plankY,
        rotation,
        dimensions,
        rowIndex,
        plankInRow,
      );

      logger.trace(
        `Testing plank ${testPlank.id} at (${plankX.toFixed(1)}, ${plankY.toFixed(1)})`,
      );

      if (!plankOverlapsPolygon(testPlank, polygonPoints)) {
        logger.trace(
          `Plank ${testPlank.id} does not overlap polygon - skipping`,
        );
        continue;
      }

      if (plankCollidesWithExisting(testPlank, newPlanks, gapPx)) {
        logger.trace(
          `🔴 Plank ${testPlank.id} collides with existing planks - skipping`,
          testPlank,
          newPlanks.slice(0),
        );
        continue;
      }

      logger.trace(`Attempting placement for plank ${testPlank.id}`);
      const placed = attemptPlankPlacement(
        testPlank,
        polygonPoints,
        newPlanks,
        newSpares,
        gapPx,
      );

      if (placed) {
        logger.trace(`✅ Successfully placed plank ${testPlank.id}`);
      } else {
        logger.trace(`🔴 Failed to place plank ${testPlank.id}`);
      }
    }
  }

  logger.debug("Starting secondary gap-filling pass");
  // fillRemainingGaps(newPlanks, newSpares, polygonPoints, dimensions, gapPx);

  logger.debug(`=== Tessellation complete ===`);
  logger.debug(
    `Final results: ${newPlanks.length} planks placed, ${newSpares.length} spares created`,
  );
  logger.trace(
    "Final planks:",
    newPlanks.map((p) => ({
      id: p.id,
      x: p.x.toFixed(1),
      y: p.y.toFixed(1),
      type: p.type,
    })),
  );
  logger.trace(
    "Final spares:",
    newSpares.map((s) => ({ id: s.id, length: s.length })),
  );

  return { planks: newPlanks, spares: newSpares };
};

// Calculate bounding box of polygon
const calculateBoundingBox = (polygonPoints: Point[]) => ({
  minX: Math.min(...polygonPoints.map((p) => p.x)),
  maxX: Math.max(...polygonPoints.map((p) => p.x)),
  minY: Math.min(...polygonPoints.map((p) => p.y)),
  maxY: Math.max(...polygonPoints.map((p) => p.y)),
});

// Extract position and rotation from first plank
const extractPlankPosition = (firstPlank: Plank) => ({
  startX: firstPlank.x,
  startY: firstPlank.y,
  rotation: firstPlank.rotation,
});

// Calculate spacing between planks and rows
const calculateSpacing = (
  lengthPx: number,
  widthPx: number,
  gapPx: number,
  rotation: number,
) => {
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
  startX: number,
  startY: number,
  plankInRow: number,
  rowIndex: number,
  plankSpacingX: number,
  plankSpacingY: number,
  rowSpacingX: number,
  rowSpacingY: number,
  offsetForThisRow: number,
  rotation: number,
) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    plankX:
      startX +
      plankInRow * plankSpacingX +
      rowIndex * rowSpacingX +
      offsetForThisRow * cos,
    plankY:
      startY +
      plankInRow * plankSpacingY +
      rowIndex * rowSpacingY +
      offsetForThisRow * sin,
  };
};

// Check if plank position is outside bounding box
const isOutsideBounds = (
  plankX: number,
  plankY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  lengthPx: number,
  widthPx: number,
): boolean => {
  return (
    plankX < minX - lengthPx ||
    plankX > maxX + lengthPx ||
    plankY < minY - widthPx ||
    plankY > maxY + widthPx
  );
};

// Create test plank for position
const createTestPlank = (
  plankId: number,
  plankX: number,
  plankY: number,
  rotation: number,
  dimensions: PlankDimensions,
  rowIndex: number,
  plankInRow: number,
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
): boolean => {
  logger.trace(
    `  Attempting placement for ${testPlank.id} - trying spare pieces first`,
  );

  // Try using existing spare first
  const suitableSpare = findSuitableSpare(testPlank, polygonPoints, newSpares);
  if (suitableSpare) {
    logger.trace(
      `  Found suitable spare piece for ${testPlank.id}: ${suitableSpare.length}mm`,
    );
    return applySparePiece(testPlank, suitableSpare, newPlanks, newSpares);
  }

  logger.trace(
    `  No suitable spare found for ${testPlank.id}, trying full plank`,
  );

  // Try full plank
  if (isPlankInPolygon(testPlank, polygonPoints)) {
    logger.debug(`  ✅ Full plank ${testPlank.id} fits completely - placing`);
    newPlanks.push(testPlank);
    return true;
  }

  logger.trace(
    `  Full plank ${testPlank.id} doesn't fit - trying cutting strategies`,
  );

  // Try cutting strategies
  const cuttingResult = attemptCuttingStrategies(
    testPlank,
    polygonPoints,
    newPlanks,
    newSpares,
    gapPx,
  );

  if (cuttingResult) {
    logger.trace(`  ✅ Cutting strategy succeeded for ${testPlank.id}`);
  } else {
    logger.trace(`  ❌ All cutting strategies failed for ${testPlank.id}`);
  }

  return cuttingResult;
};

// Use a spare piece
const applySparePiece = (
  testPlank: Plank,
  suitableSpare: Plank,
  newPlanks: Plank[],
  newSpares: Plank[],
): boolean => {
  const spareIndex = newSpares.indexOf(suitableSpare);
  if (spareIndex >= 0) {
    logger.debug(
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
): boolean => {
  // Try linear cut
  const linearCutResult = tryLinearCut(testPlank, polygonPoints);
  if (
    linearCutResult &&
    !plankCollidesWithExisting(linearCutResult.fitted, newPlanks, gapPx)
  ) {
    logger.debug(`Linear cut plank ${testPlank.id} placed successfully`);
    newPlanks.push(linearCutResult.fitted);
    newSpares.push(linearCutResult.spare);
    return true;
  }

  // Try multi-line cut
  const multiLineCutResult = tryMultiLineCut(testPlank, polygonPoints);
  if (multiLineCutResult && !hasCollisionWithExisting(testPlank, newPlanks)) {
    logger.debug(`Multi-line cut plank ${testPlank.id} placed successfully`);
    newPlanks.push(multiLineCutResult.fitted);
    if (multiLineCutResult.spare) {
      newSpares.push(multiLineCutResult.spare);
    }
    return true;
  }

  // Try shape cutting
  const shapeCutPlank = fitPlankByShapeCutting(testPlank, polygonPoints);
  if (shapeCutPlank && !hasCollisionWithExisting(testPlank, newPlanks)) {
    logger.debug(`Shape cut plank ${testPlank.id} placed successfully`);
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
const hasCollisionWithExisting = (
  testPlank: Plank,
  newPlanks: Plank[],
): boolean => {
  return newPlanks.some((existingPlank) =>
    doPlanksIntersect(testPlank, existingPlank),
  );
};

// Fill remaining gaps to ensure 100% polygon coverage
const fillRemainingGaps = (
  newPlanks: Plank[],
  newSpares: Plank[],
  polygonPoints: Point[],
  dimensions: PlankDimensions,
  gapPx: number,
  plankLog: {
    debug: (message: string, ...args: unknown[]) => void;
    trace: (message: string, ...args: unknown[]) => void;
  },
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

      if (
        !plankOverlapsPolygon(testPlank, polygonPoints) ||
        plankCollidesWithExisting(testPlank, newPlanks, gapPx)
      ) {
        continue;
      }

      attemptPlankPlacement(
        testPlank,
        polygonPoints,
        newPlanks,
        newSpares,
        gapPx,
      );
    }
  }
};
