/**
 * Beatrove - Error Handler Module
 * Centralized error handling and logging system
 */

'use strict';

export class ErrorHandler {
  constructor(notificationSystem = null, logger = null) {
    this.notificationSystem = notificationSystem;
    this.logger = logger;
    this.errorQueue = [];
    this.maxQueueSize = 100;
    this.errorCounts = new Map();
    this.rateLimitWindow = 5000; // 5 seconds
    this.maxErrorsPerWindow = 3;
  }

  /**
   * Handle an error with appropriate logging and user notification
   * @param {Error|string} error - The error to handle
   * @param {Object} context - Context information about where the error occurred
   * @param {string} context.component - Component where error occurred
   * @param {string} context.method - Method where error occurred
   * @param {string} context.severity - error, warn, info (default: error)
   * @param {boolean} context.showUser - Whether to show error to user (default: true)
   * @param {boolean} context.logToConsole - Whether to log to console (default: true)
   * @param {*} context.fallbackValue - Value to return if this is a safe operation
   */
  handle(error, context = {}) {
    const {
      component = 'Unknown',
      method = 'Unknown',
      severity = 'error',
      showUser = true,
      logToConsole = true,
      fallbackValue = null,
      operation = 'operation'
    } = context;

    // Normalize error
    const normalizedError = this.normalizeError(error);

    // Create error info object
    const errorInfo = {
      error: normalizedError,
      component,
      method,
      severity,
      timestamp: Date.now(),
      message: normalizedError.message,
      stack: normalizedError.stack,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Rate limiting to prevent spam
    if (this.shouldRateLimit(errorInfo)) {
      return fallbackValue;
    }

    // Log to console if requested
    if (logToConsole) {
      this.logToConsole(errorInfo);
    }

    // Log to logger if available
    if (this.logger) {
      this.logger.error(`[${component}:${method}] ${normalizedError.message}`, errorInfo);
    }

    // Show to user if requested and not rate limited
    if (showUser && this.notificationSystem) {
      this.showToUser(errorInfo, operation);
    }

    // Add to error queue for analytics
    this.addToQueue(errorInfo);

    return fallbackValue;
  }

  /**
   * Safely execute an async operation with error handling
   * @param {Function} operation - The async operation to execute
   * @param {Object} context - Error context information
   * @returns {Promise<*>} Result or fallback value
   */
  async safeAsync(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      return this.handle(error, context);
    }
  }

  /**
   * Safely execute a sync operation with error handling
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Error context information
   * @returns {*} Result or fallback value
   */
  safe(operation, context = {}) {
    try {
      return operation();
    } catch (error) {
      return this.handle(error, context);
    }
  }

  /**
   * Create a wrapped version of a method that automatically handles errors
   * @param {Object} target - Object containing the method
   * @param {string} methodName - Name of the method to wrap
   * @param {Object} context - Default error context
   */
  wrapMethod(target, methodName, context = {}) {
    const originalMethod = target[methodName];
    if (typeof originalMethod !== 'function') {
      throw new Error(`Method ${methodName} is not a function`);
    }

    const defaultContext = {
      component: target.constructor.name,
      method: methodName,
      ...context
    };

    target[methodName] = (...args) => {
      try {
        const result = originalMethod.apply(target, args);

        // Handle async methods
        if (result && typeof result.catch === 'function') {
          return result.catch(error => this.handle(error, defaultContext));
        }

        return result;
      } catch (error) {
        return this.handle(error, defaultContext);
      }
    };
  }

  /**
   * Wrap multiple methods at once
   * @param {Object} target - Object containing methods
   * @param {string[]} methodNames - Array of method names to wrap
   * @param {Object} context - Default error context
   */
  wrapMethods(target, methodNames, context = {}) {
    methodNames.forEach(methodName => {
      this.wrapMethod(target, methodName, context);
    });
  }

  /**
   * Normalize different error types to Error objects
   */
  normalizeError(error) {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object') {
      const err = new Error(error.message || 'Unknown error');
      err.stack = error.stack;
      err.code = error.code;
      return err;
    }

