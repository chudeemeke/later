/**
 * Git Port
 *
 * Defines the contract for git integration.
 * Implemented by adapters that interact with git repositories.
 */

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: string[];
}

/**
 * Git repository information
 */
export interface GitRepoInfo {
  path: string;
  name: string;
  branch: string;
  remote?: string;
  remoteUrl?: string;
  isDirty: boolean;
}

/**
 * File diff information
 */
export interface GitFileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string; // For renames
}

/**
 * Commit search options
 */
export interface CommitSearchOptions {
  /** Number of commits to search */
  limit?: number;

  /** Start date for search */
  since?: Date;

  /** End date for search */
  until?: Date;

  /** Author filter */
  author?: string;

  /** File path filter */
  path?: string;

  /** Search in commit message */
  grep?: string;
}

/**
 * Later tag found in commit message
 */
export interface LaterTag {
  itemId: number;
  tagType: 'later' | 'resolves-later';
  fullMatch: string;
}

/**
 * Main git port interface
 */
export interface IGitPort {
  // ===========================================
  // Repository Operations
  // ===========================================

  /**
   * Get current repository information
   * @param path Optional path (defaults to cwd)
   */
  getRepoInfo(path?: string): Promise<GitRepoInfo | null>;

  /**
   * Check if path is inside a git repository
   */
  isGitRepo(path?: string): Promise<boolean>;

  /**
   * Get the root path of the repository
   */
  getRepoRoot(path?: string): Promise<string | null>;

  // ===========================================
  // Commit Operations
  // ===========================================

  /**
   * Get a specific commit by hash
   */
  getCommit(hash: string, repoPath?: string): Promise<GitCommit | null>;

  /**
   * Get recent commits
   */
  getRecentCommits(
    options?: CommitSearchOptions,
    repoPath?: string
  ): Promise<GitCommit[]>;

  /**
   * Search commits for later tags
   * @returns Commits that contain later:#ID or resolves-later:ID
   */
  findCommitsWithLaterTags(
    options?: CommitSearchOptions,
    repoPath?: string
  ): Promise<Array<{
    commit: GitCommit;
    tags: LaterTag[];
  }>>;

  /**
   * Get commits that reference a specific item ID
   */
  getCommitsForItem(
    itemId: number,
    options?: CommitSearchOptions,
    repoPath?: string
  ): Promise<GitCommit[]>;

  // ===========================================
  // Tag Detection
  // ===========================================

  /**
   * Extract later tags from commit message
   */
  extractLaterTags(message: string): LaterTag[];

  /**
   * Check if message contains later tags
   */
  containsLaterTag(message: string): boolean;

  /**
   * Get item IDs mentioned in message
   */
  extractItemIds(message: string): number[];

  // ===========================================
  // File Operations
  // ===========================================

  /**
   * Get changed files in a commit
   */
  getCommitFiles(hash: string, repoPath?: string): Promise<GitFileDiff[]>;

  /**
   * Get files changed between two commits/refs
   */
  getChangedFiles(
    from: string,
    to: string,
    repoPath?: string
  ): Promise<GitFileDiff[]>;

  /**
   * Get uncommitted changes
   */
  getUncommittedChanges(repoPath?: string): Promise<GitFileDiff[]>;

  /**
   * Check if specific files have changed since a commit
   */
  haveFilesChanged(
    files: string[],
    sinceCommit: string,
    repoPath?: string
  ): Promise<boolean>;

  /**
   * Get file hash (for change detection)
   */
  getFileHash(filePath: string, repoPath?: string): Promise<string | null>;

  // ===========================================
  // Watch & Hooks
  // ===========================================

  /**
   * Set up a watcher for new commits
   * @param callback Called when new commits detected
   * @returns Unsubscribe function
   */
  watchCommits(
    callback: (commits: GitCommit[]) => void,
    options?: { pollInterval?: number },
    repoPath?: string
  ): () => void;

  /**
   * Register a post-commit hook handler
   * (For processing commits after they're made)
   */
  onPostCommit(
    callback: (commit: GitCommit) => Promise<void>,
    repoPath?: string
  ): () => void;

  // ===========================================
  // Linking Operations
  // ===========================================

  /**
   * Scan repository for all later-tagged commits
   * and return item-commit mappings
   */
  scanForLaterTags(
    options?: CommitSearchOptions,
    repoPath?: string
  ): Promise<Map<number, GitCommit[]>>;

  /**
   * Get link suggestions based on recent commits
   * and existing item decisions
   */
  suggestLinks(
    itemDecisions: Array<{ id: number; decision: string }>,
    options?: CommitSearchOptions,
    repoPath?: string
  ): Promise<Array<{
    itemId: number;
    commit: GitCommit;
    confidence: number;
    reason: string;
  }>>;

  // ===========================================
  // Lifecycle
  // ===========================================

  /**
   * Initialize git integration
   */
  initialize(): Promise<void>;

  /**
   * Shutdown git integration
   */
  shutdown(): Promise<void>;

  /**
   * Check if git is available on the system
   */
  isGitAvailable(): Promise<boolean>;
}
