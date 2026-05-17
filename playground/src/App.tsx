import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Diagnostic } from "@cello/core";
import { examples, getExample } from "./examples";
import { renderPreview } from "./preview";
import { loadStoredState, saveStoredState } from "./playgroundState";

const bylawsUrl = "https://github.com/nachoggodino/cello/blob/main/BYLAWS.md";
const CodeEditor = lazy(async () => ({ default: (await import("./CodeEditor")).CodeEditor }));

type MobilePanel = "editor" | "preview" | "syntax";
type RenderState = "idle" | "rendering" | "failed";

export function App() {
  const initialState = useMemo(() => loadStoredState(window.localStorage), []);
  const [selectedExampleId, setSelectedExampleId] = useState(initialState.exampleId);
  const [source, setSource] = useState(initialState.source);
  const deferredSource = useDeferredValue(source);
  const [previewHtml, setPreviewHtml] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [renderState, setRenderState] = useState<RenderState>("rendering");
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");
  const [editorBasis, setEditorBasis] = useState(50);
  const [actionMessage, setActionMessage] = useState("");
  const dragState = useRef<{ startX: number; startBasis: number } | null>(null);
  const renderRun = useRef(0);
  const lastGoodHtmlRef = useRef("");

  useEffect(() => {
    saveStoredState(window.localStorage, { exampleId: selectedExampleId, source });
  }, [selectedExampleId, source]);

  useEffect(() => {
    const runId = ++renderRun.current;
    setRenderState("rendering");

    const timeout = window.setTimeout(() => {
      void renderPreview(deferredSource)
        .then((result) => {
          if (runId !== renderRun.current) {
            return;
          }
          setPreviewHtml(result.html);
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
  }, [deferredSource]);

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

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(`${label} copied.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(`Copy failed: ${message}`);
    }
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
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setActionMessage("HTML download started.");
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

  const resizeEditor = (nextBasis: number) => {
    setEditorBasis(Math.min(68, Math.max(32, nextBasis)));
  };

  const onDividerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      resizeEditor(editorBasis - 4);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      resizeEditor(editorBasis + 4);
      event.preventDefault();
      return;
    }
    if (event.key === "Home") {
      resizeEditor(32);
      event.preventDefault();
      return;
    }
    if (event.key === "End") {
      resizeEditor(68);
      event.preventDefault();
    }
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
          <button type="button" onClick={() => void copyText(source, ".cel source")}>Copy .cel</button>
          <button type="button" onClick={() => void copyText(previewHtml, "HTML")} disabled={!previewHtml}>Copy HTML</button>
          <button type="button" onClick={downloadHtml} disabled={!previewHtml}>Download HTML</button>
          <button type="button" className={syntaxOpen ? "active" : ""} onClick={() => setSyntaxOpen((open) => !open)}>
            Syntax
          </button>
        </div>
      </header>

      <div className="mobileSwitch" role="tablist" aria-label="Playground panels">
        <button id="tab-editor" role="tab" aria-controls="panel-editor" aria-selected={mobilePanel === "editor"} className={mobilePanel === "editor" ? "active" : ""} onClick={() => setMobilePanel("editor")}>Editor</button>
        <button id="tab-preview" role="tab" aria-controls="panel-preview" aria-selected={mobilePanel === "preview"} className={mobilePanel === "preview" ? "active" : ""} onClick={() => setMobilePanel("preview")}>Preview</button>
        <button id="tab-syntax" role="tab" aria-controls="panel-syntax" aria-selected={mobilePanel === "syntax"} className={mobilePanel === "syntax" ? "active" : ""} onClick={() => setMobilePanel("syntax")}>Syntax</button>
      </div>

      <main className={`workspace ${syntaxOpen ? "syntaxVisible" : ""}`}>
        <section id="panel-editor" role="tabpanel" aria-labelledby="tab-editor" className={`pane editorPane ${mobilePanel === "editor" ? "mobileVisible" : ""}`} style={{ flexBasis: `${editorBasis}%` }}>
          <div className="paneHeader">
            <div>
              <strong>{selectedExample.name}</strong>
              <span>{selectedExample.description}</span>
            </div>
          </div>
          <Suspense fallback={<div className="editorLoading">Loading editor...</div>}>
            <CodeEditor value={source} onChange={setSource} />
          </Suspense>
        </section>

        <div
          className="divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panes"
          aria-valuemin={32}
          aria-valuemax={68}
          aria-valuenow={Math.round(editorBasis)}
          tabIndex={0}
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={onDividerKeyDown}
        />

        <section id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" className={`pane previewPane ${mobilePanel === "preview" ? "mobileVisible" : ""}`}>
          <div className="paneHeader">
            <div>
              <strong>Rendered HTML</strong>
              <span>{renderState === "rendering" ? "Rendering..." : renderState === "failed" ? "Showing last successful preview" : "Live preview"}</span>
            </div>
          </div>
          <div className="previewFrameWrap">
            {renderState === "rendering" && <div className="previewOverlay">Rendering...</div>}
            <iframe title="Rendered Cello workbook" srcDoc={previewHtml || lastGoodHtmlRef.current} sandbox="" />
          </div>
        </section>

        <aside id="panel-syntax" role="tabpanel" aria-labelledby="tab-syntax" className={`syntaxPanel ${syntaxOpen ? "open" : ""} ${mobilePanel === "syntax" ? "mobileVisible" : ""}`}>
          <SyntaxPanel />
        </aside>
      </main>

      <footer className={`diagnostics ${hasErrors ? "hasErrors" : issueCount > 0 ? "hasWarnings" : ""}`}>
        <div className="diagnosticSummary">
          <strong>{issueCount === 0 ? "No issues" : `${issueCount} ${issueCount === 1 ? "issue" : "issues"}`}</strong>
          <span>{issueCount === 0 ? actionMessage || "The workbook parsed and rendered cleanly." : "Review diagnostics below."}</span>
        </div>
        {issueCount > 0 && (
          <ol className="diagnosticList" aria-label="Diagnostics">
            {diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.level}-${diagnostic.sheet ?? ""}-${diagnostic.line ?? ""}-${index}`}>
                {formatDiagnostic(diagnostic)}
              </li>
            ))}
          </ol>
        )}
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
      <SyntaxBlock title="Headers And Rows" code={'@header | Item | Plan[€][2d] | Actual[€][2d] |\n| Hosting | 300 | 340 |\n[bold] | TOTAL | =SUM(Plan) | =SUM(Actual) |'} />
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
