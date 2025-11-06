/**
 * State machine for DeferredItem status transitions
 * Ensures valid state flows and prevents invalid transitions
 */

export type ItemStatus = 'pending' | 'in-progress' | 'done' | 'archived';

/**
 * State transition rules
 * Each status maps to an array of valid next statuses
 *
 * Transition flow:
 * - pending → in-progress (start work)
 * - pending → archived (quick archive, decided not to do)
 * - in-progress → done (complete work)
 * - in-progress → pending (rollback, defer again)
 * - in-progress → archived (abandon work)
 * - done → archived (archive completed item)
 * - archived → pending (restore archived item)
 * - All states can stay in same state (idempotency)
 */
export const STATE_MACHINE: Record<ItemStatus, ItemStatus[]> = {
  pending: ['pending', 'in-progress', 'archived'],
  'in-progress': ['in-progress', 'done', 'pending', 'archived'],
  done: ['done', 'archived'],
  archived: ['archived', 'pending'],
};

/**
 * Validate if a status transition is allowed
 *
 * @param fromStatus - Current status
 * @param toStatus - Desired status
 * @returns true if transition is valid, false otherwise
 *
 * @example
 * validateTransition('pending', 'in-progress') // true
 * validateTransition('pending', 'done') // false (must go through in-progress)
 * validateTransition('done', 'pending') // false (can't reopen done items)
 */
export function validateTransition(fromStatus: ItemStatus, toStatus: ItemStatus): boolean {
  // Check if fromStatus exists in state machine
  if (!(fromStatus in STATE_MACHINE)) {
    return false;
  }

  // Check if toStatus is in the list of valid transitions
  const validTransitions = STATE_MACHINE[fromStatus];
  return validTransitions.includes(toStatus);
}

/**
 * Get all valid transitions from a given status
 *
 * @param fromStatus - Current status
 * @returns Array of valid next statuses
 *
 * @example
 * getValidTransitions('pending') // ['pending', 'in-progress', 'archived']
 * getValidTransitions('done') // ['done', 'archived']
 */
export function getValidTransitions(fromStatus: ItemStatus): ItemStatus[] {
  if (!(fromStatus in STATE_MACHINE)) {
    return [];
  }

  return [...STATE_MACHINE[fromStatus]];
}

/**
 * Get human-readable error message for invalid transition
 *
 * @param fromStatus - Current status
 * @param toStatus - Desired status
 * @returns Error message explaining why transition is invalid
 */
export function getTransitionError(fromStatus: ItemStatus, toStatus: ItemStatus): string {
  if (!(fromStatus in STATE_MACHINE)) {
    return `Invalid status: "${fromStatus}"`;
  }

  if (validateTransition(fromStatus, toStatus)) {
    return ''; // No error
  }

  const validTransitions = STATE_MACHINE[fromStatus];
  return `Cannot transition from "${fromStatus}" to "${toStatus}". Valid transitions: ${validTransitions.join(', ')}`;
}
