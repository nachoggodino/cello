import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { useEffect, useRef } from "react";
import { celloLanguage, celloSyntaxHighlighting } from "./celloLanguage";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          dropCursor(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          highlightSelectionMatches(),
          celloLanguage,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          celloSyntaxHighlighting(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap]),
          editorTheme
        ]
      })
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) {
      return;
    }
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    });
  }, [value]);

  return <div className="editorMount" ref={hostRef} />;
}

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--code-text)",
    backgroundColor: "var(--code-bg-strong)",
    fontSize: "var(--font-size-code)"
  },
  ".cm-scroller": {
    fontFamily: "var(--font-code)",
    lineHeight: "var(--line-height-code)",
    fontVariantLigatures: "contextual"
  },
  ".cm-content": {
    padding: "var(--space-5) 0",
    caretColor: "var(--orange-light)"
  },
  ".cm-line": {
    padding: "0 var(--space-4)"
  },
  ".cm-gutters": {
    backgroundColor: "var(--code-bg-2-strong)",
    borderRight: "1px solid var(--line-on-dark)",
    color: "var(--code-muted)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--orange-wash)",
    color: "var(--orange-pale)"
  },
  ".cm-activeLine": {
    backgroundColor: "var(--surface-on-dark-subtle)"
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--orange-selection)"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--orange)"
  },
  "&.cm-focused": {
    outline: "none"
  }
});
