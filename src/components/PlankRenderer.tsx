"use client";

import type { Plank } from "../lib/plank";
import type { Gap } from "../stores/plankStore";
import {
  analyzePlankForRendering,
  plankShapeToWorldCoordinates,
  pointsToSVGPath,
  getPlankPixelDimensions,
} from "../lib/plankRendering";
import { mmToPixels } from "../lib/geometry";

interface PlankRendererProps {
  planks: Plank[];
  gaps: Gap[];
  previewPlank: Plank | null;
}

export default function PlankRenderer({ planks, gaps, previewPlank }: PlankRendererProps) {

  return (
    <>
      {/* Placed Planks */}
      {planks.map((plank) => {
        const renderInfo = analyzePlankForRendering(plank);

        if (renderInfo.isArbitraryShape) {
          const worldPoints = plankShapeToWorldCoordinates(plank);
          const pathData = pointsToSVGPath(worldPoints);

          return (
            <g key={plank.id} id={plank.id}>
              <path
                d={pathData}
                fill={renderInfo.fillColor}
                stroke={renderInfo.strokeColor}
                strokeWidth="1"
                className="select-none cursor-pointer"
              >
                <title>{plank.id}</title>
              </path>
              {/* Render cut lines for multi-line cuts */}
              {renderInfo.isMultiLineCut &&
                plank.cutLines &&
                plank.cutLines.map((cutLine, lineIndex) => (
                  <line
                    key={`cutline-${lineIndex}`}
                    x1={cutLine[0].x}
                    y1={cutLine[0].y}
                    x2={cutLine[1].x}
                    y2={cutLine[1].y}
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeDasharray="3,2"
                    className="select-none"
                  />
                ))}
            </g>
          );
        } else {
          const { length: pixelLength, width: pixelWidth } = getPlankPixelDimensions(plank);

          return (
            <rect
              id={plank.id}
              key={plank.id}
              x={plank.x - pixelLength / 2}
              y={plank.y - pixelWidth / 2}
              width={pixelLength}
              height={pixelWidth}
              fill={renderInfo.fillColor}
              stroke={renderInfo.strokeColor}
              strokeWidth="1"
              transform={`rotate(${plank.rotation} ${plank.x} ${plank.y})`}
              className="select-none cursor-pointer"
            >
              <title>{plank.id}</title>
            </rect>
          );
        }
      })}

      {/* Gap Indicators */}
      {gaps.map((gap, index) => {
        if (gap.isArbitraryShape && gap.shape) {
          const pathData = pointsToSVGPath(gap.shape);

          return (
            <path
              key={`gap-${index}`}
              d={pathData}
              fill="rgba(239, 68, 68, 0.3)"
              stroke="#EF4444"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="select-none"
            />
          );
        } else {
          const pixelLength = mmToPixels(gap.requiredLength);
          const pixelWidth = mmToPixels(gap.width);

          return (
            <rect
              key={`gap-${index}`}
              x={gap.x - pixelLength / 2}
              y={gap.y - pixelWidth / 2}
              width={pixelLength}
              height={pixelWidth}
              fill="rgba(239, 68, 68, 0.3)"
              stroke="#EF4444"
              strokeWidth="2"
              strokeDasharray="5,5"
              transform={`rotate(${gap.rotation} ${gap.x} ${gap.y})`}
              className="select-none"
            />
          );
        }
      })}

      {/* Preview Plank */}
      {previewPlank && (
        <rect
          x={previewPlank.x - mmToPixels(previewPlank.length) / 2}
          y={previewPlank.y - mmToPixels(previewPlank.width) / 2}
          width={mmToPixels(previewPlank.length)}
          height={mmToPixels(previewPlank.width)}
          fill="rgba(139, 69, 19, 0.4)"
          stroke="#8B4513"
          strokeWidth="2"
          strokeDasharray="5,5"
          transform={`rotate(${previewPlank.rotation} ${previewPlank.x} ${previewPlank.y})`}
          className="select-none pointer-events-none"
        />
      )}
    </>
  );
}