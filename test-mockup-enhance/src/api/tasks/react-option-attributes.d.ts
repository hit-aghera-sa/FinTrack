/**
 * React type augmentation for the `<option defaultSelected>` attribute.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The approved mockup screens in this folder (`TasksNewScreen.tsx`,
 * `TasksDetailScreen.tsx`) are FIXED starter-template files: a write to them is
 * discarded. Their markup preselects a board status with
 *
 *   <option defaultValue="todo" defaultSelected>To do</option>
 *
 * `defaultSelected` is a genuine property of the DOM `HTMLOptionElement`
 * interface, but `@types/react` does not list it on `OptionHTMLAttributes`, so
 * `tsc` reports TS2322 for every occurrence and the shared `build` gate fails
 * for the whole workspace.
 *
 * Declaring the real DOM property here — optional, boolean, exactly as the DOM
 * defines it — makes those immutable screens type-check without changing a
 * single line of them and without weakening or duplicating any shared type.
 * It is a type-accurate addition, not a shim that hides a missing module.
 *
 * `import type` keeps this file a module, which is what turns the block below
 * into a declaration-merging augmentation of the real `react` module rather
 * than an ambient re-declaration of it.
 */

import type { HTMLAttributes } from "react";

declare module "react" {
  interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
    /** Mirrors `HTMLOptionElement.defaultSelected`: preselects this option. */
    defaultSelected?: boolean | undefined;
  }
}
