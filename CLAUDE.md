# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plank is a minimal app for calculating parquet floor layouts and tile tessellation. Users draw surfaces to millimeter scale, define plank dimensions, and place the first plank. The app automatically generates optimal layouts using advanced placement algorithms that minimize waste while adhering to flooring industry rules.

## Development Commands

### Build & Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Testing
- `npx playwright test` - Run all Playwright tests
- `npx playwright test polygon-plank.spec.ts` - Run main test suite
- `npx playwright test polygon-plank.spec.ts -g "Polygon Creation"` - Run specific test category
- `npx playwright test --project=chromium` - Run tests in single browser
- `npx playwright test --reporter=html` - Run with HTML reporter

## Code Architecture

### Core Architecture
The application follows a state management pattern using Nanostores with React integration:

- **Stores** (`src/stores/`): Centralized state management
  - `plankStore.ts` - Complex plank placement logic and tessellation algorithms
  - `polygonStore.ts` - Polygon drawing and measurement state
  - `cameraStore.ts` - Viewport controls (zoom, pan)
  - `gridStore.ts` - Grid display settings

- **Libraries** (`src/lib/`):
  - `geometry.ts` - Geometric calculations, polygon clipping, line intersections
  - `plank.ts` - Plank utilities and collision detection

### Tessellation Algorithm
The core tessellation system in `plankStore.ts` implements sophisticated flooring logic:

1. **Row-based placement** - Mimics real-world flooring installation
2. **Multiple cutting strategies** - Linear cuts, multi-line cuts, arbitrary shape cutting
3. **Spare piece management** - Tracks and reuses cut-offs to minimize waste
4. **Gap constraints** - Configurable gaps between planks and minimum row offsets
5. **Industry rules** - Adjacent end alignment rules, minimum cut sizes

### Key Technical Details

- **Coordinate System**: 1 pixel = 10mm for precision
- **Plank Types**: Full planks (brown), linear cuts (orange), shape cuts (purple), spares (green)
- **Collision Detection**: Uses Separating Axis Theorem for accurate overlap detection
- **Polygon Clipping**: Sutherland-Hodgman algorithm for complex shape cutting

### State Management Pattern
All stores use Nanostores atoms and computed values with React integration via `@nanostores/react`. Actions are defined as object methods within each store for better organization.

### Testing Strategy
Comprehensive Playwright test suite covers:
- Polygon creation and validation
- Plank placement algorithms
- Visual verification of tessellation results
- Interactive features (zoom, snap controls)
- Complex geometry handling (L-shapes, triangular rooms, concave polygons)

The tests validate both functionality and visual output by counting SVG elements and verifying colors for different plank types.

## Coding Standards

### Purpose
These rules ensure maintainable, clean, readable, testable and organised code that follows the established patterns in the Plank codebase.

### Implementation Best Practices

#### Before Coding
- **BP-1 (MUST)** Ask clarifying questions for complex features
- **BP-2 (SHOULD)** Draft and confirm approach for tessellation algorithm changes
- **BP-3 (SHOULD)** For multiple implementation approaches, list clear pros and cons

#### While Coding
- **C-1 (MUST)** Follow existing Nanostores patterns - use atoms for state, computed for derived values
- **C-2 (MUST)** Use existing geometry/plank domain vocabulary for consistency
- **C-3 (SHOULD NOT)** Introduce classes when small testable functions suffice
- **C-4 (SHOULD)** Prefer simple, composable, testable functions (follow `geometry.ts` patterns)
- **C-5 (MUST)** Use `import type { ... }` for type-only imports
- **C-6 (SHOULD NOT)** Add comments except for critical algorithmic caveats; rely on self-explanatory code
- **C-8 (SHOULD NOT)** Extract functions unless reused elsewhere, needed for unit testing, or drastically improves readability

#### Testing
- **T-1 (MUST)** Colocate unit tests in `*.spec.ts` for geometric utilities and pure functions
- **T-2 (MUST)** Use Playwright tests for full tessellation workflows and visual validation
- **T-3 (MUST)** Separate pure-logic tests (geometry) from integration tests (tessellation)
- **T-4 (SHOULD)** Prefer integration tests over heavy mocking for tessellation algorithms
- **T-5 (MUST)** Thoroughly test complex algorithms (cutting strategies, collision detection)
- **T-6 (SHOULD)** Test complete structures in one assertion where possible

#### Code Organization
- **O-1 (MUST)** Place shared geometry utilities in `src/lib/`
- **O-2 (MUST)** Keep store logic in `src/stores/` with clear separation of concerns
- **O-3 (SHOULD)** Follow existing file naming: `camelCase.ts` for utilities, `camelCaseStore.ts` for stores

### Writing Functions Checklist

When evaluating functions in the Plank codebase:

1. **Readability**: Can you understand the tessellation logic without excessive mental overhead?
2. **Complexity**: Does the function have manageable cyclomatic complexity? (tessellation functions are inherently complex but should be decomposed logically)
3. **Data Structures**: Are appropriate geometric algorithms used? (Sutherland-Hodgman clipping, ray casting, SAT collision detection)
4. **Parameters**: No unused parameters, especially in geometric calculations
5. **Type Safety**: Minimize type casts, prefer strong typing with `Point[]` over generic arrays
6. **Testability**: Can geometric functions be unit tested? Can tessellation be integration tested?
7. **Dependencies**: Factor out hardcoded values (pixel conversion, tolerances) into parameters
8. **Naming**: Use established domain vocabulary

### Writing Tests Checklist

For Plank-specific testing:

1. **SHOULD** parameterize geometric inputs (coordinates, dimensions, angles)
2. **SHOULD NOT** add tests that can't fail for real tessellation defects
3. **MUST** align test descriptions with assertions ("should place full plank when it fits completely")
4. **SHOULD** compare against independent geometric calculations, not function output
5. **MUST** follow TypeScript strict typing in tests
6. **SHOULD** test geometric invariants (area conservation, collision detection symmetry)
7. **MUST** group unit tests under `describe(functionName)`
8. **SHOULD** use `expect.any(String)` for generated plank IDs
9. **MUST** use strong assertions (`toEqual`, `toHaveLength`) over weak ones
10. **SHOULD** test edge cases: degenerate polygons, minimum plank sizes, boundary conditions
11. **SHOULD NOT** test TypeScript-caught conditions

### Plank-Specific Patterns

#### State Management
```typescript
// ✅ Good: Follow established Nanostores pattern
export const $planks = atom<Plank[]>([]);
export const $plankCount = computed($planks, (planks) => planks.length);

// Actions in object for organization
export const plankActions = {
  placePlank: (position: Point, rotation: number) => { ... }
};
```

#### Geometric Functions
```typescript
// ✅ Good: Pure, testable geometric utilities
export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => { ... }

// ❌ Avoid: Functions with side effects in geometry utilities
const updatePolygonAndNotify = (polygon: Point[]) => { ... }
```

#### Testing Patterns
```typescript
// ✅ Good: Clear, parametric test
test('should detect collision between overlapping planks', () => {
  const plankA: Plank = { x: 100, y: 100, length: 1500, width: 240, rotation: 0, id: 'test-a' };
  const plankB: Plank = { x: 120, y: 100, length: 1500, width: 240, rotation: 0, id: 'test-b' };

  expect(doPlanksIntersect(plankA, plankB)).toBe(true);
});

// ❌ Avoid: Magic numbers without context
test('collision test', () => {
  expect(doPlanksIntersect(makeTestPlank(100, 100), makeTestPlank(120, 100))).toBe(true);
});
```
