import { describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../../../packages/editor-core/src/session.js";

describe("editor session", () => {
  it("publishes immutable revision snapshots to subscribers", () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    const initial = session.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    const result = session.setSource("@sheet Report\n| B |");

    expect(result.ok).toBe(true);
    expect(initial).toMatchObject({ revision: 0, source: "@sheet Report\n| A |" });
    expect(session.getSnapshot()).toMatchObject({
      revision: 1,
      source: "@sheet Report\n| B |",
      activeSheetName: "Report"
    });
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    session.setActiveSheetName("Report");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps source undo and redo independent and clears visual history on source edits", () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    const visualResult = session.execute({
      type: "update-cell",
      address: { sheetIndex: 0, rowIndex: 0, colIndex: 0 },
      source: "B",
      mode: "content"
    });

    expect(visualResult.ok).toBe(true);
    expect(session.getSnapshot().histories.visual).toMatchObject({ canUndo: true, undoDepth: 1 });

    session.setSource("@sheet Report\n| BC |");

    expect(session.getSnapshot().histories).toEqual({
      source: { canUndo: true, canRedo: false, undoDepth: 1, redoDepth: 0 },
      visual: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 }
    });
    expect(session.undo("source")).toBe(true);
    expect(session.getSnapshot().source).toBe("@sheet Report\n|B|");
    expect(session.redo("source")).toBe(true);
    expect(session.getSnapshot().source).toBe("@sheet Report\n| BC |");
  });

  it("clears source history when a visual command changes content", () => {
    const session = createEditorSession({ source: "@sheet Report\n| A |" });
    session.setSource("@sheet Report\n| Typed |");

    session.execute({
      type: "update-cell",
      address: { sheetIndex: 0, rowIndex: 0, colIndex: 0 },
      source: "Visual",
      mode: "content"
    });

    expect(session.getSnapshot().histories.source.canUndo).toBe(false);
    expect(session.getSnapshot().histories.visual.canUndo).toBe(true);
    expect(session.undo("visual")).toBe(true);
    expect(session.getSnapshot().source).toBe("@sheet Report\n| Typed |");
  });

  it("merges source changes only within the same explicit typing group", () => {
    const session = createEditorSession({ source: "| A |" });

    session.setSource("| AB |", { history: "merge", historyGroup: "typing-1" });
    session.setSource("| ABC |", { history: "merge", historyGroup: "typing-1" });
    session.setSource("| ABCD |", { history: "merge", historyGroup: "typing-2" });

    expect(session.getSnapshot().histories.source.undoDepth).toBe(2);
    expect(session.undo("source")).toBe(true);
    expect(session.getSnapshot().source).toBe("| ABC |");
    expect(session.undo("source")).toBe(true);
    expect(session.getSnapshot().source).toBe("| A |");
  });

  it("rejects commands for stale revisions without changing source", () => {
    const session = createEditorSession({ source: "| A |" });
    const revision = session.getSnapshot().revision;
    session.setSource("| B |");

    const result = session.execute({
      type: "update-cell",
      address: { sheetIndex: 0, rowIndex: 0, colIndex: 0 },
      source: "stale",
      mode: "content"
    }, { expectedRevision: revision });

    expect(result).toMatchObject({
      ok: false,
      reason: "stale-revision",
      document: { source: "| B |" }
    });
  });

  it("rejects stale source writes and enforces the configured history limit", () => {
    const session = createEditorSession({ source: "| A |", historyLimit: 1 });

    const stale = session.setSource("| stale |", { expectedRevision: 4 });
    expect(stale).toMatchObject({
      ok: false,
      reason: "stale-revision",
      snapshot: { source: "| A |" }
    });

    session.setSource("| B |");
    session.setSource("| C |");
    expect(session.undo("source")).toBe(true);
    expect(session.getSnapshot().source).toBe("| B |");
    expect(session.undo("source")).toBe(false);
  });

  it("shares active sheet without changing revision or histories", () => {
    const session = createEditorSession({
      source: "@sheet One\n| A |\n\n@sheet Two\n| B |"
    });

    expect(session.setActiveSheetName("Two")).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      revision: 0,
      activeSheetName: "Two",
      histories: {
        source: { undoDepth: 0 },
        visual: { undoDepth: 0 }
      }
    });

    session.execute({ type: "remove-sheet", sheetIndex: 1 });
    expect(session.getSnapshot().activeSheetName).toBe("One");
  });

  it("clears both histories when a host replaces the external source", () => {
    const session = createEditorSession({ source: "| A |" });
    session.setSource("| B |");
    session.replaceExternalSource("| External |");

    expect(session.getSnapshot()).toMatchObject({
      source: "| External |",
      histories: {
        source: { canUndo: false, canRedo: false },
        visual: { canUndo: false, canRedo: false }
      }
    });
  });

  it("defaults to compact and enforces the selected layout on later visual edits", () => {
    const session = createEditorSession({
      source: "@sheet Report\n| A | 1 |\n| Longer | 22 |"
    });

    expect(session.getSnapshot().sourceLayout).toBe("compact");
    const formatted = session.format("pretty");
    expect(formatted.ok).toBe(true);
    expect(session.getSnapshot().sourceLayout).toBe("pretty");

    session.execute({
      type: "update-cell",
      address: { sheetIndex: 0, rowIndex: 0, colIndex: 1 },
      source: "100",
      mode: "content"
    });

    expect(session.getSnapshot().source).toBe(
      "@sheet Report\n| A      | 100 |\n| Longer | 22  |"
    );
  });

  it("publishes layout selection without creating a source revision", () => {
    const session = createEditorSession({ source: "| A |" });
    const listener = vi.fn();
    session.subscribe(listener);

    session.setSourceLayout("pretty");
    session.setSourceLayout("pretty");

    expect(session.getSnapshot()).toMatchObject({
      revision: 0,
      sourceLayout: "pretty"
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stores transient table view state without editing source or history", () => {
    const source = "@sheet Sales\n@view Madrid [default] | @where mad | @sort desc |\n| Madrid | 2 |\n| Bilbao | 1 |";
    const session = createEditorSession({ source });
    const initial = session.getSnapshot();

    expect(initial.tableViews.Sales).toEqual({
      enabled: true,
      selectedSavedView: "Madrid",
      columns: [{ filter: "mad" }, { sort: "desc" }]
    });
    expect(session.setSheetTableViewState("Sales", {
      enabled: true,
      columns: [{ filter: "bil" }, { sort: "asc" }]
    })).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ revision: 0, source });
    expect(session.getSnapshot().histories).toEqual(initial.histories);
    expect(session.getSnapshot().tableViews.Sales).toEqual({
      enabled: true,
      columns: [{ filter: "bil" }, { sort: "asc" }]
    });
  });
});
