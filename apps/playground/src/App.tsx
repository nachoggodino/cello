import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { format as formatCello } from "@cello/core";
import type { Diagnostic } from "@cello/core";
import { CelloVisualEditor } from "@cello/editor-react";
import "@cello/editor-react/styles.css";
import logoUrl from "./assets/cello-logo.svg?url";
import { examples, getExample } from "./examples";
import { ToolbarIcon } from "./icons";
import { bylawsUrl, githubUrl, previewDownloadFileName } from "./playgroundConfig";
import { loadStoredState, saveStoredState } from "./playgroundState";
import { buildActiveSheetClipboardPayload, buildActiveSheetClipboardPayloadFromHtml } from "./previewClipboard";
import { syntaxExamples } from "./syntaxReference";
import { useClipboardStatus } from "./useClipboardStatus";
import { usePreviewRender } from "./usePreviewRender";
import { useResizableSplit } from "./useResizableSplit";

const CodeEditor = lazy(async () => ({ default: (await import("./CodeEditor")).CodeEditor }));

type MobilePanel = "editor" | "preview" | "syntax";
type PlaygroundPage = "source" | "visual";

interface ActiveSheetMessage {
  type: "cello:active-sheet";
  sheet: string;
}

const mobilePanels: Array<{ id: MobilePanel; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
  { id: "syntax", label: "Syntax" }
];

