import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Diagnostic } from "@cello/core";
import { createEditorSession } from "@cello/editor-core";
import type { EditorSession } from "@cello/editor-core";
import {
  CelloHtmlPreview,
  CelloSourceEditor,
  CelloVisualEditor,
  useEditorSession
} from "@cello/editor-react";
import type { CelloPreviewState } from "@cello/editor-react";
import "@cello/editor-react/styles.css";
import logoUrl from "./assets/cello-logo.svg?url";
import { examples, getExample } from "./examples";
import { ToolbarIcon } from "./icons";
import {
  bylawsUrl,
  githubUrl,
  previewDownloadFileName,
  renderDebounceMs
} from "./playgroundConfig";
import { loadStoredState, saveStoredState } from "./playgroundState";
import { syntaxExamples } from "./syntaxReference";
import { useClipboardStatus } from "./useClipboardStatus";
import { usePreviewFrame } from "./usePreviewFrame";
import { useResizableSplit } from "./useResizableSplit";

type MobilePanel = "editor" | "preview" | "syntax";
type PlaygroundPage = "source" | "visual";

const mobilePanels: Array<{ id: MobilePanel; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
  { id: "syntax", label: "Syntax" }
];

const initialPreviewState: CelloPreviewState = {
  revision: -1,
  html: "",
  status: "idle"
};

export function App() {
  const initialState = useMemo(() => loadStoredState(window.localStorage), []);
  const [session] = useState(() => createEditorSession({
    source: initialState.source,
    readExternalSource(path) {
      throw new Error(`External file sources are not available in the browser playground: ${path}`);
    }
  }));
  const snapshot = useEditorSession(session);
  const [page, setPage] = useState<PlaygroundPage>(() => getPageFromHash(window.location.hash));
  const [selectedExampleId, setSelectedExampleId] = useState(initialState.exampleId);
  const [previewState, setPreviewState] = useState<CelloPreviewState>(initialPreviewState);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");
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
    saveStoredState(window.localStorage, { exampleId: selectedExampleId, source: snapshot.source });
  }, [selectedExampleId, snapshot.source]);

  useEffect(() => {
    if (!snapshot.activeSheetName) {
      return;
    }
    try {
      window.localStorage.setItem(
        `cello:active-sheet:${window.location.pathname}`,
        snapshot.activeSheetName
      );
    } catch {
      // Best effort only; the preview frame is still synchronized directly.
    }
  }, [snapshot.activeSheetName]);

  useEffect(() => {
    const handleHashChange = () => { setPage(getPageFromHash(window.location.hash)); };
    window.addEventListener("hashchange", handleHashChange);
    return () => { window.removeEventListener("hashchange", handleHashChange); };
  }, []);

  const selectedExample = getExample(selectedExampleId);
  const diagnostics = getPlaygroundDiagnostics(snapshot.document.diagnostics, previewState);
  const issueCount = diagnostics.length;
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.level === "error");

  const chooseExample = (exampleId: string) => {
    const next = getExample(exampleId);
    setSelectedExampleId(next.id);
    session.replaceExternalSource(next.source);
    setMobilePanel("editor");
  };

  const resetExample = () => {
    const current = getExample(selectedExampleId);
    session.replaceExternalSource(current.source);
  };

  const formatSource = () => {
    const result = session.format("pretty");
    if (result.ok) {
      setActionMessage("Source formatted.");
    } else {
      setActionMessage(`Format failed: ${result.message}`);
    }
  };

  const downloadHtml = () => {
    if (!previewState.html) {
      return;
    }
    const blob = new Blob([previewState.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = previewDownloadFileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => { URL.revokeObjectURL(url); }, 0);
    setActionMessage("HTML download started.");
  };

  const navigateToPage = (nextPage: PlaygroundPage) => {
    setPage(nextPage);
    window.location.hash = nextPage === "visual" ? "editor" : "playground";
  };

  return (
    <div className="appShell">
      <Topbar currentPage={page} syntaxOpen={syntaxOpen} onNavigate={navigateToPage} onToggleSyntax={() => { setSyntaxOpen((open) => !open); }} />

      {page === "source" ? (
        <div className="mobileControls">
          <MobileSwitch activePanel={mobilePanel} onChange={setMobilePanel} />
        </div>
      ) : null}

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
                session={session}
                source={snapshot.source}
                onChooseExample={chooseExample}
                onCopy={(value, label) => void copyText(value, label)}
                onFormat={formatSource}
                onReset={resetExample}
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
                mobileVisible={mobilePanel === "preview"}
                previewState={previewState}
                session={session}
                activeSheetName={snapshot.activeSheetName}
                onCopyPayload={(payload, label) => void copyPayload(payload, label)}
                onDownload={downloadHtml}
                onPreviewStateChange={setPreviewState}
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
        <CelloVisualEditor
          session={session}
          onCommandFailure={(failure) => { setActionMessage(failure.message); }}
          onRequestSourceView={() => { navigateToPage("source"); }}
        />
      )}

      <footer className="siteFooter">
        <span>BYLAWS-first syntax for durable plain text spreadsheets.</span>
        <span>Render live, copy HTML, keep the source reviewable.</span>
        <a href={bylawsUrl} target="_blank" rel="noreferrer">Read the BYLAWS</a>
      </footer>
    </div>
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
        <button type="button" className={`glassButton topbarPageLink ${currentPage === "source" ? "active" : ""}`} onClick={() => { onNavigate("source"); }}>Source</button>
        <button type="button" className={`glassButton topbarPageLink ${currentPage === "visual" ? "active" : ""}`} onClick={() => { onNavigate("visual"); }}>Visual editor</button>
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
          onClick={() => { onChange(panel.id); }}
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
  session,
  source,
  onChooseExample,
  onCopy,
  onFormat,
  onReset
}: {
  copiedTarget: string;
  editorBasis: number;
  mobileVisible: boolean;
  selectedExampleFileName: string;
  selectedExampleId: string;
  session: EditorSession;
  source: string;
  onChooseExample: (exampleId: string) => void;
  onCopy: (value: string, label: string) => void;
  onFormat: () => void;
  onReset: () => void;
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
              onClick={() => { setExampleMenuOpen((open) => !open); }}
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
                  onClick={() => { chooseExampleFromMenu(example.id); }}
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
            <CopyButton label={sourceLabel} copiedTarget={copiedTarget} onCopy={() => { onCopy(source, sourceLabel); }} />
          </div>
        </div>
      </div>
      <CelloSourceEditor
        ariaLabel="Cello source"
        className="playgroundSourceEditor"
        session={session}
        showToolbar={false}
      />
    </section>
  );
}

