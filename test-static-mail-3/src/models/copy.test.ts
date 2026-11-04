import { describe, it, expect } from 'vitest';
import { COPY, emptyMessage, filterLabel } from './copy.js';
import { FILTERS } from './task.js';

describe('copy contract', () => {
  it('pins the headline strings', () => {
    expect(COPY.appTitle).toBe('Tasks');
    expect(COPY.composer.placeholder).toBe('What needs to be done?');
    expect(COPY.composer.submit).toBe('Add task');
  });

  it('provides a label and empty state for every filter', () => {
    for (const filter of FILTERS) {
      expect(filterLabel(filter).length).toBeGreaterThan(0);
      expect(emptyMessage(filter).length).toBeGreaterThan(0);
    }
    expect(filterLabel('active')).toBe('Active');
    expect(emptyMessage('all')).toBe('No tasks yet. Add your first task above.');
  });

  it('pluralises the remaining-count status', () => {
    expect(COPY.status.remaining(0)).toBe('0 tasks left');
    expect(COPY.status.remaining(1)).toBe('1 task left');
    expect(COPY.status.remaining(7)).toBe('7 tasks left');
  });

  it('builds per-item action labels from the task title', () => {
    expect(COPY.item.toggle('Priya Lunch')).toBe('Toggle Priya Lunch');
    expect(COPY.item.delete('Priya Lunch')).toBe('Delete Priya Lunch');
  });

  it('exposes distinct error messages', () => {
    const messages = Object.values(COPY.errors);
    expect(new Set(messages).size).toBe(messages.length);
  });
});
