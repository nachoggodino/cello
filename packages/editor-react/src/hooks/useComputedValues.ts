import { useEffect, useState } from "react";
import { evaluateEditorWorkbookSource } from "@nachoggodino/cello/editor-core";
import type {
  ComputedCellValues,
  CreateEditorWorkbookOptions
} from "@nachoggodino/cello/editor-core";

type WorkbookParseOptions = {
  readExternalSource?: NonNullable<CreateEditorWorkbookOptions["readExternalSource"]>;
};

export function useComputedValues(
  source: string,
  workbookOptions: WorkbookParseOptions
): ComputedCellValues {
  const [computedValues, setComputedValues] = useState<ComputedCellValues>({});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const nextValues = await evaluateEditorWorkbookSource(source, {
          parse: workbookOptions
        });
        if (!cancelled) {
          setComputedValues(nextValues);
        }
      } catch {
        if (!cancelled) {
          setComputedValues({});
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [source, workbookOptions]);

  return computedValues;
}
