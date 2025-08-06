import { atom, computed } from "nanostores";

export interface Point {
  x: number;
  y: number;
}

export interface PlankDimensions {
  length: number; // in mm
  width: number;  // in mm
}

export interface Plank {
  id: string;
  x: number;      // position in canvas coordinates
  y: number;
  rotation: number; // rotation in degrees
  length: number;   // in mm
  width: number;    // in mm
  isSpare?: boolean; // true if this is a cut spare piece
  originalLength?: number; // original length before cutting (for spares)
  shape?: Point[]; // custom shape points if cut to arbitrary shape (relative to center)
  isArbitraryShape?: boolean; // true if cut into non-rectangular shape
}

export interface Gap {
  x: number;
  y: number;
  rotation: number;
  requiredLength: number; // length needed to fill the gap
  width: number;
  shape?: Point[]; // arbitrary gap shape if not rectangular
  isArbitraryShape?: boolean; // true if gap has complex shape
}

// Default plank size: 1500mm x 240mm
export const DEFAULT_PLANK_LENGTH = 1500;
export const DEFAULT_PLANK_WIDTH = 240;

// Plank state atoms
export const $plankDimensions = atom<PlankDimensions>({
  length: DEFAULT_PLANK_LENGTH,
  width: DEFAULT_PLANK_WIDTH,
});

export const $planks = atom<Plank[]>([]);
export const $spares = atom<Plank[]>([]);
export const $gaps = atom<Gap[]>([]);
export const $isPlacingPlank = atom<boolean>(false);
export const $previewPlank = atom<Plank | null>(null);

// Computed values
export const $plankCount = computed($planks, (planks) => planks.length);

// Helper function to convert mm to pixels (using same conversion as polygon store)
const MM_TO_PIXELS = 1 / 10; // 1px = 10mm