function PreviewPane({
  copiedTarget,
  mobileVisible,
  previewState,
  session,
  activeSheetName,
  onCopyPayload,
  onDownload,
  onPreviewStateChange,
  setActionMessage
}: {
  copiedTarget: string;
  mobileVisible: boolean;
  previewState: CelloPreviewState;
  session: EditorSession;
  activeSheetName: string;
  onCopyPayload: (payload: { html: string; plainText: string }, label: string) => void;
  onDownload: () => void;
  onPreviewStateChange: (state: CelloPreviewState) => void;
  setActionMessage: (message: string) => void;
}) {
  const previewTitle = previewState.status === "rendering"
    ? "Rendering"
    : previewState.status === "error" ? "Last good render" : "Live render";
  const { copyVisibleTable, onFrameLoad } = usePreviewFrame({
    activeSheetName,
    html: previewState.html,
    mobileVisible,
    onCopyPayload,
    setActionMessage
  });

  return (
    <div className="previewRegion">
      <section id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" className={`pane previewPane ${mobileVisible ? "mobileVisible" : ""}`}>
        <div className="paneHeader previewHeader">
          <div className="paneTitle">
            <span>{previewTitle}</span>
            <strong>Preview</strong>
          </div>
          <div className="paneActions">
            <CopyButton label="Table" copiedTarget={copiedTarget} disabled={!previewState.html} onCopy={copyVisibleTable} />
            <button type="button" className="glassButton iconButton exportAction" aria-label="Download HTML" title="Download HTML" onClick={onDownload} disabled={!previewState.html}>
              <ToolbarIcon name="download" />
            </button>
          </div>
        </div>
        <div className="previewFrameWrap">
          {previewState.status === "rendering" && <div className="previewOverlay">Rendering...</div>}
          <CelloHtmlPreview
            className="playgroundHtmlPreview"
            debounceMs={renderDebounceMs}
            iframeTitle="Rendered Cello workbook"
            onFrameLoad={onFrameLoad}
            onStateChange={onPreviewStateChange}
            session={session}
          />
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
        <CopyButton label={label} copiedTarget={copiedTarget} onCopy={() => { onCopy(code, label); }} />
      </div>
      <pre><code>{code}</code></pre>
    </section>
  );
}

function DiagnosticsBar({ actionMessage, diagnostics, hasErrors, issueCount }: { actionMessage: string; diagnostics: readonly Diagnostic[]; hasErrors: boolean; issueCount: number }) {
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

function getPlaygroundDiagnostics(
  diagnostics: readonly Diagnostic[],
  previewState: CelloPreviewState
): readonly Diagnostic[] {
  if (!previewState.error) {
    return diagnostics;
  }
  return [...diagnostics, { level: "error", message: `Render failed: ${previewState.error}` }];
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = [diagnostic.sheet, diagnostic.line ? `line ${diagnostic.line}` : ""].filter(Boolean).join(", ");
  return `${diagnostic.level.toUpperCase()}${location ? ` (${location})` : ""}: ${diagnostic.message}`;
}