export function App() {
  const initialState = useMemo(() => loadStoredState(window.localStorage), []);
  const [page, setPage] = useState<PlaygroundPage>(() => getPageFromHash(window.location.hash));
  const [selectedExampleId, setSelectedExampleId] = useState(initialState.exampleId);
  const [source, setSource] = useState(initialState.source);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");
  const [activeSheetName, setActiveSheetName] = useState<string | undefined>(undefined);
  const { diagnostics, lastGoodHtml, previewHtml, renderState } = usePreviewRender(source);
  const { actionMessage, copiedTarget, copyPayload, copyText, setActionMessage } = useClipboardStatus();
  const {
    editorBasis,
    onDividerKeyDown,
    onDividerPointerDown,
    onDividerPointerMove,
    splitPane,
    stopDrag
  } = useResizableSplit();

  useEffect(() => {
    saveStoredState(window.localStorage, { exampleId: selectedExampleId, source });
  }, [selectedExampleId, source]);

  useEffect(() => {
    const handleHashChange = () => setPage(getPageFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isActiveSheetMessage(event.data)) {
        return;
      }
      setActiveSheetName(event.data.sheet);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);


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

  const formatSource = () => {
    try {
      const formatted = formatCello(source);
      setSource(formatted);
      setActionMessage("Source formatted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(`Format failed: ${message}`);
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
    link.download = previewDownloadFileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setActionMessage("HTML download started.");
  };

  const navigateToPage = (nextPage: PlaygroundPage) => {
    setPage(nextPage);
    window.location.hash = nextPage === "visual" ? "editor" : "playground";
  };

  return (
    <div className="appShell">
      <Topbar currentPage={page} syntaxOpen={syntaxOpen} onNavigate={navigateToPage} onToggleSyntax={() => setSyntaxOpen((open) => !open)} />

      <div className="mobileControls">
        <div className="mobilePageSwitch" role="tablist" aria-label="Playground pages">
          <button type="button" role="tab" aria-selected={page === "source"} className={page === "source" ? "active" : ""} onClick={() => navigateToPage("source")}>Source</button>
          <button type="button" role="tab" aria-selected={page === "visual"} className={page === "visual" ? "active" : ""} onClick={() => navigateToPage("visual")}>Visual</button>
        </div>
        {page === "source" && <MobileSwitch activePanel={mobilePanel} onChange={setMobilePanel} />}
      </div>

      {page === "source" ? (
        <>
          <main className={`workbench ${mobilePanel === "preview" ? "mobilePreviewActive" : ""}`}>
            <div className={`workspace ${syntaxOpen ? "syntaxVisible" : ""}`}>
              <EditorPane
                copiedTarget={copiedTarget}
                editorBasis={editorBasis}
                mobileVisible={mobilePanel === "editor"}
                selectedExampleId={selectedExampleId}
                selectedExampleFileName={selectedExample.fileName}
                source={source}
                onChooseExample={chooseExample}
                onCopy={(value, label) => void copyText(value, label)}
                onFormat={formatSource}
                onReset={resetExample}
                onSourceChange={setSource}
              />

              <div
                className="divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize editor and preview panes"
                aria-valuemin={splitPane.min}
                aria-valuemax={splitPane.max}
                aria-valuenow={Math.round(editorBasis)}
                tabIndex={0}
                onPointerDown={onDividerPointerDown}
                onPointerMove={onDividerPointerMove}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onKeyDown={onDividerKeyDown}
              />

              <PreviewPane
                copiedTarget={copiedTarget}
                lastGoodHtml={lastGoodHtml}
                mobileVisible={mobilePanel === "preview"}
                previewHtml={previewHtml}
                renderState={renderState}
                activeSheetName={activeSheetName}
                onCopyPayload={(payload, label) => void copyPayload(payload, label)}
                onDownload={downloadHtml}
                setActionMessage={setActionMessage}
              />

              <aside id="panel-syntax" role="tabpanel" aria-labelledby="tab-syntax" className={`syntaxPanel ${syntaxOpen ? "open" : ""} ${mobilePanel === "syntax" ? "mobileVisible" : ""}`}>
                <SyntaxPanel
                  onClose={() => {
                    setSyntaxOpen(false);
                    setMobilePanel("editor");
                  }}
                  onCopy={(value, label) => void copyText(value, label)}
                  copiedTarget={copiedTarget}
                />
              </aside>
            </div>

            <DiagnosticsBar actionMessage={actionMessage} diagnostics={diagnostics} hasErrors={hasErrors} issueCount={issueCount} />
          </main>
        </>
      ) : (
        <CelloVisualEditor source={source} onSourceChange={setSource} onRequestSourceView={() => navigateToPage("source")} />
      )}

      <footer className="siteFooter">
        <span>BYLAWS-first syntax for durable plain text spreadsheets.</span>
        <span>Render live, copy HTML, keep the source reviewable.</span>
        <a href={bylawsUrl} target="_blank" rel="noreferrer">Read the BYLAWS</a>
      </footer>
    </div>
  );
}

function isActiveSheetMessage(value: unknown): value is ActiveSheetMessage {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "cello:active-sheet" &&
    "sheet" in value &&
    typeof value.sheet === "string"
  );
}

function getPageFromHash(hash: string): PlaygroundPage {
  return hash.replace(/^#/, "") === "editor" ? "visual" : "source";
}

function Topbar({
  currentPage,
  syntaxOpen,
  onNavigate,
  onToggleSyntax
}: {
  currentPage: PlaygroundPage;
  syntaxOpen: boolean;
  onNavigate: (page: PlaygroundPage) => void;
  onToggleSyntax: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brandLogo" aria-label="cello" style={{ "--logo-url": `url("${logoUrl}")` } as CSSProperties} />
        <p>plain text and LLM friendly spreadsheets</p>
      </div>
      <nav className="topbarNav" aria-label="Playground navigation">
        <button type="button" className={`glassButton topbarPageLink ${currentPage === "source" ? "active" : ""}`} onClick={() => onNavigate("source")}>Source</button>
        <button type="button" className={`glassButton topbarPageLink ${currentPage === "visual" ? "active" : ""}`} onClick={() => onNavigate("visual")}>Visual editor</button>
        <a className="navLink" href={bylawsUrl} target="_blank" rel="noreferrer">BYLAWS</a>
        <a className="navLink" href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        <button type="button" className={`glassButton iconTextButton topbarSyntaxToggle ${syntaxOpen ? "active" : ""}`} onClick={onToggleSyntax} disabled={currentPage !== "source"}>
          <ToolbarIcon name="book" />
          <span>Syntax</span>
        </button>
      </nav>
    </header>
  );
}

function MobileSwitch({ activePanel, onChange }: { activePanel: MobilePanel; onChange: (panel: MobilePanel) => void }) {
  return (
    <div className="mobileSwitch" role="tablist" aria-label="Playground panels">
      {mobilePanels.map((panel) => (
        <button
          key={panel.id}
          id={`tab-${panel.id}`}
          role="tab"
          aria-controls={`panel-${panel.id}`}
          aria-selected={activePanel === panel.id}
          className={activePanel === panel.id ? "active" : ""}
          onClick={() => onChange(panel.id)}
        >
          {panel.label}
        </button>
      ))}
    </div>
  );
}

function EditorPane({
  copiedTarget,
  editorBasis,
  mobileVisible,
  selectedExampleFileName,
  selectedExampleId,
  source,
  onChooseExample,
  onCopy,
  onFormat,
  onReset,
  onSourceChange
}: {
  copiedTarget: string;
  editorBasis: number;
  mobileVisible: boolean;
  selectedExampleFileName: string;
  selectedExampleId: string;
  source: string;
  onChooseExample: (exampleId: string) => void;
  onCopy: (value: string, label: string) => void;
  onFormat: () => void;
  onReset: () => void;
  onSourceChange: (value: string) => void;
}) {
  const sourceLabel = ".cel source";
  const [exampleMenuOpen, setExampleMenuOpen] = useState(false);
  const selectedExample = getExample(selectedExampleId);

  const chooseExampleFromMenu = (exampleId: string) => {
    onChooseExample(exampleId);
    setExampleMenuOpen(false);
  };

  return (
    <section id="panel-editor" role="tabpanel" aria-labelledby="tab-editor" className={`pane editorPane ${mobileVisible ? "mobileVisible" : ""}`} style={{ flexBasis: `${editorBasis}%` }}>
      <div className="paneHeader">
        <div className="paneTitle">
          <span>Source</span>
          <strong className="sourceFileName">{selectedExampleFileName}</strong>
        </div>
        <div className="paneActions paneActionsStart">
          <div className="exampleSelect" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setExampleMenuOpen(false);
            }
          }}>
            <button
              type="button"
              className={`exampleSelectButton ${exampleMenuOpen ? "open" : ""}`}
              aria-haspopup="listbox"
              aria-expanded={exampleMenuOpen}
              aria-label="Choose example"
              onClick={() => setExampleMenuOpen((open) => !open)}
            >
              <span>{selectedExample.name}</span>
              <ToolbarIcon name="chevron" />
            </button>
            {exampleMenuOpen && (
              <div className="exampleMenu" role="listbox" aria-label="Choose example">
              {examples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  role="option"
                  aria-selected={selectedExampleId === example.id}
                  className={selectedExampleId === example.id ? "selected" : ""}
                  onClick={() => chooseExampleFromMenu(example.id)}
                >
                  <span>{example.name}</span>
                  <small>{example.fileName}</small>
                </button>
              ))}
              </div>
            )}
          </div>
        </div>
        <div className="paneActions editorActions">
          <button type="button" className="glassButton iconTextButton primaryAction" onClick={onFormat}>
            <ToolbarIcon name="format" />
            <span>Format</span>
          </button>
          <div className="editorUtilityActions">
            <button type="button" className="glassButton iconButton" aria-label="Reset example" title="Reset example" onClick={onReset}>
              <ToolbarIcon name="reset" />
            </button>
            <CopyButton label={sourceLabel} copiedTarget={copiedTarget} onCopy={() => onCopy(source, sourceLabel)} />
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="editorLoading">Loading editor...</div>}>
        <CodeEditor value={source} onChange={onSourceChange} />
      </Suspense>
    </section>
  );
}

