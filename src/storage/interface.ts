import type { DeferredItem } from '../types.js';

export interface Storage {
  /**
   * Append an item to storage
   * @param item - Item to append (id is optional and will be auto-assigned if not provided)
   * @returns The ID of the appended item
   */
  append(item: Omit<DeferredItem, 'id'> & { id?: number }): Promise<number>;
  readAll(): Promise<DeferredItem[]>;
  findById(id: number): Promise<DeferredItem | null>;
  update(item: DeferredItem): Promise<void>;
  delete(id: number): Promise<void>;
  /**
   * Get the next available ID
   * @deprecated Use append() without specifying id for atomic ID assignment in concurrent scenarios
   */
  getNextId(): Promise<number>;
}
