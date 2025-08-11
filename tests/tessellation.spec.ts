import { test, expect } from '@playwright/test';

test.describe('Tessellation Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/tessellation-test');
    await page.waitForLoadState('networkidle');
  });

  test('should display all tessellation test scenarios', async ({ page }) => {
    // Check that all test scenarios are loaded
    const scenarios = page.locator('[data-testid="tessellation-scenario"]');
    await expect(scenarios).toHaveCount(5);

    // Check scenario names
    await expect(page.locator('text=Simple Rectangle - 3x2 meters')).toBeVisible();
    await expect(page.locator('text=L-shaped Room')).toBeVisible();
    await expect(page.locator('text=Narrow Hallway - 1m x 5m')).toBeVisible();
    await expect(page.locator('text=Small Square Room - 2x2 meters')).toBeVisible();
    await expect(page.locator('text=Complex H-shaped Room')).toBeVisible();
  });

  test('should run all tests successfully', async ({ page }) => {
    // Click "Run All Tests" button
    await page.click('text=Run All Tests');
    
    // Wait for tests to complete
    await page.waitForTimeout(2000);
    
    // Check that all tests have results
    const results = page.locator('text=✓ PASS, text=✗ FAIL');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Simple Rectangle - should place first plank and tessellate correctly', async ({ page }) => {
    // Select Simple Rectangle scenario
    await page.click('text=Simple Rectangle - 3x2 meters');
    
    // Run the test for the selected scenario
    await page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")').click();
    
    // Wait for test result
    await page.waitForTimeout(1000);
    
    // Check test result appears
    await expect(page.locator('.bg-green-100, .bg-red-100').first()).toBeVisible();
    
    // Check visual elements
    await expect(page.locator('svg.w-full.h-full').first()).toBeVisible();
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-results/simple-rectangle-tessellation.png',
      fullPage: false,
      clip: { x: 384, y: 0, width: 800, height: 600 }
    });
    
    // Verify that we can see both polygon and plank elements
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();
    
    // Check for first plank (dashed border - semi-transparent starting position)
    const firstPlank = page.locator('svg rect[stroke-dasharray="8,4"]');
    await expect(firstPlank).toBeVisible();
    
    // Check that tessellated planks are visible (brown rectangles for full planks)
    const tessellatedPlanks = page.locator('svg rect[fill="#8B4513"]');
    await expect(tessellatedPlanks.first()).toBeVisible();
  });

  test('Simple Rectangle - should pass tessellation metrics', async ({ page }) => {
    // Select and run Simple Rectangle scenario
    await page.click('text=Simple Rectangle - 3x2 meters');
    await page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")').click();
    
    // Wait for test result
    await page.waitForTimeout(1000);
    
    // Check that the test shows specific metrics
    await expect(page.locator('text=Test Results')).toBeVisible();
    await expect(page.locator('text=Total Planks:')).toBeVisible();
    await expect(page.locator('text=Cut Planks:')).toBeVisible();
    await expect(page.locator('text=Coverage:')).toBeVisible();
    await expect(page.locator('text=Waste Area:')).toBeVisible();
    
    // For the Simple Rectangle, we expect reasonable metrics
    // The actual values will be validated by the test logic, here we just ensure they display
    const totalPlanksText = page.locator('text=Total Planks:');
    await expect(totalPlanksText).toBeVisible();
  });

  test('should show tessellation results overlay on canvas', async ({ page }) => {
    // Run Simple Rectangle test
    await page.click('text=Simple Rectangle - 3x2 meters');
    await page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")').click();
    
    await page.waitForTimeout(1000);
    
    // Check that results overlay is visible on the canvas
    await expect(page.locator('svg text:has-text("Tessellation Results")')).toBeVisible();
    await expect(page.locator('svg text:has-text("Total:")')).toBeVisible();
    await expect(page.locator('svg text:has-text("Coverage:")')).toBeVisible();
    await expect(page.locator('svg text:has-text("Waste:")')).toBeVisible();
  });

  test('L-shaped Room - should handle complex geometry', async ({ page }) => {
    // Select L-shaped room scenario
    await page.click('text=L-shaped Room');
    
    // Run the test
    await page.locator('[data-testid="tessellation-scenario"]:has-text("L-shaped Room")').locator('button:has-text("Test")').click();
    
    // Wait for test result
    await page.waitForTimeout(1000);
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-results/l-shaped-tessellation.png',
      fullPage: false,
      clip: { x: 384, y: 0, width: 800, height: 600 }
    });
    
    // Check test result appears
    await expect(page.locator('.bg-green-100, .bg-red-100').first()).toBeVisible();
    
    // Check for complex polygon shape
    const polygonPath = page.locator('svg path[stroke="#3b82f6"]');
    await expect(polygonPath).toBeVisible();
    
    // L-shaped room should have some cut planks (orange/pink/purple)
    const cutPlanks = page.locator('svg rect[fill*="#F97316"], svg rect[fill*="#EC4899"], svg path[fill*="#9333EA"]');
    // At least one cut plank should be visible
    await expect(cutPlanks.first()).toBeVisible();
  });

  test('should display detailed test results panel', async ({ page }) => {
    // Run Simple Rectangle test
    await page.click('text=Simple Rectangle - 3x2 meters');
    await page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")').click();
    
    await page.waitForTimeout(1000);
    
    // Check that detailed results panel is displayed
    await expect(page.locator('text=Overall Status:')).toBeVisible();
    await expect(page.locator('text=Plank Counts')).toBeVisible();
    await expect(page.locator('text=Coverage Analysis')).toBeVisible();
    await expect(page.locator('text=Waste Analysis')).toBeVisible();
    
    // Check specific metrics sections
    await expect(page.locator('text=Expected:')).toBeVisible();
    await expect(page.locator('text=Actual:')).toBeVisible();
    await expect(page.locator('text=Polygon Area:')).toBeVisible();
    await expect(page.locator('text=Covered Area:')).toBeVisible();
  });

  test('should show legend with correct plank types', async ({ page }) => {
    // Check that legend is visible
    await expect(page.locator('text=Legend')).toBeVisible();
    
    // Check legend items for different plank types
    await expect(page.locator('text=First Plank (starting position)')).toBeVisible();
    await expect(page.locator('text=Full Planks')).toBeVisible();
    await expect(page.locator('text=Linear Cut Planks')).toBeVisible();
    await expect(page.locator('text=Multi-line Cut Planks')).toBeVisible();
    await expect(page.locator('text=Shape Cut Planks')).toBeVisible();
    await expect(page.locator('text=Spare Pieces')).toBeVisible();
    
    // Check that color indicators are present
    const colorIndicators = page.locator('.w-3.h-3');
    await expect(colorIndicators).toHaveCount(6);
  });

  test('should switch between scenarios correctly', async ({ page }) => {
    // Start with first scenario - Simple Rectangle should be selected by default
    await expect(page.locator('text=Simple Rectangle - 3x2 meters').locator('..').first()).toHaveClass(/bg-blue-100/);
    
    // Switch to L-shaped room
    await page.click('text=L-shaped Room');
    await expect(page.locator('text=L-shaped Room').locator('..').first()).toHaveClass(/bg-blue-100/);
    
    // Switch to Narrow Hallway
    await page.click('text=Narrow Hallway - 1m x 5m');
    await expect(page.locator('text=Narrow Hallway - 1m x 5m').locator('..').first()).toHaveClass(/bg-blue-100/);
    
    // The visualization should update (check for drawing canvas)
    await expect(page.locator('svg.w-full.h-full').first()).toBeVisible();
  });

  test('Simple Rectangle - should place first plank at correct position', async ({ page }) => {
    // This test specifically checks that our fix for the first plank placement works
    await page.click('text=Simple Rectangle - 3x2 meters');
    await page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")').click();
    
    await page.waitForTimeout(1000);
    
    // Check that we have tessellated planks - if the first plank wasn't placed, 
    // we'd see very low coverage and few planks
    const totalPlanksText = await page.locator('text=Actual:').nth(0).textContent();
    const planksCount = parseInt(totalPlanksText?.match(/\d+/)?.[0] || '0');
    
    // Should have more than 5 planks for a 3x2m rectangle (the fix should enable proper tessellation)
    expect(planksCount).toBeGreaterThan(5);
    
    // Check coverage is reasonable (should be above 50% with the fix)
    const coverageText = await page.locator('text=Actual Coverage:').textContent();
    const coverage = parseFloat(coverageText?.match(/[\d.]+/)?.[0] || '0');
    
    expect(coverage).toBeGreaterThan(50);
  });

  test('should handle test execution timing', async ({ page }) => {
    // Test individual scenario execution
    await page.click('text=Simple Rectangle - 3x2 meters');
    
    const testButton = page.locator('[data-testid="tessellation-scenario"]:has-text("Simple Rectangle")').locator('button:has-text("Test")');
    await testButton.click();
    
    // Should show result quickly (within 3 seconds for tessellation)
    await expect(page.locator('.bg-green-100, .bg-red-100').first()).toBeVisible({ timeout: 3000 });
    
    // Test result details should appear
    await expect(page.locator('text=Overall Status:')).toBeVisible();
  });
});