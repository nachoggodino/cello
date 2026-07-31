import {
  CELLO_HEADING_STYLES,
  ROW_HEIGHT_PRESETS,
  SHEET_COLUMNS_MODES,
  SHEET_ROWS_MODES,
  TEXT_TONES,
  WIDTH_PRESET_NAMES
} from "@nachoggodino/cello/editor-core";
import type {
  ColorModifierKey,
  TextTone,
  ToggleModifierKey
} from "@nachoggodino/cello/editor-core";
import { EditorIcon } from "../icons.js";
import { renderFormulaHighlight } from "../textPresentation.js";
import type { CelloVisualEditorLabels } from "../types.js";
import { IconButton, IconTextButton, ValueMenu } from "./controls.js";

const headingStyles = CELLO_HEADING_STYLES.map((heading) => ({
  labelKey: heading.level,
  prefix: heading.prefix
}));

interface InheritedGroup {
  scope: string;
  modifiers: Array<{ key: string; raw: string; value?: string }>;
}

export interface EditorToolbarModel {
  labels: CelloVisualEditorLabels;
  selectedLabel: string;
  selectedContentText: string;
  selectedModifierText: string;
  modifiersMixed: boolean;
  inheritedGroups: InheritedGroup[];
  controlsDisabled: boolean;
  boldActive: boolean;
  italicActive: boolean;
  strikeActive: boolean;
  selectedHeadingPrefix: string | undefined;
  selectedTextColor: string;
  selectedFillColor: string;
  selectedTone: string | undefined;
  columnsMode: "normal" | "fit";
  rowsMode: "wrap" | "ellipsis";
  canAddColumn: boolean;
  selectedColumnResolvedFit: boolean;
  selectedWidthDisplay: string;
  selectedColumnWidth: string | undefined;
  selectedRowWrap: boolean;
  selectedRowHeight: string | undefined;
  showSourceButton: boolean;
}

export interface EditorToolbarActions {
  changeContent: (value: string) => void;
  changeModifiers: (value: string) => void;
  toggleModifier: (key: ToggleModifierKey) => void;
  toggleInlineStrike: () => void;
  applyPrefix: (prefix: string) => void;
  setColor: (key: ColorModifierKey, value: string) => void;
  setTone: (value: TextTone) => void;
  setColumnsMode: (value: "normal" | "fit") => void;
  setRowsMode: (value: "wrap" | "ellipsis") => void;
  mergeLeft: () => void;
  mergeUp: () => void;
  addRow: () => void;
  addColumn: () => void;
  toggleColumnFit: () => void;
  setColumnWidth: (value: string | undefined) => void;
  toggleRowWrap: () => void;
  setRowHeight: (value: string | undefined) => void;
  requestSourceView: () => void;
}