function PreviewPane({
  copiedTarget,
  lastGoodHtml,
  mobileVisible,
  previewHtml,
  renderState,
  activeSheetName,
  onCopyPayload,
  onDownload,
  setActionMessage
}: {
  copiedTarget: string;
  lastGoodHtml: string;
  mobileVisible: boolean;
  previewHtml: string;
  renderState: "idle" | "rendering" | "failed";
  activeSheetName?: string;
  onCopyPayload: (payload: { html: string; plainText: string }, label: string) => void;
  onDownload: () => void;
  setActionMessage: (message: string) => void;
}) {
  const previewTitle = renderState === "rendering" ? "Rendering" : renderState === "failed" ? "Last good render" : "Live render";
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const copyVisibleTable = useCallback(() => {
    const frameDocument = previewFrameRef.current?.contentDocument;
    const payload = frameDocument ? buildActiveSheetClipboardPayload(frameDocument, activeSheetName) : null;
    const fallbackPayload = payload ?? buildActiveSheetClipboardPayloadFromHtml(previewHtml || lastGoodHtml, activeSheetName);

    if (!fallbackPayload) {
      setActionMessage("Copy failed: preview table is not ready yet.");
      return;
    }

    onCopyPayload(fallbackPayload, "Table");
  }, [activeSheetName, lastGoodHtml, onCopyPayload, previewHtml, setActionMessage]);

  const resizePreviewFrame = useCallback(() => {
    const frame = previewFrameRef.current;
    if (!frame) {
      return;
    }

    const frameDocument = frame.contentDocument;
    if (!mobileVisible || !window.matchMedia("(max-width: 860px)").matches) {
      frame.style.height = "";
      if (frameDocument) {
        frameDocument.documentElement.style.overflowY = "";
        frameDocument.body.style.overflowY = "";
      }
      return;
    }

    if (!frameDocument) {
      return;
    }

    const { body, documentElement } = frameDocument;
    documentElement.style.overflowY = "hidden";
    body.style.overflowY = "hidden";
    frame.style.height = `${Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, documentElement.scrollHeight, documentElement.offsetHeight, documentElement.clientHeight))}px`;
  }, [mobileVisible]);

  useEffect(() => {
    resizePreviewFrame();
  }, [lastGoodHtml, mobileVisible, previewHtml, resizePreviewFrame]);

  return (
    <div className="previewRegion">
      <section id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" className={`pane previewPane ${mobileVisible ? "mobileVisible" : ""}`}>
        <div className="paneHeader previewHeader">
          <div className="paneTitle">
            <span>{previewTitle}</span>
            <strong>Preview</strong>
          </div>
          <div className="paneActions">
            <CopyButton label="Table" copiedTarget={copiedTarget} disabled={!previewHtml && !lastGoodHtml} onCopy={copyVisibleTable} />
            <button type="button" className="glassButton iconButton exportAction" aria-label="Download HTML" title="Download HTML" onClick={onDownload} disabled={!previewHtml}>
              <ToolbarIcon name="download" />
            </button>
          </div>
        </div>
        <div className="previewFrameWrap">
          {renderState === "rendering" && <div className="previewOverlay">Rendering...</div>}
          <iframe ref={previewFrameRef} title="Rendered Cello workbook" srcDoc={previewHtml || lastGoodHtml} sandbox="allow-scripts allow-same-origin" onLoad={resizePreviewFrame} />
        </div>
      </section>
    </div>
  );
}

