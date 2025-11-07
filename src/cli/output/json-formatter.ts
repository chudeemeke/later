/**
 * JSON Formatter - Outputs structured JSON for scripting
 */
export class JsonFormatter {
  /**
   * Format capture result as JSON
   */
  static formatCaptureResult(result: any): string {
    if (result.success) {
      return JSON.stringify({
        id: result.item_id,
        message: result.message,
        warnings: result.warnings || [],
        duplicate_detected: result.duplicate_detected || false,
        similar_items: result.similar_items || [],
      }, null, 2);
    } else {
      return JSON.stringify({
        error: result.error,
        success: false,
      }, null, 2);
    }
  }

  /**
   * Format list result as JSON
   */
  static formatListResult(items: any[]): string {
    return JSON.stringify(items, null, 2);
  }

  /**
   * Format show result as JSON
   */
  static formatShowResult(item: any): string {
    return JSON.stringify(item, null, 2);
  }

  /**
   * Format search result as JSON
   */
  static formatSearchResult(result: any): string {
    return JSON.stringify({
      query: result.query,
      totalFound: result.totalFound,
      searchTime: result.searchTime,
      results: result.results,
    }, null, 2);
  }

  /**
   * Format do result as JSON
   */
  static formatDoResult(result: any): string {
    return JSON.stringify({
      success: result.success,
      message: result.message,
      item: result.item,
      todo_guidance: result.todo_guidance,
      warnings: result.warnings,
    }, null, 2);
  }

  /**
   * Format update result as JSON
   */
  static formatUpdateResult(result: any): string {
    return JSON.stringify({
      success: result.success,
      message: result.message,
      item: result.item,
      warnings: result.warnings || [],
    }, null, 2);
  }

  /**
   * Format delete result as JSON
   */
  static formatDeleteResult(result: any): string {
    return JSON.stringify({
      success: result.success,
      message: result.message,
      warnings: result.warnings || [],
    }, null, 2);
  }

  /**
   * Format bulk operation result as JSON
   */
  static formatBulkResult(result: any): string {
    return JSON.stringify({
      success: result.success,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failedCount || 0,
      processed: result.processed || [],
      failures: result.failed || [],
    }, null, 2);
  }
}
