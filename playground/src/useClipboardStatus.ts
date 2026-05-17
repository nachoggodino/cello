import { useCallback, useState } from "react";
import { copiedStatusMs } from "./playgroundConfig";

export function useClipboardStatus() {
  const [actionMessage, setActionMessage] = useState("");
  const [copiedTarget, setCopiedTarget] = useState("");

  const copyText = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(`${label} copied.`);
      setCopiedTarget(label);
      window.setTimeout(() => setCopiedTarget((current) => (current === label ? "" : current)), copiedStatusMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(`Copy failed: ${message}`);
    }
  }, []);

  return { actionMessage, copiedTarget, copyText, setActionMessage };
}
