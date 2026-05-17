import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Diagnostic } from "@cello/core";
import { CodeEditor } from "./CodeEditor";
import { defaultExampleId, examples, getExample } from "./examples";
import { renderPreview, warmPreviewEngine } from "./preview";

const storageKey = "cello-playground:v1";
const bylawsUrl = "https://github.com/nachoggodino/cello/blob/main/BYLAWS.md";

interface StoredState {
  exampleId: string;
  source: string;
}

type MobilePanel = "editor" | "preview" | "syntax";

export function App() {
  const initialState = useMemo(loadStoredState, []);
  const [selectedExampleId, setSelectedExampleId] = useState(initialState.exampleId);
  const [source, setSource] = useState(initialState.source);
  const [previewHtml, setPreviewHtml] = useState("");
  const [lastGoodHtml, setLastGoodHtml] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "failed">("rendering");
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");
  const [editorBasis, setEditorBasis] = useState(50);
  const dragState = useRef<{ startX: number; startBasis: number } | null>(null);
  const renderRun = useRef(0);
  const lastGoodHtmlRef = useRef("");

  useEffect(() => {
    void warmPreviewEngine().catch(() => undefined);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ exampleId: selectedExampleId, source }));
  }, [selectedExampleId, source]);

  useEffect(() => {
    const runId = ++renderRun.current;
    setRenderState("rendering");

    const timeout = window.setTimeout(() => {
      void renderPreview(source)
        .then((result) => {
          if (runId !== renderRun.current) {
            return;
          }
          setPreviewHtml(result.html);
          setLastGoodHtml(result.html);
          lastGoodHtmlRef.current = result.html;
          setDiagnostics(result.diagnostics);
          setRenderState("idle");
        })
        .catch((error: unknown) => {
          if (runId !== renderRun.current) {
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          setPreviewHtml(lastGoodHtmlRef.current);
          setDiagnostics([{ level: "error", message: `Render failed: ${message}` }]);
          setRenderState("failed");
        });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [source]);

  const selectedExample = getExample(selectedExampleId);
  const issueCount = diagnostics.length;
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.level === "error");

  const chooseExample = (exampleId: string) => {
    const next = getExample(exampleId);
    setSelectedExampleId(next.id);
    setSource(next.source);
    setMobilePanel("editor");
  };

  const resetExample = () => {
    const current = getExample(selectedExampleId);
    setSource(current.source);
  };

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const downloadHtml = () => {
    if (!previewHtml) {
      return;
    }
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cello-preview.html";
    link.click();
    URL.revokeObjectURL(url);
  };

  const onDividerPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      dragState.current = { startX: event.clientX, startBasis: editorBasis };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [editorBasis]
  );

  const onDividerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const container = event.currentTarget.parentElement;
    if (!drag || !container) {
      return;
    }
    const delta = ((event.clientX - drag.startX) / container.clientWidth) * 100;
    setEditorBasis(Math.min(68, Math.max(32, drag.startBasis + delta)));
  };

  const stopDrag = () => {
    dragState.current = null;
  };

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">C</div>
          <div>
            <h1>Cello Playground</h1>
            <p>Plain-text spreadsheets, rendered live.</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="exampleSelect">
            <span>Example</span>
            <select value={selectedExampleId} onChange={(event) => chooseExample(event.target.value)}>
              {examples.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={resetExample}>Reset</button>
          <button type="button" onClick={() => void copyText(source)}>Copy .cel</button>
          <button type="button" onClick={() => void copyText(previewHtml)} disabled={!previewHtml}>Copy HTML</button>
          <button type="button" onClick={downloadHtml} disabled={!previewHtml}>Download HTML</button>
          <button type="button" className={syntaxOpen ? "active" : ""} onClick={() => setSyntaxOpen((open) => !open)}>
            Syntax
          </button>
        </div>
      </header>

      <div className="mobileSwitch" role="tablist" aria-label="Playground panels">
        <button className={mobilePanel === "editor" ? "active" : ""} onClick={() => setMobilePanel("editor")}>Editor</button>
        <button className={mobilePanel === "preview" ? "active" : ""} onClick={() => setMobilePanel("preview")}>Preview</button>
        <button className={mobilePanel === "syntax" ? "active" : ""} onClick={() => setMobilePanel("syntax")}>Syntax</button>
      </div>

      <main className={`workspace ${syntaxOpen ? "syntaxVisible" : ""}`}>
        <section className={`pane editorPane ${mobilePanel === "editor" ? "mobileVisible" : ""}`} style={{ flexBasis: `${editorBasis}%` }}>
          <div className="paneHeader">
            <div>
              <strong>{selectedExample.name}</strong>
              <span>{selectedExample.description}</span>
            </div>
          </div>
          <CodeEditor value={source} onChange={setSource} />
        </section>

        <div
          className="divider"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        />

        <section className={`pane previewPane ${mobilePanel === "preview" ? "mobileVisible" : ""}`}>
          <div className="paneHeader">
            <div>
              <strong>Rendered HTML</strong>
              <span>{renderState === "rendering" ? "Rendering..." : renderState === "failed" ? "Showing last successful preview" : "Live preview"}</span>
            </div>
          </div>
          <div className="previewFrameWrap">
            {renderState === "rendering" && <div className="previewOverlay">Rendering...</div>}
            <iframe title="Rendered Cello workbook" srcDoc={previewHtml || lastGoodHtml} sandbox="allow-scripts allow-same-origin" />
          </div>
        </section>

        <aside className={`syntaxPanel ${syntaxOpen ? "open" : ""} ${mobilePanel === "syntax" ? "mobileVisible" : ""}`}>
          <SyntaxPanel />
        </aside>
      </main>

      <footer className={`diagnostics ${hasErrors ? "hasErrors" : issueCount > 0 ? "hasWarnings" : ""}`}>
        <strong>{issueCount === 0 ? "No issues" : `${issueCount} ${issueCount === 1 ? "issue" : "issues"}`}</strong>
        <div>
          {issueCount === 0
            ? "The workbook parsed and rendered cleanly."
            : diagnostics.slice(0, 3).map(formatDiagnostic).join("  ")}
        </div>
      </footer>
    </div>
  );
}

