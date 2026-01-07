/**
 * GitLink Entity
 *
 * Links an item to git commits that reference it.
 * Enables tracking of what code changes resulted from decisions.
 */

import { ItemId } from '../value-objects/ItemId.js';

export interface GitLinkProps {
  id: number;
  itemId: number;
  commitHash: string;
  commitMessage?: string;
  commitDate?: Date;
  repoPath?: string;
  detectedAt: Date;
}

export interface CreateGitLinkInput {
  id?: number; // Optional - assigned by storage if not provided
  itemId: number;
  commitHash: string;
  commitMessage?: string;
  commitDate?: Date;
  repoPath?: string;
}

// Pattern: later:#123 or resolves-later:123
const LATER_TAG_PATTERN = /(?:later:#?|resolves-later:)(\d+)/gi;

export class GitLink {
  private readonly _id: number;
  private readonly _itemId: ItemId;
  private readonly _commitHash: string;
  private readonly _commitMessage?: string;
  private readonly _commitDate?: Date;
  private readonly _repoPath?: string;
  private readonly _detectedAt: Date;

  private constructor(props: GitLinkProps) {
    this._id = props.id;
    this._itemId = ItemId.create(props.itemId);
    this._commitHash = props.commitHash;
    this._commitMessage = props.commitMessage;
    this._commitDate = props.commitDate;
    this._repoPath = props.repoPath;
    this._detectedAt = props.detectedAt;
  }

  /**
   * Create a new git link
   * @param input Creation input. If id is not provided, caller must provide it.
   */
  static create(input: CreateGitLinkInput & { id: number }): GitLink {
    if (!input.commitHash || input.commitHash.length === 0) {
      throw new Error('Commit hash cannot be empty');
    }

    return new GitLink({
      id: input.id,
      itemId: input.itemId,
      commitHash: input.commitHash.toLowerCase(),
      commitMessage: input.commitMessage,
      commitDate: input.commitDate,
      repoPath: input.repoPath,
      detectedAt: new Date(),
    });
  }

  /**
   * Reconstitute from storage
   */
  static fromProps(props: GitLinkProps): GitLink {
    return new GitLink(props);
  }

  /**
   * Extract item IDs from a commit message
   */
  static extractItemIds(message: string): number[] {
    const ids: number[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    LATER_TAG_PATTERN.lastIndex = 0;

    while ((match = LATER_TAG_PATTERN.exec(message)) !== null) {
      const id = parseInt(match[1], 10);
      if (!isNaN(id) && id > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }

    return ids;
  }

  /**
   * Check if message contains later tags
   */
  static containsLaterTag(message: string): boolean {
    LATER_TAG_PATTERN.lastIndex = 0;
    return LATER_TAG_PATTERN.test(message);
  }

  // Getters
  get id(): number {
    return this._id;
  }

  get itemId(): ItemId {
    return this._itemId;
  }

  get commitHash(): string {
    return this._commitHash;
  }

  get commitMessage(): string | undefined {
    return this._commitMessage;
  }

  get commitDate(): Date | undefined {
    return this._commitDate;
  }

  get repoPath(): string | undefined {
    return this._repoPath;
  }

  get detectedAt(): Date {
    return this._detectedAt;
  }

  // Domain Methods

  /**
   * Get short commit hash (7 chars)
   */
  shortHash(): string {
    return this._commitHash.substring(0, 7);
  }

  /**
   * Check if this links to the same commit
   */
  sameCommit(other: GitLink): boolean {
    return this._commitHash === other._commitHash;
  }

  /**
   * Check if this is for the same item and commit
   */
  equals(other: GitLink): boolean {
    return (
      this._itemId.equals(other._itemId) &&
      this._commitHash === other._commitHash
    );
  }

  /**
   * Get composite key
   */
  getKey(): string {
    return `${this._itemId.value}-${this._commitHash}`;
  }

  /**
   * Calculate days since commit
   */
  daysSinceCommit(): number | undefined {
    if (!this._commitDate) {
      return undefined;
    }
    const now = new Date();
    const diffMs = now.getTime() - this._commitDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Convert to plain object for storage
   */
  toProps(): GitLinkProps {
    return {
      id: this._id,
      itemId: this._itemId.value,
      commitHash: this._commitHash,
      commitMessage: this._commitMessage,
      commitDate: this._commitDate,
      repoPath: this._repoPath,
      detectedAt: this._detectedAt,
    };
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      item_id: this._itemId.value,
      commit_hash: this._commitHash,
      commit_message: this._commitMessage,
      commit_date: this._commitDate?.toISOString(),
      repo_path: this._repoPath,
      detected_at: this._detectedAt.toISOString(),
    };
  }
}
