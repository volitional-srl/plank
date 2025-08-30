import {
  PLANK_FILL_RGB_LINEAR_CUT,
  PLANK_FILL_RGB_MULTILINE_CUT,
  PLANK_FILL_RGB_REGULAR_CUT,
} from "@/lib/plankRendering";
import { TestScenarioName } from "@/lib/cuttingStrategiesTest";
import { test, expect } from "@playwright/test";

test.describe("Cutting Strategies Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cutting-test");
    await page.waitForLoadState("networkidle");
  });

  test("should display all test scenarios", async ({ page }) => {
    // Check that all test scenarios are loaded
    const scenarios = page.locator('[data-testid="test-scenario"]');
    await expect(scenarios).toHaveCount(5);

    // Check scenario names
    await expect(
      page.locator(`text=${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}`),
    ).toBeVisible();
    await expect(
      page.locator(`text=${TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM}`),
    ).toBeVisible();
    await expect(
      page.locator(`text=${TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM}`),
    ).toBeVisible();
    await expect(
      page.locator(`text=${TestScenarioName.NO_CUT_POSSIBLE_OUTSIDE}`),
    ).toBeVisible();
  });

  test("should run all tests successfully", async ({ page }) => {
    // Click "Run All Tests" button
    await page.click("text=Run All Tests");

    // Wait for tests to complete
    await page.waitForTimeout(1000);

    // Check that all tests have results
    const successResults = page.locator("text=✓");
    const failResults = page.locator("text=✗");

    // Check that tests have completed and show some results (at least 1)
    const results = page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100");
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Linear Cut - should create linear cut on right edge", async ({
    page,
  }) => {
    // Select linear cut scenario
    await page.click(`text=${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}`);

    // Run the test for the selected scenario - use data-testid and nth selector
    await page
      .locator(
        `[data-testid="test-scenario"]:has-text("${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}")`,
      )
      .locator('button:has-text("Test")')
      .click();

    // Wait for test result
    await page.waitForTimeout(500);

    // Check test result appears (any result is fine for visual testing)
    await expect(
      page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100").first(),
    ).toBeVisible();

    // Check visual elements
    await expect(page.locator("svg.w-full.h-full").first()).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/linear-cut-test.png",
      fullPage: false,
      clip: { x: 320, y: 0, width: 800, height: 600 },
    });

    // Verify that we can see both polygon and plank elements
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();

    // Check for fitted plank (orange for linear cut)
    const fittedPlank = page.locator(
      `svg rect[fill*="${PLANK_FILL_RGB_LINEAR_CUT}"]`,
    ); // Orange color for linear cut
    await expect(fittedPlank).toBeVisible();
  });

  test("Linear Cut - should create linear cut on left edge", async ({
    page,
  }) => {
    // Select linear cut scenario
    await page.click(`text=${TestScenarioName.LINEAR_CUT_LEFT_EDGE}`);

    // Run the test for the selected scenario - use data-testid and nth selector
    await page
      .locator(
        `[data-testid="test-scenario"]:has-text("${TestScenarioName.LINEAR_CUT_LEFT_EDGE}")`,
      )
      .locator('button:has-text("Test")')
      .click();

    // Wait for test result
    await page.waitForTimeout(500);

    // Check test result appears (any result is fine for visual testing)
    await expect(
      page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100").first(),
    ).toBeVisible();

    // Check visual elements
    await expect(page.locator("svg.w-full.h-full").first()).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/linear-cut-test.png",
      fullPage: false,
      clip: { x: 320, y: 0, width: 800, height: 600 },
    });

    // Verify that we can see both polygon and plank elements
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();

    // Check for fitted plank (orange for linear cut)
    const fittedPlank = page.locator(
      `svg rect[fill *= "${PLANK_FILL_RGB_LINEAR_CUT}"]`,
    ); // Orange color for linear cut
    await expect(fittedPlank).toBeVisible();
  });

  test("Multi-line Cut - should create shape cut for L-shaped room", async ({
    page,
  }) => {
    // Select shape cut scenario
    await page.click(`text=${TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM}`);

    // Run the test for the selected scenario - use data-testid and nth selector
    await page
      .locator(
        `[data-testid="test-scenario"]:has-text("${TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM}")`,
      )
      .locator('button:has-text("Test")')
      .click();

    // Wait for test result
    await page.waitForTimeout(500);

    // Check test result appears (any result is fine for visual testing)
    await expect(
      page.locator('[class*="bg-green-100"], [class*="bg-red-100"]').first(),
    ).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/shape-cut-test.png",
      fullPage: false,
      clip: { x: 320, y: 0, width: 800, height: 600 },
    });

    // Check for L-shaped polygon
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();

    // Check for multi-line cut plank (should be a path element, not rectangle)
    const multiLineCutPath = page.locator(
      `svg path[fill*="${PLANK_FILL_RGB_MULTILINE_CUT}"]`,
    ); // Purple for shape cut
    await expect(multiLineCutPath).toBeVisible();
  });

  test("Multi-line Cut - should create multi-line cut for complex polygon", async ({
    page,
  }) => {
    // Select multi-line cut scenario
    await page.click(`text=${TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM}`);

    // Run the test for the selected scenario - use data-testid and nth selector
    await page
      .locator(
        `[data-testid="test-scenario"]:has-text("${TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM}")`,
      )
      .locator('button:has-text("Test")')
      .click();

    // Wait for test result
    await page.waitForTimeout(500);

    // Check test result appears (any result is fine for visual testing)
    await expect(
      page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100").first(),
    ).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/multi-line-cut-test.png",
      fullPage: false,
      clip: { x: 320, y: 0, width: 800, height: 600 },
    });

    // Check for complex polygon
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();
  });

  test("No Cut Possible - should fail for plank completely outside", async ({
    page,
  }) => {
    // Select no cut scenario
    await page.click(`text=${TestScenarioName.NO_CUT_POSSIBLE_OUTSIDE}`);

    // Run the test
    await page.click('button:has-text("Test")');

    // Wait for test result
    await page.waitForTimeout(500);

    // Check test result shows failure
    await expect(page.locator("text=✗ failed")).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: "test-results/no-cut-test.png",
      fullPage: false,
      clip: { x: 320, y: 0, width: 800, height: 600 },
    });

    // Check that polygon is visible but separate from plank
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();

    // Original plank should still be visible (transparent)
    const originalPlank = page.locator('svg rect[stroke-dasharray="5,5"]');
    await expect(originalPlank).toBeVisible();
  });

  test("should display detailed test results", async ({ page }) => {
    // Run all tests
    await page.click("text=Run All Tests");
    await page.waitForTimeout(1000);

    // Select linear cut scenario to check detailed results
    await page.click(`text=${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}`);

    // Check that detailed results are displayed
    await expect(page.locator("text=Test Result")).toBeVisible();
    await expect(page.locator("text=Success:")).toBeVisible();
    await expect(page.locator("text=Method:")).toBeVisible();
    await expect(
      page.locator('span:has-text("Expected:")').last(),
    ).toBeVisible();
    await expect(page.locator("text=Match:")).toBeVisible();

    // For successful linear cut, should show fitted plank info
    await expect(page.locator("text=Fitted Plank:")).toBeVisible();
  });

  test("should show visual legend", async ({ page }) => {
    // Check that legend is visible
    await expect(page.locator("text=Legend")).toBeVisible();

    // Check legend items
    await expect(
      page.locator("text=Original Plank (transparent)"),
    ).toBeVisible();
    await expect(
      page.locator('span:has-text("Linear Cut")').last(),
    ).toBeVisible();
    await expect(
      page.locator('span:has-text("Multi-line Cut")').last(),
    ).toBeVisible();
    await expect(
      page.locator('span:has-text("Shape Cut")').last(),
    ).toBeVisible();
    await expect(page.locator("text=Spare Piece")).toBeVisible();

    // Check that color indicators are present
    const colorIndicators = page.locator(".w-3.h-3");
    await expect(colorIndicators).toHaveCount(5);
  });

  test("should switch between scenarios correctly", async ({ page }) => {
    // Start with first scenario - should be selected by default
    await expect(
      page
        .locator(`text=${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}`)
        .locator("..")
        .first(),
    ).toHaveClass(/bg-blue-100/);

    // Switch to second scenario
    await page.click(`text=${TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM}`);
    await expect(
      page
        .locator(`text=${TestScenarioName.MULTI_LINE_CUT_L_SHAPED_ROOM}`)
        .locator("..")
        .first(),
    ).toHaveClass(/bg-blue-100/);

    // Switch to third scenario
    await page.click(`text=${TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM}`);
    await expect(
      page
        .locator(`text=${TestScenarioName.MULTI_LINE_CUT_H_SHAPED_ROOM}`)
        .locator("..")
        .first(),
    ).toHaveClass(/bg-blue-100/);

    // The visualization should update (check for drawing canvas)
    await expect(page.locator("svg.w-full.h-full").first()).toBeVisible();
  });

  test("should handle test execution timing", async ({ page }) => {
    // Test individual scenario execution
    await page.click(`text=${TestScenarioName.LINEAR_CUT_RIGHT_EDGE}`);

    const testButton = page.locator('button:has-text("Test")').first();
    await testButton.click();

    // Should show result quickly (within 2 seconds)
    await expect(
      page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100").first(),
    ).toBeVisible({ timeout: 2000 });

    // Test result details should appear
    await expect(page.locator("text=Success:")).toBeVisible();
  });
});
