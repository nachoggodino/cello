import { useCallback, useEffect, useRef } from "react";
import { buildActiveSheetClipboardPayload, buildActiveSheetClipboardPayloadFromHtml } from "./previewClipboard";
import { mobileBreakpointPx } from "./playgroundConfig";

interface UsePreviewFrameOptions {
  activeSheetName: string;
  html: string;
  mobileVisible: boolean;
  onCopyPayload: (payload: { html: string; plainText: string }, label: string) => void;
  setActionMessage: (message: string) => void;
}

export function usePreviewFrame({ activeSheetName, html, mobileVisible, onCopyPayload, setActionMessage }: UsePreviewFrameOptions) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const copyVisibleTable = useCallback(() => {
    const liveDocument = frameRef.current?.contentDocument;
    const payload = liveDocument ? buildActiveSheetClipboardPayload(liveDocument, activeSheetName) : null;
    const fallbackPayload = payload ?? buildActiveSheetClipboardPayloadFromHtml(html, activeSheetName);
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
  const onFrameLoad = useCallback(
    (frame: HTMLIFrameElement) => {
      frameRef.current = frame;
      resize();
    },
    [resize]
  );

  useEffect(() => {
    resize();
  }, [html, resize]);

  return { copyVisibleTable, onFrameLoad };
}

function resizePreviewFrame(frame: HTMLIFrameElement, mobileVisible: boolean): void {
  const frameDocument = frame.contentDocument;
  const documentElement = frameDocument?.querySelector("html");
  const body = frameDocument?.querySelector("body");
  if (!documentElement || !body) {
    return;
  }
  const mobile = mobileVisible && window.matchMedia(`(max-width: ${mobileBreakpointPx}px)`).matches;
  documentElement.style.overflowY = mobile ? "hidden" : "";
  body.style.overflowY = mobile ? "hidden" : "";
  frame.style.height = mobile ? `${getDocumentHeight(documentElement, body)}px` : "";
}

function getDocumentHeight(documentElement: HTMLElement, body: HTMLElement): number {
  return Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, documentElement.scrollHeight, documentElement.offsetHeight, documentElement.clientHeight));
}
