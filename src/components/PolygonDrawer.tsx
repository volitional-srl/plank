"use client";

import { useEffect } from "react";
import { useStore } from "@nanostores/react";

// Store imports
import { $points, $isComplete, $mousePosition, $polygonPathClosed, $edgeLengths, polygonActions } from "../stores/polygonStore";
import { $planks, $previewPlank, $isPlacingPlank, $gaps, plankActions } from "../stores/plankStore";
import { $isAngleSnapActive, $isGridSnapActive, gridActions } from "../stores/gridStore";
import type { Point } from "../lib/geometry";

// Component imports
import DrawingToolbar from "./DrawingToolbar";
import MeasurementsPanel from "./MeasurementsPanel";
import PlankConfigPanel from "./PlankConfigPanel";
import DrawingCanvas from "./DrawingCanvas";
import PolygonRenderer from "./PolygonRenderer";
import PlankRenderer from "./PlankRenderer";
import StatusDisplay from "./StatusDisplay";

export default function PolygonDrawer() {
  const points = useStore($points);
  const isComplete = useStore($isComplete);
  const mousePosition = useStore($mousePosition);
  const isAngleSnapActive = useStore($isAngleSnapActive);
  const isGridSnapActive = useStore($isGridSnapActive);
  const polygonPath = useStore($polygonPathClosed);
  const edgeLengths = useStore($edgeLengths);
  const planks = useStore($planks);
  const gaps = useStore($gaps);
  const isPlacingPlank = useStore($isPlacingPlank);
  const previewPlank = useStore($previewPlank);

  // Handle tessellation when first plank is placed
  useEffect(() => {
    if (planks.length === 1 && isComplete && points.length >= 3) {
      plankActions.generateTessellation(planks[0], points);
    }
  }, [planks, isComplete, points]);

  const handleMouseMove = (canvasPoint: Point) => {
    // Handle plank placement preview
    if (isPlacingPlank) {
      plankActions.setPreviewPlank(canvasPoint, 0);
      return;
    }

    // Handle normal drawing mouse movement
    if (!isComplete) {
      polygonActions.setMousePosition(canvasPoint);
    }
  };

  const getPreviewPoint = (): Point | null => {
    if (!mousePosition) return mousePosition;

    const previousPoint = points.length > 0 ? points[points.length - 1] : undefined;
    return gridActions.applySnapping(
      mousePosition.x,
      mousePosition.y,
      previousPoint,
    );
  };

  const handleCanvasClick = (canvasPoint: Point) => {
    // Handle plank placement if in placing mode
    if (isPlacingPlank) {
      plankActions.placePlank(canvasPoint, 0);
      return;
    }

    // Handle polygon drawing if not complete
    if (!isComplete) {
      const previousPoint = points.length > 0 ? points[points.length - 1] : undefined;
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

        <DrawingToolbar />

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

        <MeasurementsPanel />
        <PlankConfigPanel />
        <StatusDisplay />
      </div>

      <div className="flex-1 relative">
        <DrawingCanvas 
          onMouseMove={handleMouseMove} 
          onCanvasClick={handleCanvasClick}
        >
          <PolygonRenderer
            points={points}
            polygonPath={polygonPath}
            isComplete={isComplete}
            edgeLengths={edgeLengths}
            mousePosition={mousePosition}
            previewPoint={getPreviewPoint()}
            isAngleSnapActive={isAngleSnapActive}
            isGridSnapActive={isGridSnapActive}
          />
          <PlankRenderer
            planks={planks}
            gaps={gaps}
            previewPlank={previewPlank}
          />
        </DrawingCanvas>
      </div>
    </div>
  );
}
