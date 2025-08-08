"use client";

import type { Point } from "../lib/geometry";
import { calculateTextAngle, getMidpoint } from "../lib/coordinates";
import { getSnapIndicatorColor } from "../lib/plankRendering";
import { unitUtils } from "../stores/polygonStore";

interface EdgeLength {
  from: Point;
  to: Point;
  lengthMm: number;
}

interface PolygonRendererProps {
  points: Point[];
  polygonPath: string;
  isComplete: boolean;
  edgeLengths: EdgeLength[];
  mousePosition: Point | null;
  previewPoint: Point | null;
  isAngleSnapActive: boolean;
  isGridSnapActive: boolean;
}

export default function PolygonRenderer({
  points,
  polygonPath,
  isComplete,
  edgeLengths,
  mousePosition,
  previewPoint,
  isAngleSnapActive,
  isGridSnapActive,
}: PolygonRendererProps) {
  return (
    <>
      {/* Polygon Points */}
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

      {/* Polygon Path */}
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
          const midpoint = getMidpoint(edge.from, edge.to);
          const textAngle = calculateTextAngle(edge.from, edge.to);

          return (
            <text
              key={`edge-${index}`}
              x={midpoint.x}
              y={midpoint.y}
              fontSize="10"
              fill="#374151"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${textAngle} ${midpoint.x} ${midpoint.y})`}
              className="select-none pointer-events-none"
            >
              {unitUtils.formatMm(edge.lengthMm)}
            </text>
          );
        })}

      {/* Preview Line and Point */}
      {points.length > 0 &&
        !isComplete &&
        mousePosition &&
        (() => {
          const lastPoint = points[points.length - 1];
          const hasSnapping = isAngleSnapActive || isGridSnapActive;
          const snapColor = getSnapIndicatorColor(isAngleSnapActive, isGridSnapActive);

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

      {/* Completion Hint */}
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
    </>
  );
}