import type { Point } from "./geometry";

// Convert screen coordinates to canvas coordinates with zoom/pan support
export const screenToCanvas = (
  screenX: number,
  screenY: number,
  zoomTransform: string,
): Point => {
  // Parse the transform string (e.g., "translate(50, 30) scale(1.2)")
  const translateMatch = zoomTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  const scaleMatch = zoomTransform.match(/scale\(([^)]+)\)/);
  
  const translateX = translateMatch ? parseFloat(translateMatch[1]) : 0;
  const translateY = translateMatch ? parseFloat(translateMatch[2]) : 0;
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
  
  return {
    x: (screenX - translateX) / scale,
    y: (screenY - translateY) / scale,
  };
};

// Calculate text rotation angle for edge labels
export const calculateTextAngle = (from: Point, to: Point): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  let textAngle = (angle * 180) / Math.PI;

  // Keep text readable by flipping it if it's upside down
  if (textAngle > 90 || textAngle < -90) {
    textAngle += 180;
  }

  return textAngle;
};

// Get midpoint between two points
export const getMidpoint = (from: Point, to: Point): Point => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2,
});