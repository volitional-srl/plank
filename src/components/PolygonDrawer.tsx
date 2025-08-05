'use client';

import { useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $points,
  $isComplete,
  $angleSnapEnabled,
  $gridSnapEnabled,
  $isShiftPressed,
  $mousePosition,
  $isAngleSnapActive,
  $isGridSnapActive,
  $polygonPathClosed,
  $polygonArea,
  $polygonPerimeter,
  $edgeLengths,
  polygonActions,
  unitUtils,
  Point
} from '../stores/polygonStore';

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
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        polygonActions.setShiftPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        polygonActions.setShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSVGMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isComplete) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    polygonActions.setMousePosition({ x, y });
  };

  const getPreviewPoint = (): Point | null => {
    if (!mousePosition) return mousePosition;
    
    const previousPoint = points.length > 0 ? points[points.length - 1] : undefined;
    return polygonActions.applySnapping(mousePosition.x, mousePosition.y, previousPoint);
  };

  const handleSVGClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isComplete) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    const previousPoint = points.length > 0 ? points[points.length - 1] : undefined;
    const newPoint = polygonActions.applySnapping(rawX, rawY, previousPoint);

    polygonActions.addPoint(newPoint);
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
                onClick={polygonActions.toggleAngleSnap}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  angleSnapEnabled 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${angleSnapEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                Angle Snap
              </button>
              <span className="text-xs text-gray-500">
                {angleSnapEnabled ? 'ON' : 'OFF'} {isShiftPressed && '(SHIFT held)'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={polygonActions.toggleGridSnap}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  gridSnapEnabled 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                <div className={`w-3 h-3 rounded-sm ${gridSnapEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                Grid Snap
              </button>
              <span className="text-xs text-gray-500">
                {gridSnapEnabled ? '1000mm' : 'OFF'}
              </span>
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
                  <span className="font-medium">Perimeter:</span> {unitUtils.formatMm(polygonPerimeter)}
                </div>
              )}
              {isComplete && polygonArea > 0 && (
                <div className="text-gray-600">
                  <span className="font-medium">Area:</span> {unitUtils.formatArea(polygonArea)}
                </div>
              )}
            </div>
          </div>
        )}
        
        <p className="text-sm text-gray-600">
          {isComplete 
            ? `Polygon complete with ${points.length} points`
            : `Click to add points (${points.length} added)${
                isAngleSnapActive || isGridSnapActive 
                  ? ` - ${[
                      isAngleSnapActive && 'Angle snap',
                      isGridSnapActive && 'Grid snap'
                    ].filter(Boolean).join(' + ')} active`
                  : ''
              }`
          }
        </p>
      </div>
      
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full border cursor-crosshair"
          onClick={handleSVGClick}
          onMouseMove={handleSVGMouseMove}
          style={{ minHeight: '500px' }}
        >
          {/* Grid Pattern */}
          {gridSnapEnabled && (
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
              </pattern>
            </defs>
          )}
          
          {/* Grid Background */}
          {gridSnapEnabled && (
            <rect width="100%" height="100%" fill="url(#grid)" />
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
          {points.length >= 2 && edgeLengths.map((edge, index) => {
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

          {points.length > 0 && !isComplete && mousePosition && (() => {
            const previewPoint = getPreviewPoint();
            const lastPoint = points[points.length - 1];
            const hasSnapping = isAngleSnapActive || isGridSnapActive;
            const snapColor = isAngleSnapActive && isGridSnapActive ? "#8b5cf6" : 
                             isAngleSnapActive ? "#10b981" : 
                             isGridSnapActive ? "#3b82f6" : "#94a3b8";
            
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
        </svg>
      </div>
    </div>
  );
}