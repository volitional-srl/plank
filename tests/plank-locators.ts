import { Page, Locator } from '@playwright/test';

/**
 * Utility functions for locating different plank types in Playwright tests
 */

/**
 * Get locator for full planks (brown color)
 */
export function getFullPlanks(page: Page): Locator {
  return page.locator('rect[fill*="rgba(139, 69, 19"]');
}

/**
 * Get locator for cut planks (orange color) 
 */
export function getCutPlanks(page: Page): Locator {
  return page.locator('rect[fill*="rgba(251, 146, 60"]');
}

/**
 * Get locator for shape-cut planks (purple color)
 */
export function getShapeCutPlanks(page: Page): Locator {
  return page.locator('path[fill*="rgba(147, 51, 234"]');
}

/**
 * Get locator for multi-line cut planks (pink color)
 */
export function getMultiLineCutPlanks(page: Page): Locator {
  return page.locator('path[fill*="rgba(236, 72, 153"]');
}

/**
 * Get locator for spares/other planks (green color)
 */
export function getSparePlanks(page: Page): Locator {
  return page.locator('path[fill*="rgba(34, 197, 94"]');
}

/**
 * Get locator for all plank elements (any type)
 */
export function getAllPlanks(page: Page): Locator {
  return page.locator(
    'rect[fill*="rgba(139, 69, 19"], rect[fill*="rgba(251, 146, 60"], path[fill*="rgba(147, 51, 234"], path[fill*="rgba(236, 72, 153"], path[fill*="rgba(34, 197, 94"]'
  );
}

/**
 * Get locator for all rectangular planks (full + cut planks)
 */
export function getRectangularPlanks(page: Page): Locator {
  return page.locator(
    'rect[fill*="rgba(139, 69, 19"], rect[fill*="rgba(251, 146, 60"]'
  );
}

/**
 * Get locator for all path-based planks (shape-cut + multi-line cut + spares)
 */
export function getPathPlanks(page: Page): Locator {
  return page.locator(
    'path[fill*="rgba(147, 51, 234"], path[fill*="rgba(236, 72, 153"], path[fill*="rgba(34, 197, 94"]'
  );
}

/**
 * Utility function to wait for planks to appear after tessellation
 */
export async function waitForPlanks(page: Page, timeout: number = 2000): Promise<void> {
  await page.waitForTimeout(timeout);
}

/**
 * Get plank count by type
 */
export async function getPlankCounts(page: Page) {
  const fullPlanks = await getFullPlanks(page).count();
  const cutPlanks = await getCutPlanks(page).count();  
  const shapeCutPlanks = await getShapeCutPlanks(page).count();
  const multiLineCutPlanks = await getMultiLineCutPlanks(page).count();
  const sparePlanks = await getSparePlanks(page).count();
  const totalPlanks = await getAllPlanks(page).count();

  return {
    full: fullPlanks,
    cut: cutPlanks,
    shapeCut: shapeCutPlanks,
    multiLineCut: multiLineCutPlanks,
    spare: sparePlanks,
    total: totalPlanks
  };
}

/**
 * Interface for polygon coverage data
 */
export interface CoverageData {
  polygonArea: number;
  plankArea: number;
  coveragePercentage: number;
  gapArea: number;
  hasGaps: boolean;
}

/**
 * Calculate polygon area from SVG path data using shoelace formula
 */