function CopyButton({ copiedTarget, disabled = false, label, onCopy }: { copiedTarget: string; disabled?: boolean; label: string; onCopy: () => void }) {
  const copied = copiedTarget === label;

  return (
    <button type="button" className={`glassButton iconButton ${copied ? "success" : ""}`} aria-label={`Copy ${label}`} title={`Copy ${label}`} onClick={onCopy} disabled={disabled}>
      <ToolbarIcon name={copied ? "check" : "copy"} />
    </button>
  );
}

function SyntaxPanel({ onClose, onCopy, copiedTarget }: { onClose: () => void; onCopy: (value: string, label: string) => void; copiedTarget: string }) {
  return (
    <div className="syntaxContent">
      <div className="syntaxHeader">
        <div>
          <span>BYLAWS reference</span>
          <h2>Syntax sheet</h2>
          <p>Small patterns for authoring readable `.cel` files. The full rules live in the BYLAWS.</p>
        </div>
        <div className="syntaxHeaderActions">
          <a className="glassButton iconTextButton bylawsButton" href={bylawsUrl} target="_blank" rel="noreferrer" aria-label="Open BYLAWS.md" title="Open BYLAWS.md">
            <span>BYLAWS</span>
            <ToolbarIcon name="external" />
          </a>
          <button type="button" className="glassButton iconButton" aria-label="Close syntax" title="Close syntax" onClick={onClose}>
            <ToolbarIcon name="x" />
          </button>
        </div>
      </div>
      {syntaxExamples.map((example) => (
        <SyntaxBlock key={example.title} {...example} onCopy={onCopy} copiedTarget={copiedTarget} />
      ))}
    </div>
  );
}

