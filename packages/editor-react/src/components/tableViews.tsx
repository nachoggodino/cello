import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseViewFilter } from "../../../core/src/index.js";
import type { SheetView, ViewColumnRule } from "../../../core/src/index.js";
import { EditorIcon } from "../icons.js";
import type { CelloVisualEditorLabels } from "../types.js";

export function TableViewBar({
  disabled,
  enabled,
  hiddenRowCount,
  labels,
  selectedSavedView,
  totalDataRows,
  views,
  onClear,
  onSelect,
  onToggle
}: {
  disabled: boolean;
  enabled: boolean;
  hiddenRowCount: number;
  labels: CelloVisualEditorLabels;
  selectedSavedView?: string;
  totalDataRows: number;
  views: SheetView[];
  onClear: () => void;
  onSelect: (name: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="celloVisualViewBar">
      <button
        type="button"
        className={["celloVisualButton", "celloVisualViewToggle", enabled ? "active" : ""].filter(Boolean).join(" ")}
        aria-pressed={enabled}
        disabled={disabled}
        title={disabled ? labels.verticalMergeViewWarning : labels.filterAndSort}
        onClick={onToggle}
      >
        <EditorIcon name="filter" />
        <span>{labels.filterAndSort}</span>
      </button>
      {views.length > 0 ? (
        <label className="celloVisualSavedView">
          <span>{labels.savedView}</span>
          <select value={selectedSavedView ?? ""} disabled={disabled} onChange={(event) => { onSelect(event.target.value); }}>
            <option value="">{labels.allRows}</option>
            {views.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}
          </select>
        </label>
      ) : null}
      <span className="celloVisualViewCount" aria-live="polite">
        {enabled ? `${totalDataRows - hiddenRowCount} of ${totalDataRows} rows` : `${totalDataRows} rows`}
      </span>
      {enabled ? <button type="button" className="celloVisualViewClear" onClick={onClear}>{labels.clearView}</button> : null}
      {disabled ? <span className="celloVisualViewWarning" role="status">{labels.verticalMergeViewWarning}</span> : null}
    </div>
  );
}

export function ColumnViewButton({
  colIndex,
  columnLabel,
  enabled,
  labels,
  rule,
  onChange
}: {
  colIndex: number;
  columnLabel: string;
  enabled: boolean;
  labels: CelloVisualEditorLabels;
  rule: ViewColumnRule | undefined;
  onChange: (rule: ViewColumnRule) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const active = Boolean(rule?.filter || rule?.sort);
  const invalid = Boolean(rule?.filter && !parseViewFilter(rule.filter));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!enabled) return null;
  const openPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)), top: Math.min(rect.bottom + 5, window.innerHeight - 156) });
    setOpen((current) => !current);
  };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={["celloVisualColumnFilter", active ? "active" : ""].filter(Boolean).join(" ")}
        aria-label={`${labels.filterColumn} ${columnLabel}${active ? ", active" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-column={colIndex}
        onMouseDown={(event) => { event.stopPropagation(); }}
        onClick={(event) => { event.stopPropagation(); openPopover(); }}
      >
        <EditorIcon name="filter" />
      </button>
      {open ? createPortal(
        <div ref={popoverRef} className="celloVisualFilterPopover" role="dialog" aria-label={`${labels.filterColumn} ${columnLabel}`} style={position}>
          <label>
            <span>{labels.filterColumn} {columnLabel}</span>
            <input
              autoFocus
              value={rule?.filter ?? ""}
              placeholder="Contains, *wildcard*, >100"
              aria-invalid={invalid}
              onChange={(event) => { onChange(updateRule(rule, "filter", event.target.value || undefined)); }}
            />
          </label>
          {invalid ? <span className="celloVisualFilterError">Enter a number after a comparison operator.</span> : null}
          <div className="celloVisualFilterSort" role="group" aria-label="Sort direction">
            {([
              ["", labels.noSort],
              ["asc", labels.sortAscending],
              ["desc", labels.sortDescending]
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className={(rule?.sort ?? "") === value ? "active" : ""} onClick={() => {
                onChange(updateRule(rule, "sort", value || undefined));
                setOpen(false);
              }}>{label}</button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function updateRule(
  rule: ViewColumnRule | undefined,
  key: "filter" | "sort",
  value: string | undefined
): ViewColumnRule {
  const next = { ...(rule ?? {}) };
  if (value === undefined) Reflect.deleteProperty(next, key);
  else if (key === "filter") next.filter = value;
  else next.sort = value as "asc" | "desc";
  return next;
}
