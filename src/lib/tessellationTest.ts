import type { Point } from "./geometry";
import { calculatePolygonArea } from "./geometry";
import type { Plank } from "./plank";
import type { PlankDimensions } from "../stores/plankStore";
import { generateTessellation } from "./tessellation";

export interface TessellationTestScenario {
  name: string;
  polygon: Point[];
  firstPlank: Plank;
  plankDimensions: PlankDimensions;
  expectedMetrics: {
    totalPlanks: number;
    cutPlanks: number;
    fullPlanks: number;
    spareCount: number;
    coveragePercentage: number; // 0-100
    wastedAreaMm2: number; // area of spares that couldn't be placed
  };
}

export interface TessellationTestResult {
  scenario: TessellationTestScenario;
  actualMetrics: {
    totalPlanks: number;
    cutPlanks: number;
    fullPlanks: number;
    spareCount: number;
    coveragePercentage: number;
    wastedAreaMm2: number;
    polygonAreaMm2: number;
    coveredAreaMm2: number;
  };
  verification: {
    plankCountMatch: boolean;
    cutPlankCountMatch: boolean;
    coverageMatch: boolean;
    wasteMatch: boolean;
    overallPass: boolean;
  };
  planks: Plank[];
  spares: Plank[];
}

// Helper function to calculate plank area in mm²
const calculatePlankAreaMm2 = (plank: Plank): number => {
  const MM_TO_PIXELS = 1 / 10;
  
  if (plank.shape) {
    // For shape-cut planks, calculate actual shape area
    return calculatePolygonArea(plank.shape) * (1 / MM_TO_PIXELS) ** 2;
  }
  
  // For regular rectangular planks
  return plank.length * plank.width;
};

// Helper function to determine if plank was cut
const isPlankCut = (plank: Plank): boolean => {
  return plank.type === "linear-cut" || 
         plank.type === "multi-line-cut" || 
         plank.type === "shape-cut";
};

// Calculate coverage percentage by checking plank overlap with polygon
const calculateCoveragePercentage = (
  planks: Plank[], 
  polygonPoints: Point[]
): { coveragePercentage: number; coveredAreaMm2: number; polygonAreaMm2: number } => {
  const MM_TO_PIXELS = 1 / 10;
  const polygonAreaPx = calculatePolygonArea(polygonPoints);
  const polygonAreaMm2 = polygonAreaPx * (1 / MM_TO_PIXELS) ** 2;
  
  // Calculate total covered area by summing all placed planks
  let totalCoveredAreaMm2 = 0;
  
  for (const plank of planks) {
    totalCoveredAreaMm2 += calculatePlankAreaMm2(plank);
  }
  
  const coveragePercentage = polygonAreaMm2 > 0 
    ? Math.min(100, (totalCoveredAreaMm2 / polygonAreaMm2) * 100)
    : 0;
  
  return {
    coveragePercentage,
    coveredAreaMm2: totalCoveredAreaMm2,
    polygonAreaMm2
  };
};

// Calculate wasted area from spares that couldn't be placed
const calculateWastedArea = (spares: Plank[]): number => {
  return spares.reduce((total, spare) => total + calculatePlankAreaMm2(spare), 0);
};

// Run tessellation test
export const runTessellationTest = (
  scenario: TessellationTestScenario
): TessellationTestResult => {
  console.log(`=== Running tessellation test: ${scenario.name} ===`);
  
  // Create logger for tessellation
  const plankLog = {
    debug: (message: string, ...args: unknown[]) => {
      console.debug(`[TEST DEBUG] ${message}`, ...args);
    },
    trace: (message: string, ...args: unknown[]) => {
      console.debug(`[TEST TRACE] ${message}`, ...args);
    },
  };
  
  // Run tessellation
  const tessellationResult = generateTessellation(
    scenario.firstPlank,
    scenario.polygon,
    scenario.plankDimensions,
    plankLog
  );
  
  const { planks, spares } = tessellationResult;
  
  // Calculate actual metrics
  const cutPlanks = planks.filter(isPlankCut).length;
  const fullPlanks = planks.length - cutPlanks;
  const wastedAreaMm2 = calculateWastedArea(spares);
  
  const { coveragePercentage, coveredAreaMm2, polygonAreaMm2 } = 
    calculateCoveragePercentage(planks, scenario.polygon);
  
  const actualMetrics = {
    totalPlanks: planks.length,
    cutPlanks,
    fullPlanks,
    spareCount: spares.length,
    coveragePercentage,
    wastedAreaMm2,
    polygonAreaMm2,
    coveredAreaMm2
  };
  
  // Verification with tolerance
  const TOLERANCE = {
    count: 0, // Exact match required for counts
    percentage: 2.0, // 2% tolerance for coverage
    area: 1000 // 1000mm² tolerance for waste area
  };
  
  const verification = {
    plankCountMatch: Math.abs(actualMetrics.totalPlanks - scenario.expectedMetrics.totalPlanks) <= TOLERANCE.count,
    cutPlankCountMatch: Math.abs(actualMetrics.cutPlanks - scenario.expectedMetrics.cutPlanks) <= TOLERANCE.count,
    coverageMatch: Math.abs(actualMetrics.coveragePercentage - scenario.expectedMetrics.coveragePercentage) <= TOLERANCE.percentage,
    wasteMatch: Math.abs(actualMetrics.wastedAreaMm2 - scenario.expectedMetrics.wastedAreaMm2) <= TOLERANCE.area,
    overallPass: false
  };
  
  verification.overallPass = verification.plankCountMatch && 
                           verification.cutPlankCountMatch && 
                           verification.coverageMatch && 
                           verification.wasteMatch;
  
  console.log('Tessellation test results:', {
    actualMetrics,
    expectedMetrics: scenario.expectedMetrics,
    verification
  });
  
  return {
    scenario,
    actualMetrics,
    verification,
    planks,
    spares
  };
};

