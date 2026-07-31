import { useCallback, useState } from "react";
import { copiedStatusMs } from "./playgroundConfig";
import type { ClipboardPayload } from "./previewClipboard";

export function useClipboardStatus() {
  const [actionMessage, setActionMessage] = useState("");
  const [copiedTarget, setCopiedTarget] = useState("");

  const copyText = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(`${label} copied.`);
      setCopiedTarget(label);
      window.setTimeout(() => {
        setCopiedTarget((current) => (current === label ? "" : current));
      }, copiedStatusMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(`Copy failed: ${message}`);
    }
  }, []);

  const copyPayload = useCallback(async (payload: ClipboardPayload, label: string) => {
    try {
      if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([payload.html], { type: "text/html" }),
            "text/plain": new Blob([payload.plainText], { type: "text/plain" })
          })
        ]);
      } else if (copyViaExecCommand(payload)) {
        // Prefer the legacy rich-copy path over writeText so paste targets receive HTML tables.
      } else if (typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(payload.plainText);
      } else {
        throw new Error("Clipboard access is unavailable in this browser");
      }
      setActionMessage(`${label} copied.`);
      setCopiedTarget(label);
      window.setTimeout(() => {
        setCopiedTarget((current) => (current === label ? "" : current));
      }, copiedStatusMs);
    } catch (error) {
      if (copyViaExecCommand(payload)) {
        setActionMessage(`${label} copied.`);
        setCopiedTarget(label);
        window.setTimeout(() => {
          setCopiedTarget((current) => (current === label ? "" : current));
        }, copiedStatusMs);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(`Copy failed: ${message}`);
    }
  }, []);

  return { actionMessage, copiedTarget, copyPayload, copyText, setActionMessage };
}

function copyViaExecCommand(payload: ClipboardPayload): boolean {
  // ClipboardItem is not uniformly available; keep this deprecated API as a last-resort fallback.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousRanges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.opacity = "0";
  container.innerHTML = payload.html;
  document.body.appendChild(container);

  const listener = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData("text/plain", payload.plainText);
    event.clipboardData?.setData("text/html", payload.html);
  };

  const range = document.createRange();
  range.selectNodeContents(container);
  selection.removeAllRanges();
  selection.addRange(range);
  container.focus();
  document.addEventListener("copy", listener);

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", listener);
    selection.removeAllRanges();
    for (const previousRange of previousRanges) {
      selection.addRange(previousRange);
    }
    container.remove();
    activeElement?.focus();
  }
}
