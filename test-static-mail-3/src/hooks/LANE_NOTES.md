# Lane notes — `usetasks-state-http-hook`

This lane owns `src/hooks/**`: the `useTasks` hook, the pure state transitions in
`taskState.ts` and the serial PUT queue in `taskQueue.ts`.

## This lane renders nothing

No module under `src/hooks/` emits DOM, class names, inline styles, font sizes or
user-visible literals of its own. The only string it ever puts on screen is the single
error line, and both of its values (`LOAD_ERROR`, `SAVE_ERROR`) are read from the shared
copy contract in `src/models` — see `taskState.surface.test.ts` for the pinned proof.

Screen-level QA findings therefore never originate here. Kept as a triage record so the
next pass routes them to the lane that actually renders the markup.

## QA cycle `cmtvfk9wd001nifyt0fyixiyt` — filed here, owned elsewhere

### 1. `secret_leak` on `/acceptance-regression-test-suite` (20 occurrences)

The redacted matches decode to the task-list lane's BEM class names, not to credentials:

| redacted match | rendered text |
| --- | --- |
| `sk-l***ow` | `task-list__row` contains `sk-list__row` |
| `sk-l***ox` | `task-list__checkbox` contains `sk-list__checkbox` |
| `sk-l***ne` | `task-list__title--done` contains `sk-list__title--done` |

Each name is counted twice because the lane ships its selectors in the markup **and** in
the inline `<style id="task-list-styles">` block.

* Source: `src/components/task-list/styles.ts`, `TaskList.tsx`, `TaskListRow.tsx`,
  `helpers.ts` (`TASK_LIST_CLASS`, `rowClassName`, `titleClassName`).
* Fix: remove the hyphen that produces the `sk-` sequence — e.g. `task-list__row` ->
  `tasklist__row`, or `tasks-row`.
* Coupling: `e2e/support/app.ts` and the acceptance spec pin `.task-list__title`,
  `.task-list__checkbox` and `.task-list__remove`, so the rename has to land together with
  the suite lane's selector update.

### 2. `design_fidelity:typography` on `/acceptance-regression-test-suite`

* `32px` — the `h1` in `src/App.tsx` plus the global stylesheet the entry imports.
* `14px` — `--font-size-sm, 0.875rem` on `.controls-footer__summary`, `.controls-error`
  and `.controls-empty` in `src/components/controls/styles.ts` (and the equivalent rules in
  the task-list stylesheet).

The pinned design's base size is `16px`; those declarations need to move onto that scale.
