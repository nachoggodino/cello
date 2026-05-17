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
        doc: value,
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
          EditorView.lineWrapping,
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
    color: "#f7ead9",
    backgroundColor: "rgba(37, 24, 17, 0.94)",
    fontSize: "14px"
  },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    lineHeight: "1.65"
  },
  ".cm-content": {
    padding: "18px 0",
    caretColor: "#f0a64b"
  },
  ".cm-line": {
    padding: "0 18px"
  },
  ".cm-gutters": {
    backgroundColor: "rgba(24, 15, 10, 0.92)",
    borderRight: "1px solid rgba(255, 226, 185, 0.11)",
    color: "#9a8271"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(213, 137, 57, 0.18)",
    color: "#ffd29a"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 224, 178, 0.055)"
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(226, 145, 58, 0.32)"
  },
  "&.cm-focused": {
    outline: "none"
  }
});
