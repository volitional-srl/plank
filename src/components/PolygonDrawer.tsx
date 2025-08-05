'use client';

import { useState, useRef, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

export default function PolygonDrawer() {
  const [points, setPoints] = useState<Point[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSVGClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (isComplete) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newPoint = { x, y };
    setPoints(prev => [...prev, newPoint]);
  };

  const completePolygon = () => {
    if (points.length >= 3) {
      setIsComplete(true);
    }
  };

  const clearPolygon = () => {
    setPoints([]);
    setIsComplete(false);
  };

  const getPolygonPath = () => {
    if (points.length === 0) return '';
    
    const pathData = points.map((point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
    }).join(' ');
    
    return isComplete ? `${pathData} Z` : pathData;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-xl font-semibold mb-2">Draw Your Surface</h2>
        <div className="flex gap-2">
          <button
            onClick={completePolygon}
            disabled={points.length < 3}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Complete Polygon
          </button>
          <button
            onClick={clearPolygon}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Clear
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {isComplete 
            ? `Polygon complete with ${points.length} points`
            : `Click to add points (${points.length} added)`
          }
        </p>
      </div>
      
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full border cursor-crosshair"
          onClick={handleSVGClick}
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
              d={getPolygonPath()}
              fill={isComplete ? "rgba(59, 130, 246, 0.2)" : "none"}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray={isComplete ? "none" : "5,5"}
            />
          )}
          
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