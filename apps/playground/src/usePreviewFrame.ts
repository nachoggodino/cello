import { useCallback, useEffect, useRef } from "react";
import {
  buildActiveSheetClipboardPayload,
  buildActiveSheetClipboardPayloadFromHtml
} from "./previewClipboard";
import { mobileBreakpointPx } from "./playgroundConfig";

interface UsePreviewFrameOptions {
  activeSheetName: string;
  html: string;
  mobileVisible: boolean;
  onCopyPayload: (payload: { html: string; plainText: string }, label: string) => void;
  setActionMessage: (message: string) => void;
}

export function usePreviewFrame({
  activeSheetName,
  html,
  mobileVisible,
  onCopyPayload,
  setActionMessage
}: UsePreviewFrameOptions) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const copyVisibleTable = useCallback(() => {
    const liveDocument = frameRef.current?.contentDocument;
    const payload = liveDocument
      ? buildActiveSheetClipboardPayload(liveDocument, activeSheetName)
      : null;
    const fallbackPayload = payload ?? buildActiveSheetClipboardPayloadFromHtml(
      html,
      activeSheetName
    );
    if (!fallbackPayload) {
      setActionMessage("Copy failed: preview table is not ready yet.");
      return;
    }
    onCopyPayload(fallbackPayload, "Table");
  }, [activeSheetName, html, onCopyPayload, setActionMessage]);
  const resize = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    resizePreviewFrame(frame, mobileVisible);
  }, [mobileVisible]);
  const onFrameLoad = useCallback((frame: HTMLIFrameElement) => {
    frameRef.current = frame;
    resize();
  }, [resize]);

  useEffect(() => {
    resize();
  }, [html, resize]);

  return { copyVisibleTable, onFrameLoad };
}

function resizePreviewFrame(frame: HTMLIFrameElement, mobileVisible: boolean): void {
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    return;
  }
  const mobile = mobileVisible && window.matchMedia(`(max-width: ${mobileBreakpointPx}px)`).matches;
  frameDocument.documentElement.style.overflowY = mobile ? "hidden" : "";
  frameDocument.body.style.overflowY = mobile ? "hidden" : "";
  frame.style.height = mobile ? `${getDocumentHeight(frameDocument)}px` : "";
}

function getDocumentHeight(document: Document): number {
  return Math.ceil(Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  ));
}
