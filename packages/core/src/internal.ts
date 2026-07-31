// Repository-internal composition surface. This module is intentionally absent
// from package.json exports and has no compatibility guarantee.
export * from "./index.js";
export { resolveWorkbookIdentity } from "./shared/identity.js";
export type { WorkbookIdentity, WorkbookIdentityLocations } from "./shared/identity.js";
export type { ResolvedHeight, ResolvedRowLayout, ResolvedWidth } from "./shared/layout.js";
export type { CurrencySymbol, NumericDisplayFormat, ToneName } from "./shared/display.js";
export {
  DEFAULT_COLUMN_WIDTH,
  CELL_LAYOUT_METRICS,
  FIT_COLUMN_MAX_WIDTH,
  FIT_COLUMN_MIN_WIDTH,
  DEFAULT_ROW_LAYOUT,
  ROW_HEIGHT_PRESETS,
  SHEET_LAYOUT_DEFAULT_SENTINEL,
  SHEET_COLUMNS_MODES,
  SHEET_ROWS_MODES,
  WIDTH_PRESETS,
  WIDTH_PRESET_NAMES,
  expandAliasModifiers,
  fitCandidateValue,
  heightContentToCss,
  heightOuterToCss,
  isFitCandidateCell,
  isLayoutModifierKey,
  isSheetColumnsMode,
  isSheetRowsMode,
  parseHeightValue,
  parseWidthValue,
  literalFitValue,
  resolveColumnWidth,
  resolveRowLayout,
  widthContentToCss,
  widthOuterToCss
} from "./shared/layout.js";
export {
  CELLO_HEADING_STYLES,
  CELLO_TONE_COLORS,
  CELLO_TONE_NAMES,
  collectNumericDisplayFormat,
  formatDisplayValue,
  isCurrencyModifier,
  parseDecimalsModifier
} from "./shared/display.js";
export { isNamedColorModifier, sanitizeCssColor } from "./shared/colors.js";
export {
  cleanInlineDisplayText,
  getInlineTextStyle,
  getModifierStyle,
  getModifierStyleRules,
  getRowLayoutClasses,
  getRowLayoutStyleRules,
  getToneClasses
} from "./shared/presentation.js";
export type { PresentationStyle } from "./shared/presentation.js";
export { sheetLayoutToModifiers, sheetLayoutToToken, stringifyModifiers } from "./shared/serialization.js";
export { isCellModifier, isKnownModifier, isSheetFormatModifier, parseModifier, parseSheetFormat, parseTrailingModifiers } from "./shared/utils.js";
