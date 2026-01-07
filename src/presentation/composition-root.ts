/**
 * Composition Root
 *
 * Central dependency injection container that wires up all application
 * components. This is the only place where concrete implementations are
 * instantiated and connected.
 *
 * Following the Composition Root pattern from Dependency Injection:
 * - All dependencies are resolved at application startup
 * - No service locator pattern (anti-pattern)
 * - Clear dependency graph
 * - Easy to swap implementations for testing
 */

import { JSONLStorageAdapter } from '../infrastructure/storage/JSONLStorageAdapter.js';
import type { IStoragePort } from '../domain/ports/IStoragePort.js';

// Domain Services
import { DependencyResolver } from '../domain/services/DependencyResolver.js';
import { StalenessChecker } from '../domain/services/StalenessChecker.js';

// Application Commands
import { CaptureItemCommand } from '../application/commands/CaptureItemCommand.js';
import { UpdateItemCommand } from '../application/commands/UpdateItemCommand.js';
import { CompleteItemCommand } from '../application/commands/CompleteItemCommand.js';
import { DeleteItemCommand } from '../application/commands/DeleteItemCommand.js';
import { AddDependencyCommand } from '../application/commands/AddDependencyCommand.js';

// Application Queries
import { GetItemQuery } from '../application/queries/GetItemQuery.js';
import { ListItemsQuery } from '../application/queries/ListItemsQuery.js';
import { SearchItemsQuery } from '../application/queries/SearchItemsQuery.js';
import { GetBlockedItemsQuery } from '../application/queries/GetBlockedItemsQuery.js';
import { GetStaleItemsQuery } from '../application/queries/GetStaleItemsQuery.js';

/**
 * Configuration for container creation
 */
export interface ContainerConfig {
  /** Directory for JSONL data files (e.g., ~/.later) */
  dataDir: string;

  /** Days after which an item is considered stale (default: 30) */
  stalenessThresholdDays?: number;
}

/**
 * Commands container
 */
export interface Commands {
  capture: CaptureItemCommand;
  update: UpdateItemCommand;
  complete: CompleteItemCommand;
  delete: DeleteItemCommand;
  addDependency: AddDependencyCommand;
}

/**
 * Queries container
 */
export interface Queries {
  getItem: GetItemQuery;
  listItems: ListItemsQuery;
  searchItems: SearchItemsQuery;
  getBlockedItems: GetBlockedItemsQuery;
  getStaleItems: GetStaleItemsQuery;
}

/**
 * Domain services container
 */
export interface Services {
  dependencyResolver: DependencyResolver;
  stalenessChecker: StalenessChecker;
}

/**
 * Main dependency injection container
 */
export interface Container {
  /** Storage port implementation */
  storage: IStoragePort;

  /** Application commands */
  commands: Commands;

  /** Application queries */
  queries: Queries;

  /** Domain services */
  services: Services;

  /** Close all resources */
  close(): Promise<void>;
}

/**
 * Create a fully wired dependency injection container
 *
 * This is the composition root - the only place where we know about
 * concrete implementations. All other code depends on abstractions.
 *
 * @param config - Configuration options
 * @returns Fully configured container
 */
export function createContainer(config: ContainerConfig): Container {
  // Create infrastructure layer (adapters)
  const storage = new JSONLStorageAdapter(config.dataDir);

  // Create domain services
  const dependencyResolver = new DependencyResolver();
  const stalenessChecker = new StalenessChecker(
    config.stalenessThresholdDays ?? 30
  );

  // Create application commands (inject dependencies)
  const captureCommand = new CaptureItemCommand(storage);
  const updateCommand = new UpdateItemCommand(storage);
  const completeCommand = new CompleteItemCommand(storage);
  const deleteCommand = new DeleteItemCommand(storage, dependencyResolver);
  const addDependencyCommand = new AddDependencyCommand(
    storage,
    dependencyResolver
  );

  // Create application queries (inject dependencies)
  const getItemQuery = new GetItemQuery(storage);
  const listItemsQuery = new ListItemsQuery(storage);
  const searchItemsQuery = new SearchItemsQuery(storage);
  const getBlockedItemsQuery = new GetBlockedItemsQuery(
    storage,
    dependencyResolver
  );
  const getStaleItemsQuery = new GetStaleItemsQuery(storage, stalenessChecker);

  return {
    storage,

    commands: {
      capture: captureCommand,
      update: updateCommand,
      complete: completeCommand,
      delete: deleteCommand,
      addDependency: addDependencyCommand,
    },

    queries: {
      getItem: getItemQuery,
      listItems: listItemsQuery,
      searchItems: searchItemsQuery,
      getBlockedItems: getBlockedItemsQuery,
      getStaleItems: getStaleItemsQuery,
    },

    services: {
      dependencyResolver,
      stalenessChecker,
    },

    async close() {
      // Storage adapter handles file cleanup
      // Nothing else needs explicit cleanup
    },
  };
}

/**
 * Default data directory for Later storage
 */
export function getDefaultDataDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return `${homeDir}/.later`;
}

/**
 * Create container with default configuration
 */
export function createDefaultContainer(): Container {
  return createContainer({
    dataDir: getDefaultDataDir(),
  });
}
