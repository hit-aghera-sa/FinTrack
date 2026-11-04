/**
 * The single shared list for the process.
 *
 * The store is created LAZILY on first access, so importing this module has no side
 * effects: no array is allocated, no connection is opened, nothing is read from disk.
 */
import { createMemoryTaskStore } from './memoryTaskStore.js';
import type { MemoryTaskStore, MemoryTaskStoreOptions } from './memoryTaskStore.js';

let sharedStore: MemoryTaskStore | null = null;

/** The process-wide store used by the route handler. */
export function getTaskStore(): MemoryTaskStore {
  if (sharedStore === null) {
    sharedStore = createMemoryTaskStore();
  }
  return sharedStore;
}

/** Replace the shared store with a fresh (optionally seeded) one. Intended for tests. */
export function resetTaskStore(options: MemoryTaskStoreOptions = {}): MemoryTaskStore {
  sharedStore = createMemoryTaskStore(options);
  return sharedStore;
}

/** Factory matching the shared `TaskStoreFactory` signature. */
export function taskStoreFactory(): MemoryTaskStore {
  return getTaskStore();
}
