import { describe, it, expect } from '@jest/globals';
import {
  JSONRPCErrorCode,
  createError,
  createValidationError,
  createItemNotFoundError,
  createStorageError,
  createStateTransitionError,
  createDependencyCycleError,
  createInternalError,
  toStandardError,
  isClientError,
  isServerError,
} from '../../src/utils/errors.js';

describe('Error Utils', () => {
  describe('createError', () => {
    it('should create basic error', () => {
      const error = createError(
        JSONRPCErrorCode.INVALID_REQUEST,
        'Invalid request'
      );

      expect(error.code).toBe(-32600);
      expect(error.message).toBe('Invalid request');
      expect(error.data).toBeUndefined();
    });

    it('should create error with data', () => {
      const error = createError(
        JSONRPCErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { details: 'Field required' }
      );

      expect(error.code).toBe(-32001);
      expect(error.data).toEqual({ details: 'Field required' });
    });
  });

  describe('createValidationError', () => {
    it('should create validation error', () => {
      const error = createValidationError('id is required');

      expect(error.code).toBe(JSONRPCErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Validation failed');
      expect(error.data?.details).toBe('id is required');
    });

    it('should include field when provided', () => {
      const error = createValidationError('Must be positive', 'id');

      expect(error.data?.field).toBe('id');
      expect(error.data?.details).toBe('Must be positive');
    });
  });

  describe('createItemNotFoundError', () => {
    it('should create item not found error', () => {
      const error = createItemNotFoundError(42);

      expect(error.code).toBe(JSONRPCErrorCode.ITEM_NOT_FOUND);
      expect(error.message).toBe('Item not found');
      expect(error.data?.id).toBe(42);
      expect(error.data?.details).toContain('42');
    });
  });

  describe('createStorageError', () => {
    it('should create storage error', () => {
      const error = createStorageError('File not accessible');

      expect(error.code).toBe(JSONRPCErrorCode.STORAGE_ERROR);
      expect(error.message).toBe('Storage operation failed');
      expect(error.data?.details).toBe('File not accessible');
    });
  });

  describe('createStateTransitionError', () => {
    it('should create state transition error', () => {
      const error = createStateTransitionError(
        'done',
        'pending',
        'Cannot revert done item to pending'
      );

      expect(error.code).toBe(JSONRPCErrorCode.STATE_TRANSITION_ERROR);
      expect(error.message).toBe('Invalid state transition');
      expect(error.data?.from).toBe('done');
      expect(error.data?.to).toBe('pending');
      expect(error.data?.details).toContain('Cannot revert');
    });
  });

  describe('createDependencyCycleError', () => {
    it('should create dependency cycle error', () => {
      const error = createDependencyCycleError(
        5,
        'Item 5 depends on itself'
      );

      expect(error.code).toBe(JSONRPCErrorCode.DEPENDENCY_CYCLE_ERROR);
      expect(error.message).toBe('Dependency cycle detected');
      expect(error.data?.id).toBe(5);
      expect(error.data?.details).toContain('itself');
    });
  });

  describe('createInternalError', () => {
    it('should create internal error', () => {
      const error = createInternalError('Unexpected null pointer');

      expect(error.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Internal server error');
      expect(error.data?.details).toBe('Unexpected null pointer');
    });
  });

  describe('toStandardError', () => {
    it('should convert Error to standard error', () => {
      const jsError = new Error('Something went wrong');
      const stdError = toStandardError(jsError);

      expect(stdError.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(stdError.data?.details).toBe('Something went wrong');
    });

    it('should convert string to standard error', () => {
      const stdError = toStandardError('Random error string');

      expect(stdError.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(stdError.data?.details).toBe('Random error string');
    });

    it('should handle unknown types', () => {
      const stdError = toStandardError({ weird: 'object' });

      expect(stdError.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(stdError.data?.details).toContain('object');
    });
  });

  describe('isClientError', () => {
    it('should identify validation error as client error', () => {
      expect(isClientError(JSONRPCErrorCode.VALIDATION_ERROR)).toBe(true);
    });

    it('should identify item not found as client error', () => {
      expect(isClientError(JSONRPCErrorCode.ITEM_NOT_FOUND)).toBe(true);
    });

    it('should identify state transition error as client error', () => {
      expect(isClientError(JSONRPCErrorCode.STATE_TRANSITION_ERROR)).toBe(true);
    });

    it('should identify dependency cycle as client error', () => {
      expect(isClientError(JSONRPCErrorCode.DEPENDENCY_CYCLE_ERROR)).toBe(true);
    });

    it('should not identify storage error as client error', () => {
      expect(isClientError(JSONRPCErrorCode.STORAGE_ERROR)).toBe(false);
    });

    it('should not identify internal error as client error', () => {
      expect(isClientError(JSONRPCErrorCode.INTERNAL_ERROR)).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should identify storage error as server error', () => {
      expect(isServerError(JSONRPCErrorCode.STORAGE_ERROR)).toBe(true);
    });

    it('should identify internal error as server error', () => {
      expect(isServerError(JSONRPCErrorCode.INTERNAL_ERROR)).toBe(true);
    });

    it('should not identify validation error as server error', () => {
      expect(isServerError(JSONRPCErrorCode.VALIDATION_ERROR)).toBe(false);
    });

    it('should not identify item not found as server error', () => {
      expect(isServerError(JSONRPCErrorCode.ITEM_NOT_FOUND)).toBe(false);
    });
  });

  describe('error code values', () => {
    it('should have standard JSON-RPC codes', () => {
      expect(JSONRPCErrorCode.PARSE_ERROR).toBe(-32700);
      expect(JSONRPCErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(JSONRPCErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(JSONRPCErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(JSONRPCErrorCode.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have custom application codes in valid range', () => {
      expect(JSONRPCErrorCode.VALIDATION_ERROR).toBe(-32001);
      expect(JSONRPCErrorCode.ITEM_NOT_FOUND).toBe(-32002);
      expect(JSONRPCErrorCode.STORAGE_ERROR).toBe(-32003);
      expect(JSONRPCErrorCode.STATE_TRANSITION_ERROR).toBe(-32004);
      expect(JSONRPCErrorCode.DEPENDENCY_CYCLE_ERROR).toBe(-32005);
    });
  });
});
