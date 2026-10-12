import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_SLUGS,
  createTask,
  uniqueLabel,
  type TaskPriority,
} from '../support/boardApi.js';

const FEATURE = 'priority-label-on-board-task-cards';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:priority-label-on-board-task-cards the priority label on a board card', () => {
  test('labels every card with its own level, in that level\u2019s own colour', async ({
    page,
    request,
  }) => {
    const titles = new Map<TaskPriority, string>();
    for (const priority of TASK_PRIORITIES) {
      const title = uniqueLabel(`Priya Lunch ${priority.toLowerCase()}`);
      const created = await createTask(request, { title, status: 'todo', priority });
      expect(created.priority, 'the stored task must keep the chosen priority').toBe(priority);
      titles.set(priority, title);
    }

    try {
      await open(page, '/');

      const colours: string[] = [];
      for (const priority of TASK_PRIORITIES) {
        const title = titles.get(priority) ?? '';
        expect(title).not.toBe('');

        const card = page.getByRole('article', { name: title }).first();
        await expect(card, `the ${priority} task must be on the board`).toBeVisible();

        const badge = card.locator('[data-priority]').first();
        await expect(badge).toHaveAttribute('data-priority', TASK_PRIORITY_SLUGS[priority]);
        await expect(badge, 'the level must be spelled out, never colour alone').toContainText(
          priority,
        );

        const className = await badge.evaluate(
          (element: HTMLElement): string => element.className,
        );
        expect(className).toContain(`ui-priority-badge--${TASK_PRIORITY_SLUGS[priority]}`);

        const background = await badge.evaluate(
          (element: HTMLElement): string => globalThis.getComputedStyle(element).backgroundColor,
        );
        expect(background, 'the label must be coloured').not.toBe('rgba(0, 0, 0, 0)');
        colours.push(background);
      }

      expect(
        new Set(colours).size,
        'each level must be drawn in its own colour',
      ).toBe(TASK_PRIORITIES.length);

      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });
});
