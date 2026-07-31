import { useEffect, useState } from "react";
import { evaluateEditorWorkbookSource } from "@nachoggodino/cello/editor-core";
import type {
  ComputedCellValues,
  CreateEditorWorkbookOptions
} from "@nachoggodino/cello/editor-core";

type WorkbookParseOptions = Pick<
  CreateEditorWorkbookOptions,
  "baseDir" | "readExternalSource" | "strict"
>;

export function useComputedValues(
  source: string,
  workbookOptions: WorkbookParseOptions
): ComputedCellValues {
  const [computedValues, setComputedValues] = useState<ComputedCellValues>({});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const parseOptions = {
          ...(workbookOptions.baseDir === undefined ? {} : { baseDir: workbookOptions.baseDir }),
          ...(workbookOptions.readExternalSource === undefined
            ? {}
            : { readExternalSource: workbookOptions.readExternalSource }),
          ...(workbookOptions.strict === undefined ? {} : { strict: workbookOptions.strict })
        };
        const nextValues = await evaluateEditorWorkbookSource(source, {
          parse: parseOptions
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