export const plankActions = {
  // Plank dimension management
  setPlankDimensions: (dimensions: PlankDimensions) => {
    $plankDimensions.set(dimensions);
  },

  setPlankLength: (length: number) => {
    const current = $plankDimensions.get();
    $plankDimensions.set({ ...current, length });
  },

  setPlankWidth: (width: number) => {
    const current = $plankDimensions.get();
    $plankDimensions.set({ ...current, width });
  },

  // Plank placement
  startPlacingPlank: () => {
    $isPlacingPlank.set(true);
  },

  stopPlacingPlank: () => {
    $isPlacingPlank.set(false);
    $previewPlank.set(null);
  },

  // Preview plank for placement
  setPreviewPlank: (position: Point, rotation: number = 0) => {
    const dimensions = $plankDimensions.get();
    const plank: Plank = {
      id: `preview-${Date.now()}`,
      x: position.x,
      y: position.y,
      rotation,
      length: dimensions.length,
      width: dimensions.width,
    };
    $previewPlank.set(plank);
  },

  // Place a plank (confirm preview plank)
  placePlank: (position: Point, rotation: number = 0) => {
    const dimensions = $plankDimensions.get();
    const plank: Plank = {
      id: `plank-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: position.x,
      y: position.y,
      rotation,
      length: dimensions.length,
      width: dimensions.width,
    };
    
    const currentPlanks = $planks.get();
    $planks.set([...currentPlanks, plank]);
    $isPlacingPlank.set(false);
    $previewPlank.set(null);

    // Tessellation will be triggered from the component after first plank placement
  },

  // Remove all planks
  clearPlanks: () => {
    $planks.set([]);
    $spares.set([]);
    $gaps.set([]);
    $isPlacingPlank.set(false);
    $previewPlank.set(null);
  },

  // Convert plank dimensions from mm to pixels for rendering
  getPlankPixelDimensions: () => {
    const dimensions = $plankDimensions.get();
    return {
      length: dimensions.length * MM_TO_PIXELS,
      width: dimensions.width * MM_TO_PIXELS,
    };
  },

  // Convert individual measurements
  mmToPixels: (mm: number): number => mm * MM_TO_PIXELS,
  pixelsToMm: (pixels: number): number => pixels / MM_TO_PIXELS,

  // Sutherland-Hodgman polygon clipping algorithm
  clipPolygonByPolygon: (subjectPolygon: Point[], clipPolygon: Point[]): Point[] => {
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
        if (plankActions.isInsideEdge(e, clipVertex1, clipVertex2)) {
          if (!plankActions.isInsideEdge(s, clipVertex1, clipVertex2)) {
            const intersection = plankActions.computeIntersection(s, e, clipVertex1, clipVertex2);
            if (intersection) outputList.push(intersection);
          }
          outputList.push(e);
        } else if (plankActions.isInsideEdge(s, clipVertex1, clipVertex2)) {
          const intersection = plankActions.computeIntersection(s, e, clipVertex1, clipVertex2);
          if (intersection) outputList.push(intersection);
        }
        s = e;
      }
    }
    
    return outputList;
  },

  // Check if point is inside the edge (left side of directed line)
  isInsideEdge: (point: Point, edgeStart: Point, edgeEnd: Point): boolean => {
    return ((edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - 
            (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)) >= 0;
  },

  // Compute intersection of two line segments
  computeIntersection: (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-10) return null;
    
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  },

  // Calculate polygon area (for checking if shape is valid)
  calculatePolygonArea: (points: Point[]): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  },

  // Get rectangle corners as polygon
  getRectangleCorners: (plank: Plank): Point[] => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    const halfLength = lengthPx / 2;
    const halfWidth = widthPx / 2;
    
    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return [
      {
        x: plank.x + (-halfLength * cos - -halfWidth * sin),
        y: plank.y + (-halfLength * sin + -halfWidth * cos)
      },
      {
        x: plank.x + (halfLength * cos - -halfWidth * sin),
        y: plank.y + (halfLength * sin + -halfWidth * cos)
      },
      {
        x: plank.x + (halfLength * cos - halfWidth * sin),
        y: plank.y + (halfLength * sin + halfWidth * cos)
      },
      {
        x: plank.x + (-halfLength * cos - halfWidth * sin),
        y: plank.y + (-halfLength * sin + halfWidth * cos)
      }
    ];
  },

  // Check if a point is inside a polygon using ray casting algorithm
  isPointInPolygon: (point: Point, polygonPoints: Point[]): boolean => {
    if (polygonPoints.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].x;
      const yi = polygonPoints[i].y;
      const xj = polygonPoints[j].x;
      const yj = polygonPoints[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  },

  // Check if a plank (as rectangle or arbitrary shape) is fully inside the polygon
  isPlankInPolygon: (plank: Plank, polygonPoints: Point[]): boolean => {
    let corners: Point[];
    
    if (plank.isArbitraryShape && plank.shape) {
      // Transform shape points to world coordinates
      const rad = (plank.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      corners = plank.shape.map(point => ({
        x: plank.x + (point.x * cos - point.y * sin),
        y: plank.y + (point.x * sin + point.y * cos)
      }));
    } else {
      // Use rectangle corners
      corners = plankActions.getRectangleCorners(plank);
    }
    
    // All corners must be inside the polygon
    return corners.every(corner => 
      plankActions.isPointInPolygon(corner, polygonPoints)
    );
  },

  // Try to fit a plank by cutting it to an arbitrary shape
  fitPlankByShapeCutting: (plank: Plank, polygonPoints: Point[]): Plank | null => {
    // Get the plank's rectangle corners
    const plankCorners = plankActions.getRectangleCorners(plank);
    
    // Check if any part of the plank is actually inside the polygon
    const insideCorners = plankCorners.filter(corner => 
      plankActions.isPointInPolygon(corner, polygonPoints)
    );
    
    // If no corners are inside, this plank shouldn't be placed at all
    if (insideCorners.length === 0) return null;
    
    // Clip the plank rectangle against the room polygon
    const clippedShape = plankActions.clipPolygonByPolygon(plankCorners, polygonPoints);
    
    if (clippedShape.length < 3) return null; // Not enough area
    
    const clippedArea = plankActions.calculatePolygonArea(clippedShape);
    const originalArea = plank.length * plank.width * (MM_TO_PIXELS * MM_TO_PIXELS);
    
    // Only accept if we retain at least 30% of the original area and it's meaningful size
    if (clippedArea < originalArea * 0.3 || clippedArea < 2500) return null; // 2500 px² ≈ 25cm²
    
    // Verify all clipped shape points are actually inside the polygon
    const allPointsInside = clippedShape.every(point => 
      plankActions.isPointInPolygon(point, polygonPoints)
    );
    
    if (!allPointsInside) return null; // Shape extends outside polygon
    
    // Convert clipped shape to relative coordinates (relative to plank center)
    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const relativeShape = clippedShape.map(point => ({
      x: (point.x - plank.x) * cos + (point.y - plank.y) * sin,
      y: -(point.x - plank.x) * sin + (point.y - plank.y) * cos
    }));
    
    return {
      ...plank,
      id: `${plank.id}-shaped`,
      isArbitraryShape: true,
      shape: relativeShape,
      isSpare: plank.isSpare,
      originalLength: plank.originalLength || plank.length,
    };
  },

  // Create a spare from the unused part of a plank (simplified for arbitrary shapes)
  createSpareFromCut: (originalPlank: Plank, fittedPlank: Plank): Plank | null => {
    if (!fittedPlank.isArbitraryShape || !fittedPlank.shape) return null;
    
    const originalArea = originalPlank.length * originalPlank.width;
    const fittedArea = plankActions.calculatePolygonArea(fittedPlank.shape) * (plankActions.pixelsToMm(1) ** 2);
    const spareArea = originalArea - fittedArea;
    
    // Create a simplified spare (as a rectangle for now)
    // In reality, this would be more complex shape analysis
    if (spareArea < 50 * 50) return null; // Minimum 50mm x 50mm spare
    
    const spareLength = Math.sqrt(spareArea);
    const spareWidth = Math.min(originalPlank.width, spareLength);
    
    return {
      ...originalPlank,
      id: `${originalPlank.id}-spare-${Date.now()}`,
      length: spareLength,
      width: spareWidth,
      isSpare: true,
      originalLength: originalPlank.originalLength || originalPlank.length,
    };
  },

  // Try to perform a clean linear cut along plank length
  tryLinearCut: (plank: Plank, polygonPoints: Point[]): { fitted: Plank, spare?: Plank } | null => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    
    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Check if we can make a clean cut along the plank length direction
    // Cast rays from both width edges of the plank along its length
    const halfWidth = widthPx / 2;
    const edges = [
      { // Top edge
        startX: plank.x - (lengthPx / 2) * cos - halfWidth * sin,
        startY: plank.y - (lengthPx / 2) * sin + halfWidth * cos,
        dirX: cos,
        dirY: sin
      },
      { // Bottom edge
        startX: plank.x - (lengthPx / 2) * cos + halfWidth * sin,
        startY: plank.y - (lengthPx / 2) * sin - halfWidth * cos,
        dirX: cos,
        dirY: sin
      }
    ];
    
    let minIntersectionDistance = lengthPx;
    let hasIntersection = false;
    
    for (const edge of edges) {
      // Cast ray along plank length
      for (let i = 0; i < polygonPoints.length; i++) {
        const j = (i + 1) % polygonPoints.length;
        const p1 = polygonPoints[i];
        const p2 = polygonPoints[j];
        
        const intersection = plankActions.lineIntersection(
          edge.startX, edge.startY,
          edge.startX + lengthPx * edge.dirX, edge.startY + lengthPx * edge.dirY,
          p1.x, p1.y, p2.x, p2.y
        );
        
        if (intersection) {
          const distance = Math.sqrt(
            (intersection.x - edge.startX) ** 2 + (intersection.y - edge.startY) ** 2
          );
          if (distance > 50 && distance < minIntersectionDistance) { // Minimum 50px = 500mm
            minIntersectionDistance = distance;
            hasIntersection = true;
          }
        }
      }
    }
    
    if (!hasIntersection || minIntersectionDistance >= lengthPx * 0.95) {
      return null; // No clean cut possible or cut would be too small
    }
    
    // Check if this is truly an orthogonal cut by seeing if both edges hit at similar distances
    const cutLengthMm = minIntersectionDistance * plankActions.pixelsToMm(1);
    
    // Verify the cut plank would fit inside the polygon
    const testCutPlank: Plank = {
      ...plank,
      length: cutLengthMm,
      x: plank.x - ((plank.length * MM_TO_PIXELS - minIntersectionDistance) / 2) * cos,
      y: plank.y - ((plank.length * MM_TO_PIXELS - minIntersectionDistance) / 2) * sin,
    };
    
    if (!plankActions.isPlankInPolygon(testCutPlank, polygonPoints)) {
      return null; // Cut plank doesn't fit cleanly
    }
    
    // Create the cut plank and spare
    const { fitted, spare } = plankActions.cutPlank(plank, cutLengthMm);
    fitted.x = testCutPlank.x;
    fitted.y = testCutPlank.y;
    
    return { fitted, spare };
  },

  // Calculate the shape of a gap that needs to be filled
  calculateGapShape: (plank: Plank, polygonPoints: Point[]): Point[] | null => {
    // This is a simplified version - in reality, gap shapes are complex
    // For now, we'll represent gaps as the intersection of the plank area that's outside the room
    const plankCorners = plankActions.getRectangleCorners(plank);
    
    // Find which corners are outside the polygon
    const outsideCorners = plankCorners.filter(corner => 
      !plankActions.isPointInPolygon(corner, polygonPoints)
    );
    
    if (outsideCorners.length === 0) return null;
    
    // For simplicity, return the outside corners as the gap shape
    // In a real implementation, this would calculate the exact boundary
    return outsideCorners.length >= 3 ? outsideCorners : null;
  },

  // Calculate intersection distance along plank length when it hits polygon edge
  calculateIntersectionDistance: (plank: Plank, polygonPoints: Point[]): number | null => {
    const lengthPx = plank.length * MM_TO_PIXELS;
    const widthPx = plank.width * MM_TO_PIXELS;
    const halfWidth = widthPx / 2;
    
    const rad = (plank.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Direction vector along plank length
    const lengthDirX = cos;
    const lengthDirY = sin;
    
    // Check both edges of the plank (top and bottom)
    const edges = [
      { // Top edge
        startX: plank.x - halfWidth * sin,
        startY: plank.y + halfWidth * cos,
      },
      { // Bottom edge  
        startX: plank.x + halfWidth * sin,
        startY: plank.y - halfWidth * cos,
      }
    ];
    
    let minIntersectionDistance = lengthPx;
    
    for (const edge of edges) {
      // Cast ray from back of plank along length direction
      const rayStartX = edge.startX - (lengthPx / 2) * lengthDirX;
      const rayStartY = edge.startY - (lengthPx / 2) * lengthDirY;
      
      // Find intersection with polygon edges
      for (let i = 0; i < polygonPoints.length; i++) {
        const j = (i + 1) % polygonPoints.length;
        const p1 = polygonPoints[i];
        const p2 = polygonPoints[j];
        
        const intersection = plankActions.lineIntersection(
          rayStartX, rayStartY,
          rayStartX + lengthPx * lengthDirX, rayStartY + lengthPx * lengthDirY,
          p1.x, p1.y, p2.x, p2.y
        );
        
        if (intersection) {
          const distance = Math.sqrt(
            (intersection.x - rayStartX) ** 2 + (intersection.y - rayStartY) ** 2
          );
          minIntersectionDistance = Math.min(minIntersectionDistance, distance);
        }
      }
    }
    
    return minIntersectionDistance < lengthPx ? minIntersectionDistance : null;
  },

  // Line intersection helper
  lineIntersection: (x1: number, y1: number, x2: number, y2: number,
                    x3: number, y3: number, x4: number, y4: number): Point | null => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }
    
    return null;
  },

  // Cut a plank into two pieces
  cutPlank: (plank: Plank, cutLengthMm: number): { fitted: Plank, spare: Plank } => {
    const fitted: Plank = {
      ...plank,
      id: `${plank.id}-fitted`,
      length: cutLengthMm,
    };
    
    const spare: Plank = {
      ...plank,
      id: `${plank.id}-spare-${Date.now()}`,
      length: plank.length - cutLengthMm,
      isSpare: true,
      originalLength: plank.originalLength || plank.length,
    };
    
    return { fitted, spare };
  },

  // Find a spare that can fit in a gap
  findSpareForGap: (gap: Gap): Plank | null => {
    const spares = $spares.get();
    
    // Find spare that is exactly the right size or larger
    for (const spare of spares) {
      if (spare.length >= gap.requiredLength && spare.width === gap.width) {
        return spare;
      }
    }
    
    return null;
  },

  // Generate tessellation with cutting and spare management
  generateTessellation: (firstPlank: Plank, polygonPoints: Point[]) => {
    if (polygonPoints.length < 3) return;
    
    const dimensions = $plankDimensions.get();
    const lengthPx = dimensions.length * MM_TO_PIXELS;
    const widthPx = dimensions.width * MM_TO_PIXELS;
    
    const newPlanks: Plank[] = [firstPlank];
    const newSpares: Plank[] = [];
    const newGaps: Gap[] = [];
    let plankId = 1;
    
    // Calculate bounding box of polygon to limit search area
    const minX = Math.min(...polygonPoints.map(p => p.x));
    const maxX = Math.max(...polygonPoints.map(p => p.x));
    const minY = Math.min(...polygonPoints.map(p => p.y));
    const maxY = Math.max(...polygonPoints.map(p => p.y));
    
    // Start from the first plank position and work outward in rows
    const startX = firstPlank.x;
    const startY = firstPlank.y;
    const rotation = firstPlank.rotation;
    
    // Convert rotation to radians
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Calculate row and column directions based on plank rotation
    const rowStepX = lengthPx * cos;
    const rowStepY = lengthPx * sin;
    const colStepX = -widthPx * sin;
    const colStepY = widthPx * cos;
    
    // Generate planks in a grid pattern
    for (let row = -20; row <= 20; row++) {
      for (let col = -20; col <= 20; col++) {
        // Skip the first plank position (already placed)
        if (row === 0 && col === 0) continue;
        
        const plankX = startX + row * rowStepX + col * colStepX;
        const plankY = startY + row * rowStepY + col * colStepY;
        
        // Skip if way outside bounding box (performance optimization)
        if (plankX < minX - lengthPx || plankX > maxX + lengthPx ||
            plankY < minY - widthPx || plankY > maxY + widthPx) {
          continue;
        }
        
        const testPlank: Plank = {
          id: `auto-${plankId++}`,
          x: plankX,
          y: plankY,
          rotation: rotation,
          length: dimensions.length,
          width: dimensions.width,
        };
        
        // Check if plank center is inside polygon - if not, skip entirely
        if (!plankActions.isPointInPolygon({x: plankX, y: plankY}, polygonPoints)) {
          continue;
        }
        
        // Check if this plank fits completely inside the polygon
        if (plankActions.isPlankInPolygon(testPlank, polygonPoints)) {
          newPlanks.push(testPlank);
        } else {
          // Check if this is a clean orthogonal cut case first
          const linearCutResult = plankActions.tryLinearCut(testPlank, polygonPoints);
          
          if (linearCutResult) {
            // This is a clean linear cut - use it
            newPlanks.push(linearCutResult.fitted);
            if (linearCutResult.spare) {
              newSpares.push(linearCutResult.spare);
            }
          } else {
            // Try to fit the plank by cutting it to an arbitrary shape
            const shapeCutPlank = plankActions.fitPlankByShapeCutting(testPlank, polygonPoints);
            
            if (shapeCutPlank) {
              newPlanks.push(shapeCutPlank);
              
              // Create spare from the unused portion
              const spare = plankActions.createSpareFromCut(testPlank, shapeCutPlank);
              if (spare) {
                newSpares.push(spare);
              }
            }
            // If neither linear nor shape cutting works, don't create a gap
            // This prevents gaps outside the polygon
          }
        }
      }
    }
    
    // Try to fill gaps with spares
    const remainingGaps: Gap[] = [];
    for (const gap of newGaps) {
      const spare = plankActions.findSpareForGap(gap);
      if (spare) {
        if (spare.length === gap.requiredLength) {
          // Perfect fit
          newPlanks.push({
            ...spare,
            x: gap.x,
            y: gap.y,
            rotation: gap.rotation,
          });
          // Remove used spare
          const spareIndex = newSpares.indexOf(spare);
          if (spareIndex >= 0) newSpares.splice(spareIndex, 1);
        } else if (spare.length > gap.requiredLength) {
          // Cut the spare
          const { fitted, spare: newSpare } = plankActions.cutPlank(spare, gap.requiredLength);
          newPlanks.push({
            ...fitted,
            x: gap.x,
            y: gap.y,
            rotation: gap.rotation,
          });
          // Replace old spare with new smaller spare
          const spareIndex = newSpares.indexOf(spare);
          if (spareIndex >= 0) {
            newSpares[spareIndex] = newSpare;
          } else {
            newSpares.push(newSpare);
          }
        }
      } else {
        remainingGaps.push(gap);
      }
    }
    
    $planks.set(newPlanks);
    $spares.set(newSpares);
    $gaps.set(remainingGaps);
  },
};