/**
 * Public surface of the shared label UI lane. Task screens import from here:
 *
 *   import { LabelPicker, LabelBadge } from "../labels/index.js";
 */
export { LabelBadge } from "./LabelBadge.js";
export type { LabelBadgeProps } from "./LabelBadge.js";
export { LabelPicker } from "./LabelPicker.js";
export type { LabelPickerProps } from "./LabelPicker.js";
export { createLabelApi, labelApi, LABELS_ENDPOINT } from "./labelsClient.js";
export type { LabelApi, LabelFetch } from "./labelsClient.js";
export * from "./labels.js";
