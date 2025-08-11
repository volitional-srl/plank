"use client";

import { useState } from "react";
import type { Plank } from "../lib/plank";
import {
  attemptCuttingStrategies,
  createTestScenarios,
  type CuttingResult,
  type TestScenario,
} from "../lib/cuttingStrategiesTest";
import type { Gap } from "../stores/plankStore";
import DrawingCanvas from "./DrawingCanvas";
import PolygonRenderer from "./PolygonRenderer";
import PlankRenderer from "./PlankRenderer";

export default function TestCuttingStrategies() {
  const [selectedScenario, setSelectedScenario] = useState<number>(0);
  const [testResults, setTestResults] = useState<CuttingResult[]>([]);
  const scenarios = createTestScenarios();

  const runTest = (scenarioIndex: number) => {
    const scenario = scenarios[scenarioIndex];
    console.log("Running test for scenario:", scenario.name);
    console.log("Plank:", scenario.plank);
    console.log("Polygon:", scenario.polygon);

    const result = attemptCuttingStrategies(
      scenario.plank,
      scenario.polygon,
      [], // No existing planks
      0, // No gap
      scenario.expectedCutLines || [], // Expected cut lines from scenario
    );

    console.log("Test result:", result);

    const newResults = [...testResults];
    newResults[scenarioIndex] = result;
    setTestResults(newResults);
  };

  const runAllTests = () => {
    const results = scenarios.map((scenario) =>
      attemptCuttingStrategies(
        scenario.plank,
        scenario.polygon,
        [],
        0,
        scenario.expectedCutLines || [],
      ),
    );
    setTestResults(results);
  };

  const currentScenario = scenarios[selectedScenario];
  const currentResult = testResults[selectedScenario];

  // Create rendering data
  const planksToRender: Plank[] = [];
  const gaps: Gap[] = [];

  // Add original plank (semi-transparent)
  planksToRender.push({
    ...currentScenario.plank,
    id: `${currentScenario.plank.id}-original`,
  });

  // Add fitted plank if cutting was successful
  if (currentResult?.success && currentResult.fittedPlank) {
    planksToRender.push(currentResult.fittedPlank);
  }

  // Add spare if created
  if (currentResult?.spareCreated) {
    planksToRender.push({
      ...currentResult.spareCreated,
      x: currentScenario.plank.x + 100, // Offset spare for visibility
      y: currentScenario.plank.y + 50,
    });
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

  return (
    <div className="w-full h-full flex">
      {/* Test Controls Panel */}
      <div className="w-80 bg-gray-100 p-4 border-r overflow-y-auto">
        <h1 className="text-xl font-semibold mb-4">Cutting Strategies Test</h1>

        <div className="mb-4">
          <button
            onClick={runAllTests}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Run All Tests
          </button>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Test Scenarios</h3>
          {scenarios.map((scenario, index) => (
            <div key={index} className="mb-2" data-testid="test-scenario">
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
                  Expected: {scenario.expectedMethod}
                </div>
              </button>

              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => runTest(index)}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Test
                </button>

                {testResults[index] && (
                  <div
                    className={`px-2 py-1 text-xs rounded ${
                      testResults[index].success
                        ? testResults[index].method === scenario.expectedMethod
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {testResults[index].success
                      ? `✓ ${testResults[index].method}`
                      : "✗ failed"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Test Result Details */}
        {currentResult && (
          <div className="mb-4 p-3 bg-white rounded border">
            <h4 className="font-semibold mb-2">Test Result</h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="font-medium">Success:</span>{" "}
                <span
                  className={
                    currentResult.success ? "text-green-600" : "text-red-600"
                  }
                >
                  {currentResult.success ? "Yes" : "No"}
                </span>
              </div>
              <div>
                <span className="font-medium">Method:</span>{" "}
                {currentResult.method}
              </div>
              <div>
                <span className="font-medium">Expected:</span>{" "}
                {currentScenario.expectedMethod}
              </div>
              <div>
                <span className="font-medium">Match:</span>{" "}
                <span
                  className={
                    currentResult.method === currentScenario.expectedMethod
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {currentResult.method === currentScenario.expectedMethod
                    ? "Yes"
                    : "Unexpected"}
                </span>
              </div>
              {currentResult.fittedPlank && (
                <div>
                  <span className="font-medium">Fitted Plank:</span>{" "}
                  {currentResult.fittedPlank.length}mm ×{" "}
                  {currentResult.fittedPlank.width}mm
                  <br />
                  <span className="text-xs text-gray-600">
                    Position: ({currentResult.fittedPlank.x.toFixed(1)},{" "}
                    {currentResult.fittedPlank.y.toFixed(1)})
                  </span>
                </div>
              )}
              {currentScenario.expectedFittedPlank && (
                <div>
                  <span className="font-medium">Expected Fitted:</span>{" "}
                  {currentScenario.expectedFittedPlank.length}mm ×{" "}
                  {currentScenario.expectedFittedPlank.width}mm
                  <br />
                  <span className="text-xs text-gray-600">
                    Position: (
                    {currentScenario.expectedFittedPlank.x.toFixed(1)},{" "}
                    {currentScenario.expectedFittedPlank.y.toFixed(1)})
                  </span>
                </div>
              )}
              {currentResult.spareCreated && (
                <div>
                  <span className="font-medium">Spare Created:</span>{" "}
                  {currentResult.spareCreated.length}mm ×{" "}
                  {currentResult.spareCreated.width}mm
                </div>
              )}

              {/* Cut Details */}
              {currentResult.cutDetails && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <h5 className="font-medium text-gray-700 mb-1">
                    Cut Verification
                  </h5>

                  {currentResult.cutDetails.cutLineVerification && (
                    <div className="space-y-1">
                      <div>
                        <span className="font-medium">Cut Accuracy:</span>{" "}
                        <span
                          className={
                            currentResult.cutDetails.cutLineVerification
                              .isCorrect
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {currentResult.cutDetails.cutLineVerification
                            .isCorrect
                            ? "✓ Correct"
                            : "✗ Incorrect"}
                        </span>
                      </div>
                      {currentResult.cutDetails.cutLineVerification.message && (
                        <div className="text-xs text-gray-600">
                          {currentResult.cutDetails.cutLineVerification.message}
                        </div>
                      )}
                      {currentResult.cutDetails.cutLineVerification
                        .distanceFromExpected && (
                        <div className="text-xs text-gray-600">
                          Distance from expected:{" "}
                          {currentResult.cutDetails.cutLineVerification.distanceFromExpected.toFixed(
                            1,
                          )}
                          px
                        </div>
                      )}
                    </div>
                  )}

                  {currentResult.cutDetails.cutDistance && (
                    <div>
                      <span className="font-medium">Cut Distance:</span>{" "}
                      {currentResult.cutDetails.cutDistance.toFixed(1)}px
                    </div>
                  )}

                  {currentResult.cutDetails.cutLines &&
                    currentResult.cutDetails.cutLines.length > 0 && (
                      <div>
                        <span className="font-medium">Cut Lines:</span>{" "}
                        {currentResult.cutDetails.cutLines.length}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="p-3 bg-white rounded border">
          <h4 className="font-semibold mb-2">Legend</h4>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-800 opacity-50 rounded-sm"></div>
              <span>Original Plank (transparent)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
              <span>Linear Cut</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-pink-500 rounded-sm"></div>
              <span>Multi-line Cut</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
              <span>Shape Cut</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>Spare Piece</span>
            </div>
            <hr className="my-2" />
            <div className="text-xs font-medium text-gray-700 mb-1">
              Cut Verification
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-0.5 bg-green-500"
                style={{ borderStyle: "dashed" }}
              ></div>
              <span>Expected Cut Line</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-0.5 bg-red-500"
                style={{ borderStyle: "dashed" }}
              ></div>
              <span>Actual Cut Line</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Intersection Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-indigo-500"></div>
              <span>Cut Distance</span>
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

            {/* Original plank overlay (semi-transparent) */}
            <rect
              x={
                currentScenario.plank.x -
                (currentScenario.plank.length * 0.1) / 2
              }
              y={
                currentScenario.plank.y -
                (currentScenario.plank.width * 0.1) / 2
              }
              width={currentScenario.plank.length * 0.1}
              height={currentScenario.plank.width * 0.1}
              fill="rgba(139, 69, 19, 0.3)"
              stroke="#8B4513"
              strokeWidth="2"
              strokeDasharray="5,5"
              transform={`rotate(${currentScenario.plank.rotation} ${currentScenario.plank.x} ${currentScenario.plank.y})`}
              className="select-none pointer-events-none"
            />

            {/* Cut lines visualization */}
            {currentResult?.cutDetails?.expectedCutLines &&
              currentResult.cutDetails.expectedCutLines.map(
                (cutLine, index) => (
                  <line
                    key={`expected-cut-${index}`}
                    x1={cutLine[0]?.x || 0}
                    y1={cutLine[0]?.y || 0}
                    x2={cutLine[1]?.x || 0}
                    y2={cutLine[1]?.y || 0}
                    stroke="#10B981"
                    // strokeWidth="3"
                    // strokeDasharray="8,4"
                    className="select-none pointer-events-none"
                  />
                ),
              )}

            {/* Multi-line cut lines visualization */}
            {currentResult?.cutDetails?.cutLines &&
              currentResult.cutDetails.cutLines.map((cutLine, index) => (
                <line
                  key={`actual-cut-${index}`}
                  x1={cutLine[0]?.x || 0}
                  y1={cutLine[0]?.y || 0}
                  x2={cutLine[1]?.x || 0}
                  y2={cutLine[1]?.y || 0}
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                  className="select-none pointer-events-none"
                />
              ))}

            {/* Intersection points visualization */}
            {currentResult?.cutDetails?.intersectionPoints &&
              currentResult.cutDetails.intersectionPoints.map(
                (point, index) => (
                  <circle
                    key={`intersection-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#F59E0B"
                    stroke="#92400E"
                    strokeWidth="1"
                    className="select-none pointer-events-none"
                  />
                ),
              )}

            {/* Linear cut distance indicator */}
            {currentResult?.method === "linear" &&
              currentResult.cutDetails?.cutDistance && (
                <g>
                  {/* Cut distance line */}
                  <line
                    x1={
                      currentScenario.plank.x -
                      (currentScenario.plank.length * 0.1) / 2
                    }
                    y1={currentScenario.plank.y - 20}
                    x2={
                      currentScenario.plank.x -
                      (currentScenario.plank.length * 0.1) / 2 +
                      currentResult.cutDetails.cutDistance
                    }
                    y2={currentScenario.plank.y - 20}
                    stroke="#6366F1"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                    className="select-none pointer-events-none"
                  />
                  <text
                    x={
                      currentScenario.plank.x -
                      (currentScenario.plank.length * 0.1) / 2 +
                      currentResult.cutDetails.cutDistance / 2
                    }
                    y={currentScenario.plank.y - 25}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6366F1"
                    className="select-none pointer-events-none"
                  >
                    {(currentResult.cutDetails.cutDistance * 10).toFixed(0)}mm
                  </text>
                  {/* Arrow marker definition */}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6366F1" />
                    </marker>
                  </defs>
                </g>
              )}
          </DrawingCanvas>
        </div>
      </div>
    </div>
  );
}