export function EditorToolbarRows({
  actions,
  model
}: {
  actions: EditorToolbarActions;
  model: EditorToolbarModel;
}) {
  const { labels } = model;

  return (
    <>
      <div className="celloVisualToolbarRow celloVisualToolbarTopRow">
        <div className="celloVisualToolbarGroup celloVisualToolbarIdentity">
          <span className="celloVisualCellAddress">{model.selectedLabel}</span>
          <div className="celloVisualFormulaEditor">
            <div className="celloVisualFormulaHighlight" aria-hidden="true">
              {renderFormulaHighlight(model.selectedContentText)}
            </div>
            <textarea
              className={[
                "celloVisualFormulaInput",
                "celloVisualFormulaArea",
                model.selectedContentText.startsWith("=") ? "hasHighlight" : ""
              ].filter(Boolean).join(" ")}
              aria-label={labels.selectedCellSource}
              rows={1}
              value={model.selectedContentText}
              onChange={(event) => { actions.changeContent(event.target.value); }}
            />
          </div>
        </div>

        <label className="celloVisualModifiersPanel">
          <span>{labels.modifiers}</span>
          <input
            aria-label={labels.modifiers}
            value={model.selectedModifierText}
            placeholder={model.modifiersMixed ? "Mixed" : undefined}
            onChange={(event) => { actions.changeModifiers(event.target.value); }}
          />
        </label>

        <div
          className="celloVisualInheritedPanel"
          aria-label={labels.inherited}
        >
          <span>{labels.inherited}</span>
          <div>
            {model.inheritedGroups.length > 0 ? (
              model.inheritedGroups.map((group) => (
                <span
                  key={group.scope}
                  className={`celloVisualInheritedToken ${group.scope}`}
                >
                  {group.scope}:{" "}
                  {group.modifiers.map(formatInheritedModifier).join("")}
                </span>
              ))
            ) : (
              <span className="celloVisualInheritedEmpty">
                {labels.noInheritedModifiers}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="celloVisualToolbarRow celloVisualToolbarFormatRow">
        <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
          <span className="celloVisualGroupLabel">{labels.textGroup}</span>
          <TextModifierButton
            active={model.boldActive}
            disabled={model.controlsDisabled}
            label={labels.bold}
            onClick={() => { actions.toggleModifier("bold"); }}
          >
            <strong>B</strong>
          </TextModifierButton>
          <TextModifierButton
            active={model.italicActive}
            disabled={model.controlsDisabled}
            label={labels.italic}
            onClick={() => { actions.toggleModifier("italic"); }}
          >
            <em>I</em>
          </TextModifierButton>
          <TextModifierButton
            active={model.strikeActive}
            disabled={model.controlsDisabled}
            label={labels.strike}
            onClick={() => { actions.toggleModifier("strike"); }}
            onDoubleClick={actions.toggleInlineStrike}
          >
            <span className="celloVisualStrikeIcon">S</span>
          </TextModifierButton>
          {headingStyles.map((style) => (
            <IconTextButton
              key={style.labelKey}
              active={model.selectedHeadingPrefix === style.prefix}
              disabled={model.controlsDisabled}
              label={labels[style.labelKey]}
              onClick={() => { actions.applyPrefix(style.prefix); }}
            />
          ))}
          <label
            className="celloVisualColorTool"
            title={labels.textColor}
            aria-label={labels.textColor}
          >
            <span style={{ color: model.selectedTextColor }}>A</span>
            <input
              type="color"
              value={model.selectedTextColor}
              disabled={model.controlsDisabled}
              onChange={(event) =>
                { actions.setColor("color", event.target.value); }
              }
            />
          </label>
          <label
            className="celloVisualColorTool"
            title={labels.fillColor}
            aria-label={labels.fillColor}
            style={{ background: model.selectedFillColor }}
          >
            <EditorIcon name="paint" />
            <input
              type="color"
              value={model.selectedFillColor}
              disabled={model.controlsDisabled}
              onChange={(event) => { actions.setColor("bg", event.target.value); }}
            />
          </label>
          <ValueMenu
            ariaLabel={labels.tone}
            buttonClassName={
              model.selectedTone
                ? `celloVisualTone celloVisualTone-${model.selectedTone}`
                : ""
            }
            displayValue={
              model.selectedTone
                ? `${labels.tone}: ${model.selectedTone}`
                : labels.tone
            }
            disabled={model.controlsDisabled}
            options={TEXT_TONES.map((tone) => ({
              label: tone,
              value: tone,
              className: `celloVisualTone celloVisualTone-${tone}`
            }))}
            value={model.selectedTone}
            onChange={(value) => { actions.setTone(value as TextTone); }}
          />
        </div>

        <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
          <span className="celloVisualGroupLabel">{labels.tableGroup}</span>
          <ValueMenu
            ariaLabel={labels.columnsMode}
            displayValue={`Col: ${formatLayoutValue(model.columnsMode)}`}
            options={SHEET_COLUMNS_MODES.map((mode) => ({
              label:
                mode === "normal" ? labels.columnsNormal : labels.columnsFit,
              value: mode
            }))}
            value={model.columnsMode}
            disabled={model.controlsDisabled}
            onChange={(value) =>
              { actions.setColumnsMode(value as "normal" | "fit"); }
            }
          />
          <ValueMenu
            ariaLabel={labels.rowsMode}
            displayValue={`Row: ${formatLayoutValue(model.rowsMode)}`}
            options={SHEET_ROWS_MODES.map((mode) => ({
              label: mode === "ellipsis" ? labels.rowsEllipsis : labels.rowsWrap,
              value: mode
            }))}
            value={model.rowsMode}
            disabled={model.controlsDisabled}
            onChange={(value) =>
              { actions.setRowsMode(value as "wrap" | "ellipsis"); }
            }
          />
          <IconButton
            label={labels.mergeLeft}
            icon="mergeLeft"
            disabled={model.controlsDisabled}
            onClick={actions.mergeLeft}
          />
          <IconButton
            label={labels.mergeUp}
            icon="mergeUp"
            disabled={model.controlsDisabled}
            onClick={actions.mergeUp}
          />
          <IconButton label={labels.newRow} icon="row" onClick={actions.addRow} />
          <IconButton
            label={labels.newColumn}
            icon="column"
            disabled={!model.canAddColumn}
            onClick={actions.addColumn}
          />
        </div>

        <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
          <span className="celloVisualGroupLabel">{labels.selectedColumn}</span>
          <button
            type="button"
            className={[
              "celloVisualButton",
              model.selectedColumnResolvedFit ? "active" : ""
            ].filter(Boolean).join(" ")}
            aria-label={labels.fit}
            disabled={model.controlsDisabled}
            onClick={actions.toggleColumnFit}
          >
            {labels.fit}
          </button>
          <ValueMenu
            ariaLabel={labels.width}
            displayValue={model.selectedWidthDisplay}
            customPlaceholder={labels.width}
            options={WIDTH_PRESET_NAMES.map((value) => ({
              label: value,
              value
            }))}
            value={model.selectedColumnWidth}
            disabled={model.controlsDisabled}
            onChange={(value) =>
              { actions.setColumnWidth(value.trim() || undefined); }
            }
          />
        </div>

        <div className="celloVisualToolbarGroup celloVisualLabeledGroup">
          <span className="celloVisualGroupLabel">{labels.selectedRow}</span>
          <button
            type="button"
            className={[
              "celloVisualButton",
              model.selectedRowWrap ? "active" : ""
            ].filter(Boolean).join(" ")}
            aria-label={labels.wrap}
            disabled={model.controlsDisabled}
            onClick={actions.toggleRowWrap}
          >
            {labels.wrap}
          </button>
          <ValueMenu
            ariaLabel={labels.height}
            displayValue={model.selectedRowHeight ?? "auto"}
            customPlaceholder={labels.height}
            options={ROW_HEIGHT_PRESETS.map((value) => ({
              label: value,
              value
            }))}
            value={model.selectedRowHeight}
            disabled={model.controlsDisabled}
            onChange={(value) => { actions.setRowHeight(value.trim() || undefined); }}
          />
        </div>

        {model.showSourceButton ? (
          <button
            type="button"
            className="celloVisualButton celloVisualIconTextButton celloVisualSourceButton"
            aria-label={labels.source}
            disabled={model.controlsDisabled}
            onClick={actions.requestSourceView}
          >
            <EditorIcon name="format" />
            <span>{labels.source}</span>
          </button>
        ) : null}
      </div>
    </>
  );
}

function TextModifierButton({
  active,
  children,
  disabled,
  label,
  onClick,
  onDoubleClick
}: {
  active: boolean;
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "celloVisualButton",
        "celloVisualIconButton",
        active ? "active" : ""
      ].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </button>
  );
}

function formatLayoutValue(value: string): string {
  return (value[0]?.toUpperCase() ?? "") + value.slice(1);
}

function formatInheritedModifier(modifier: {
  key: string;
  raw: string;
  value?: string;
}): string {
  return modifier.key === "default" && modifier.value
    ? `[${modifier.value}]`
    : `[${modifier.raw}]`;
}
