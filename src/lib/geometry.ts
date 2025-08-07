export interface Point {
  x: number;
  y: number;
}

const MM_TO_PIXELS = 1 / 10;

export const mmToPixels = (mm: number): number => mm * MM_TO_PIXELS;
export const pixelsToMm = (pixels: number): number => pixels / MM_TO_PIXELS;

// Sutherland-Hodgman polygon clipping algorithm
export const clipPolygonByPolygon = (
  subjectPolygon: Point[],
  clipPolygon: Point[],
): Point[] => {
  if (subjectPolygon.length === 0 || clipPolygon.length === 0) return [];

  let outputList = [...subjectPolygon];

  for (let i = 0; i < clipPolygon.length; i++) {
    const clipVertex1 = clipPolygon[i];
    const clipVertex2 = clipPolygon[(i + 1) % clipPolygon.length];

    const inputList = outputList;
    outputList = [];

    if (inputList.length === 0) break;

    let s = inputList[inputList.length - 1];

    for (const e of inputList) {
      if (isInsideEdge(e, clipVertex1, clipVertex2)) {
        if (!isInsideEdge(s, clipVertex1, clipVertex2)) {
          const intersection = computeIntersection(
            s,
            e,
            clipVertex1,
            clipVertex2,
          );
          if (intersection) outputList.push(intersection);
        }
        outputList.push(e);
      } else if (isInsideEdge(s, clipVertex1, clipVertex2)) {
        const intersection = computeIntersection(
          s,
          e,
          clipVertex1,
          clipVertex2,
        );
        if (intersection) outputList.push(intersection);
      }
      s = e;
    }
  }

  return outputList;
};

// Check if point is inside the edge (left side of directed line)
export const isInsideEdge = (
  point: Point,
  edgeStart: Point,
  edgeEnd: Point,
): boolean => {
  return (
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
      (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >=
    0
  );
};

// Compute intersection of two line segments
export const computeIntersection = (
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): Point | null => {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-10) return null;

  const t =
    ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
};

// Calculate polygon area (for checking if shape is valid)
export const calculatePolygonArea = (points: Point[]): number => {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};

// Check if a point is inside a polygon using ray casting algorithm
export const isPointInPolygon = (
  point: Point,
  polygonPoints: Point[],
): boolean => {
  if (polygonPoints.length < 3) return false;

  let inside = false;
  for (
    let i = 0, j = polygonPoints.length - 1;
    i < polygonPoints.length;
    j = i++
  ) {
    const xi = polygonPoints[i].x;
    const yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x;
    const yj = polygonPoints[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// Check if a point lies on the polygon boundary
export const isPointOnPolygonBoundary = (
  point: Point,
  polygonPoints: Point[],
  tolerance: number = 1,
): boolean => {
  for (let i = 0; i < polygonPoints.length; i++) {
    const j = (i + 1) % polygonPoints.length;
    const p1 = polygonPoints[i];
    const p2 = polygonPoints[j];

    const distance = distanceFromPointToLineSegment(point, p1, p2);
    if (distance <= tolerance) {
      return true;
    }
  }
  return false;
};

// Calculate distance from point to line segment
export const distanceFromPointToLineSegment = (
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number => {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    return Math.sqrt(A * A + B * B);
  }

  const param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

// Line intersection helper
export const lineIntersection = (
  { x: x1, y: y1 }: Point,
  { x: x2, y: y2 }: Point,
  { x: x3, y: y3 }: Point,
  { x: x4, y: y4 }: Point,
): Point | null => {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
};

// Check if two lines intersect using Separating Axis Theorem
// Returns true only for actual overlaps, not just edge-touching
export const doLinesIntersect = (
  point1: Point,
  point2: Point,
  point3: Point,
  point4: Point,
): boolean => {
  return lineIntersection(point1, point2, point3, point4) !== null;
};

// Check if two rectangles intersect using Separating Axis Theorem
// Returns true only for actual overlaps, not just edge-touching
export const doRectanglesIntersect = (
  cornersA: Point[],
  cornersB: Point[],
): boolean => {
  const axes = [
    { x: cornersA[1].x - cornersA[0].x, y: cornersA[1].y - cornersA[0].y },
    { x: cornersA[2].x - cornersA[1].x, y: cornersA[2].y - cornersA[1].y },
    { x: cornersB[1].x - cornersB[0].x, y: cornersB[1].y - cornersB[0].y },
    { x: cornersB[2].x - cornersB[1].x, y: cornersB[2].y - cornersB[1].y },
  ];

  for (const axis of axes) {
    const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    if (length === 0) continue;

    const normalizedAxis = { x: axis.x / length, y: axis.y / length };

    const projA = cornersA.map(
      (corner) => corner.x * normalizedAxis.x + corner.y * normalizedAxis.y,
    );
    const projB = cornersB.map(
      (corner) => corner.x * normalizedAxis.x + corner.y * normalizedAxis.y,
    );

    const minA = Math.min(...projA);
    const maxA = Math.max(...projA);
    const minB = Math.min(...projB);
    const maxB = Math.max(...projB);

    const tolerance = 0.1;

    if (maxA <= minB + tolerance || maxB <= minA + tolerance) {
      return false;
    }
  }

  return true;
};

// Check if a point is inside a rectangle
export const isPointInRectangle = (
  point: Point,
  rectangle: Point[],
): boolean => {
  let inside = false;
  for (let i = 0, j = rectangle.length - 1; i < rectangle.length; j = i++) {
    const xi = rectangle[i].x;
    const yi = rectangle[i].y;
    const xj = rectangle[j].x;
    const yj = rectangle[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};
