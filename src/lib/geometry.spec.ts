import { doRectanglesIntersect } from "./geometry";
import { describe, test, expect } from "vitest";
import type { Point } from "./geometry";

describe("doRectanglesIntersect", () => {
  test("should allow touching rectangles (edge contact)", () => {
    // Two adjacent rectangles touching at edges
    const rectA: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];

    const rectB: Point[] = [
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 50 },
      { x: 100, y: 50 },
    ];

    expect(doRectanglesIntersect(rectA, rectB)).toBe(false);
  });

  test("should prevent overlapping rectangles (interior intersection)", () => {
    // Two rectangles with overlapping interiors
    const rectA: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];

    const rectB: Point[] = [
      { x: 50, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 50 },
      { x: 50, y: 50 },
    ];

    expect(doRectanglesIntersect(rectA, rectB)).toBe(true);
  });

  test("should allow touching at corners", () => {
    // Two rectangles touching only at corner points
    const rectA: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];

    const rectB: Point[] = [
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
    ];

    expect(doRectanglesIntersect(rectA, rectB)).toBe(false);
  });

  test("should prevent rectangles with small interior overlap", () => {
    // Two rectangles with minimal but actual interior overlap
    const rectA: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];

    const rectB: Point[] = [
      { x: 99, y: 0 },
      { x: 199, y: 0 },
      { x: 199, y: 50 },
      { x: 99, y: 50 },
    ];

    expect(doRectanglesIntersect(rectA, rectB)).toBe(true);
  });

  test("should handle separated rectangles", () => {
    // Two completely separate rectangles
    const rectA: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];

    const rectB: Point[] = [
      { x: 100, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 50 },
      { x: 100, y: 50 },
    ];

    expect(doRectanglesIntersect(rectA, rectB)).toBe(false);
  });
});
