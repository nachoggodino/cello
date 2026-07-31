import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";
import { EditorView } from "@codemirror/view";
import CodeMirror, { Transaction } from "@uiw/react-codemirror";
import type {
  BasicSetupOptions,
  ReactCodeMirrorRef,
  ViewUpdate
} from "@uiw/react-codemirror";
import { celloLanguage, celloSyntaxHighlighting } from "./celloLanguage.js";

export interface CodeMirrorSourceSurfaceProps {
  ariaLabel: string;
  readOnly: boolean;
  source: string;
  onBlur: () => void;
  onChange: (source: string, inputType: string) => void;
  onRedo: () => void;
  onUndo: () => void;
}

const basicSetup = {
  allowMultipleSelections: false,
  autocompletion: false,
  bracketMatching: true,
  closeBrackets: true,
  closeBracketsKeymap: true,
  crosshairCursor: false,
  defaultKeymap: true,
  drawSelection: true,
  dropCursor: true,
  foldGutter: false,
  history: false,
  historyKeymap: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  highlightSelectionMatches: true,
  indentOnInput: true,
  lineNumbers: true,
  rectangularSelection: false,
  searchKeymap: true,
  syntaxHighlighting: true,
  tabSize: 2
} satisfies BasicSetupOptions;

const baseExtensions = [celloLanguage, celloSyntaxHighlighting];

export function CodeMirrorSourceSurface({
  ariaLabel,
  readOnly,
  source,
  onBlur,
  onChange,
  onRedo,
  onUndo
}: CodeMirrorSourceSurfaceProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const applyingExternalChangeRef = useRef(false);
  useLayoutEffect(() => {
    const view = editorRef.current?.view;
    if (!view || view.state.doc.toString() === source) {
      return;
    }

    applyingExternalChangeRef.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: source
        },
        annotations: Transaction.userEvent.of("input.external")
      });
    } finally {
      applyingExternalChangeRef.current = false;
    }
  }, [source]);

  const extensions = useMemo(() => [
    ...baseExtensions,
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      "aria-readonly": String(readOnly),
      spellcheck: "false"
    })
  ], [ariaLabel, readOnly]);
  const handleChange = useCallback((value: string, update: ViewUpdate) => {
    if (applyingExternalChangeRef.current) {
      return;
    }
    onChange(value, getUserEvent(update));
  }, [onChange]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || (!event.metaKey && !event.ctrlKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey);
    if (key !== "z" && !redo) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (redo) {
      onRedo();
    } else {
      onUndo();
    }
  }, [onRedo, onUndo, readOnly]);

  return (
    <CodeMirror
      aria-label={ariaLabel}
      basicSetup={basicSetup}
      className="celloSourceInput"
      editable={!readOnly}
      extensions={extensions}
      height="100%"
      indentWithTab
      onBlur={onBlur}
      onChange={handleChange}
      onKeyDownCapture={handleKeyDown}
      readOnly={readOnly}
      ref={editorRef}
      theme="none"
      value={source}
    />
  );
}

function getUserEvent(update: ViewUpdate): string {
  for (const transaction of update.transactions) {
    const userEvent = transaction.annotation(Transaction.userEvent);
    if (userEvent) {
      return userEvent;
    }
  }
  return "input";
}
