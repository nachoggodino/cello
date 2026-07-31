import { useState } from "react";

const maxHistoryEntries = 100;

interface SourceHistory {
  past: string[];
  future: string[];
}

export function useSourceHistory(currentSource: string, applySourceSnapshot: (source: string) => void, announce: (message: string) => void) {
  const [, setHistory] = useState<SourceHistory>({ past: [], future: [] });

  const pushHistoryEntry = (previousSource: string) => {
    setHistory((current) => ({
      past: [...current.past, previousSource].slice(-maxHistoryEntries),
      future: []
    }));
  };

  const undo = () => {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (previous === undefined) {
        return current;
      }
      applySourceSnapshot(previous);
      announce("Undo");
      return {
        past: current.past.slice(0, -1),
        future: [currentSource, ...current.future].slice(0, maxHistoryEntries)
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0];
      if (next === undefined) {
        return current;
      }
      applySourceSnapshot(next);
      announce("Redo");
      return {
        past: [...current.past, currentSource].slice(-maxHistoryEntries),
        future: current.future.slice(1)
      };
    });
  };

  return { pushHistoryEntry, redo, undo };
}
