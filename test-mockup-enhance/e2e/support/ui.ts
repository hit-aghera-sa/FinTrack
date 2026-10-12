// e2e/support/ui.ts
//
// Browser-side helpers shared by the feature specs. Everything here reaches the app only through
// the page; nothing is imported from src/.
import { expect, type Locator, type Page } from '@playwright/test';
import { settle } from './capture.js';
import { TASK_STATUS_LABELS, type TaskStatus } from './boardApi.js';

/** Opens a route of the running app and waits for the screen to finish loading. */
export async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** The pathname the browser is currently showing. */
export function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}

/** Presses the button whose accessible name matches, failing with a readable message when there is none. */
export async function clickButton(scope: Page | Locator, name: RegExp): Promise<void> {
  const button = scope.getByRole('button', { name }).first();
  await expect(button, `a button matching ${String(name)} must be on screen`).toBeVisible();
  await button.click();
}

/**
 * Which board column currently holds the card for `title`.
 *
 * Found structurally rather than by guessing at class names: the deepest element whose text holds
 * the title is the card's text, and the nearest ancestor whose text mentions exactly ONE of the
 * three column headings is that card's column.
 */
export async function columnOfTask(page: Page, title: string): Promise<string | null> {
  return page.evaluate(
    ({ taskTitle, labels }: { taskTitle: string; labels: string[] }): string | null => {
      const doc = globalThis.document;
      const holders = Array.from(doc.querySelectorAll('body *')).filter((element: Element): boolean => {
        const text = element.textContent ?? '';
        if (!text.includes(taskTitle)) return false;
        return Array.from(element.children).every(
          (child: Element): boolean => !(child.textContent ?? '').includes(taskTitle),
        );
      });
      const card = holders[holders.length - 1];
      if (card === undefined) return null;
      let node: Element | null = card.parentElement;
      // The text a column shows, WITHOUT its controls: a card names other columns on its own move buttons
      // ("Move to Doing") and a status select lists all three, which made every ancestor match 2-3 labels.
      const ownText = (element: Element): string => {
        const copy = element.cloneNode(true) as Element;
        copy.querySelectorAll('button, select, option, [role="button"]').forEach((control: Element): void => control.remove());
        return copy.textContent ?? '';
      };
      while (node !== null) {
        const text = ownText(node);
        const present = labels.filter((label: string): boolean => text.includes(label));
        if (present.length === 1) return present[0] ?? null;
        node = node.parentElement;
      }
      return null;
    },
    { taskTitle: title, labels: ['To do', 'Doing', 'Done'] },
  );
}

/**
 * Moves the card for `title` to another column using the board's OWN controls — a button naming
 * the destination, or a status select on the card. Throws when the board offers neither: a board
 * a person cannot move a task on is a defect, not a reason to weaken the test.
 */
export async function moveTaskViaUi(page: Page, title: string, target: TaskStatus): Promise<void> {
  const label = TASK_STATUS_LABELS[target];
  const holders = page.locator('body *').filter({ hasText: title });
  const count = await holders.count();
  for (let index = count - 1; index >= 0 && index > count - 12; index -= 1) {
    const scope = holders.nth(index);
    const button = scope.getByRole('button', { name: new RegExp(label, 'i') });
    if ((await button.count()) >= 1) {
      await button.first().click();
      await settle(page);
      return;
    }
    const select = scope.locator('select');
    if ((await select.count()) === 1) {
      await select.first().selectOption({ label });
      await settle(page);
      return;
    }
  }
  throw new Error(`The board offers no control to move "${title}" to the ${label} column.`);
}

/** The assignee options a task form offers, as plain text. */
export async function assigneeOptions(page: Page): Promise<string[]> {
  const field = page.getByLabel(/assignee/i).first();
  await expect(field, 'the task form must offer an assignee field').toBeVisible();
  const options = await field.locator('option').allTextContents();
  return options.map((option: string): string => option.trim());
}

/** Marks the live document, so a later assertion can prove the page was never reloaded. */
export async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    globalThis.document.body.setAttribute('data-qa-no-reload', 'kept');
  });
}

/** Asserts the document has not been reloaded since {@link markNoReload}. */
export async function expectNoReload(page: Page): Promise<void> {
  await expect(
    page.locator('body'),
    'the board must re-render in place, without reloading the page',
  ).toHaveAttribute('data-qa-no-reload', 'kept');
}
