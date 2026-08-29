import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { parseViewFilter } from "@nachoggodino/cello/editor-core";
import type { SheetView, ViewColumnRule } from "@nachoggodino/cello/editor-core";
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
        {enabled
          ? `${totalDataRows - hiddenRowCount} of ${totalDataRows} ${labels.rows}`
          : `${totalDataRows} ${labels.rows}`}
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
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const active = Boolean(rule?.filter || rule?.sort);
  const position = useFilterPopoverPosition(open, triggerRef, popoverRef);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  if (!enabled) return null;
  const openPopover = () => { setOpen((current) => !current); };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={["celloVisualColumnFilter", active ? "active" : ""].filter(Boolean).join(" ")}
        aria-label={`${labels.filterColumn} ${columnLabel}${active ? `, ${labels.activeFilter}` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        data-column={colIndex}
        onMouseDown={(event) => { event.stopPropagation(); }}
        onClick={(event) => { event.stopPropagation(); openPopover(); }}
      >
        <EditorIcon name="filter" />
      </button>
      {open ? createPortal(
        <ColumnFilterPopover
          columnLabel={columnLabel}
          labels={labels}
          popoverId={popoverId}
          popoverRef={popoverRef}
          position={position}
          rule={rule}
          triggerRef={triggerRef}
          onChange={onChange}
          onClose={() => { setOpen(false); }}
        />,
        document.body
      ) : null}
    </>
  );
}

function ColumnFilterPopover({
  columnLabel,
  labels,
  popoverId,
  popoverRef,
  position,
  rule,
  triggerRef,
  onChange,
  onClose
}: {
  columnLabel: string;
  labels: CelloVisualEditorLabels;
  popoverId: string;
  popoverRef: RefObject<HTMLDivElement | null>;
  position: { left: number; top: number };
  rule: ViewColumnRule | undefined;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onChange: (rule: ViewColumnRule) => void;
  onClose: () => void;
}) {
  const invalid = Boolean(rule?.filter && !parseViewFilter(rule.filter));
  const closeAndFocus = () => {
    onClose();
    triggerRef.current?.focus();
  };
  return (
    <div
      ref={popoverRef}
      id={popoverId}
      className="celloVisualFilterPopover"
      role="dialog"
      aria-label={`${labels.filterColumn} ${columnLabel}`}
      style={position}
      onClick={(event) => { event.stopPropagation(); }}
      onMouseDown={(event) => { event.stopPropagation(); }}
      onPaste={(event) => { event.stopPropagation(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") closeAndFocus();
      }}
    >
      <label>
        <span>{labels.filterColumn} {columnLabel}</span>
        <input
          autoFocus
          value={rule?.filter ?? ""}
          placeholder={labels.filterPlaceholder}
          aria-invalid={invalid}
          onChange={(event) => { onChange(updateRule(rule, "filter", event.target.value || undefined)); }}
        />
      </label>
      {invalid ? <span className="celloVisualFilterError" role="status">{labels.invalidNumberFilter}</span> : null}
      <div className="celloVisualFilterSort" role="group" aria-label={labels.sortDirection}>
        {([
          ["", labels.noSort],
          ["asc", labels.sortAscending],
          ["desc", labels.sortDescending]
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={(rule?.sort ?? "") === value ? "active" : ""} onClick={() => {
            onChange(updateRule(rule, "sort", value || undefined));
            closeAndFocus();
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function useFilterPopoverPosition(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
  popoverRef: RefObject<HTMLDivElement | null>
): { left: number; top: number } {
  const [position, setPosition] = useState({ left: 12, top: 12 });
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!trigger || !popover) return;
      const gutter = 8;
      const left = Math.max(gutter, Math.min(trigger.left, window.innerWidth - popover.width - gutter));
      const below = trigger.bottom + 5;
      const above = trigger.top - popover.height - 5;
      const top = below + popover.height <= window.innerHeight - gutter ? below : Math.max(gutter, above);
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, popoverRef, triggerRef]);
  return position;
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
