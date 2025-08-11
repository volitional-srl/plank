"use client";

import { useState } from "react";
import type { Plank } from "../lib/plank";
import {
  runTessellationTest,
  createTessellationTestScenarios,
  type TessellationTestResult,
  type TessellationTestScenario,
} from "../lib/tessellationTest";
import type { Gap } from "../stores/plankStore";
import DrawingCanvas from "./DrawingCanvas";
import PolygonRenderer from "./PolygonRenderer";
import PlankRenderer from "./PlankRenderer";

export default function TestTessellation() {
  const [selectedScenario, setSelectedScenario] = useState<number>(0);
  const [testResults, setTestResults] = useState<TessellationTestResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const scenarios = createTessellationTestScenarios();

  const runTest = async (scenarioIndex: number) => {
    const scenario = scenarios[scenarioIndex];
    setIsRunning(true);

    console.log("Running tessellation test for scenario:", scenario.name);

    try {
      const result = runTessellationTest(scenario);

      const newResults = [...testResults];
      newResults[scenarioIndex] = result;
      setTestResults(newResults);
    } catch (error) {
      console.error("Test failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);

    try {
      const results = scenarios.map((scenario) =>
        runTessellationTest(scenario),
      );
      setTestResults(results);
    } catch (error) {
      console.error("Tests failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const currentScenario = scenarios[selectedScenario];
  const currentResult = testResults[selectedScenario];

  // Create rendering data
  const planksToRender: Plank[] = [];
  const gaps: Gap[] = [];

  // Add first plank (semi-transparent)
  planksToRender.push({
    ...currentScenario.firstPlank,
    id: `${currentScenario.firstPlank.id}-first`,
  });

  // Add all tessellated planks if test was run
  if (currentResult) {
    planksToRender.push(...currentResult.planks);
  }

  // Calculate polygon path for rendering
  const polygonPath =
    currentScenario.polygon.length > 0
      ? `M ${currentScenario.polygon.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`
      : "";

  const edgeLengths = currentScenario.polygon.map((point, index) => {
    const nextPoint =
      currentScenario.polygon[(index + 1) % currentScenario.polygon.length];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const length = Math.sqrt(dx * dx + dy * dy) * 10; // Convert pixels to mm

    return {
      from: point,
      to: nextPoint,
      lengthMm: length,
    };
  });

  // Helper to format numbers
  const formatNumber = (num: number, decimals: number = 0): string => {
    return num.toFixed(decimals);
  };

  // Helper to get verification icon
  const getVerificationIcon = (isCorrect: boolean): string => {
    return isCorrect ? "✓" : "✗";
  };

  // Helper to get verification color class
  const getVerificationColor = (isCorrect: boolean): string => {
    return isCorrect ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="w-full h-full flex">
      {/* Test Controls Panel */}
      <div className="w-96 bg-gray-100 p-4 border-r overflow-y-auto">
        <h1 className="text-xl font-semibold mb-4">Tessellation Testing</h1>

        <div className="mb-4">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`w-full px-4 py-2 text-white rounded ${
              isRunning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isRunning ? "Running Tests..." : "Run All Tests"}
          </button>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Test Scenarios</h3>
          {scenarios.map((scenario, index) => (
            <div
              key={index}
              className="mb-2"
              data-testid="tessellation-scenario"
            >
              <button
                onClick={() => setSelectedScenario(index)}
                className={`w-full text-left p-2 rounded text-sm border ${
                  selectedScenario === index
                    ? "bg-blue-100 border-blue-300"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{scenario.name}</div>
                <div className="text-xs text-gray-600">
                  Expected: {scenario.expectedMetrics.totalPlanks} planks,{" "}
                  {scenario.expectedMetrics.coveragePercentage}% coverage
                </div>
              </button>

              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => runTest(index)}
                  disabled={isRunning}
                  className={`px-2 py-1 text-xs text-white rounded ${
                    isRunning
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {isRunning ? "..." : "Test"}
                </button>

                {testResults[index] && (
                  <div
                    className={`px-2 py-1 text-xs rounded ${
                      testResults[index].verification.overallPass
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {testResults[index].verification.overallPass
                      ? "✓ PASS"
                      : "✗ FAIL"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Test Result Details */}
        {currentResult && (
          <div className="mb-4 p-3 bg-white rounded border">
            <h4 className="font-semibold mb-3">Test Results</h4>

            {/* Overall Status */}
            <div className="mb-3 p-2 rounded border-l-4 border-l-blue-500 bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="font-medium">Overall Status:</span>
                <span
                  className={`font-bold ${getVerificationColor(currentResult.verification.overallPass)}`}
                >
                  {getVerificationIcon(currentResult.verification.overallPass)}{" "}
                  {currentResult.verification.overallPass ? "PASS" : "FAIL"}
                </span>
              </div>
            </div>

            {/* Metrics Comparison */}
            <div className="space-y-3 text-sm">
              {/* Plank Counts */}
              <div className="border rounded p-2 bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">Plank Counts</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Total Planks:</span>
                    <div className="flex justify-between items-center">
                      <span>
                        Expected:{" "}
                        {currentResult.scenario.expectedMetrics.totalPlanks}
                      </span>
                      <span
                        className={getVerificationColor(
                          currentResult.verification.plankCountMatch,
                        )}
                      >
                        {getVerificationIcon(
                          currentResult.verification.plankCountMatch,
                        )}
                      </span>
                    </div>
                    <div className="font-medium">
                      Actual: {currentResult.actualMetrics.totalPlanks}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Cut Planks:</span>
                    <div className="flex justify-between items-center">
                      <span>
                        Expected:{" "}
                        {currentResult.scenario.expectedMetrics.cutPlanks}
                      </span>
                      <span
                        className={getVerificationColor(
                          currentResult.verification.cutPlankCountMatch,
                        )}
                      >
                        {getVerificationIcon(
                          currentResult.verification.cutPlankCountMatch,
                        )}
                      </span>
                    </div>
                    <div className="font-medium">
                      Actual: {currentResult.actualMetrics.cutPlanks}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Full Planks: {currentResult.actualMetrics.fullPlanks} |
                  Spares: {currentResult.actualMetrics.spareCount}
                </div>
              </div>

              {/* Coverage */}
              <div className="border rounded p-2 bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">
                  Coverage Analysis
                </h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span>
                      Expected Coverage:{" "}
                      {
                        currentResult.scenario.expectedMetrics
                          .coveragePercentage
                      }
                      %
                    </span>
                    <span
                      className={getVerificationColor(
                        currentResult.verification.coverageMatch,
                      )}
                    >
                      {getVerificationIcon(
                        currentResult.verification.coverageMatch,
                      )}
                    </span>
                  </div>
                  <div className="font-medium">
                    Actual Coverage:{" "}
                    {formatNumber(
                      currentResult.actualMetrics.coveragePercentage,
                      1,
                    )}
                    %
                  </div>
                  <div className="text-gray-600 mt-1">
                    Polygon Area:{" "}
                    {formatNumber(
                      currentResult.actualMetrics.polygonAreaMm2 / 1000000,
                      2,
                    )}{" "}
                    m²
                  </div>
                  <div className="text-gray-600">
                    Covered Area:{" "}
                    {formatNumber(
                      currentResult.actualMetrics.coveredAreaMm2 / 1000000,
                      2,
                    )}{" "}
                    m²
                  </div>
                </div>
              </div>

              {/* Waste Analysis */}
              <div className="border rounded p-2 bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">
                  Waste Analysis
                </h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span>
                      Expected Waste:{" "}
                      {formatNumber(
                        currentResult.scenario.expectedMetrics.wastedAreaMm2 /
                          1000,
                        0,
                      )}{" "}
                      cm²
                    </span>
                    <span
                      className={getVerificationColor(
                        currentResult.verification.wasteMatch,
                      )}
                    >
                      {getVerificationIcon(
                        currentResult.verification.wasteMatch,
                      )}
                    </span>
                  </div>
                  <div className="font-medium">
                    Actual Waste:{" "}
                    {formatNumber(
                      currentResult.actualMetrics.wastedAreaMm2 / 1000,
                      0,
                    )}{" "}
                    cm²
                  </div>
                  <div className="text-gray-600 mt-1">
                    Waste Percentage:{" "}
                    {formatNumber(
                      (currentResult.actualMetrics.wastedAreaMm2 /
                        currentResult.actualMetrics.polygonAreaMm2) *
                        100,
                      1,
                    )}
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="p-3 bg-white rounded border">
          <h4 className="font-semibold mb-2">Legend</h4>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 bg-amber-800 opacity-30 rounded-sm border border-amber-800"
                style={{ borderStyle: "dashed" }}
              ></div>
              <span>First Plank (starting position)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-800 rounded-sm"></div>
              <span>Full Planks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
              <span>Linear Cut Planks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-pink-500 rounded-sm"></div>
              <span>Multi-line Cut Planks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
              <span>Shape Cut Planks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>Spare Pieces</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <DrawingCanvas
            onMouseMove={() => {}} // No mouse interaction needed for tests
            onCanvasClick={() => {}} // No click interaction needed for tests
          >
            <PolygonRenderer
              points={currentScenario.polygon}
              polygonPath={polygonPath}
              isComplete={true}
              edgeLengths={edgeLengths}
              mousePosition={null}
              previewPoint={null}
              isAngleSnapActive={false}
              isGridSnapActive={false}
            />
            <PlankRenderer
              planks={planksToRender}
              gaps={gaps}
              previewPlank={null}
            />

            {/* First plank overlay (semi-transparent with dashed border) */}
            <rect
              x={
                currentScenario.firstPlank.x -
                (currentScenario.firstPlank.length * 0.1) / 2
              }
              y={
                currentScenario.firstPlank.y -
                (currentScenario.firstPlank.width * 0.1) / 2
              }
              width={currentScenario.firstPlank.length * 0.1}
              height={currentScenario.firstPlank.width * 0.1}
              fill="rgba(139, 69, 19, 0.2)"
              stroke="#8B4513"
              strokeWidth="2"
              strokeDasharray="8,4"
              transform={`rotate(${currentScenario.firstPlank.rotation} ${currentScenario.firstPlank.x} ${currentScenario.firstPlank.y})`}
              className="select-none pointer-events-none"
            />

            {/* Result statistics overlay */}
            {currentResult && (
              <g>
                <rect
                  x="10"
                  y="10"
                  width="200"
                  height="80"
                  fill="rgba(255, 255, 255, 0.95)"
                  stroke="#ccc"
                  strokeWidth="1"
                  rx="4"
                />
                <text x="20" y="30" fontSize="12" fontWeight="bold" fill="#333">
                  Tessellation Results
                </text>
                <text x="20" y="45" fontSize="10" fill="#666">
                  Total: {currentResult.actualMetrics.totalPlanks} planks
                </text>
                <text x="20" y="57" fontSize="10" fill="#666">
                  Cut: {currentResult.actualMetrics.cutPlanks} | Full:{" "}
                  {currentResult.actualMetrics.fullPlanks}
                </text>
                <text x="20" y="69" fontSize="10" fill="#666">
                  Coverage:{" "}
                  {formatNumber(
                    currentResult.actualMetrics.coveragePercentage,
                    1,
                  )}
                  %
                </text>
                <text x="20" y="81" fontSize="10" fill="#666">
                  Waste:{" "}
                  {formatNumber(
                    currentResult.actualMetrics.wastedAreaMm2 / 1000,
                    0,
                  )}{" "}
                  cm²
                </text>
              </g>
            )}
          </DrawingCanvas>
        </div>
      </div>
    </div>
  );
}
