/**
 * Beatrove - Logging Utility
 * Conditional logging for production environments
 */

'use strict';

// ============= LOGGER UTILITY =============
export class Logger {
  static isDevelopment() {
    // Check for development indicators
    return (
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.port !== '' ||
      window.location.search.includes('debug=true') ||
      localStorage.getItem('beatrove-debug') === 'true'
    );
  }

  static log(...args) {
    if (this.isDevelopment()) {
      console.log(...args);
    }
  }

  static warn(...args) {
    if (this.isDevelopment()) {
      console.warn(...args);
    }
  }

  static error(...args) {
    // Always log errors, even in production
    console.error(...args);
  }

  static info(...args) {
    if (this.isDevelopment()) {
      console.info(...args);
    }
  }

  static debug(...args) {
    if (this.isDevelopment() && localStorage.getItem('beatrove-verbose') === 'true') {
      console.debug(...args);
    }
  }

  // Performance timing
  static time(label) {
    if (this.isDevelopment()) {
      console.time(label);
    }
  }

  static timeEnd(label) {
    if (this.isDevelopment()) {
      console.timeEnd(label);
    }
  }
}