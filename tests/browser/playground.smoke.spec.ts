import { expect, test } from "@playwright/test";

test("loads the playground and renders the workbook preview", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Cello/);
  await expect(page.getByRole("navigation", { name: "Playground navigation" })).toBeVisible();
  await expect(page.locator('iframe[title="Rendered Cello workbook"]')).toBeVisible();
  await expect(page.frameLocator('iframe[title="Rendered Cello workbook"]').locator(".cello-workbook")).toBeVisible();
});

test("loads CodeMirror lazily and keeps grouped source history separate from visual history", async ({ page }) => {
  const sourceModuleRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("CodeMirrorSourceSurface")) {
      sourceModuleRequests.push(request.url());
    }
  });

  await page.goto("/#editor");
  await expect(page.getByRole("grid", { name: "Visual spreadsheet editor" })).toBeVisible();
  expect(sourceModuleRequests).toEqual([]);

  await navigationButton(page, "Source").click();
  const editor = sourceEditor(page);
  await expect(editor).toBeVisible();
  await expect.poll(() => sourceModuleRequests.length).toBeGreaterThan(0);

  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  const finalLine = editor.locator(".cm-line").last();
  const originalTail = await finalLine.innerText();
  await page.keyboard.type("XY");
  await expect(finalLine).toContainText("XY");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(finalLine).toHaveText(originalTail);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(finalLine).toContainText("XY");

  await page.getByRole("button", { name: "Visual editor", exact: true }).click();
  await page.getByRole("gridcell", { name: "A1", exact: true }).click();
  await page.getByRole("textbox", { name: "Selected cell source" }).fill("Visual edit");
  await navigationButton(page, "Source").click();
  await expect(editor).toContainText("Visual edit");

  await editor.click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).toContainText("Visual edit");
});

test("rejects stale preview work and exposes invalid source in source and visual modes", async ({ page }) => {
  await page.goto("/");
  const editor = sourceEditor(page);
  await editor.fill("@sheet Rapid\n| Old |");
  await editor.fill("@sheet Rapid\n| Latest |");

  const preview = page.frameLocator('iframe[title="Rendered Cello workbook"]');
  await expect(preview.locator(".cello-workbook")).toContainText("Latest");
  await expect(preview.locator(".cello-workbook")).not.toContainText("Old");

  await editor.fill("@sheet Duplicate\n| A |\n@sheet Duplicate\n| B |");
  await expect(page.getByRole("list", { name: "Diagnostics" })).toBeVisible();
  await page.getByRole("button", { name: "Visual editor", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/duplicate/i);
});

test("synchronizes sheets and copies the live rendered table", async ({ browserName, page }) => {
  test.skip(browserName !== "chromium", "Clipboard permission coverage is required in Chromium.");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await sourceEditor(page).fill("@sheet One\n| First |\n\n@sheet Two\n| Second |");

  await page.getByRole("button", { name: "Visual editor", exact: true }).click();
  await page.getByRole("tab", { name: "Two" }).click();
  await navigationButton(page, "Source").click();
  await expect(page.frameLocator('iframe[title="Rendered Cello workbook"]').locator('.cello-sheet.active[data-sheet="Two"]')).toContainText("Second");

  await page.getByRole("button", { name: "Copy Table" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Second");
});

test("edits the simplified foreign-format grid without normalizing its storage format", async ({ page }) => {
  await page.goto("/");
  await sourceEditor(page).fill("@sheet Raw [csv]\nname,amount\nAda,5");
  await page.getByRole("button", { name: "Visual editor", exact: true }).click();

  const cell = page.getByRole("gridcell", { name: "A2" });
  await expect(cell).toContainText("Ada");
  await cell.dblclick();
  await page.getByRole("textbox", { name: "A2" }).fill("Grace");
  await page.getByRole("textbox", { name: "A2" }).press("Enter");

  await navigationButton(page, "Source").click();
  await expect(sourceEditor(page)).toContainText("@sheet Raw [csv]");
  await expect(sourceEditor(page)).toContainText("Grace,5");
});

test("resizes the preview iframe for the mobile panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Preview" }).click();

  const iframe = page.locator('iframe[title="Rendered Cello workbook"]');
  await expect(iframe).toBeVisible();
  await expect
    .poll(async () => {
      const box = await iframe.boundingBox();
      return box?.height ?? 0;
    })
    .toBeGreaterThan(100);
});

function sourceEditor(page: import("@playwright/test").Page) {
  return page.locator('.cm-content[contenteditable="true"][aria-label="Cello source"]');
}

function navigationButton(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("navigation", { name: "Playground navigation" }).getByRole("button", { name, exact: true });
}
