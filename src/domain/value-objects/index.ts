/**
 * Domain Value Objects
 *
 * Immutable objects that represent domain concepts with validation.
 * No identity - equality is based on attribute values.
 */

export { Status, StatusValue, VALID_STATUSES } from './Status.js';
export { Priority, PriorityValue, VALID_PRIORITIES } from './Priority.js';
export { Outcome, OutcomeValue, VALID_OUTCOMES } from './Outcome.js';
export { TriggerType, TriggerTypeValue, VALID_TRIGGER_TYPES } from './TriggerType.js';
export { DependencyType, DependencyTypeValue, VALID_DEPENDENCY_TYPES } from './DependencyType.js';
export { ItemId } from './ItemId.js';