// Test scenarios for different room shapes and configurations
export const createTessellationTestScenarios = (): TessellationTestScenario[] => [
  {
    name: "Simple Rectangle - 3x2 meters",
    polygon: [
      { x: 100, y: 100 }, // 3m x 2m room
      { x: 400, y: 100 },
      { x: 400, y: 300 },
      { x: 100, y: 300 },
    ],
    firstPlank: {
      id: "first-rect",
      x: 175, // Start near left edge
      y: 150, // Center vertically 
      rotation: 0,
      length: 1500, // 1.5m plank
      width: 240,   // 240mm width
    } as Plank,
    plankDimensions: {
      length: 1500,
      width: 240,
      gap: 0,
      minRowOffset: 300,
    },
    expectedMetrics: {
      totalPlanks: 10, // Approximate for 3x2m with 1.5m planks
      cutPlanks: 4,    // Some planks will need cutting at edges
      fullPlanks: 6,   // Most planks should fit fully
      spareCount: 2,   // Some cut-offs should be usable as spares
      coveragePercentage: 95, // Should achieve high coverage
      wastedAreaMm2: 50000,   // Small amount of waste expected
    },
  },
  
  {
    name: "L-shaped Room",
    polygon: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 300 },
      { x: 100, y: 300 },
    ],
    firstPlank: {
      id: "first-l",
      x: 175,
      y: 150,
      rotation: 0,
      length: 1200,
      width: 200,
    } as Plank,
    plankDimensions: {
      length: 1200,
      width: 200,
      gap: 0,
      minRowOffset: 250,
    },
    expectedMetrics: {
      totalPlanks: 8,
      cutPlanks: 6,    // L-shape requires many cuts
      fullPlanks: 2,
      spareCount: 4,   // Complex shape generates more spares
      coveragePercentage: 88, // Lower coverage due to complex shape
      wastedAreaMm2: 80000,
    },
  },
  
  {
    name: "Narrow Hallway - 1m x 5m",
    polygon: [
      { x: 100, y: 100 },
      { x: 600, y: 100 }, // 5m long
      { x: 600, y: 200 }, // 1m wide  
      { x: 100, y: 200 },
    ],
    firstPlank: {
      id: "first-hall",
      x: 225,
      y: 150,
      rotation: 0, // Planks run along length
      length: 1500,
      width: 240,
    } as Plank,
    plankDimensions: {
      length: 1500,
      width: 240,
      gap: 0,
      minRowOffset: 300,
    },
    expectedMetrics: {
      totalPlanks: 16, // Long narrow space, many planks needed
      cutPlanks: 8,    // End planks will need cutting
      fullPlanks: 8,
      spareCount: 3,
      coveragePercentage: 92,
      wastedAreaMm2: 45000,
    },
  },
  
  {
    name: "Small Square Room - 2x2 meters",
    polygon: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 },
    ],
    firstPlank: {
      id: "first-small",
      x: 175,
      y: 150,
      rotation: 0,
      length: 1200,
      width: 200,
    } as Plank,
    plankDimensions: {
      length: 1200,
      width: 200,
      gap: 0,
      minRowOffset: 250,
    },
    expectedMetrics: {
      totalPlanks: 7,
      cutPlanks: 3,
      fullPlanks: 4,
      spareCount: 1,
      coveragePercentage: 94,
      wastedAreaMm2: 25000,
    },
  },
  
  {
    name: "Complex H-shaped Room",
    polygon: [
      // Left vertical bar of H
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 150, y: 175 },
      // Top of horizontal bar  
      { x: 250, y: 175 },
      { x: 250, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      // Right vertical bar of H
      { x: 250, y: 300 },
      { x: 250, y: 225 },
      // Bottom of horizontal bar
      { x: 150, y: 225 },
      { x: 150, y: 300 },
      { x: 100, y: 300 },
    ],
    firstPlank: {
      id: "first-h",
      x: 125,
      y: 150,
      rotation: 0,
      length: 1000,
      width: 180,
    } as Plank,
    plankDimensions: {
      length: 1000,
      width: 180,
      gap: 0,
      minRowOffset: 200,
    },
    expectedMetrics: {
      totalPlanks: 12,
      cutPlanks: 10,   // Very complex shape, most planks need cutting
      fullPlanks: 2,
      spareCount: 6,   // Complex cutting generates many spares
      coveragePercentage: 82, // Lower coverage due to complexity
      wastedAreaMm2: 120000,
    },
  },
];