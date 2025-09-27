/**
 * Beatrove - Security Utilities Module
 * Provides comprehensive input validation, sanitization, and security features
 */

'use strict';

// ============= CONFIGURATION =============
export const CONFIG = {
  APP_TITLE: 'DJ Total Kaos - EDM Bangers',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TAG_LENGTH: 50,
  MIN_BPM: 60,
  MAX_BPM: 200,
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  ALLOWED_FILE_EXTENSIONS: ['.csv', '.txt', '.yaml', '.yml'],
  ALLOWED_AUDIO_EXTENSIONS: ['.mp3', '.wav', '.flac', '.ogg', '.aiff'],
  ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  DEBOUNCE_DELAY: 300,
  CACHE_SIZE_LIMIT: 50,
  MAX_TRACKS_PER_FILE: 20000,
  MAX_LINE_LENGTH: 2000,
  RATE_LIMIT_WINDOW: 10000, // 10 seconds
  MAX_OPERATIONS_PER_WINDOW: 5,
  // Cover Art Configuration
  COVER_ART: {
    DIRECTORY: 'covers', // Default cover art directory relative to selected audio folder
    SHOW_BY_DEFAULT: true, // Show cover art by default
    MAX_SIZE: '150px', // Maximum cover art display size
    FALLBACK_ENABLED: true, // Show placeholder when cover art not found
    CACHE_ENABLED: true // Cache loaded cover art images
  }
};