function SyntaxBlock({ title, code, onCopy, copiedTarget }: { title: string; code: string; onCopy: (value: string, label: string) => void; copiedTarget: string }) {
  const label = `Syntax: ${title}`;
  return (
    <section className="syntaxBlock">
      <div className="syntaxBlockHeader">
        <h3>{title}</h3>
        <CopyButton label={label} copiedTarget={copiedTarget} onCopy={() => onCopy(code, label)} />
      </div>
      <pre>{highlightCelloSyntax(code)}</pre>
    </section>
  );
}

function highlightCelloSyntax(code: string): ReactNode[] {
  return code.split("\n").flatMap((line, lineIndex, lines) => {
    const nodes = highlightCelloLine(line, lineIndex);
    return lineIndex < lines.length - 1 ? [...nodes, "\n"] : nodes;
  });
}

function highlightCelloLine(line: string, lineIndex: number): ReactNode[] {
  const tokenPattern =
    /(\/\/.*$|@sheet\b|@header\b|@defaults\b|->|##?[^|]*|=[^|]*|\[[^\]]+\]|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[|<>^])/gi;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    const value = match[0];
    if (match.index > cursor) {
      nodes.push(line.slice(cursor, match.index));
    }
    nodes.push(
      <span key={`${lineIndex}-${match.index}`} className={`syntaxToken ${getSyntaxTokenClass(value)}`}>
        {value}
      </span>
    );
    cursor = match.index + value.length;
  }

  if (cursor < line.length) {
    nodes.push(line.slice(cursor));
  }
  return nodes;
}

function getSyntaxTokenClass(value: string): string {
  if (value.startsWith("//")) {
    return "syntaxTokenComment";
  }
  if (value.startsWith("@")) {
    return "syntaxTokenKeyword";
  }
  if (value.startsWith("[")) {
    return "syntaxTokenAttribute";
  }
  if (value.startsWith("=")) {
    return "syntaxTokenFormula";
  }
  if (value.startsWith("#")) {
    return "syntaxTokenHeading";
  }
  if (value === "->" || value === "<" || value === "^" || value === "|") {
    return "syntaxTokenOperator";
  }
  if (/^(?:true|false|null)$/i.test(value)) {
    return "syntaxTokenAtom";
  }
  return "syntaxTokenNumber";
}

function DiagnosticsBar({ actionMessage, diagnostics, hasErrors, issueCount }: { actionMessage: string; diagnostics: Diagnostic[]; hasErrors: boolean; issueCount: number }) {
  return (
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
  );
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = [diagnostic.sheet, diagnostic.line ? `line ${diagnostic.line}` : ""].filter(Boolean).join(", ");
  return `${diagnostic.level.toUpperCase()}${location ? ` (${location})` : ""}: ${diagnostic.message}`;
}
