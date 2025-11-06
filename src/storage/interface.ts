import type { DeferredItem } from '../types.js';

export interface Storage {
  append(item: DeferredItem): Promise<void>;
  readAll(): Promise<DeferredItem[]>;
  findById(id: number): Promise<DeferredItem | null>;
  update(item: DeferredItem): Promise<void>;
  delete(id: number): Promise<void>;
  getNextId(): Promise<number>;
}
