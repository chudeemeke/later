/**
 * Domain Services
 *
 * Stateless services that encapsulate domain logic not belonging to entities.
 */

export {
  DependencyResolver,
  CycleCheckResult,
  BlockedItemInfo,
  DependencyChain,
} from './DependencyResolver.js';

export {
  StalenessChecker,
  StalenessConfig,
  StalenessResult,
  ContextStalenessResult,
  StalenessReport,
  DEFAULT_STALENESS_CONFIG,
} from './StalenessChecker.js';
