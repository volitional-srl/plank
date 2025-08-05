'use client';

import { useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $points,
  $isComplete,
  $angleSnapEnabled,
  $isShiftPressed,
  $mousePosition,
  $isAngleSnapActive,
  $polygonPathClosed,
  polygonActions,
  Point
} from '../stores/polygonStore';

export default function PolygonDrawer() {
  const points = useStore($points);
  const isComplete = useStore($isComplete);
  const angleSnapEnabled = useStore($angleSnapEnabled);
  const isShiftPressed = useStore($isShiftPressed);
  const mousePosition = useStore($mousePosition);
  const isAngleSnapActive = useStore($isAngleSnapActive);
  const polygonPath = useStore($polygonPathClosed);
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
    if (!mousePosition || points.length === 0) return mousePosition;
    
    if (isAngleSnapActive) {
      const lastPoint = points[points.length - 1];
      return polygonActions.snapToAngle(mousePosition.x, mousePosition.y, lastPoint);
    }
    
    return mousePosition;
  };

  const handleSVGClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isComplete) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    let newPoint = { x: rawX, y: rawY };

    if (isAngleSnapActive && points.length > 0) {
      const lastPoint = points[points.length - 1];
      newPoint = polygonActions.snapToAngle(rawX, rawY, lastPoint);
    }

    polygonActions.addPoint(newPoint);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-xl font-semibold mb-3">Draw Your Surface</h2>
        
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-3 p-2 bg-white rounded-lg border">
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
        
        <p className="text-sm text-gray-600">
          {isComplete 
            ? `Polygon complete with ${points.length} points`
            : `Click to add points (${points.length} added)${isAngleSnapActive ? ' - Angle snapping active' : ''}`
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

          {points.length > 0 && !isComplete && mousePosition && (() => {
            const previewPoint = getPreviewPoint();
            const lastPoint = points[points.length - 1];
            
            return (
              <>
                <line
                  x1={lastPoint.x}
                  y1={lastPoint.y}
                  x2={previewPoint?.x || mousePosition.x}
                  y2={previewPoint?.y || mousePosition.y}
                  stroke={isAngleSnapActive ? "#10b981" : "#94a3b8"}
                  strokeWidth={isAngleSnapActive ? "3" : "1"}
                  strokeDasharray="3,3"
                />
                {previewPoint && (
                  <circle
                    cx={previewPoint.x}
                    cy={previewPoint.y}
                    r="3"
                    fill={isAngleSnapActive ? "#10b981" : "#94a3b8"}
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