// ============= SECURITY UTILITIES =============
export class SecurityUtils {
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    // Use textContent only - never innerHTML to prevent XSS
    // Strip HTML tags using regex instead of DOM manipulation
    return text.replace(/<[^>]*>/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  static stripHtmlTags(text) {
    if (typeof text !== 'string') return '';
    // Comprehensive HTML tag removal with multiple passes
    let clean = text;
    // Remove HTML tags
    clean = clean.replace(/<[^>]*>/g, '');
    // Remove HTML entities
    clean = clean.replace(/&[#\w]+;/g, '');
    // Remove any remaining < or > characters
    clean = clean.replace(/[<>]/g, '');
    return clean.trim();
  }

  static sanitizeForContentEditable(text) {
    if (typeof text !== 'string') return '';

    // Remove all HTML-like patterns first
    let clean = text.replace(/<[^>]*>/g, '');
    // Remove script patterns
    clean = clean.replace(/javascript:|data:|vbscript:/gi, '');
    // Allow only safe characters (word chars, whitespace, basic punctuation)
    clean = clean.replace(/[^\w\s\-.,!?'"]/g, '');

    return clean.substring(0, 100); // Enforce max length
  }

  static sanitizeForAttribute(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>"']/g, match => {
      const escape = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match] || match;
    });
  }

  static escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static unescapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  static createSafeElement(tagName, textContent = '', className = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  static validateFileExtension(filename, allowedExtensions) {
    if (!filename || typeof filename !== 'string') return false;
    const extension = '.' + filename.split('.').pop().toLowerCase();
    return allowedExtensions.includes(extension);
  }

  static validateBPM(bpm) {
    const bpmNum = parseInt(bpm, 10);
    return !isNaN(bpmNum) && bpmNum >= CONFIG.MIN_BPM && bpmNum <= CONFIG.MAX_BPM;
  }

  static validateYear(year) {
    if (!year) return true;
    const yearNum = parseInt(year, 10);
    return !isNaN(yearNum) && yearNum >= CONFIG.MIN_YEAR && yearNum <= CONFIG.MAX_YEAR;
  }

  static validateTag(tag) {
    return tag &&
           typeof tag === 'string' &&
           tag.length <= CONFIG.MAX_TAG_LENGTH &&
           !/[<>"']/.test(tag);
  }

  static validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxMB = (CONFIG.MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);
      errors.push(`File size ${sizeMB}MB exceeds maximum allowed size of ${maxMB}MB`);
    }

    // Check file extension
    if (!this.validateFileExtension(file.name, CONFIG.ALLOWED_FILE_EXTENSIONS)) {
      errors.push(`Invalid file type. Allowed types: ${CONFIG.ALLOWED_FILE_EXTENSIONS.join(', ')}`);
    }

    // Check file name for security
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      errors.push('Invalid file name. Only alphanumeric characters, dots, underscores, and hyphens are allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }
    };
  }

  static validateFileContent(content, fileName) {
    const errors = [];

    if (!content || typeof content !== 'string') {
      errors.push('Invalid file content');
      return { isValid: false, errors };
    }

    // Check content size
    if (content.length > CONFIG.MAX_FILE_SIZE) {
      errors.push('File content exceeds maximum size limit');
    }

    // Check for potentially malicious content
    if (/<script|javascript:|data:|vbscript:/i.test(content)) {
      errors.push('File contains potentially malicious content');
    }

    // Check line count
    const lines = content.split('\n');
    if (lines.length > CONFIG.MAX_TRACKS_PER_FILE) {
      errors.push(`Too many lines (${lines.length}). Maximum allowed: ${CONFIG.MAX_TRACKS_PER_FILE}`);
    }

    // Check for excessively long lines
    const longLines = lines.filter(line => line.length > CONFIG.MAX_LINE_LENGTH);
    if (longLines.length > 0) {
      errors.push(`File contains ${longLines.length} lines that exceed maximum length of ${CONFIG.MAX_LINE_LENGTH} characters`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      stats: {
        contentLength: content.length,
        lineCount: lines.length,
        maxLineLength: Math.max(...lines.map(l => l.length))
      }
    };
  }

  static validateAudioFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check audio file extension
    if (!this.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
      errors.push(`Invalid audio file type. Allowed types: ${CONFIG.ALLOWED_AUDIO_EXTENSIONS.join(', ')}`);
    }

    // Check file size (audio files can be larger)
    const maxAudioSize = 200 * 1024 * 1024; // 200MB for audio
    if (file.size > maxAudioSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      errors.push(`Audio file size ${sizeMB}MB exceeds maximum allowed size of 200MB`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      file: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    };
  }
}

// ============= RATE LIMITING =============
export class RateLimiter {
  constructor() {
    this.storageKey = 'beatrove_rate_limits';
    this.fingerprintKey = 'beatrove_client_fp';
    this.operations = new Map();
    this.clientFingerprint = this.generateClientFingerprint();
    this.bypassAttempts = 0;
    this.maxBypassAttempts = 3;
    this.lockoutDuration = 5 * 60 * 1000; // 5 minutes

    this.loadFromStorage();
    this.startPeriodicCleanup();
  }

  generateClientFingerprint() {
    try {
      // Create a semi-persistent client identifier
      const factors = [
        navigator.userAgent || '',
        navigator.language || '',
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        navigator.maxTouchPoints || 0
      ];

      // Simple hash function
      let hash = 0;
      const str = factors.join('|');
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      return Math.abs(hash).toString(36);
    } catch (error) {
      return 'unknown_' + Date.now();
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);

        // Verify client fingerprint
        if (data.fingerprint !== this.clientFingerprint) {
          this.detectBypassAttempt('fingerprint_mismatch');
          return;
        }

        // Validate data integrity
        if (this.validateStoredData(data)) {
          this.operations = new Map(data.operations || []);
          this.bypassAttempts = data.bypassAttempts || 0;
          this.cleanupExpiredOperations();
        } else {
          this.detectBypassAttempt('data_tampering');
        }
      }
    } catch (error) {
      this.operations = new Map();
      this.bypassAttempts = 0;
    }
  }

  validateStoredData(data) {
    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') return false;
      if (!Array.isArray(data.operations)) return false;

      // Check for reasonable timestamps
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [operationType, timestamps] of data.operations) {
        if (!Array.isArray(timestamps)) return false;
        for (const timestamp of timestamps) {
          if (typeof timestamp !== 'number' ||
              timestamp > now ||
              timestamp < now - maxAge) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  saveToStorage() {
    try {
      // Clean up before saving
      this.cleanupExpiredOperations();

      const data = {
        fingerprint: this.clientFingerprint,
        operations: Array.from(this.operations.entries()),
        bypassAttempts: this.bypassAttempts,
        lastSaved: Date.now(),
        version: '1.0'
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      // Fail silently in case of storage issues
    }
  }

  detectBypassAttempt(reason) {
    this.bypassAttempts++;

    if (this.bypassAttempts >= this.maxBypassAttempts) {
      this.lockoutUntil = Date.now() + this.lockoutDuration;
    }

    this.saveToStorage();
  }

  isLockedOut() {
    return this.lockoutUntil && Date.now() < this.lockoutUntil;
  }

  isAllowed(operationType) {
    // Check for lockout first
    if (this.isLockedOut()) {
      const remainingLockout = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      return {
        allowed: false,
        waitTime: remainingLockout,
        remaining: 0,
        reason: 'locked_out'
      };
    }

    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

    if (!this.operations.has(operationType)) {
      this.operations.set(operationType, []);
    }

    const operationTimes = this.operations.get(operationType);

    // Remove old operations outside the window
    const recentOperations = operationTimes.filter(time => time > windowStart);
    this.operations.set(operationType, recentOperations);

    // Check if limit is exceeded
    if (recentOperations.length >= CONFIG.MAX_OPERATIONS_PER_WINDOW) {
      const oldestOperation = Math.min(...recentOperations);
      const waitTime = CONFIG.RATE_LIMIT_WINDOW - (now - oldestOperation);

      // Save state after each check
      this.saveToStorage();

      return {
        allowed: false,
        waitTime: Math.ceil(waitTime / 1000),
        remaining: 0,
        reason: 'rate_limit_exceeded'
      };
    }

    // Record this operation
    recentOperations.push(now);
    this.operations.set(operationType, recentOperations);

    // Save state after recording operation
    this.saveToStorage();

    return {
      allowed: true,
      waitTime: 0,
      remaining: CONFIG.MAX_OPERATIONS_PER_WINDOW - recentOperations.length,
      reason: 'allowed'
    };
  }

  reset(operationType) {
    // Only allow resets if not locked out and not suspicious
    if (this.isLockedOut()) {
      return false;
    }

    if (this.bypassAttempts > 1) {
      this.detectBypassAttempt('suspicious_reset');
      return false;
    }

    if (operationType) {
      this.operations.delete(operationType);
    } else {
      this.operations.clear();
      this.bypassAttempts = 0; // Allow clean reset occasionally
    }

    this.saveToStorage();
    return true;
  }

  getRemainingTime(operationType) {
    if (this.isLockedOut()) {
      return Math.ceil((this.lockoutUntil - Date.now()) / 1000);
    }

    if (!this.operations.has(operationType)) {
      return 0;
    }

    const now = Date.now();
    const operationTimes = this.operations.get(operationType);

    if (operationTimes.length < CONFIG.MAX_OPERATIONS_PER_WINDOW) {
      return 0;
    }

    const oldestOperation = Math.min(...operationTimes);
    const waitTime = CONFIG.RATE_LIMIT_WINDOW - (now - oldestOperation);

    return Math.max(0, Math.ceil(waitTime / 1000));
  }

  cleanupExpiredOperations() {
    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

    for (const [operationType, timestamps] of this.operations.entries()) {
      const recentOperations = timestamps.filter(time => time > windowStart);
      if (recentOperations.length === 0) {
        this.operations.delete(operationType);
      } else {
        this.operations.set(operationType, recentOperations);
      }
    }
  }

  startPeriodicCleanup() {
    // Clean up expired operations every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredOperations();
      this.saveToStorage();

      // Reset lockout if expired
      if (this.lockoutUntil && Date.now() > this.lockoutUntil) {
        this.lockoutUntil = null;
        this.bypassAttempts = Math.max(0, this.bypassAttempts - 1);
      }
    }, 5 * 60 * 1000);
  }

  getStatus() {
    return {
      fingerprint: this.clientFingerprint,
      bypassAttempts: this.bypassAttempts,
      isLockedOut: this.isLockedOut(),
      lockoutRemaining: this.lockoutUntil ? Math.ceil((this.lockoutUntil - Date.now()) / 1000) : 0,
      totalOperations: Array.from(this.operations.values()).reduce((sum, ops) => sum + ops.length, 0)
    };
  }

  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.saveToStorage();
  }
}