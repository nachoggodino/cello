export function synchronizePreviewSheet(
  document: Document,
  activeSheetName: string,
  onActiveSheetChange: (sheetName: string) => void
): void {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>(".cello-tab"));
  const sheets = Array.from(document.querySelectorAll<HTMLElement>(".cello-sheet"));
  const activeTab = tabs.find((tab) => tab.dataset.sheet === activeSheetName) ?? tabs[0];
  const resolvedName = activeTab?.dataset.sheet;
  if (!resolvedName) {
    return;
  }

  for (const tab of tabs) {
    const active = tab.dataset.sheet === resolvedName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.onclick = () => {
      const sheetName = tab.dataset.sheet;
      if (sheetName) {
        onActiveSheetChange(sheetName);
      }
    };
  }
  for (const sheet of sheets) {
    sheet.classList.toggle("active", sheet.dataset.sheet === resolvedName);
  }
}
