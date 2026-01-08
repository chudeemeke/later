/**
 * MCP Show Handler Tests
 *
 * Tests for the MCP-facing show handler that wraps GetItemQuery.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createShowHandler, ShowArgs, ShowResult } from '../../../../src/presentation/mcp/handlers/show.js';

describe('MCP Show Handler', () => {
  let testDir: string;
  let container: Container;
  let showHandler: (args: ShowArgs) => Promise<ShowResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-show-handler-test-'));
    container = createContainer({ dataDir: testDir });
    showHandler = createShowHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({ decision: 'Test decision', context: 'Test context', tags: ['test'] });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic show', () => {
    it('should show an item by ID', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.id).toBe(1);
      expect(result.item!.decision).toBe('Test decision');
    });

    it('should include all item fields', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item).toHaveProperty('id');
      expect(result.item).toHaveProperty('decision');
      expect(result.item).toHaveProperty('context');
      expect(result.item).toHaveProperty('status');
      expect(result.item).toHaveProperty('priority');
      expect(result.item).toHaveProperty('tags');
      expect(result.item).toHaveProperty('created_at');
      expect(result.item).toHaveProperty('updated_at');
    });

    it('should return formatted output', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.formatted_output).toBeDefined();
      expect(result.formatted_output).toContain('#1');
      expect(result.formatted_output).toContain('Test decision');
    });
  });

  describe('Validation', () => {
    it('should fail for missing ID', async () => {
      const result = await showHandler({ id: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for negative ID', async () => {
      const result = await showHandler({ id: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for non-existent item', async () => {
      const result = await showHandler({ id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item).toHaveProperty('created_at');
      expect(result.item).toHaveProperty('updated_at');
      expect(result).toHaveProperty('formatted_output');
    });

    it('should include success flag', async () => {
      const result = await showHandler({ id: 1 });
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Dependencies', () => {
    it('should include dependencies when requested', async () => {
      // Create a second item
      const captureHandler = createCaptureHandler(container);
      await captureHandler({ decision: 'Second item' });

      // Add dependency: item 2 depends on item 1
      await container.commands.addDependency.execute({ itemId: 2, dependsOnId: 1 });

      // Show item 2 with dependencies
      const result = await showHandler({ id: 2, include_deps: true });

      expect(result.success).toBe(true);
      expect(result.item?.dependencies).toBeDefined();
      expect(result.item?.dependencies).toContain(1);
      expect(result.formatted_output).toContain('Depends on');
    });

    it('should include dependents when requested', async () => {
      // Create a second item that depends on item 1
      const captureHandler = createCaptureHandler(container);
      await captureHandler({ decision: 'Dependent item' });

      // Add dependency: item 2 depends on item 1
      await container.commands.addDependency.execute({ itemId: 2, dependsOnId: 1 });

      // Show item 1 with dependencies (should show dependents)
      const result = await showHandler({ id: 1, include_deps: true });

      expect(result.success).toBe(true);
      expect(result.item?.dependents).toBeDefined();
      expect(result.item?.dependents).toContain(2);
      expect(result.formatted_output).toContain('Blocking');
    });
  });

  describe('Retrospective', () => {
    it('should include retrospective when requested', async () => {
      // Complete the item with a retrospective
      await container.commands.complete.execute({
        id: 1,
        retrospective: {
          outcome: 'success',
          lessonsLearned: 'Test lessons learned',
        },
      });

      // Show with retrospective
      const result = await showHandler({ id: 1, include_retro: true });

      expect(result.success).toBe(true);
      expect(result.item?.retrospective).toBeDefined();
      expect(result.item?.retrospective?.outcome).toBe('success');
      expect(result.item?.retrospective?.lessons_learned).toBe('Test lessons learned');
      expect(result.item?.retrospective?.completed_at).toBeDefined();
      expect(result.formatted_output).toContain('Retrospective');
      expect(result.formatted_output).toContain('success');
      expect(result.formatted_output).toContain('Test lessons learned');
    });

    it('should include retrospective without lessons when not provided', async () => {
      // Complete item without lessons_learned
      await container.commands.complete.execute({
        id: 1,
        retrospective: {
          outcome: 'partial',
        },
      });

      const result = await showHandler({ id: 1, include_retro: true });

      expect(result.success).toBe(true);
      expect(result.item?.retrospective?.outcome).toBe('partial');
      expect(result.formatted_output).toContain('Retrospective');
      expect(result.formatted_output).toContain('partial');
    });
  });

  describe('Formatted output', () => {
    it('should format tags when present', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item?.tags).toContain('test');
      expect(result.formatted_output).toContain('Tags:');
      expect(result.formatted_output).toContain('test');
    });

    it('should format context when present', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item?.context).toBe('Test context');
      expect(result.formatted_output).toContain('Context:');
      expect(result.formatted_output).toContain('Test context');
    });

    it('should not show tags section when empty', async () => {
      // Create an item without tags
      const captureHandler = createCaptureHandler(container);
      await captureHandler({ decision: 'No tags item', tags: [] });

      const result = await showHandler({ id: 2 });

      expect(result.success).toBe(true);
      expect(result.item?.tags).toEqual([]);
      // Should not have Tags: line when empty
      const lines = result.formatted_output!.split('\n');
      const hasTagsLine = lines.some(line => line.startsWith('Tags:'));
      expect(hasTagsLine).toBe(false);
    });
  });
});
