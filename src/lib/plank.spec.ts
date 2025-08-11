import { describe, test, expect } from "vitest";
import { plankCollidesWithExisting, doPlanksIntersect } from "./plank";
import type { Plank } from "./plank";

describe("plankCollidesWithExisting", () => {
  test("should allow touching planks when gap is 0", () => {
    const plankA: Plank = {
      id: "plank-a",
      x: 50, y: 50, // center at (50, 50)
      rotation: 0,
      length: 1000, // 100mm = 10 pixels width
      width: 200,   // 20mm = 2 pixels height
    };
    
    const plankB: Plank = {
      id: "plank-b", 
      x: 150, y: 50, // center at (150, 50), touching plankA's right edge
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // With gap = 0, touching planks should not collide
    expect(plankCollidesWithExisting(plankB, [plankA], 0)).toBe(false);
  });

  test("should prevent overlapping planks when gap is 0", () => {
    const plankA: Plank = {
      id: "plank-a",
      x: 50, y: 50,
      rotation: 0,
      length: 1000,
      width: 200,
    };
    
    const plankB: Plank = {
      id: "plank-b", 
      x: 140, y: 50, // overlapping with plankA
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // Overlapping planks should collide
    expect(plankCollidesWithExisting(plankB, [plankA], 0)).toBe(true);
  });

  test("should enforce gaps when gap is positive", () => {
    const plankA: Plank = {
      id: "plank-a",
      x: 50, y: 50,
      rotation: 0,
      length: 1000,
      width: 200,
    };
    
    const plankB: Plank = {
      id: "plank-b", 
      x: 150, y: 50, // exactly touching
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // With positive gap, even touching planks should collide
    expect(plankCollidesWithExisting(plankB, [plankA], 5)).toBe(true);
  });

  test("should allow plank surrounded by touching planks when gap is 0", () => {
    // Center plank at (100,100)
    // length=1000mm → 100px, width=200mm → 20px
    // halfLength=50px, halfWidth=10px
    // Corners at: (50,90), (150,90), (150,110), (50,110)
    const centerPlank: Plank = {
      id: "center",
      x: 100, y: 100,
      rotation: 0,
      length: 1000, // 1000mm = 100px length
      width: 200,   // 200mm = 20px width
    };

    // Top plank touching center's top edge (y=90)
    // Top plank's bottom edge should be at y=90, so center at y=80
    const topPlank: Plank = {
      id: "top",
      x: 100, y: 80,
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // Bottom plank touching center's bottom edge (y=110)
    // Bottom plank's top edge should be at y=110, so center at y=120
    const bottomPlank: Plank = {
      id: "bottom", 
      x: 100, y: 120,
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // Left plank touching center's left edge (x=50)
    // Left plank's right edge should be at x=50, so center at x=0
    const leftPlank: Plank = {
      id: "left",
      x: 0, y: 100,
      rotation: 0,
      length: 1000,
      width: 200,
    };

    // Right plank touching center's right edge (x=150)
    // Right plank's left edge should be at x=150, so center at x=200
    const rightPlank: Plank = {
      id: "right",
      x: 200, y: 100,
      rotation: 0,
      length: 1000,
      width: 200,
    };

    const surroundingPlanks = [topPlank, bottomPlank, leftPlank, rightPlank];

    // Verify each individual touching relationship first
    expect(doPlanksIntersect(centerPlank, topPlank)).toBe(false);
    expect(doPlanksIntersect(centerPlank, bottomPlank)).toBe(false);
    expect(doPlanksIntersect(centerPlank, leftPlank)).toBe(false);
    expect(doPlanksIntersect(centerPlank, rightPlank)).toBe(false);
    
    // Test individual collision checks
    expect(plankCollidesWithExisting(centerPlank, [topPlank], 0)).toBe(false);
    expect(plankCollidesWithExisting(centerPlank, [bottomPlank], 0)).toBe(false);
    expect(plankCollidesWithExisting(centerPlank, [leftPlank], 0)).toBe(false);
    expect(plankCollidesWithExisting(centerPlank, [rightPlank], 0)).toBe(false);
    
    // Center plank should not collide with any of the surrounding touching planks
    expect(plankCollidesWithExisting(centerPlank, surroundingPlanks, 0)).toBe(false);
  });
});

describe("doPlanksIntersect", () => {
  test("should return false for touching planks", () => {
    const plankA: Plank = {
      id: "plank-a",
      x: 50, y: 50,
      rotation: 0,
      length: 1000,
      width: 200,
    };
    
    const plankB: Plank = {
      id: "plank-b", 
      x: 150, y: 50, // touching plankA's edge
      rotation: 0,
      length: 1000,
      width: 200,
    };

    expect(doPlanksIntersect(plankA, plankB)).toBe(false);
  });

  test("should return true for overlapping planks", () => {
    const plankA: Plank = {
      id: "plank-a",
      x: 50, y: 50,
      rotation: 0,
      length: 1000,
      width: 200,
    };
    
    const plankB: Plank = {
      id: "plank-b", 
      x: 140, y: 50, // overlapping
      rotation: 0,
      length: 1000,
      width: 200,
    };

    expect(doPlanksIntersect(plankA, plankB)).toBe(true);
  });
});