export function calculatePolygonAreaFromPath(pathData: string): number {
  // Parse SVG path data to extract coordinates
  const coords = pathData
    .replace(/[MZ]/g, '') // Remove M and Z commands
    .replace(/L/g, ' ') // Replace L with space
    .trim()
    .split(/\s+/)
    .map(parseFloat)
    .filter(n => !isNaN(n));

  if (coords.length < 6) return 0; // Need at least 3 points (6 coordinates)

  // Convert to points array
  const points: Array<{x: number, y: number}> = [];
  for (let i = 0; i < coords.length; i += 2) {
    points.push({ x: coords[i], y: coords[i + 1] });
  }

  // Shoelace formula for polygon area
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate rectangle area from element attributes
 */
export function calculateRectangleArea(width: number, height: number): number {
  return width * height;
}

/**
 * Get polygon area from the SVG polygon path
 */
export async function getPolygonArea(page: Page): Promise<number> {
  const polygonPath = page.locator('path[fill*="rgba(59, 130, 246"]').first();
  const pathData = await polygonPath.getAttribute('d');
  
  if (!pathData) {
    throw new Error('No polygon path found');
  }
  
  return calculatePolygonAreaFromPath(pathData);
}

/**
 * Calculate total area covered by all planks
 */
export async function getTotalPlankArea(page: Page): Promise<number> {
  let totalArea = 0;

  // Get all rectangular planks (full + cut planks)
  const rectangularPlanks = await getRectangularPlanks(page).all();
  for (const plank of rectangularPlanks) {
    const width = parseFloat(await plank.getAttribute('width') || '0');
    const height = parseFloat(await plank.getAttribute('height') || '0');
    totalArea += calculateRectangleArea(width, height);
  }

  // Get all path-based planks (shape-cut + multi-line cut + spares)
  const pathPlanks = await getPathPlanks(page).all();
  for (const plank of pathPlanks) {
    const pathData = await plank.getAttribute('d');
    if (pathData) {
      totalArea += calculatePolygonAreaFromPath(pathData);
    }
  }

  return totalArea;
}

/**
 * Calculate gap area from gap indicators
 */
export async function getTotalGapArea(page: Page): Promise<number> {
  let gapArea = 0;

  // Get rectangular gaps
  const rectangularGaps = page.locator('rect[stroke="#EF4444"][stroke-dasharray="5,5"]');
  const rectGaps = await rectangularGaps.all();
  
  for (const gap of rectGaps) {
    const width = parseFloat(await gap.getAttribute('width') || '0');
    const height = parseFloat(await gap.getAttribute('height') || '0');
    gapArea += calculateRectangleArea(width, height);
  }

  // Get path-based gaps (arbitrary shapes)
  const pathGaps = page.locator('path[stroke="#EF4444"][stroke-dasharray="5,5"]');
  const shapeGaps = await pathGaps.all();
  
  for (const gap of shapeGaps) {
    const pathData = await gap.getAttribute('d');
    if (pathData) {
      gapArea += calculatePolygonAreaFromPath(pathData);
    }
  }

  return gapArea;
}

/**
 * Get comprehensive coverage data for the current tessellation
 */
export async function getCoverageData(page: Page): Promise<CoverageData> {
  const polygonArea = await getPolygonArea(page);
  const plankArea = await getTotalPlankArea(page);
  const gapArea = await getTotalGapArea(page);
  
  const totalCoveredArea = plankArea + gapArea;
  const coveragePercentage = (totalCoveredArea / polygonArea) * 100;
  
  return {
    polygonArea,
    plankArea,
    coveragePercentage,
    gapArea,
    hasGaps: gapArea > 1 // Consider gaps > 1 pixel² as meaningful
  };
}

/**
 * Assert that the tessellation achieves 100% polygon coverage
 * @param page - Playwright page object
 * @param tolerance - Acceptable coverage tolerance as percentage (default: 1%)
 * @param logDetails - Whether to log detailed coverage information (default: true)
 */
export async function assertFullCoverage(
  page: Page, 
  tolerance: number = 1, 
  logDetails: boolean = true
): Promise<void> {
  const coverage = await getCoverageData(page);
  
  if (logDetails) {
    console.log('=== COVERAGE ANALYSIS ===');
    console.log(`Polygon area: ${coverage.polygonArea.toFixed(2)} px²`);
    console.log(`Plank area: ${coverage.plankArea.toFixed(2)} px²`);
    console.log(`Gap area: ${coverage.gapArea.toFixed(2)} px²`);
    console.log(`Coverage: ${coverage.coveragePercentage.toFixed(2)}%`);
    console.log(`Has gaps: ${coverage.hasGaps}`);
    console.log('========================');
  }

  // Assert coverage meets minimum threshold
  const minCoverage = 100 - tolerance;
  if (coverage.coveragePercentage < minCoverage) {
    throw new Error(
      `Coverage assertion failed: ${coverage.coveragePercentage.toFixed(2)}% < ${minCoverage}%\n` +
      `Polygon area: ${coverage.polygonArea.toFixed(2)} px²\n` +
      `Covered area: ${(coverage.plankArea + coverage.gapArea).toFixed(2)} px²\n` +
      `Missing area: ${(coverage.polygonArea - coverage.plankArea - coverage.gapArea).toFixed(2)} px²`
    );
  }

  // Warn if coverage is suspiciously high (might indicate overlapping planks)
  if (coverage.coveragePercentage > 105) {
    console.warn(
      `Warning: Coverage is ${coverage.coveragePercentage.toFixed(2)}%, ` +
      'which may indicate overlapping planks'
    );
  }
}

/**
 * Assert that the tessellation has minimal gaps
 * @param page - Playwright page object
 * @param maxGapAreaRatio - Maximum acceptable gap area as ratio of total polygon area (default: 0.005 = 0.5%)
 */
export async function assertMinimalGaps(
  page: Page, 
  maxGapAreaRatio: number = 0.005
): Promise<void> {
  const coverage = await getCoverageData(page);
  const gapAreaRatio = coverage.gapArea / coverage.polygonArea;
  
  if (gapAreaRatio > maxGapAreaRatio) {
    throw new Error(
      `Gap assertion failed: Gap area ratio ${(gapAreaRatio * 100).toFixed(3)}% > ${(maxGapAreaRatio * 100).toFixed(3)}%\n` +
      `Gap area: ${coverage.gapArea.toFixed(2)} px² out of ${coverage.polygonArea.toFixed(2)} px²`
    );
  }
}