    return new Error('Unknown error occurred');
  }

  /**
   * Check if error should be rate limited
   */
  shouldRateLimit(errorInfo) {
    const key = `${errorInfo.component}:${errorInfo.method}:${errorInfo.message}`;
    const now = Date.now();

    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, { count: 1, firstOccurrence: now });
      return false;
    }

    const errorData = this.errorCounts.get(key);

    // Reset if outside window
    if (now - errorData.firstOccurrence > this.rateLimitWindow) {
      this.errorCounts.set(key, { count: 1, firstOccurrence: now });
      return false;
    }

    // Increment and check limit
    errorData.count++;
    return errorData.count > this.maxErrorsPerWindow;
  }

  /**
   * Log error to console with formatting
   */
  logToConsole(errorInfo) {
    const prefix = `[${errorInfo.component}:${errorInfo.method}]`;
    const timestamp = new Date(errorInfo.timestamp).toISOString();

    switch (errorInfo.severity) {
      case 'warn':
        console.warn(`${prefix} ${timestamp}`, errorInfo.message, errorInfo.error);
        break;
      case 'info':
        console.info(`${prefix} ${timestamp}`, errorInfo.message, errorInfo.error);
        break;
      default:
        console.error(`${prefix} ${timestamp}`, errorInfo.message, errorInfo.error);
    }
  }

  /**
   * Show user-friendly error message
   */
  showToUser(errorInfo, operation) {
    let userMessage;

    // Create user-friendly messages based on error types
    if (errorInfo.message.includes('fetch')) {
      userMessage = 'Network error - please check your connection';
    } else if (errorInfo.message.includes('parse') || errorInfo.message.includes('JSON')) {
      userMessage = 'Error processing data - file may be corrupted';
    } else if (errorInfo.message.includes('permission') || errorInfo.message.includes('access')) {
      userMessage = 'Permission denied - please check file access';
    } else if (errorInfo.message.includes('storage') || errorInfo.message.includes('quota')) {
      userMessage = 'Storage error - please free up space';
    } else if (errorInfo.component === 'AudioManager') {
      userMessage = 'Audio playback error - please try again';
    } else if (errorInfo.component === 'UIRenderer') {
      userMessage = 'Display error - please refresh the page';
    } else {
      userMessage = `Error during ${operation} - please try again`;
    }

    // Show appropriate notification based on severity
    switch (errorInfo.severity) {
      case 'warn':
        this.notificationSystem.warning(userMessage);
        break;
      case 'info':
        this.notificationSystem.info(userMessage);
        break;
      default:
        this.notificationSystem.error(userMessage);
    }
  }

  /**
   * Add error to queue for analytics
   */
  addToQueue(errorInfo) {
    this.errorQueue.push(errorInfo);

    // Trim queue if too large
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  /**
   * Get error statistics
   */
  getStats() {
    const now = Date.now();
    const recentErrors = this.errorQueue.filter(
      error => now - error.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    const byComponent = {};
    const byMethod = {};
    const bySeverity = {};

    recentErrors.forEach(error => {
      byComponent[error.component] = (byComponent[error.component] || 0) + 1;
      byMethod[error.method] = (byMethod[error.method] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: this.errorQueue.length,
      recent: recentErrors.length,
      byComponent,
      byMethod,
      bySeverity,
      rateLimitedCount: Array.from(this.errorCounts.values())
        .filter(data => data.count > this.maxErrorsPerWindow).length
    };
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorQueue.length = 0;
    this.errorCounts.clear();
  }

  /**
   * Export error data for debugging
   */
  exportErrors() {
    return {
      errors: this.errorQueue.slice(), // Copy array
      stats: this.getStats(),
      config: {
        maxQueueSize: this.maxQueueSize,
        rateLimitWindow: this.rateLimitWindow,
        maxErrorsPerWindow: this.maxErrorsPerWindow
      }
    };
  }
}