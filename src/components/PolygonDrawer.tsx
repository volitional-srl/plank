"use client";

import { useRef, useEffect } from "react";
import { useStore } from "@nanostores/react";

// Camera store imports
import {
  $currentZoom,
  $zoomTransform,
  $canZoomIn,
  $canZoomOut,
  $isPanning,
  $isSpacePressed,
  cameraActions,
  type Point,
} from "../stores/cameraStore";

// Polygon store imports
import {
  $points,
  $isComplete,
  $mousePosition,
  $polygonPathClosed,
  $polygonArea,
  $polygonPerimeter,
  $edgeLengths,
  polygonActions,
  unitUtils,
} from "../stores/polygonStore";

// Grid store imports
import {
  $angleSnapEnabled,
  $gridSnapEnabled,
  $isShiftPressed,
  $isAngleSnapActive,
  $isGridSnapActive,
  gridActions,
} from "../stores/gridStore";

// Plank store imports
import {
  $plankDimensions,
  $planks,
  $isPlacingPlank,
  $previewPlank,
  plankActions,
} from "../stores/plankStore";

export default function PolygonDrawer() {
  const points = useStore($points);
  const isComplete = useStore($isComplete);
  const angleSnapEnabled = useStore($angleSnapEnabled);
  const gridSnapEnabled = useStore($gridSnapEnabled);
  const isShiftPressed = useStore($isShiftPressed);
  const mousePosition = useStore($mousePosition);
  const isAngleSnapActive = useStore($isAngleSnapActive);
  const isGridSnapActive = useStore($isGridSnapActive);
  const polygonPath = useStore($polygonPathClosed);
  const polygonArea = useStore($polygonArea);
  const polygonPerimeter = useStore($polygonPerimeter);
  const edgeLengths = useStore($edgeLengths);
  const currentZoom = useStore($currentZoom);
  const zoomTransform = useStore($zoomTransform);
  const canZoomIn = useStore($canZoomIn);
  const canZoomOut = useStore($canZoomOut);
  const isPanning = useStore($isPanning);
  const isSpacePressed = useStore($isSpacePressed);
  const plankDimensions = useStore($plankDimensions);
  const planks = useStore($planks);
  const isPlacingPlank = useStore($isPlacingPlank);
  const previewPlank = useStore($previewPlank);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        gridActions.setShiftPressed(true);
      } else if (event.key === " ") {
        event.preventDefault();
        cameraActions.setSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        gridActions.setShiftPressed(false);
      } else if (event.key === " ") {
        cameraActions.setSpacePressed(false);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      // Only zoom when mouse is over the SVG
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // Check if mouse is within SVG bounds
      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        event.preventDefault();

        if (event.deltaY < 0) {
          cameraActions.zoomIn();
        } else {
          cameraActions.zoomOut();
        }
      }
    };

    const handleGlobalMouseUp = () => {
      cameraActions.stopPanning();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isPanning]);

  const handleSVGMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    // Check if middle mouse button or space+left click for panning
    if (event.button === 1 || (event.button === 0 && isSpacePressed)) {
      event.preventDefault();
      cameraActions.startPanning(event.clientX, event.clientY);
      return;
    }
  };

  const handleSVGMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Handle panning
    if (isPanning) {
      cameraActions.updatePanning(event.clientX, event.clientY);
      return;
    }

    const rect = svg.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    // Convert screen coordinates to canvas coordinates
    const canvasPoint = cameraActions.screenToCanvas(screenX, screenY);

    // Handle plank placement preview
    if (isPlacingPlank) {
      plankActions.setPreviewPlank(canvasPoint, 0); // TODO: Add rotation control
      return;
    }

    // Handle normal drawing mouse movement
    if (!isComplete) {
      polygonActions.setMousePosition(canvasPoint);
    }
  };

  const handleSVGMouseUp = () => {
    if (isPanning) {
      cameraActions.stopPanning();
      return;
    }
  };

  const getPreviewPoint = (): Point | null => {
    if (!mousePosition) return mousePosition;

    const previousPoint =
      points.length > 0 ? points[points.length - 1] : undefined;
    return gridActions.applySnapping(
      mousePosition.x,
      mousePosition.y,
      previousPoint,
    );
  };

  const handleSVGClick = (event: React.MouseEvent<SVGSVGElement>) => {
    // Don't do anything if panning
    if (isSpacePressed || isPanning) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    // Convert screen coordinates to canvas coordinates
    const canvasPoint = cameraActions.screenToCanvas(screenX, screenY);

    // Handle plank placement if in placing mode
    if (isPlacingPlank) {
      plankActions.placePlank(canvasPoint, 0); // Start with 0 rotation
      return;
    }

    // Handle polygon drawing if not complete
    if (!isComplete) {
      const previousPoint =
        points.length > 0 ? points[points.length - 1] : undefined;
      const newPoint = gridActions.applySnapping(
        canvasPoint.x,
        canvasPoint.y,
        previousPoint,
      );

      polygonActions.addPoint(newPoint);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-xl font-semibold mb-3">Draw Your Surface</h2>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-3 p-2 bg-white rounded-lg border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={gridActions.toggleAngleSnap}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  angleSnapEnabled
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full ${angleSnapEnabled ? "bg-green-500" : "bg-gray-400"}`}
                ></div>
                Angle Snap
              </button>
              <span className="text-xs text-gray-500">
                {angleSnapEnabled ? "ON" : "OFF"}{" "}
                {isShiftPressed && "(SHIFT held)"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={gridActions.toggleGridSnap}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  gridSnapEnabled
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-sm ${gridSnapEnabled ? "bg-blue-500" : "bg-gray-400"}`}
                ></div>
                Grid Snap
              </button>
              <span className="text-xs text-gray-500">
                {gridSnapEnabled ? `100mm` : "OFF"}
              </span>
            </div>

            <div className="flex items-center gap-1 border-l border-gray-300 pl-4">
              <button
                onClick={cameraActions.zoomOut}
                disabled={!canZoomOut}
                className="p-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="M21 21l-4.35-4.35"></path>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <span className="text-xs text-gray-600 min-w-[3rem] text-center">
                {Math.round(currentZoom * 100)}%
              </span>
              <button
                onClick={cameraActions.zoomIn}
                disabled={!canZoomIn}
                className="p-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="M21 21l-4.35-4.35"></path>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                </svg>
              </button>
              <button
                onClick={cameraActions.resetZoom}
                className="text-xs text-gray-600 hover:text-gray-800 ml-1"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={polygonActions.completePolygon}
            disabled={points.length < 3}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Complete Polygon
          </button>
          <button
            onClick={polygonActions.clearPolygon}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Clear
          </button>
        </div>

        {/* Measurements Panel */}
        {points.length > 0 && (
          <div className="mb-3 p-2 bg-white rounded-lg border">
            <div className="flex items-center gap-6 text-sm">
              <div className="text-gray-600">
                <span className="font-medium">Points:</span> {points.length}
              </div>
              {points.length >= 2 && (
                <div className="text-gray-600">
                  <span className="font-medium">Perimeter:</span>{" "}
                  {unitUtils.formatMm(polygonPerimeter)}
                </div>
              )}
              {isComplete && polygonArea > 0 && (
                <div className="text-gray-600">
                  <span className="font-medium">Area:</span>{" "}
                  {unitUtils.formatArea(polygonArea)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plank Configuration Panel */}
        <div className="mb-3 p-3 bg-white rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Plank Configuration</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label htmlFor="plank-length" className="text-xs text-gray-600 min-w-[40px]">
                Length:
              </label>
              <input
                id="plank-length"
                type="number"
                value={plankDimensions.length}
                onChange={(e) => plankActions.setPlankLength(Number(e.target.value))}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="100"
                max="5000"
                step="10"
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="plank-width" className="text-xs text-gray-600 min-w-[35px]">
                Width:
              </label>
              <input
                id="plank-width"
                type="number"
                value={plankDimensions.width}
                onChange={(e) => plankActions.setPlankWidth(Number(e.target.value))}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="50"
                max="1000"
                step="5"
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
          
          {isComplete && (
            <div className="flex items-center gap-2">
              <button
                onClick={plankActions.startPlacingPlank}
                disabled={isPlacingPlank}
                className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPlacingPlank ? "Click to Place Plank" : "Place First Plank"}
              </button>
              {planks.length > 0 && (
                <button
                  onClick={plankActions.clearPlanks}
                  className="px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                >
                  Clear Planks ({planks.length})
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600">
          {isComplete
            ? `Polygon complete with ${points.length} points`
            : `Click to add points (${points.length} added)${
                isAngleSnapActive || isGridSnapActive
                  ? ` - ${[
                      isAngleSnapActive && "Angle snap",
                      isGridSnapActive && "Grid snap",
                    ]
                      .filter(Boolean)
                      .join(" + ")} active`
                  : ""
              } - Hold SPACE to pan or use middle mouse button`}
        </p>
      </div>

      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className={`w-full h-full border ${
            isPanning
              ? "cursor-grabbing"
              : isSpacePressed
                ? "cursor-grab"
                : "cursor-crosshair"
          }`}
          onClick={handleSVGClick}
          onMouseDown={handleSVGMouseDown}
          onMouseMove={handleSVGMouseMove}
          onMouseUp={handleSVGMouseUp}
          style={{ minHeight: "500px" }}
        >
          {/* Grid Pattern */}
          {gridSnapEnabled && (
            <defs>
              <pattern
                id="grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
          )}

          {/* Content with zoom/pan transform */}
          <g transform={zoomTransform}>
            {/* Grid Background */}
            {gridSnapEnabled && (
              <rect
                x="-1000"
                y="-1000"
                width="2000"
                height="2000"
                fill="url(#grid)"
              />
            )}
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="2"
              />
            ))}

            {points.length > 0 && (
              <path
                d={polygonPath}
                fill={isComplete ? "rgba(59, 130, 246, 0.2)" : "none"}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray={isComplete ? "none" : "5,5"}
              />
            )}

            {/* Edge Labels */}
            {points.length >= 2 &&
              edgeLengths.map((edge, index) => {
                const midX = (edge.from.x + edge.to.x) / 2;
                const midY = (edge.from.y + edge.to.y) / 2;
                const dx = edge.to.x - edge.from.x;
                const dy = edge.to.y - edge.from.y;
                const angle = Math.atan2(dy, dx);
                let textAngle = (angle * 180) / Math.PI;

                // Keep text readable by flipping it if it's upside down
                if (textAngle > 90 || textAngle < -90) {
                  textAngle += 180;
                }

                return (
                  <text
                    key={`edge-${index}`}
                    x={midX}
                    y={midY}
                    fontSize="10"
                    fill="#374151"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textAngle} ${midX} ${midY})`}
                    className="select-none pointer-events-none"
                  >
                    {unitUtils.formatMm(edge.lengthMm)}
                  </text>
                );
              })}

            {/* Placed Planks */}
            {planks.map((plank) => {
              const pixelLength = plankActions.mmToPixels(plank.length);
              const pixelWidth = plankActions.mmToPixels(plank.width);
              
              return (
                <rect
                  key={plank.id}
                  x={plank.x - pixelLength / 2}
                  y={plank.y - pixelWidth / 2}
                  width={pixelLength}
                  height={pixelWidth}
                  fill="rgba(139, 69, 19, 0.7)"
                  stroke="#8B4513"
                  strokeWidth="1"
                  transform={`rotate(${plank.rotation} ${plank.x} ${plank.y})`}
                  className="select-none"
                />
              );
            })}

            {/* Preview Plank */}
            {previewPlank && (
              <rect
                x={previewPlank.x - plankActions.mmToPixels(previewPlank.length) / 2}
                y={previewPlank.y - plankActions.mmToPixels(previewPlank.width) / 2}
                width={plankActions.mmToPixels(previewPlank.length)}
                height={plankActions.mmToPixels(previewPlank.width)}
                fill="rgba(139, 69, 19, 0.4)"
                stroke="#8B4513"
                strokeWidth="2"
                strokeDasharray="5,5"
                transform={`rotate(${previewPlank.rotation} ${previewPlank.x} ${previewPlank.y})`}
                className="select-none pointer-events-none"
              />
            )}

            {points.length > 0 &&
              !isComplete &&
              mousePosition &&
              (() => {
                const previewPoint = getPreviewPoint();
                const lastPoint = points[points.length - 1];
                const hasSnapping = isAngleSnapActive || isGridSnapActive;
                const snapColor =
                  isAngleSnapActive && isGridSnapActive
                    ? "#8b5cf6"
                    : isAngleSnapActive
                      ? "#10b981"
                      : isGridSnapActive
                        ? "#3b82f6"
                        : "#94a3b8";

                return (
                  <>
                    <line
                      x1={lastPoint.x}
                      y1={lastPoint.y}
                      x2={previewPoint?.x || mousePosition.x}
                      y2={previewPoint?.y || mousePosition.y}
                      stroke={snapColor}
                      strokeWidth={hasSnapping ? "3" : "1"}
                      strokeDasharray="3,3"
                    />
                    {previewPoint && (
                      <circle
                        cx={previewPoint.x}
                        cy={previewPoint.y}
                        r="3"
                        fill={snapColor}
                        opacity="0.7"
                      />
                    )}
                  </>
                );
              })()}

            {points.length > 0 && !isComplete && (
              <text
                x={points[0].x}
                y={points[0].y - 10}
                fontSize="12"
                fill="#666"
                textAnchor="middle"
              >
                Click here to close
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
