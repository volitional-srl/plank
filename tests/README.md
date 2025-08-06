# Plank Floor Layout Tool - Test Suite

This directory contains comprehensive Playwright tests for the Plank floor layout calculation tool.

## Test Coverage

### 🏗️ Polygon Creation Tests
- **Simple Rectangular Polygon**: Tests basic 4-point rectangle creation
- **Triangular Polygon**: Tests 3-point triangle creation
- **Complex Polygon**: Tests L-shaped polygon with 6 points
- **Measurements Display**: Verifies perimeter and area calculations
- **Clear and Recreate**: Tests polygon clearing and recreation functionality

### 🪵 Plank Placement - Simple Polygons
- **First Plank Placement**: Tests initial plank placement and tessellation
- **Color Coding**: Verifies different plank types (full, cut, shape-cut, spare)
- **Custom Dimensions**: Tests plank size configuration (length/width)
- **Clear Planks**: Tests clearing all placed planks

### 🏛️ Plank Placement - Complex Polygons
- **L-shaped Room**: Tests tessellation in non-rectangular spaces
- **Triangular Room**: Tests tessellation in triangular geometry
- **Convex (Star-shaped) Polygon**: Tests tessellation in convex shapes
- **Concave (U-shaped) Room**: Tests tessellation with internal concavities
- **Spares and Gaps**: Tests spare piece management and gap detection

### 🎮 Interactive Features
- **Zoom Functionality**: Tests zoom in/out/reset controls
- **Snapping Features**: Tests angle snap and grid snap toggles

## Running Tests

### Run All Tests
```bash
npx playwright test polygon-plank.spec.ts
```

### Run Specific Test Categories
```bash
# Polygon creation only
npx playwright test polygon-plank.spec.ts -g "Polygon Creation"

# Simple plank placement only
npx playwright test polygon-plank.spec.ts -g "Simple Polygons"

# Complex plank placement only
npx playwright test polygon-plank.spec.ts -g "Complex Polygons"

# Interactive features only
npx playwright test polygon-plank.spec.ts -g "Interactive Features"
```

### Run Single Browser
```bash
npx playwright test polygon-plank.spec.ts --project=chromium
```

### Run with Visual Output
```bash
npx playwright test polygon-plank.spec.ts --reporter=html
```

## Test Features

### ✅ Functionality Tested
- **Polygon Drawing**: Click-to-add points, completion, clearing
- **Unit Conversion**: Pixel to millimeter conversion (1px = 10mm)
- **Measurements**: Real-time perimeter and area calculations
- **Plank Configuration**: Custom length and width settings
- **Tessellation Algorithm**: Automatic plank layout generation
- **Cutting Logic**: Linear cuts and arbitrary shape cuts
- **Spare Management**: Spare piece creation and reuse
- **Visual Feedback**: Color-coded plank types and legends
- **Interactive Controls**: Zoom, pan, and snapping features

### 🎯 Algorithm Validation
- **Full Planks**: Brown rectangles for complete planks
- **Linear Cut Planks**: Orange rectangles for orthogonally cut planks
- **Shape-Cut Planks**: Purple polygons for arbitrarily shaped planks
- **Spare Pieces**: Green elements for reused spare pieces
- **Gaps**: Red dashed areas for unfilled spaces

### 🧪 Test Methodology
- **End-to-End Testing**: Full user interaction simulation
- **Visual Verification**: SVG element counting and color checking
- **Timing**: Appropriate waits for tessellation algorithms
- **Error Handling**: Robust selectors and fallback checks
- **Cross-Browser**: Chromium and Firefox compatibility

## Test Architecture

- **Page Object Pattern**: Clean, maintainable test structure
- **Selector Strategy**: CSS selectors with fallbacks
- **Async/Await**: Proper handling of asynchronous operations
- **Test Isolation**: Each test starts with a clean state
- **Assertions**: Comprehensive verification of functionality

## Performance Considerations

Tests include appropriate timing for:
- **Tessellation Algorithm**: 1-3 second waits for complex layouts
- **UI Updates**: Immediate verification for simple interactions
- **Animation Completion**: Proper waits for visual transitions

This test suite ensures the Plank floor layout tool works correctly across all major use cases and provides confidence in the tessellation algorithms, cutting logic, and user interface functionality.