function SyntaxPanel() {
  return (
    <div className="syntaxContent">
      <div className="syntaxHeader">
        <h2>Syntax</h2>
        <a href={bylawsUrl} target="_blank" rel="noreferrer">Open BYLAWS.md</a>
      </div>
      <SyntaxBlock title="Sheets" code={'@sheet Budget\n@sheet Sales [csv]\n@sheet Notes [markdown]\n@sheet Data [json]'} />
      <SyntaxBlock title="Headers And Rows" code={'-Item-Plan[€][2d]-Actual[€][2d]-\n| Hosting | 300 | 340 |\nrow_total[bold] | TOTAL | =SUM(Plan) | =SUM(Actual) |'} />
      <SyntaxBlock title="Formulas" code={'| Total | =SUM(Amount) |\n| Madrid | =SUMIF(Raw!region,"Madrid",Raw!amount) |\n| First sheet | =SUM(!!amount) |'} />
      <SyntaxBlock title="Modifiers" code={'[bold] [italic] [bg:#fef3c7] [#7c2d12]\n[€] [$] [2d] [%]'} />
      <SyntaxBlock title="Merges And Comments" code={'// comments are ignored\n| ## Title | < | < |\n| ^ | stacked | cells |'} />
    </div>
  );
}

function SyntaxBlock({ title, code }: { title: string; code: string }) {
  return (
    <section>
      <h3>{title}</h3>
      <pre>{code}</pre>
    </section>
  );
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = [diagnostic.sheet, diagnostic.line ? `line ${diagnostic.line}` : ""].filter(Boolean).join(", ");
  return `${diagnostic.level.toUpperCase()}${location ? ` (${location})` : ""}: ${diagnostic.message}`;
}

function loadStoredState(): StoredState {
  const fallback = getExample(defaultExampleId);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return { exampleId: fallback.id, source: fallback.source };
    }
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const example = getExample(parsed.exampleId ?? fallback.id);
    return {
      exampleId: example.id,
      source: typeof parsed.source === "string" ? parsed.source : example.source
    };
  } catch {
    return { exampleId: fallback.id, source: fallback.source };
  }
}
