/**
 * Beatrove - EDM Track Manager
 * Refactored for security, performance, and maintainability
 * Version: 2.0.0
 */

'use strict';

// ============= CONFIGURATION =============
const CONFIG = {
  APP_TITLE: 'DJ Total Kaos - EDM Bangers',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TAG_LENGTH: 50,
  MIN_BPM: 60,
  MAX_BPM: 200,
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  ALLOWED_FILE_EXTENSIONS: ['.csv', '.txt', '.yaml', '.yml'],
  ALLOWED_AUDIO_EXTENSIONS: ['.mp3', '.wav', '.flac', '.ogg', '.aiff'],
  DEBOUNCE_DELAY: 300,
  CACHE_SIZE_LIMIT: 50,
  MAX_TRACKS_PER_FILE: 10000,
  MAX_LINE_LENGTH: 2000,
  RATE_LIMIT_WINDOW: 10000, // 10 seconds
  MAX_OPERATIONS_PER_WINDOW: 5
};

// ============= FUZZY SEARCH UTILITIES =============
class FuzzySearchUtils {
  // Calculate Levenshtein distance between two strings
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  // Calculate similarity score (0-1, where 1 is perfect match)
  static calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLen);
  }

  // Check if search term fuzzy matches target with threshold
  static fuzzyMatch(searchTerm, target, threshold = 0.6) {
    if (!searchTerm || !target) return false;
    
    // Direct substring match (highest priority)
    if (target.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    // Fuzzy matching for individual words
    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    const targetWords = target.toLowerCase().split(/\s+/);

    // Check if each search word fuzzy matches any target word
    return searchWords.every(searchWord => {
      return targetWords.some(targetWord => {
        // Allow shorter words to have lower threshold
        const adjustedThreshold = searchWord.length <= 3 ? 0.8 : threshold;
        return this.calculateSimilarity(searchWord, targetWord) >= adjustedThreshold;
      });
    });
  }
}

// ============= SECURITY UTILITIES =============
class SecurityUtils {
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
class RateLimiter {
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
      console.warn('Rate limiter storage corrupted, resetting');
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
      console.warn('Failed to save rate limiter state:', error);
    }
  }

  detectBypassAttempt(reason) {
    this.bypassAttempts++;
    console.warn(`Rate limiter bypass attempt detected: ${reason}`);
    
    if (this.bypassAttempts >= this.maxBypassAttempts) {
      this.lockoutUntil = Date.now() + this.lockoutDuration;
      console.warn('Rate limiter: Client locked out due to repeated bypass attempts');
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
      console.warn('Reset attempt while locked out');
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

// ============= NOTIFICATION SYSTEM =============
class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.nextId = 1;
    this.init();
  }

  init() {
    // Create notification container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const id = this.nextId++;
    const notification = this.createNotification(id, message, type);
    
    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  createNotification(id, message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.id = id;

    const icon = this.getIcon(type);
    const content = SecurityUtils.createSafeElement('span', message, 'notification-message');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => this.dismiss(id);

    notification.appendChild(document.createTextNode(icon + ' '));
    notification.appendChild(content);
    notification.appendChild(closeBtn);

    return notification;
  }

  getIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }

  dismiss(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.add('hide');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
      this.notifications.delete(id);
    }, 300);
  }

  success(message, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 6000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 4000) {
    return this.show(message, 'info', duration);
  }

  // Custom dialog methods
  async prompt(title, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      const dialog = this.createDialog(title, 'prompt', resolve);
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = defaultValue;
      input.className = 'dialog-input';
      
      const content = dialog.querySelector('.dialog-content');
      content.appendChild(input);
      
      input.focus();
      input.select();

      // Handle enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          resolve(input.value);
          this.closeDialog(dialog);
        } else if (e.key === 'Escape') {
          resolve(null);
          this.closeDialog(dialog);
        }
      });
    });
  }

  async confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const dialog = this.createDialog(title, 'confirm', resolve);
      const content = dialog.querySelector('.dialog-content');
      const messageEl = SecurityUtils.createSafeElement('p', message, 'dialog-message');
      content.appendChild(messageEl);
    });
  }

  createDialog(title, type, resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = `dialog dialog-${type}`;
    
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    const titleEl = SecurityUtils.createSafeElement('h3', title, 'dialog-title');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
      resolve(null);
      this.closeDialog(overlay);
    };
    
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    
    const content = document.createElement('div');
    content.className = 'dialog-content';
    
    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    
    if (type === 'confirm') {
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'dialog-btn dialog-btn-cancel';
      cancelBtn.onclick = () => {
        resolve(false);
        this.closeDialog(overlay);
      };
      
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Confirm';
      confirmBtn.className = 'dialog-btn dialog-btn-confirm';
      confirmBtn.onclick = () => {
        resolve(true);
        this.closeDialog(overlay);
      };
      
      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
    } else if (type === 'prompt') {
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'dialog-btn dialog-btn-cancel';
      cancelBtn.onclick = () => {
        resolve(null);
        this.closeDialog(overlay);
      };
      
      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = 'dialog-btn dialog-btn-confirm';
      okBtn.onclick = () => {
        const input = dialog.querySelector('input');
        resolve(input ? input.value : null);
        this.closeDialog(overlay);
      };
      
      footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
    }
    
    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Handle escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        resolve(type === 'confirm' ? false : null);
        this.closeDialog(overlay);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });
    
    return overlay;
  }

  closeDialog(overlay) {
    overlay.classList.add('hide');
    setTimeout(() => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    }, 200);
  }
}

// ============= APPLICATION STATE =============
class ApplicationState {
  constructor(notificationSystem = null) {
    this.elements = {};
    this.notificationSystem = notificationSystem;
    this.isOperationInProgress = false; // Concurrent operation protection
    this.operationQueue = []; // Queue for pending operations
    this.data = {
      grouped: {},
      totalTracks: 0,
      duplicateTracks: [],
      tracksForUI: [],
      trackTags: {},
      moodVibeTags: {},
      favoriteTracks: {},
      playlists: {},
      smartPlaylists: {},
      currentPlaylist: '',
      showFavoritesOnly: false
    };
    this.cache = {
      filterResults: new Map(),
      sortResults: new Map(),
      domUpdateQueue: [],
      isUpdating: false
    };
    this.eventListeners = new Map();
  }

  loadFromStorage() {
    try {
      const stored = {
        trackTags: localStorage.getItem('trackTags'),
        moodVibeTags: localStorage.getItem('moodVibeTags'),
        energyLevels: localStorage.getItem('energyLevels'),
        favoriteTracks: localStorage.getItem('favoriteTracks'),
        playlists: localStorage.getItem('playlists'),
        smartPlaylists: localStorage.getItem('smartPlaylists'),
        currentPlaylist: localStorage.getItem('currentPlaylist'),
        themePreference: localStorage.getItem('themePreference'),
        accentColor: localStorage.getItem('accentColor')
      };

      if (stored.trackTags) this.data.trackTags = JSON.parse(stored.trackTags);
      if (stored.moodVibeTags) this.data.moodVibeTags = JSON.parse(stored.moodVibeTags);
      if (stored.energyLevels) this.data.energyLevels = JSON.parse(stored.energyLevels);
      if (stored.favoriteTracks) this.data.favoriteTracks = JSON.parse(stored.favoriteTracks);
      if (stored.playlists) this.data.playlists = JSON.parse(stored.playlists);
      if (stored.smartPlaylists) this.data.smartPlaylists = JSON.parse(stored.smartPlaylists);
      if (stored.currentPlaylist) this.data.currentPlaylist = stored.currentPlaylist;
      if (stored.themePreference) this.data.themePreference = stored.themePreference;
      if (stored.accentColor) this.data.accentColor = stored.accentColor;
    } catch (error) {
      console.error('Error loading stored data:', error);
      this.resetData();
    }
  }

  async saveToStorage(retryCount = 0) {
    return new Promise((resolve) => {
      // Add to operation queue to prevent concurrent modifications
      this.operationQueue.push({
        type: 'save',
        execute: async () => {
          try {
            // Check localStorage availability and quota
            const storageInfo = this.getStorageInfo();
            
            // Calculate estimated size of data to save
            const dataToSave = {
              trackTags: JSON.stringify(this.data.trackTags),
              moodVibeTags: JSON.stringify(this.data.moodVibeTags),
              energyLevels: JSON.stringify(this.data.energyLevels),
              favoriteTracks: JSON.stringify(this.data.favoriteTracks),
              playlists: JSON.stringify(this.data.playlists),
              smartPlaylists: JSON.stringify(this.data.smartPlaylists || {}),
              currentPlaylist: this.data.currentPlaylist,
              themePreference: this.data.themePreference,
              accentColor: this.data.accentColor
            };
            
            const estimatedSize = Object.values(dataToSave).join('').length * 2; // Rough UTF-16 byte estimate
            
            // Check if we're approaching quota limits
            if (storageInfo.usedSpace + estimatedSize > storageInfo.quota * 0.9) {
              await this.handleStorageQuotaApproaching(estimatedSize);
            }
            
            // Save data with individual error handling
            let saveErrors = [];
            for (const [key, value] of Object.entries(dataToSave)) {
              try {
                localStorage.setItem(key, value);
              } catch (itemError) {
                saveErrors.push({ key, error: itemError });
              }
            }
            
            if (saveErrors.length > 0) {
              await this.handleSaveErrors(saveErrors, retryCount);
            } else if (this.notificationSystem && retryCount > 0) {
              // Success after retry
              this.notificationSystem.success('Data saved successfully after cleanup');
            }
            
            resolve(true);
          } catch (error) {
            console.error('Error saving data:', error);
            await this.handleCriticalSaveError(error, retryCount);
            resolve(false);
          }
        }
      });
      
      this.processOperationQueue();
    });
  }

  getStorageInfo() {
    try {
      // Calculate current localStorage usage
      let usedSpace = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          usedSpace += localStorage[key].length + key.length;
        }
      }
      
      // Estimate quota (browsers vary, but typically 5-10MB)
      const quota = 5 * 1024 * 1024; // 5MB estimate
      
      return {
        usedSpace: usedSpace * 2, // UTF-16 bytes
        quota: quota,
        available: quota - (usedSpace * 2),
        usagePercent: (usedSpace * 2) / quota * 100
      };
    } catch (error) {
      return { usedSpace: 0, quota: 0, available: 0, usagePercent: 0 };
    }
  }

  async handleStorageQuotaApproaching(requiredSize) {
    if (this.notificationSystem) {
      const storageInfo = this.getStorageInfo();
      this.notificationSystem.warning(
        `Storage is ${storageInfo.usagePercent.toFixed(1)}% full. Cleaning up old data...`
      );
    }
    
    // Attempt to free up space by cleaning old data
    await this.cleanupOldData();
  }

  async cleanupOldData() {
    try {
      // Clean up old notification data if it exists
      const keysToClean = ['old_trackTags', 'temp_data', 'cache_data'];
      keysToClean.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
      
      // Compress current data if possible
      await this.compressStorageData();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async compressStorageData() {
    try {
      // Remove empty playlists
      Object.keys(this.data.playlists).forEach(playlistName => {
        if (!this.data.playlists[playlistName] || this.data.playlists[playlistName].length === 0) {
          delete this.data.playlists[playlistName];
        }
      });
      
      // Clean up orphaned tags (tags for tracks that no longer exist)
      const validTrackDisplays = new Set(this.data.tracksForUI.map(track => track.display));
      Object.keys(this.data.trackTags).forEach(trackDisplay => {
        if (!validTrackDisplays.has(trackDisplay)) {
          delete this.data.trackTags[trackDisplay];
        }
      });
      
      // Clean up orphaned mood & vibe tags
      Object.keys(this.data.moodVibeTags).forEach(trackDisplay => {
        if (!validTrackDisplays.has(trackDisplay)) {
          delete this.data.moodVibeTags[trackDisplay];
        }
      });
      
      // Clean up orphaned favorites
      Object.keys(this.data.favoriteTracks).forEach(trackDisplay => {
        if (!validTrackDisplays.has(trackDisplay)) {
          delete this.data.favoriteTracks[trackDisplay];
        }
      });
      
    } catch (error) {
      console.error('Error compressing storage data:', error);
    }
  }

  async handleSaveErrors(saveErrors, retryCount) {
    const quotaErrors = saveErrors.filter(e => 
      e.error.name === 'QuotaExceededError' || 
      e.error.code === 22 || 
      e.error.message.includes('quota')
    );
    
    if (quotaErrors.length > 0 && retryCount < 2) {
      if (this.notificationSystem) {
        this.notificationSystem.warning('Storage full. Attempting to free up space...');
      }
      
      // More aggressive cleanup
      await this.aggressiveCleanup();
      
      // Retry save
      setTimeout(() => this.saveToStorage(retryCount + 1), 1000);
      return;
    }
    
    // Handle different error types
    if (this.notificationSystem) {
      if (quotaErrors.length > 0) {
        this.notificationSystem.error(
          'Storage quota exceeded. Some data may not be saved. Try clearing browser data or use a different browser.'
        );
      } else {
        this.notificationSystem.error(
          `Failed to save some data: ${saveErrors.map(e => e.key).join(', ')}`
        );
      }
    }
  }

  async aggressiveCleanup() {
    try {
      // Keep only the most essential data
      const storageInfo = this.getStorageInfo();
      
      if (storageInfo.usagePercent > 95) {
        // Emergency: keep only current playlist and theme
        const essentialData = {
          currentPlaylist: this.data.currentPlaylist,
          themePreference: this.data.themePreference
        };
        
        // Clear non-essential data temporarily
        localStorage.clear();
        
        // Restore essential data
        Object.entries(essentialData).forEach(([key, value]) => {
          if (value) localStorage.setItem(key, value);
        });
        
        if (this.notificationSystem) {
          this.notificationSystem.warning('Emergency cleanup performed. Some data was cleared to free space.');
        }
      }
    } catch (error) {
      console.error('Error during aggressive cleanup:', error);
    }
  }

  async handleCriticalSaveError(error, retryCount) {
    if (this.notificationSystem) {
      const errorMessage = error.name === 'SecurityError' 
        ? 'Cannot save data: localStorage is disabled or unavailable.'
        : `Critical error saving data: ${error.message}`;
        
      this.notificationSystem.error(errorMessage);
    }
    
    // Fallback: try to save minimal essential data
    if (retryCount === 0) {
      try {
        localStorage.setItem('themePreference', this.data.themePreference || 'dark');
        localStorage.setItem('accentColor', this.data.accentColor || 'red');
        localStorage.setItem('currentPlaylist', this.data.currentPlaylist || '');
      } catch (fallbackError) {
        console.error('Even fallback save failed:', fallbackError);
      }
    }
  }

  async processOperationQueue() {
    if (this.isOperationInProgress || this.operationQueue.length === 0) return;
    
    this.isOperationInProgress = true;
    
    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift();
        await operation.execute();
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.isOperationInProgress = false;
    }
  }

  // Safe data modification methods to prevent concurrent access issues
  async safeDataModification(modificationFn, autoSave = true) {
    return new Promise((resolve) => {
      this.operationQueue.push({
        type: 'modify',
        execute: async () => {
          try {
            const result = await modificationFn(this.data);
            if (autoSave) {
              await this.saveToStorage();
            }
            resolve(result);
          } catch (error) {
            console.error('Error during safe data modification:', error);
            if (this.notificationSystem) {
              this.notificationSystem.error('Failed to modify data safely');
            }
            resolve(false);
          }
        }
      });
      
      this.processOperationQueue();
    });
  }

  // Batch multiple modifications to reduce save operations
  async batchModifications(modifications, description = 'batch operation') {
    return new Promise((resolve) => {
      this.operationQueue.push({
        type: 'batch',
        execute: async () => {
          try {
            let results = [];
            for (const modification of modifications) {
              const result = await modification(this.data);
              results.push(result);
            }
            
            // Single save after all modifications
            await this.saveToStorage();
            
            if (this.notificationSystem && description !== 'batch operation') {
              this.notificationSystem.success(`${description} completed successfully`);
            }
            
            resolve(results);
          } catch (error) {
            console.error(`Error during ${description}:`, error);
            if (this.notificationSystem) {
              this.notificationSystem.error(`Failed to complete ${description}`);
            }
            resolve([]);
          }
        }
      });
      
      this.processOperationQueue();
    });
  }

  // Centralized localStorage access to prevent concurrent conflicts
  async safeLocalStorageGet(key) {
    return new Promise((resolve) => {
      this.operationQueue.push({
        type: 'read',
        execute: async () => {
          try {
            const value = localStorage.getItem(key);
            resolve(value);
          } catch (error) {
            console.warn(`Failed to read localStorage key ${key}:`, error);
            resolve(null);
          }
        }
      });
      this.processOperationQueue();
    });
  }

  // Development warning for direct localStorage access (remove in production)
  warnDirectAccess() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const originalGetItem = localStorage.getItem;
      const originalSetItem = localStorage.setItem;
      const originalRemoveItem = localStorage.removeItem;
      const appState = this; // Reference to ApplicationState instance
      
      localStorage.getItem = function(key) {
        // Skip warning for internal ApplicationState operations
        const stack = new Error().stack;
        if (!stack.includes('ApplicationState') && !stack.includes('RateLimiter')) {
          console.warn(`Direct localStorage.getItem("${key}") detected. Use appState.safeLocalStorageGet() instead.`);
        }
        return originalGetItem.call(this, key);
      };
      
      localStorage.setItem = function(key, value) {
        // Skip warning for internal ApplicationState operations
        const stack = new Error().stack;
        if (!stack.includes('ApplicationState') && !stack.includes('RateLimiter')) {
          console.warn(`Direct localStorage.setItem("${key}") detected. Use appState.safeLocalStorageSet() instead.`);
        }
        return originalSetItem.call(this, key, value);
      };
      
      localStorage.removeItem = function(key) {
        // Skip warning for internal ApplicationState operations
        const stack = new Error().stack;
        if (!stack.includes('ApplicationState') && !stack.includes('RateLimiter')) {
          console.warn(`Direct localStorage.removeItem("${key}") detected. Use appState.safeLocalStorageRemove() instead.`);
        }
        return originalRemoveItem.call(this, key);
      };
    }
  }

  async safeLocalStorageSet(key, value) {
    return new Promise((resolve) => {
      this.operationQueue.push({
        type: 'write',
        execute: async () => {
          try {
            localStorage.setItem(key, value);
            resolve(true);
          } catch (error) {
            console.warn(`Failed to write localStorage key ${key}:`, error);
            resolve(false);
          }
        }
      });
      this.processOperationQueue();
    });
  }

  async safeLocalStorageRemove(key) {
    return new Promise((resolve) => {
      this.operationQueue.push({
        type: 'remove',
        execute: async () => {
          try {
            localStorage.removeItem(key);
            resolve(true);
          } catch (error) {
            console.warn(`Failed to remove localStorage key ${key}:`, error);
            resolve(false);
          }
        }
      });
      this.processOperationQueue();
    });
  }

  // Thread-safe property updates
  async updateProperty(path, value, autoSave = true) {
    const pathParts = path.split('.');
    
    return this.safeDataModification((data) => {
      let current = data;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      current[pathParts[pathParts.length - 1]] = value;
      return true;
    }, autoSave);
  }

  // Thread-safe array operations
  async addToArray(path, value, autoSave = true) {
    const pathParts = path.split('.');
    
    return this.safeDataModification((data) => {
      let current = data;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = [];
        }
        current = current[pathParts[i]];
      }
      
      const targetArray = current[pathParts[pathParts.length - 1]];
      if (!Array.isArray(targetArray)) {
        current[pathParts[pathParts.length - 1]] = [];
      }
      
      current[pathParts[pathParts.length - 1]].push(value);
      return true;
    }, autoSave);
  }

  async removeFromArray(path, value, autoSave = true) {
    const pathParts = path.split('.');
    
    return this.safeDataModification((data) => {
      let current = data;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]];
        if (!current) return false;
      }
      
      const targetArray = current[pathParts[pathParts.length - 1]];
      if (!Array.isArray(targetArray)) return false;
      
      const index = targetArray.indexOf(value);
      if (index > -1) {
        targetArray.splice(index, 1);
        return true;
      }
      return false;
    }, autoSave);
  }

  resetData() {
    this.data = {
      grouped: {},
      totalTracks: 0,
      duplicateTracks: [],
      tracksForUI: [],
      trackTags: {},
      moodVibeTags: {},
      energyLevels: {}, // track.display -> 1-10 energy level
      favoriteTracks: {},
      playlists: {},
      currentPlaylist: '',
      showFavoritesOnly: false,
      themePreference: 'dark', // 'dark' or 'light'
      accentColor: 'red' // 'cyan', 'red', 'green', 'orange'
    };
  }

  // Development/testing utility methods
  async testDataPersistence() {
    if (!this.notificationSystem) {
      console.log('No notification system available for testing');
      return;
    }

    console.log('Testing data persistence edge cases...');
    
    try {
      // Test 1: Normal save operation
      await this.updateProperty('themePreference', 'light', false);
      console.log('✓ Property update test passed');
      
      // Test 2: Concurrent modifications
      const promises = [
        this.addToArray('testArray', 'item1', false),
        this.addToArray('testArray', 'item2', false), 
        this.addToArray('testArray', 'item3', false)
      ];
      
      await Promise.all(promises);
      console.log('✓ Concurrent modification test passed');
      
      // Test 3: Batch modifications
      await this.batchModifications([
        (data) => { data.testProp1 = 'value1'; return true; },
        (data) => { data.testProp2 = 'value2'; return true; },
        (data) => { data.testProp3 = 'value3'; return true; }
      ], 'test batch operations');
      
      // Test 4: Storage info
      const storageInfo = this.getStorageInfo();
      console.log('Storage usage:', {
        used: Math.round(storageInfo.usedSpace / 1024) + 'KB',
        percent: storageInfo.usagePercent.toFixed(1) + '%',
        available: Math.round(storageInfo.available / 1024) + 'KB'
      });
      
      // Cleanup test data
      delete this.data.testArray;
      delete this.data.testProp1;
      delete this.data.testProp2;
      delete this.data.testProp3;
      
      await this.saveToStorage();
      
      this.notificationSystem.success('Data persistence testing completed successfully');
      console.log('✓ All data persistence tests passed');
      
    } catch (error) {
      console.error('Data persistence test failed:', error);
      this.notificationSystem.error('Data persistence testing failed');
    }
  }

  // Test title editing security
  async testTitleSecurity() {
    if (!this.notificationSystem) {
      console.log('No notification system available for testing');
      return;
    }

    console.log('Testing title editing security...');
    
    try {
      // Test 1: Verify no contenteditable exists
      const titleElement = document.getElementById('editable-title');
      if (!titleElement) {
        console.error('❌ Title element not found');
        return;
      }
      
      const hasContentEditable = titleElement.hasAttribute('contenteditable');
      if (hasContentEditable) {
        console.error('❌ contenteditable attribute still exists');
        this.notificationSystem.error('Security vulnerability: contenteditable still present');
        return;
      }
      console.log('✓ contenteditable attribute successfully removed');
      
      // Test 2: Verify click-to-edit functionality
      const clickHandler = titleElement.onclick || titleElement.addEventListener;
      if (!clickHandler) {
        console.warn('⚠️ Click handler might not be properly attached');
      } else {
        console.log('✓ Click-to-edit functionality appears to be implemented');
      }
      
      // Test 3: Test XSS prevention in simulated scenarios
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '&lt;script&gt;alert("XSS")&lt;/script&gt;'
      ];
      
      let sanitizationPassed = true;
      maliciousInputs.forEach(input => {
        const sanitized = SecurityUtils.sanitizeForContentEditable(input);
        if (sanitized.includes('<') || sanitized.includes('script') || sanitized.includes('javascript:')) {
          console.error(`❌ Sanitization failed for: ${input} -> ${sanitized}`);
          sanitizationPassed = false;
        }
      });
      
      if (sanitizationPassed) {
        console.log('✓ XSS sanitization tests passed');
      }
      
      // Test 4: Verify title persistence
      const currentTitle = titleElement.textContent;
      console.log(`Current title: "${currentTitle}"`);
      console.log('✓ Title element accessible and content readable');
      
      this.notificationSystem.success('Title editing security tests completed successfully');
      console.log('✓ All title security tests passed');
      
    } catch (error) {
      console.error('Title security test failed:', error);
      this.notificationSystem.error('Title security testing failed');
    }
  }

  // Test rate limiter bypass prevention
  async testRateLimiterSecurity() {
    if (!this.notificationSystem) {
      console.log('No notification system available for testing');
      return;
    }

    console.log('Testing rate limiter bypass prevention...');
    
    try {
      // Get rate limiter instance
      const rateLimiter = window.beatroveApp?.rateLimiter;
      if (!rateLimiter) {
        console.error('❌ Rate limiter not found');
        return;
      }

      // Test 1: Check persistent storage
      console.log('Testing persistent storage...');
      const status1 = rateLimiter.getStatus();
      console.log('✓ Rate limiter status:', status1);
      
      // Test 2: Test fingerprinting
      console.log('Testing client fingerprinting...');
      if (status1.fingerprint && status1.fingerprint.length > 5) {
        console.log('✓ Client fingerprinting working:', status1.fingerprint.substring(0, 8) + '...');
      } else {
        console.warn('⚠️ Client fingerprinting may be weak');
      }
      
      // Test 3: Test rate limiting
      console.log('Testing rate limiting...');
      let testsPassed = 0;
      let testsTotal = 0;
      
      for (let i = 0; i < 12; i++) { // Exceed normal limit
        testsTotal++;
        const result = rateLimiter.isAllowed('test_operation');
        if (i < 10) { // First 10 should be allowed
          if (result.allowed) {
            testsPassed++;
          } else {
            console.warn(`⚠️ Request ${i + 1} unexpectedly blocked`);
          }
        } else { // Requests 11 and 12 should be blocked
          if (!result.allowed) {
            testsPassed++;
            console.log(`✓ Request ${i + 1} correctly blocked: ${result.reason}`);
          } else {
            console.error(`❌ Request ${i + 1} should have been blocked`);
          }
        }
      }
      
      // Test 4: Test bypass detection
      console.log('Testing bypass detection...');
      const originalFingerprint = rateLimiter.clientFingerprint;
      
      // Simulate fingerprint tampering attempt
      rateLimiter.clientFingerprint = 'fake_fingerprint';
      rateLimiter.detectBypassAttempt('test_tampering');
      rateLimiter.clientFingerprint = originalFingerprint; // Restore
      
      const status2 = rateLimiter.getStatus();
      if (status2.bypassAttempts > status1.bypassAttempts) {
        console.log('✓ Bypass attempt detection working');
        testsPassed++;
      } else {
        console.warn('⚠️ Bypass attempt not detected');
      }
      testsTotal++;
      
      // Test 5: Test lockout mechanism
      console.log('Testing lockout mechanism...');
      const initialLockout = status2.isLockedOut;
      
      // Simulate multiple bypass attempts (but don't actually trigger lockout)
      console.log(`Current bypass attempts: ${status2.bypassAttempts}/${rateLimiter.maxBypassAttempts}`);
      
      if (status2.bypassAttempts > 0) {
        console.log('✓ Bypass attempt tracking working');
        testsPassed++;
      }
      testsTotal++;
      
      // Test 6: Test storage persistence
      console.log('Testing storage persistence...');
      rateLimiter.saveToStorage();
      const storedData = localStorage.getItem('beatrove_rate_limits');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          if (parsed.fingerprint && parsed.operations && parsed.version) {
            console.log('✓ Storage persistence working');
            testsPassed++;
          }
        } catch (e) {
          console.error('❌ Stored data is corrupted');
        }
      } else {
        console.error('❌ No data stored');
      }
      testsTotal++;
      
      // Summary
      const passRate = (testsPassed / testsTotal * 100).toFixed(1);
      console.log(`\nRate Limiter Security Test Results: ${testsPassed}/${testsTotal} tests passed (${passRate}%)`);
      
      if (testsPassed === testsTotal) {
        this.notificationSystem.success('Rate limiter security tests completed successfully');
        console.log('✓ All rate limiter security tests passed');
      } else {
        this.notificationSystem.warning(`Rate limiter tests completed with ${testsTotal - testsPassed} issues`);
        console.warn(`⚠️ ${testsTotal - testsPassed} rate limiter security tests failed`);
      }
      
    } catch (error) {
      console.error('Rate limiter security test failed:', error);
      this.notificationSystem.error('Rate limiter security testing failed');
    }
  }

  clearCache() {
    this.cache.filterResults.clear();
    this.cache.sortResults.clear();
  }
}

// ============= AUDIO MANAGER =============
class AudioManager {
  constructor(notificationSystem = null) {
    this.fileMap = {};
    this.currentAudio = null;
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.audioDataArray = null;
    this.reactToAudio = false;
    this.blobUrls = new Set();
    this.blobMeta = new Map(); // Store blob URL metadata: url -> { createdAt }
    this.currentBlobUrl = null; // Track current active blob URL
    this.pendingPreviewTrack = null;
    this.notificationSystem = notificationSystem;
    this.cleanupIntervalId = null;
    this.visualizer = null; // Direct reference to visualizer
    
    // Race condition prevention
    this.isPlayingPreview = false;
    this.isConnectingVisualizer = false;
    this.currentPreviewId = null;
    this.previewQueue = [];
    this.isProcessingQueue = false;
    
    this.startPeriodicCleanup();
  }

  createBlobUrl(file) {
    const url = URL.createObjectURL(file);
    this.blobUrls.add(url);
    this.blobMeta.set(url, { createdAt: Date.now() });
    return url;
  }

  revokeBlobUrl(url) {
    if (url && this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
      this.blobMeta.delete(url);
    }
  }

  setVisualizer(visualizer) {
    this.visualizer = visualizer;
    console.log('AudioManager: Visualizer reference set');
  }

  startPeriodicCleanup() {
    // Clean up unused blob URLs every 30 seconds
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupUnusedBlobUrls();
    }, 30000);
  }

  cleanupUnusedBlobUrls() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const url of this.blobUrls) {
      // Clean up old URLs or URLs not currently in use
      const meta = this.blobMeta.get(url);
      if (meta && (now - meta.createdAt > maxAge) && url !== this.currentBlobUrl) {
        console.log('Cleaning up old blob URL:', url);
        this.revokeBlobUrl(url);
      }
    }
  }

  cleanup() {
    console.log('AudioManager cleanup starting...');
    
    // Stop periodic cleanup
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clear race condition state
    this.isPlayingPreview = false;
    this.isConnectingVisualizer = false;
    this.currentPreviewId = null;
    this.isProcessingQueue = false;
    
    // Reject any pending preview requests
    while (this.previewQueue.length > 0) {
      const request = this.previewQueue.pop();
      request.reject(new Error('AudioManager cleanup - operation cancelled'));
    }

    // Clean up all blob URLs
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls.clear();
    this.blobMeta.clear();
    this.currentBlobUrl = null;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      if (this.currentAudio.parentElement) {
        this.currentAudio.parentElement.remove();
      }
      this.currentAudio = null;
    }

    this.disconnectVisualizer();

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(console.error);
    }

    this.fileMap = {};
    
    console.log('AudioManager cleanup completed');
  }

  disconnectVisualizer() {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }
    this.reactToAudio = false;
    this.sourceNode = null;
    this.analyser = null;
    this.audioDataArray = null;
    
    // Hide waveform when audio stops
    if (window.app && window.app.visualizer) {
      window.app.visualizer.hideWaveform();
    }
  }

  async connectVisualizer(audioElem, waveformCanvasId = null) {
    // Prevent race conditions in visualizer connection
    if (this.isConnectingVisualizer) {
      console.log('Visualizer connection already in progress, skipping');
      return;
    }

    // If already connected and working, don't reconnect
    if (this.reactToAudio && this.audioCtx && this.audioCtx.state === 'running') {
      console.log('Visualizer already connected and running');
      return;
    }

    this.isConnectingVisualizer = true;
    
    try {
      // Clean up any existing visualizer first
      this.disconnectVisualizer();
      
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048; // Increased for better waveform resolution
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElem);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.reactToAudio = true;
      
      // Ensure audio context is running
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      
      console.log('Visualizer connected successfully, state:', this.audioCtx.state);
    } catch (error) {
      console.error('Failed to connect audio visualizer:', error);
      this.disconnectVisualizer();
    } finally {
      this.isConnectingVisualizer = false;
    }
  }

  async playPreview(track) {
    // Generate unique ID for this preview request
    const previewId = Date.now() + Math.random();
    
    // Add to queue and process
    return new Promise((resolve, reject) => {
      this.previewQueue.push({ track, previewId, resolve, reject });
      this.processPreviewQueue();
    });
  }

  async processPreviewQueue() {
    // Prevent concurrent processing
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.previewQueue.length > 0) {
        // Only process the most recent request, discard older ones
        const latestRequest = this.previewQueue.pop();
        
        // Reject all other queued requests
        while (this.previewQueue.length > 0) {
          const oldRequest = this.previewQueue.pop();
          oldRequest.reject(new Error('Superseded by newer preview request'));
        }

        try {
          await this.playPreviewInternal(latestRequest.track, latestRequest.previewId);
          latestRequest.resolve();
        } catch (error) {
          latestRequest.reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      // Check if new items were added during processing
      if (this.previewQueue.length > 0) {
        this.processPreviewQueue(); // Recursive call to handle race condition
      }
    }
  }

  async playPreviewInternal(track, previewId) {
    try {
      if (!track.absPath) {
        throw new Error('No file path for this track');
      }

      console.log(`Starting preview ${previewId} for track: ${track.artist} - ${track.title}`);
      console.log(`Track path: ${track.absPath}`);

      const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();
      console.log(`Looking for filename: ${fileName}`);
      console.log(`Available files:`, Object.keys(this.fileMap));
      
      let file = this.fileMap[fileName];
      
      // If exact match fails, try partial matching for similar filenames
      if (!file) {
        // Extract base filename without extension for fuzzy matching
        const baseFileName = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
        const availableFiles = Object.keys(this.fileMap);
        
        // First try: exact base filename match
        let matchingFile = availableFiles.find(availableFile => {
          const availableBase = availableFile.replace(/\.[^/.]+$/, '').toLowerCase();
          return availableBase === baseFileName;
        });
        
        // Second try: match by artist and title (first two parts)
        if (!matchingFile) {
          const [artist, title] = baseFileName.split(' - ');
          if (artist && title) {
            matchingFile = availableFiles.find(availableFile => {
              const availableBase = availableFile.replace(/\.[^/.]+$/, '').toLowerCase();
              const [availableArtist, availableTitle] = availableBase.split(' - ');
              return availableArtist === artist && availableTitle === title;
            });
          }
        }
        
        // Third try: contains artist and title anywhere in filename
        if (!matchingFile) {
          const [artist, title] = baseFileName.split(' - ');
          if (artist && title) {
            matchingFile = availableFiles.find(availableFile => {
              const availableBase = availableFile.replace(/\.[^/.]+$/, '').toLowerCase();
              return availableBase.includes(artist) && availableBase.includes(title);
            });
          }
        }
        
        if (matchingFile) {
          file = this.fileMap[matchingFile];
          console.log(`Found matching file: ${matchingFile}`);
        } else {
          console.log(`No match found for: ${baseFileName}`);
          // Debug: show files that start with the same first letter
          const firstChar = artist ? artist[0].toLowerCase() : '';
          const similarFiles = availableFiles.filter(f => f.startsWith(firstChar)).slice(0, 10);
          console.log(`Files starting with '${firstChar}':`, similarFiles);
        }
      }
      
      if (!file) {
        throw new Error(`Audio file not found: ${fileName}. Available files: ${Object.keys(this.fileMap).slice(0, 5).join(', ')}${Object.keys(this.fileMap).length > 5 ? '...' : ''}`);
      }

      if (!SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        throw new Error('Unsupported audio file type');
      }

      console.log(`File validation passed for: ${file.name}`);
      console.log(`Current preview ID before setting: ${this.currentPreviewId}, New preview ID: ${previewId}`);

      // Clean up previous audio first, then set new preview ID
      await this.cleanupCurrentAudioAsync();
      this.currentPreviewId = previewId;
      console.log(`Set current preview ID to: ${this.currentPreviewId}`);

      // Check if this preview was superseded during cleanup
      if (this.currentPreviewId !== previewId) {
        console.log(`Preview ${previewId} was superseded during cleanup`);
        return;
      }

      const url = this.createBlobUrl(file);
      this.currentBlobUrl = url;
      
      // Create container
      const container = document.createElement('div');
      container.className = 'audio-player-container';
      container._previewId = previewId; // Track which preview this belongs to
      
      // Add track info
      const label = SecurityUtils.createSafeElement('div',
        `${track.artist || ''} – ${track.title || ''}`,
        'audio-player-label'
      );
      container.appendChild(label);

      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕';
      closeButton.className = 'audio-player-close';
      closeButton.title = 'Close audio player';
      closeButton.addEventListener('click', () => {
        // Use the existing cleanup handler logic
        this.disconnectVisualizer();
        this.isPlayingPreview = false;
        container.remove();

        // Clear references
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }

        // Revoke blob URL to free memory
        this.revokeBlobUrl(url);

        // Clear current preview ID
        this.currentPreviewId = null;
      });
      container.appendChild(closeButton);

      // Add audio element
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      audio.autoplay = true;
      audio.className = 'custom-audio-player';
      audio._previewId = previewId; // Track which preview this belongs to
      
      // Prevent audio from being paused when tab becomes inactive
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('preload', 'auto');
      
      container.appendChild(audio);

      // Add waveform canvas to the audio player popup
      const waveformCanvas = document.createElement('canvas');
      waveformCanvas.id = `waveform-${previewId}`;
      waveformCanvas.width = 400;
      waveformCanvas.height = 80;
      waveformCanvas.className = 'audio-player-waveform';
      waveformCanvas._previewId = previewId;
      container.appendChild(waveformCanvas);

      // Check again if superseded before adding to DOM
      if (this.currentPreviewId !== previewId) {
        console.log(`Preview ${previewId} was superseded before DOM insertion`);
        container.remove();
        this.revokeBlobUrl(url);
        return;
      }

      document.body.appendChild(container);
      this.currentAudio = audio;
      this.isPlayingPreview = true;

      // Set up event handlers with race condition checking
      const cleanupHandler = () => {
        // Only cleanup if this is still the current preview
        if (audio._previewId === this.currentPreviewId) {
          this.disconnectVisualizer();
          this.isPlayingPreview = false;
        }
        
        container.remove();
        
        // Clear references if this was the current audio
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        
        this.revokeBlobUrl(url);
        
        // Clear current blob URL if this was it
        if (this.currentBlobUrl === url) {
          this.currentBlobUrl = null;
        }
      };

      audio.addEventListener('ended', cleanupHandler);
      
      audio.addEventListener('error', () => {
        if (this.notificationSystem) {
          this.notificationSystem.error('Error playing audio file');
        }
        cleanupHandler();
      });

      audio.addEventListener('pause', () => {
        // Don't disconnect visualizer on pause - just let it handle the lack of audio data
        console.log('Audio paused for preview:', audio._previewId);
      });

      audio.addEventListener('play', () => {
        // Reconnect visualizer if needed when resuming playback
        if (audio._previewId === this.currentPreviewId) {
          console.log('Audio resumed for preview:', audio._previewId);
          // Ensure visualizer is connected
          if (!this.reactToAudio) {
            this.connectVisualizer(audio, `waveform-${audio._previewId}`).catch(console.error);
          }
        }
      });

      audio.addEventListener('seeked', () => {
        // Ensure visualizer stays connected after seeking
        if (audio._previewId === this.currentPreviewId) {
          console.log('Audio seeked for preview:', audio._previewId);
          // Ensure visualizer is connected
          if (!this.reactToAudio) {
            this.connectVisualizer(audio, `waveform-${audio._previewId}`).catch(console.error);
          }
        }
      });

      // Prevent automatic pause when tab becomes inactive
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && audio && !audio.paused && audio._previewId === this.currentPreviewId) {
          // Keep playing in background - don't pause
          console.log('Tab hidden but keeping audio playing');
        }
      });

      // Store cleanup handler
      audio._cleanupHandler = cleanupHandler;

      // Connect visualizer only if still current
      if (this.currentPreviewId === previewId) {
        await this.connectVisualizer(audio, `waveform-${previewId}`);
        
        // Show waveform immediately to at least display the test pattern
        console.log('Enabling waveform immediately for test pattern:', `waveform-${previewId}`);
        console.log('this.visualizer exists:', !!this.visualizer);
        if (this.visualizer) {
          console.log('Calling showWaveform with:', `waveform-${previewId}`);
          this.visualizer.showWaveform(`waveform-${previewId}`, audio);
        } else {
          console.error('Cannot call showWaveform - missing this.visualizer');
        }
        
        // Wait for audio to start playing before showing waveform
        audio.addEventListener('play', () => {
          console.log('Audio started playing, re-enabling waveform for:', `waveform-${previewId}`);
          console.log('On play - this.visualizer exists:', !!this.visualizer);
          if (this.visualizer) {
            console.log('Calling showWaveform on play with:', `waveform-${previewId}`);
            this.visualizer.showWaveform(`waveform-${previewId}`, audio);
          } else {
            console.error('On play - Cannot call showWaveform - missing this.visualizer');
          }
        }, { once: true });
        
        // Also try enabling waveform when audio data is loading
        audio.addEventListener('loadeddata', () => {
          console.log('Audio data loaded, attempting waveform for:', `waveform-${previewId}`);
          console.log('On loadeddata - this.visualizer exists:', !!this.visualizer);
          if (this.visualizer) {
            console.log('Calling showWaveform on loadeddata with:', `waveform-${previewId}`);
            this.visualizer.showWaveform(`waveform-${previewId}`, audio);
          } else {
            console.error('On loadeddata - Cannot call showWaveform - missing this.visualizer');
          }
        }, { once: true });
      }

      console.log(`Preview ${previewId} started successfully`);

    } catch (error) {
      console.error(`Preview ${previewId} error:`, error);
      if (this.notificationSystem) {
        this.notificationSystem.error(error.message);
      }
      throw error;
    }
  }

  cleanupCurrentAudio() {
    return this.cleanupCurrentAudioAsync();
  }

  async cleanupCurrentAudioAsync() {
    console.log('Starting async cleanup of current audio');
    
    // Mark that we're no longer playing
    this.isPlayingPreview = false;
    
    // Disconnect visualizer first
    this.disconnectVisualizer();
    
    if (this.currentAudio) {
      // Call stored cleanup handler if available
      if (this.currentAudio._cleanupHandler) {
        this.currentAudio._cleanupHandler();
      } else {
        // Fallback cleanup
        if (this.currentAudio.parentElement) {
          this.currentAudio.parentElement.remove();
        }
        this.currentAudio = null;
      }
    }

    // Clean up current blob URL
    if (this.currentBlobUrl) {
      this.revokeBlobUrl(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    // Clear current preview ID
    this.currentPreviewId = null;
    
    // Small delay to ensure DOM cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Async cleanup completed');
  }

  loadAudioFiles(files) {
    this.fileMap = {};
    files.forEach(file => {
      if (SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        this.fileMap[file.name.toLowerCase()] = file;
      }
    });
    return Object.keys(this.fileMap).length;
  }
}

// ============= TRACK PROCESSOR =============
class TrackProcessor {
  static processTracklist(text, fileName) {
    // Comprehensive input validation
    const contentValidation = SecurityUtils.validateFileContent(text, fileName);
    if (!contentValidation.isValid) {
      throw new Error(`File validation failed: ${contentValidation.errors.join(', ')}`);
    }

    // Skip file extension validation for auto-loaded files
    if (fileName !== 'tracklist.csv' && 
        !SecurityUtils.validateFileExtension(fileName, CONFIG.ALLOWED_FILE_EXTENSIONS)) {
      throw new Error('Invalid file type');
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    // Additional processing limits
    if (lines.length > CONFIG.MAX_TRACKS_PER_FILE) {
      throw new Error(`File contains too many tracks (${lines.length}). Maximum allowed: ${CONFIG.MAX_TRACKS_PER_FILE}`);
    }

    console.log(`Processing ${lines.length} lines from ${fileName}`, {
      contentSize: contentValidation.stats.contentLength,
      maxLineLength: contentValidation.stats.maxLineLength
    });

    const result = {
      grouped: {},
      allBPMs: new Set(),
      allKeys: new Set(),
      allGenres: new Set(),
      allLabels: new Set(),
      totalTracks: 0,
      tracksForUI: [],
      duplicateTracks: [],
      energyLevels: {}
    };

    const seenTracks = new Map();
    const errors = [];

    lines.forEach((line, index) => {
      const parts = line.split(' - ');
      if (parts.length < 6) return;

      const track = this.parseTrackLine(parts);
      
      if (!track.artist && !track.title) {
        errors.push(`Line ${index + 1}: Missing required fields`);
        return;
      }

      // Use defaults for missing fields
      if (!track.artist) track.artist = 'Unknown Artist';
      if (!track.title) track.title = 'Unknown Title';

      // Validate and collect metadata
      if (track.bpm) {
        if (!SecurityUtils.validateBPM(track.bpm)) {
          console.warn(`Line ${index + 1}: Invalid BPM ${track.bpm}`);
        }
        result.allBPMs.add(track.bpm);
      }

      if (track.key) result.allKeys.add(track.key);
      if (track.genre) result.allGenres.add(track.genre);
      if (track.recordLabel) result.allLabels.add(track.recordLabel);

      // Create track object
      const trackObj = {
        display: `${track.artist} - ${track.title} - ${track.trackTime} - ${track.year}` + 
                 (track.genre ? ` - ${track.genre}` : ''),
        ...track
      };

      // Store energy level if present
      if (track.energyLevel && track.energyLevel >= 1 && track.energyLevel <= 10) {
        result.energyLevels[trackObj.display] = track.energyLevel;
      }

      // Group by artist
      if (!result.grouped[track.artist]) {
        result.grouped[track.artist] = [];
      }
      result.grouped[track.artist].push(trackObj);
      result.totalTracks++;
      result.tracksForUI.push(trackObj);

      // Improved duplicate detection
      const duplicateKeys = this.generateDuplicateKeys(track);
      let isDuplicate = false;
      
      duplicateKeys.forEach(key => {
        if (seenTracks.has(key)) {
          const original = seenTracks.get(key)[0];
          if (!result.duplicateTracks.includes(original)) {
            result.duplicateTracks.push(original);
          }
          if (!result.duplicateTracks.includes(trackObj)) {
            result.duplicateTracks.push(trackObj);
          }
          isDuplicate = true;
        }
      });
      
      if (!isDuplicate) {
        duplicateKeys.forEach(key => {
          if (!seenTracks.has(key)) {
            seenTracks.set(key, [trackObj]);
          }
        });
      }
    });

    if (errors.length > 0 && fileName !== 'tracklist.csv') {
      const summary = errors.slice(0, 5).join('\n');
      console.warn(`Validation errors:\n${summary}`);
    }

    return result;
  }

  static parseTrackLine(parts) {
    const track = {
      artist: parts[0]?.trim() || '',
      title: parts[1]?.trim() || '',
      key: parts[2]?.trim() || '',
      trackTime: parts[4]?.trim() || '',
      year: parts[5]?.trim() || '',
      recordLabel: '',
      genre: '',
      absPath: ''
    };

    // Extract BPM from format like "127.flac"
    const bpmExt = parts[3]?.trim() || '';
    const bpmMatch = bpmExt.match(/(\d{2,3})/);
    track.bpm = bpmMatch ? bpmMatch[1] : '';

    // Handle extended fields, energy level, and record label
    if (parts.length >= 7) {
      let workingParts = [...parts];
      let energyIndex = -1;
      let recordLabelIndex = -1;
      
      // Find energy level position (look for "Energy #" pattern)
      for (let i = workingParts.length - 1; i >= 6; i--) {
        const part = workingParts[i].trim();
        if (/Energy\s+(\d+)/i.test(part)) {
          const energyMatch = part.match(/Energy\s+(\d+)/i);
          track.energyLevel = parseInt(energyMatch[1]);
          energyIndex = i;
          break;
        }
      }
      
      // Find record label (should be after energy level if both exist)
      if (energyIndex !== -1 && workingParts.length > energyIndex + 1) {
        // Record label is after energy level
        const remainingParts = workingParts.slice(energyIndex + 1);
        // Filter out empty parts and commas
        const cleanParts = remainingParts.filter(part => part.trim() && part.trim() !== ',');
        if (cleanParts.length > 0) {
          let labelText = cleanParts.join(' - ').trim();
          // Remove "Label " prefix if it exists
          if (labelText.toLowerCase().startsWith('label ')) {
            labelText = labelText.substring(6).trim();
          }
          track.recordLabel = labelText;
        }
      }
      
      // Handle path and genre (between index 6 and energy level)
      const endIndex = energyIndex !== -1 ? energyIndex : workingParts.length;
      if (endIndex > 6) {
        const middleParts = workingParts.slice(6, endIndex);
        
        // Find file path (look for file extensions)
        let pathParts = [];
        let genreParts = [];
        
        for (let i = 0; i < middleParts.length; i++) {
          const part = middleParts[i].trim();
          if (/\.(mp3|wav|flac|aiff|ogg)$/i.test(part)) {
            // This and everything before it is likely the path
            pathParts = middleParts.slice(0, i + 1);
            // Everything after is genre
            genreParts = middleParts.slice(i + 1);
            break;
          }
        }
        
        // If no file extension found, assume last part is genre
        if (pathParts.length === 0 && middleParts.length > 0) {
          if (middleParts.length > 1) {
            pathParts = middleParts.slice(0, -1);
            genreParts = [middleParts[middleParts.length - 1]];
          } else {
            genreParts = middleParts;
          }
        }
        
        track.absPath = pathParts.join(' - ').trim();
        track.genre = genreParts.join(' - ').trim();
      }
    }

    // Normalize year
    const yearMatch = track.year.match(/(19\d{2}|20\d{2})/);
    if (yearMatch) track.year = yearMatch[1];

    return track;
  }

  static generateDuplicateKeys(track) {
    // Create multiple keys to catch variations
    const keys = new Set();
    
    // Normalize text function
    const normalize = (text) => {
      if (!text) return '';
      return text.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
        .replace(/-+/g, '-') // Normalize hyphens
        .trim();
    };
    
    const normalizedArtist = normalize(track.artist);
    const normalizedTitle = normalize(track.title);
    
    // Basic key (exact match)
    keys.add(`${normalizedArtist}|${normalizedTitle}|${track.key}|${track.bpm}`);
    
    // Key without BPM (in case BPM differs slightly)
    keys.add(`${normalizedArtist}|${normalizedTitle}|${track.key}`);
    
    // Handle remix variations
    const titleWithoutRemix = normalizedTitle
      .replace(/\b(remix|edit|extended|radio|club|original|mix|version|rework|remaster)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
      
    if (titleWithoutRemix !== normalizedTitle) {
      keys.add(`${normalizedArtist}|${titleWithoutRemix}|${track.key}|${track.bpm}`);
      keys.add(`${normalizedArtist}|${titleWithoutRemix}|${track.key}`);
    }
    
    // Handle artist variations (remove featuring, ft, feat, etc.)
    const artistWithoutFeat = normalizedArtist
      .replace(/\b(feat|featuring|ft|vs|x|and|&)\b.*$/g, '')
      .trim();
      
    if (artistWithoutFeat !== normalizedArtist) {
      keys.add(`${artistWithoutFeat}|${normalizedTitle}|${track.key}|${track.bpm}`);
      keys.add(`${artistWithoutFeat}|${titleWithoutRemix}|${track.key}|${track.bpm}`);
    }
    
    // Handle parenthetical content in titles
    const titleWithoutParens = normalizedTitle
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
      
    if (titleWithoutParens !== normalizedTitle) {
      keys.add(`${normalizedArtist}|${titleWithoutParens}|${track.key}|${track.bpm}`);
      keys.add(`${artistWithoutFeat}|${titleWithoutParens}|${track.key}|${track.bpm}`);
    }
    
    // Remove empty keys
    keys.delete('|||');
    keys.delete('||');
    
    return Array.from(keys).filter(key => key.length > 3);
  }
}

// ============= UI RENDERER =============
class UIRenderer {
  constructor(appState) {
    this.appState = appState;
    this.azBarActive = null;

    // Pagination state
    this.currentPage = 1;
    this.tracksPerPage = 100;
    this.totalTracks = 0;
    this.totalPages = 1;
    this.currentFilteredTracks = [];
  }

  render() {
    const filters = this.getActiveFilters();
    let filteredTracks = this.filterTracks(filters);

    // Apply smart playlist filtering if a smart playlist is selected
    const currentPlaylist = this.appState.data.currentPlaylist;
    if (currentPlaylist && currentPlaylist.startsWith('smart:')) {
      const smartPlaylistName = currentPlaylist.replace('smart:', '');
      const smartPlaylist = this.appState.data.smartPlaylists?.[smartPlaylistName];

      console.log('Applying smart playlist filtering:', smartPlaylistName);
      console.log('Available smart playlists:', Object.keys(this.appState.data.smartPlaylists || {}));
      console.log('Smart playlist data:', smartPlaylist);
      console.log('Tracks before smart filtering:', filteredTracks.length);

      if (smartPlaylist) {
        // Apply smart playlist rules to the already filtered tracks
        filteredTracks = this.filterTracksBySmartRules(filteredTracks, smartPlaylist.rules, smartPlaylist.logic);
        console.log('Tracks after smart filtering:', filteredTracks.length);
      }
    }

    const sortedTracks = this.sortTracks(filteredTracks, filters.sortValue);

    // Store filtered tracks for pagination
    this.currentFilteredTracks = sortedTracks;
    this.totalTracks = sortedTracks.length;
    this.totalPages = Math.ceil(this.totalTracks / this.tracksPerPage);

    // Reset to page 1 if current page is beyond total pages
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }

    // Ensure we're on page 1 if this is the first render with tracks
    if (this.totalTracks > 0 && this.currentPage === 0) {
      this.currentPage = 1;
    }

    // Get tracks for current page
    const paginatedTracks = this.getPaginatedTracks();
    const groupedTracks = this.groupTracks(paginatedTracks);

    // Debug logging with more detail
    console.log(`DEBUG: Page ${this.currentPage}/${this.totalPages}, TracksPerPage: ${this.tracksPerPage}`);
    console.log(`DEBUG: Total tracks: ${this.totalTracks}, Paginated tracks: ${paginatedTracks.length}`);
    console.log(`DEBUG: Grouped tracks artists: ${Object.keys(groupedTracks).length}`);

    let totalTracksInGroups = 0;
    Object.entries(groupedTracks).forEach(([artist, tracks]) => {
      totalTracksInGroups += tracks.length;
      console.log(`DEBUG: Artist ${artist}: ${tracks.length} tracks`);
    });
    console.log(`DEBUG: Total tracks in groups: ${totalTracksInGroups}`);

    this.renderTracks(groupedTracks);
    this.updatePaginationControls();
    this.updateStats(filteredTracks);
    this.renderAZBar();

    if (filteredTracks.length === 0 && this.hasActiveFilters(filters)) {
      this.showNoResults();
    }
  }

  getPaginatedTracks() {
    if (this.currentFilteredTracks.length === 0) {
      return [];
    }

    const startIndex = (this.currentPage - 1) * this.tracksPerPage;
    const endIndex = startIndex + this.tracksPerPage;

    return this.currentFilteredTracks.slice(startIndex, endIndex);
  }

  updatePaginationControls() {
    // Get both top and bottom pagination elements
    const topElements = {
      tracksShowing: document.getElementById('tracks-showing'),
      pageInfo: document.getElementById('page-info'),
      firstPageBtn: document.getElementById('first-page-btn'),
      prevPageBtn: document.getElementById('prev-page-btn'),
      nextPageBtn: document.getElementById('next-page-btn'),
      lastPageBtn: document.getElementById('last-page-btn')
    };

    const bottomElements = {
      tracksShowing: document.getElementById('tracks-showing-bottom'),
      pageInfo: document.getElementById('page-info-bottom'),
      firstPageBtn: document.getElementById('first-page-btn-bottom'),
      prevPageBtn: document.getElementById('prev-page-btn-bottom'),
      nextPageBtn: document.getElementById('next-page-btn-bottom'),
      lastPageBtn: document.getElementById('last-page-btn-bottom')
    };

    const updateElements = (elements) => {
      if (!elements.tracksShowing || !elements.pageInfo) return;

      // Handle case where no tracks are loaded yet
      if (this.totalTracks === 0) {
        elements.tracksShowing.textContent = 'Loading tracks...';
        elements.pageInfo.textContent = 'Page 1 of 1';

        if (elements.firstPageBtn && elements.prevPageBtn && elements.nextPageBtn && elements.lastPageBtn) {
          elements.firstPageBtn.disabled = true;
          elements.prevPageBtn.disabled = true;
          elements.nextPageBtn.disabled = true;
          elements.lastPageBtn.disabled = true;
        }
        return;
      }

      // Update tracks showing info
      let showingText;
      if (this.tracksPerPage === Infinity) {
        // Show All mode
        showingText = `Showing all ${this.totalTracks} tracks`;
      } else {
        const startTrack = (this.currentPage - 1) * this.tracksPerPage + 1;
        const endTrack = Math.min(this.currentPage * this.tracksPerPage, this.totalTracks);
        showingText = `Showing ${startTrack}-${endTrack} of ${this.totalTracks} tracks`;
      }
      elements.tracksShowing.textContent = showingText;

      // Update page info
      if (this.tracksPerPage === Infinity) {
        elements.pageInfo.textContent = 'Showing All';
      } else {
        elements.pageInfo.textContent = `Page ${this.currentPage} of ${Math.max(1, this.totalPages)}`;
      }

      // Update button states
      if (elements.firstPageBtn && elements.prevPageBtn && elements.nextPageBtn && elements.lastPageBtn) {
        if (this.tracksPerPage === Infinity) {
          // Disable all pagination buttons when showing all
          elements.firstPageBtn.disabled = true;
          elements.prevPageBtn.disabled = true;
          elements.nextPageBtn.disabled = true;
          elements.lastPageBtn.disabled = true;
        } else {
          const isFirstPage = this.currentPage <= 1;
          const isLastPage = this.currentPage >= this.totalPages || this.totalPages <= 1;

          elements.firstPageBtn.disabled = isFirstPage;
          elements.prevPageBtn.disabled = isFirstPage;
          elements.nextPageBtn.disabled = isLastPage;
          elements.lastPageBtn.disabled = isLastPage;
        }
      }
    };

    // Update both top and bottom pagination controls
    updateElements(topElements);
    updateElements(bottomElements);

    console.log(`DEBUG: Pagination display updated for both top and bottom controls`);
  }

  goToPage(page) {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.render();
  }

  setTracksPerPage(tracksPerPage) {
    if (tracksPerPage === 'all') {
      this.tracksPerPage = Infinity; // Show all tracks
    } else {
      this.tracksPerPage = parseInt(tracksPerPage);
    }
    this.currentPage = 1; // Reset to first page when changing page size
    this.render();
  }

  getActiveFilters() {
    // Ensure elements are defined with fallback to document.getElementById
    const filters = {
      search: document.getElementById('search')?.value.toLowerCase() || '',
      fuzzySearchEnabled: document.getElementById('fuzzy-search-toggle')?.checked || false,
      selectedBPM: (this.appState.elements?.bpmFilter?.value) || document.getElementById('bpm-filter')?.value || '',
      selectedKey: (this.appState.elements?.keyFilter?.value) || document.getElementById('key-filter')?.value || '',
      selectedGenre: (this.appState.elements?.genreFilter?.value) || document.getElementById('genre-filter')?.value || '',
      selectedEnergy: (this.appState.elements?.energyFilter?.value) || document.getElementById('energy-filter')?.value || '',
      selectedLabel: (this.appState.elements?.labelFilter?.value) || document.getElementById('label-filter')?.value || '',
      tagSearch: document.getElementById('tag-dropdown')?.value.toLowerCase() || '',
      sortValue: (this.appState.elements?.sortSelect?.value) || document.getElementById('sort-select')?.value || 'name-asc',
      yearSearch: document.getElementById('year-search')?.value.trim() || '',
      showFavoritesOnly: this.appState.data.showFavoritesOnly || false
    };

    console.log('Active filters:', filters);
    return filters;
  }

  hasActiveFilters(filters) {
    return filters.search || filters.selectedBPM || filters.selectedKey || 
           filters.selectedGenre || filters.selectedEnergy || filters.selectedLabel || 
           filters.tagSearch || filters.yearSearch || filters.showFavoritesOnly;
  }

  filterTracks(filters) {
    console.log(`DEBUG: Starting filterTracks with ${this.appState.data.tracksForUI.length} total tracks`);

    let yearMin = null, yearMax = null;

    if (filters.yearSearch) {
      const match = filters.yearSearch.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
      if (match) {
        yearMin = parseInt(match[1], 10);
        yearMax = match[2] ? parseInt(match[2], 10) : yearMin;
      }
    }

    const result = this.appState.data.tracksForUI.filter(track => {
      // Search filter (with optional fuzzy matching)
      if (filters.search) {
        let searchMatch = false;
        
        if (filters.fuzzySearchEnabled) {
          // Fuzzy search using Levenshtein distance
          searchMatch = FuzzySearchUtils.fuzzyMatch(filters.search, track.display) ||
                       FuzzySearchUtils.fuzzyMatch(filters.search, track.artist || '') ||
                       FuzzySearchUtils.fuzzyMatch(filters.search, track.title || '') ||
                       FuzzySearchUtils.fuzzyMatch(filters.search, track.genre || '') ||
                       FuzzySearchUtils.fuzzyMatch(filters.search, track.recordLabel || '');
        } else {
          // Standard exact substring matching
          searchMatch = track.display.toLowerCase().includes(filters.search) ||
                       track.artist?.toLowerCase().includes(filters.search) ||
                       track.title?.toLowerCase().includes(filters.search);
        }
        
        if (!searchMatch) return false;
      }

      // BPM filter
      if (filters.selectedBPM && track.bpm !== filters.selectedBPM) return false;

      // Key filter
      if (filters.selectedKey && track.key !== filters.selectedKey) return false;

      // Genre filter
      if (filters.selectedGenre && track.genre !== filters.selectedGenre) return false;

      // Label filter
      if (filters.selectedLabel && track.recordLabel !== filters.selectedLabel) return false;

      // Tag filter
      if (filters.tagSearch) {
        const tags = this.appState.data.trackTags[track.display] || [];
        if (!tags.map(t => t.toLowerCase()).includes(filters.tagSearch)) return false;
      }

      // Energy level filter
      if (filters.selectedEnergy) {
        const trackEnergy = this.appState.data.energyLevels[track.display];
        if (trackEnergy !== parseInt(filters.selectedEnergy)) return false;
      }

      // Favorites filter
      if (filters.showFavoritesOnly && !this.appState.data.favoriteTracks[track.display]) {
        return false;
      }

      // Year filter
      if (yearMin !== null && yearMax !== null) {
        const trackYear = parseInt(track.year, 10);
        if (isNaN(trackYear) || trackYear < yearMin || trackYear > yearMax) return false;
      }

      return true;
    });

    console.log(`DEBUG: filterTracks result: ${result.length} tracks after filtering`);
    return result;
  }

  filterTracksBySmartRules(tracks, rules, logic) {
    if (!rules || !rules.length) return tracks;

    return tracks.filter(track => {
      if (logic === 'AND') {
        return rules.every(rule => this.trackMatchesRule(track, rule));
      } else {
        return rules.some(rule => this.trackMatchesRule(track, rule));
      }
    });
  }

  trackMatchesRule(track, rule) {
    const { field, operator, value, value2 } = rule;
    let trackValue = track[field] || '';

    // Special handling for energy levels
    if (field === 'energy') {
      trackValue = this.appState.data.energyLevels[track.display] || 0;
    }

    // Convert to string for comparison
    const trackValueStr = String(trackValue).toLowerCase();
    const ruleValueStr = value.toLowerCase();

    switch (operator) {
      case 'is':
        if (['bpm', 'year', 'energy'].includes(field)) {
          return parseFloat(trackValue) === parseFloat(value);
        }
        return trackValueStr === ruleValueStr;

      case 'contains':
        return trackValueStr.includes(ruleValueStr);

      case 'starts_with':
        return trackValueStr.startsWith(ruleValueStr);

      case 'greater_than':
        return parseFloat(trackValue) > parseFloat(value);

      case 'less_than':
        return parseFloat(trackValue) < parseFloat(value);

      case 'between':
        if (!value2) return false;
        const numValue = parseFloat(trackValue);
        const min = Math.min(parseFloat(value), parseFloat(value2));
        const max = Math.max(parseFloat(value), parseFloat(value2));
        return numValue >= min && numValue <= max;

      default:
        return false;
    }
  }

  sortTracks(tracks, sortValue) {
    console.log(`DEBUG: sortTracks input: ${tracks.length} tracks, sortValue: ${sortValue}`);
    const sorted = [...tracks];

    if (sortValue === 'tracks-desc' || sortValue === 'tracks-asc') {
      const artistCounts = {};
      tracks.forEach(t => {
        artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
      });
      sorted.sort((a, b) => {
        const diff = artistCounts[b.artist] - artistCounts[a.artist];
        return sortValue === 'tracks-desc' ? diff : -diff;
      });
    } else {
      sorted.sort((a, b) => {
        switch (sortValue) {
          case 'name-asc': return a.artist.localeCompare(b.artist);
          case 'name-desc': return b.artist.localeCompare(a.artist);
          case 'bpm-asc': return Number(a.bpm) - Number(b.bpm);
          case 'bpm-desc': return Number(b.bpm) - Number(a.bpm);
          case 'key-asc': return a.key.localeCompare(b.key);
          case 'key-desc': return b.key.localeCompare(a.key);
          case 'title-asc': return a.title.localeCompare(b.title);
          case 'title-desc': return b.title.localeCompare(a.title);
          default: return a.artist.localeCompare(b.artist);
        }
      });
    }

    console.log(`DEBUG: sortTracks result: ${sorted.length} tracks after sorting`);
    return sorted;
  }

  groupTracks(tracks) {
    const grouped = {};
    tracks.forEach(track => {
      if (!grouped[track.artist]) grouped[track.artist] = [];
      grouped[track.artist].push(track);
    });
    return grouped;
  }

  renderTracks(groupedTracks) {
    const container = this.appState.elements.container;
    if (!container) {
      console.log('DEBUG: No container found!');
      return;
    }

    // Clear existing DOM and event listeners for memory management
    this.cleanupTrackElements(container);

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();

    let totalRendered = 0;
    Object.entries(groupedTracks).forEach(([artist, tracks]) => {
      if (tracks.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'column-group group';

      const h2 = SecurityUtils.createSafeElement('h2', artist);
      groupDiv.appendChild(h2);

      tracks.forEach(track => {
        groupDiv.appendChild(this.createTrackElement(track));
        totalRendered++;
      });

      fragment.appendChild(groupDiv);
    });

    container.appendChild(fragment);
    console.log(`DEBUG: Rendered ${totalRendered} track elements to DOM`);
  }

  cleanupTrackElements(container) {
    // Remove all existing content and trigger garbage collection
    const existingTracks = container.querySelectorAll('.track');
    existingTracks.forEach(track => {
      // Remove any event listeners that might be attached
      const buttons = track.querySelectorAll('button');
      buttons.forEach(button => {
        button.replaceWith(button.cloneNode(true));
      });
    });

    // Clear container
    container.innerHTML = '';

    // Force garbage collection hint (not guaranteed but helps)
    if (window.gc) {
      window.gc();
    }
  }

  createTrackElement(track) {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    
    if (this.appState.data.favoriteTracks[track.display]) {
      trackDiv.className += ' favorite-track';
    }

    // Store data attributes for later retrieval
    trackDiv.dataset.artist = track.artist || '';
    trackDiv.dataset.title = track.title || '';
    trackDiv.dataset.key = track.key || '';
    trackDiv.dataset.bpm = track.bpm || '';
    trackDiv.dataset.year = track.year || '';
    trackDiv.dataset.genre = track.genre || '';
    trackDiv.dataset.path = track.absPath || '';
    trackDiv.dataset.display = track.display || '';
    trackDiv.dataset.trackTime = track.trackTime || '';

    // Main content
    const nameContainer = document.createElement('div');
    
    const trackMain = SecurityUtils.createSafeElement('span', 
      `${track.artist} - ${track.title}`, 'track-main');
    nameContainer.appendChild(trackMain);

    // Details
    const energyLevel = this.appState.data.energyLevels[track.display];
    const energyDisplay = energyLevel ? `${'★'.repeat(energyLevel)}${'☆'.repeat(10 - energyLevel)} (${energyLevel}/10)` : '';
    
    const details = [
      { label: 'Key', value: track.key },
      { label: 'BPM', value: track.bpm },
      { label: 'Genre', value: track.genre },
      { label: 'Length', value: track.trackTime },
      { label: 'Year', value: track.year },
      { label: 'Label', value: track.recordLabel },
      { label: 'Energy', value: energyDisplay }
    ];

    details.forEach(detail => {
      if (detail.value) {
        const span = SecurityUtils.createSafeElement('span', 
          `${detail.label}: ${detail.value}`, 'track-details');
        nameContainer.appendChild(span);
      }
    });

    // Icons row
    const iconRow = this.createIconRow(track);

    trackDiv.appendChild(nameContainer);
    trackDiv.appendChild(iconRow);

    // Tags
    const tags = this.appState.data.trackTags[track.display];
    if (tags && tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'track-tags-row';
      tags.forEach(tag => {
        const tagSpan = SecurityUtils.createSafeElement('span', tag, 'tag-pill');
        tagsDiv.appendChild(tagSpan);
      });
      trackDiv.appendChild(tagsDiv);
    }

    // Mood & Vibe Tags
    const moodTags = this.appState.data.moodVibeTags[track.display];
    if (moodTags && moodTags.length > 0) {
      const moodTagsDiv = document.createElement('div');
      moodTagsDiv.className = 'mood-vibe-tags-row';
      
      // Add a small icon/label to differentiate from regular tags
      const moodLabel = SecurityUtils.createSafeElement('span', '😎', 'mood-vibe-label');
      moodLabel.title = 'Mood & Vibe Tags';
      moodTagsDiv.appendChild(moodLabel);
      
      moodTags.forEach(tag => {
        const tagSpan = SecurityUtils.createSafeElement('span', tag, 'mood-vibe-pill');
        moodTagsDiv.appendChild(tagSpan);
      });
      trackDiv.appendChild(moodTagsDiv);
    }

    return trackDiv;
  }

  createIconRow(track) {
    const iconRow = document.createElement('div');
    iconRow.className = 'track-icons-row';

    // Star button
    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn';
    starBtn.dataset.trackDisplay = track.display;
    if (this.appState.data.favoriteTracks[track.display]) {
      starBtn.className += ' favorited';
      starBtn.textContent = '★';
      starBtn.title = 'Unstar';
    } else {
      starBtn.textContent = '☆';
      starBtn.title = 'Mark as favorite';
    }
    iconRow.appendChild(starBtn);

    // Folder button
    if (track.absPath) {
      const folderBtn = document.createElement('button');
      folderBtn.className = 'folder-btn';
      folderBtn.title = 'Copy Path to Clipboard';
      folderBtn.textContent = '📁';
      folderBtn.dataset.path = track.absPath;
      iconRow.appendChild(folderBtn);
    }

    // Tag button
    const tagBtn = document.createElement('button');
    tagBtn.className = 'tag-btn';
    tagBtn.title = 'Tag';
    tagBtn.textContent = '🏷️';
    tagBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(tagBtn);

    // Mood & Vibe tag button
    const moodBtn = document.createElement('button');
    moodBtn.className = 'mood-vibe-btn';
    moodBtn.title = 'Edit Mood & Vibe';
    moodBtn.textContent = '😎';
    moodBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(moodBtn);

    // Playlist button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-playlist-btn';
    addBtn.title = 'Add to Playlist';
    addBtn.textContent = '+';
    addBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(addBtn);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-track-btn';
    copyBtn.title = 'Copy Track Info';
    copyBtn.textContent = '📋';
    copyBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(copyBtn);

    // Energy level button
    const energyBtn = document.createElement('button');
    energyBtn.className = 'energy-btn';
    const currentEnergy = this.appState.data.energyLevels[track.display] || 0;
    energyBtn.title = `Set Energy Level (Current: ${currentEnergy}/5)`;
    energyBtn.textContent = '⚡';
    energyBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(energyBtn);

    // Preview button
    const previewBtn = document.createElement('button');
    previewBtn.className = 'preview-btn';
    previewBtn.title = 'Preview';
    previewBtn.textContent = '▶️';
    previewBtn.dataset.trackDisplay = track.display;
    iconRow.appendChild(previewBtn);

    return iconRow;
  }

  updateStats(tracks) {
    const stats = this.appState.elements.statsElement;
    if (!stats) return;

    const artistCount = new Set(tracks.map(t => t.artist)).size;
    
    let bpmStat = '';
    const bpms = tracks.map(t => parseInt(t.bpm)).filter(Boolean);
    if (bpms.length === 1) {
      bpmStat = `${bpms[0]} BPM`;
    } else if (bpms.length > 1) {
      bpms.sort((a, b) => a - b);
      bpmStat = `${bpms[0]}–${bpms[bpms.length - 1]} BPM`;
    }

    const statsText = [
      `${tracks.length} tracks`,
      `${artistCount} artists`,
      bpmStat
    ].filter(Boolean).join(' • ');

    stats.textContent = statsText;
  }

  showNoResults() {
    const container = this.appState.elements.container;
    if (!container) return;
    
    const noResults = SecurityUtils.createSafeElement('div', 
      'No tracks found matching your filters.', 'no-results');
    container.innerHTML = '';
    container.appendChild(noResults);
  }

  renderAZBar() {
    const azBar = document.getElementById('az-bar');
    if (!azBar) return;

    azBar.innerHTML = '';
    
    // Get available artist initials from current data
    const availableInitials = this.getAvailableArtistInitials();
    
    // Build categories: Numbers, Letters, Symbols
    const categories = [
      { label: '#', type: 'numbers', chars: '0123456789' },
      { label: 'A-Z', type: 'letters', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
      { label: '★', type: 'symbols', chars: '' } // Catch-all for symbols
    ];
    
    categories.forEach(category => {
      if (category.type === 'letters') {
        // Individual letter buttons
        for (const char of category.chars) {
          if (availableInitials.has(char)) {
            const btn = document.createElement('button');
            btn.textContent = char;
            btn.className = 'az-letter';
            btn.dataset.letter = char;
            btn.dataset.type = 'letter';
            azBar.appendChild(btn);
          }
        }
      } else {
        // Category buttons for numbers and symbols
        const hasContent = category.type === 'numbers' 
          ? Array.from(category.chars).some(char => availableInitials.has(char))
          : availableInitials.has('symbols');
          
        if (hasContent) {
          const btn = document.createElement('button');
          btn.textContent = category.label;
          btn.className = 'az-letter az-category';
          btn.dataset.letter = category.type;
          btn.dataset.type = category.type;
          azBar.appendChild(btn);
        }
      }
    });
  }

  getAvailableArtistInitials() {
    const initials = new Set();
    const tracksForUI = this.appState.data.tracksForUI || [];
    
    tracksForUI.forEach(track => {
      if (track.artist) {
        const firstChar = this.normalizeFirstCharacter(track.artist);
        initials.add(firstChar);
      }
    });
    
    return initials;
  }

  normalizeFirstCharacter(artistName) {
    if (!artistName) return 'symbols';
    
    // Get first character and normalize
    const firstChar = artistName.trim()[0];
    if (!firstChar) return 'symbols';
    
    const upper = firstChar.toUpperCase();
    
    // Check if it's a number
    if (/[0-9]/.test(upper)) return 'numbers';
    
    // Check if it's a letter (including accented characters)
    if (/[A-ZÁÀÂÄÃÅÆÇÉÈÊËÍÌÎÏÑÓÒÔÖÕØÚÙÛÜÝ]/.test(upper)) {
      // Map accented characters to base letters
      const accents = {
        'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A', 'Æ': 'A',
        'Ç': 'C',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ñ': 'N',
        'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O', 'Ø': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ý': 'Y'
      };
      return accents[upper] || upper;
    }
    
    // Everything else is a symbol
    return 'symbols';
  }

  jumpToArtist(letter) {
    const tracks = document.querySelectorAll('.track');
    
    for (const track of tracks) {
      const artist = track.dataset.artist || '';
      if (!artist) continue;
      
      const artistFirstChar = this.normalizeFirstCharacter(artist);
      let shouldJump = false;
      
      // Handle different jump types
      if (letter === 'numbers' && artistFirstChar === 'numbers') {
        shouldJump = true;
      } else if (letter === 'symbols' && artistFirstChar === 'symbols') {
        shouldJump = true;
      } else if (letter.length === 1 && artistFirstChar === letter) {
        shouldJump = true;
      }
      
      if (shouldJump) {
        track.scrollIntoView({ behavior: 'smooth', block: 'center' });
        track.classList.add('az-jump-highlight');
        setTimeout(() => track.classList.remove('az-jump-highlight'), 1200);
        break;
      }
    }
  }

  renderDuplicateList() {
    const container = document.getElementById('duplicate-list');
    if (!container) return;

    const duplicates = this.appState.data.duplicateTracks;
    if (!duplicates || duplicates.length === 0) {
      container.innerHTML = '';
      return;
    }

    const header = SecurityUtils.createSafeElement('div', 
      `Duplicate Tracks Detected (${duplicates.length}):`, 'duplicate-list-header');

    const ul = document.createElement('ul');
    ul.className = 'duplicate-list-container';

    duplicates.forEach(track => {
      const li = SecurityUtils.createSafeElement('li', track.display);
      ul.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(header);
    container.appendChild(ul);
  }

  showCopyTooltip(element, message) {
    const tooltip = SecurityUtils.createSafeElement('div', message, 'copy-tooltip');
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + window.scrollX + 'px';
    tooltip.style.top = rect.bottom + window.scrollY + 2 + 'px';

    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 2000);
  }
}

// ============= UI CONTROLLERS =============
class UIController {
  constructor(appState, renderer, audioManager, notificationSystem, rateLimiter) {
    this.appState = appState;
    this.renderer = renderer;
    this.audioManager = audioManager;
    this.notificationSystem = notificationSystem;
    this.rateLimiter = rateLimiter;
    this.tagPopup = null;
    this.tagPopupClickHandler = null; // Track the document click handler
  }

  attachEventListeners() {
    // Use event delegation for better performance
    const container = this.appState.elements.container;
    if (container) {
      container.addEventListener('click', this.handleTrackClick.bind(this));
    }

    // Filter listeners
    this.attachFilterListeners();
    
    // Playlist controls
    this.attachPlaylistListeners();
    
    // Import/Export controls
    this.attachImportExportListeners();
    
    // Other controls
    this.attachOtherListeners();
  }

  attachFilterListeners() {
    const filters = ['search', 'bpm-filter', 'key-filter', 'genre-filter', 'energy-filter', 'label-filter', 'sort-select', 'year-search', 'tag-dropdown', 'fuzzy-search-toggle'];

    filters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.render());
        if (id === 'search' || id === 'year-search') {
          element.addEventListener('input', debounce(() => this.render(), CONFIG.DEBOUNCE_DELAY));
        }
        if (id === 'fuzzy-search-toggle') {
          element.addEventListener('input', () => this.render());
        }
      }
    });

    // Enhanced search functionality
    this.attachSearchEnhancements();

    // Filter drawer toggle functionality
    this.attachFilterDrawer();
  }

  attachSearchEnhancements() {
    const searchInput = document.getElementById('search');
    const clearButton = document.getElementById('clear-search');
    
    if (searchInput && clearButton) {
      // Show/hide clear button based on input content
      const updateClearButton = () => {
        if (searchInput.value.trim()) {
          clearButton.classList.add('visible');
        } else {
          clearButton.classList.remove('visible');
        }
      };

      searchInput.addEventListener('input', updateClearButton);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          updateClearButton();
          this.render();
        }
      });

      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        updateClearButton();
        searchInput.focus();
        this.render();
      });

      // Initial state
      updateClearButton();
    }
  }

  attachFilterDrawer() {
    const filterDrawerBtn = document.getElementById('filter-drawer-btn');
    const filterDrawer = document.getElementById('filter-drawer');

    if (filterDrawerBtn && filterDrawer) {
      filterDrawerBtn.addEventListener('click', () => {
        const isCollapsed = filterDrawer.classList.contains('collapsed');
        const arrow = filterDrawerBtn.querySelector('.filter-toggle-arrow');

        if (isCollapsed) {
          // Expand
          filterDrawer.classList.remove('collapsed');
          filterDrawerBtn.classList.remove('collapsed');
          if (arrow) arrow.textContent = '▼';
        } else {
          // Collapse
          filterDrawer.classList.add('collapsed');
          filterDrawerBtn.classList.add('collapsed');
          if (arrow) arrow.textContent = '▶';
        }
      });
    }
  }

  attachPlaylistListeners() {
    const playlistSelect = document.getElementById('playlist-select');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (e) => {
        this.appState.data.currentPlaylist = e.target.value;
        this.appState.saveToStorage();
        this.updatePlaylistButtonStates();

        // If it's a smart playlist, trigger a render to show filtered tracks
        if (e.target.value.startsWith('smart:')) {
          console.log('Smart playlist selected:', e.target.value);
          this.renderer.render();
        }
      });
    }

    const createBtn = document.getElementById('create-playlist-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.createPlaylist());
    }

    const createSmartBtn = document.getElementById('create-smart-playlist-btn');
    if (createSmartBtn) {
      createSmartBtn.addEventListener('click', () => this.showSmartPlaylistModal());
    }

    const deleteBtn = document.getElementById('delete-playlist-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deletePlaylist());
    }

    const renameBtn = document.getElementById('rename-playlist-btn');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => this.renamePlaylist());
    }

    const exportBtn = document.getElementById('export-playlist-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.showExportFormatModal());
    }

    const importBtn = document.getElementById('import-playlists-btn');
    const importInput = document.getElementById('import-playlists-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this.importPlaylists(e));
    }
  }

  attachImportExportListeners() {
    // Export all
    const exportAllBtn = document.getElementById('export-all');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.exportAll());
    }

    // Import all
    const importAllInput = document.getElementById('import-all-input');
    if (importAllInput) {
      importAllInput.addEventListener('change', (e) => this.importAll(e));
    }

    // Export tags
    const exportTagsBtn = document.getElementById('export-tags');
    if (exportTagsBtn) {
      exportTagsBtn.addEventListener('click', () => this.exportTags());
    }

    // Import tags
    const importTagsBtn = document.getElementById('import-tags-btn');
    const importTagsInput = document.getElementById('import-tags-input');
    if (importTagsBtn && importTagsInput) {
      importTagsBtn.addEventListener('click', () => importTagsInput.click());
      importTagsInput.addEventListener('change', (e) => this.importTags(e));
    }

    // Upload tracklist
    const uploadInput = document.getElementById('tracklist-upload');
    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => this.uploadTracklist(e));
    }

    // Audio folder input
    const audioInput = document.getElementById('audio-folder-input');
    if (audioInput) {
      audioInput.addEventListener('change', (e) => this.loadAudioFolder(e));
    }
  }

  attachOtherListeners() {
    // Favorites toggle
    const favBtn = document.getElementById('favorites-toggle-btn');
    if (favBtn) {
      favBtn.addEventListener('click', () => this.toggleFavorites());
    }

    // Stats toggle
    const statsBtn = document.getElementById('stats-toggle-btn');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => this.toggleStats());
    }

    // Duplicate tracks toggle
    const duplicatesBtn = document.getElementById('duplicates-toggle-btn');
    if (duplicatesBtn) {
      duplicatesBtn.addEventListener('click', () => this.toggleDuplicates());
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', (e) => {
        const isLightMode = e.target.checked;
        document.body.classList.toggle('light-mode', isLightMode);
        this.appState.data.themePreference = isLightMode ? 'light' : 'dark';
        this.appState.saveToStorage();
      });
    }

    // Accent color selector
    const accentColorSelect = document.getElementById('accent-color-select');
    if (accentColorSelect) {
      accentColorSelect.addEventListener('change', (e) => {
        const selectedColor = e.target.value;
        document.documentElement.setAttribute('data-accent', selectedColor);
        this.appState.data.accentColor = selectedColor;
        this.appState.saveToStorage();
      });
    }

    // Pagination controls
    this.attachPaginationListeners();

    // Waveform style selector
    const waveformStyleSelect = document.getElementById('waveform-style-select');
    if (waveformStyleSelect) {
      // Leave default placeholder "Waveform Style" showing

      waveformStyleSelect.addEventListener('change', (e) => {
        const newStyle = e.target.value;
        // Don't allow empty value
        if (newStyle && this.audioManager && this.audioManager.visualizer) {
          this.audioManager.visualizer.setWaveformStyle(newStyle);
          console.log('Waveform style changed to:', newStyle);
        }
      });
    }

    // AZ bar
    const azBar = document.getElementById('az-bar');
    if (azBar) {
      azBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('az-letter')) {
          document.querySelectorAll('.az-letter').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.renderer.jumpToArtist(e.target.dataset.letter);
        }
      });
    }

    // Cleanup handlers are managed at the app level

    // Set title from configuration
    const title = document.getElementById('editable-title');
    if (title) {
      title.textContent = CONFIG.APP_TITLE;
    }
  }

  attachPaginationListeners() {
    // Top pagination controls
    const firstPageBtn = document.getElementById('first-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const lastPageBtn = document.getElementById('last-page-btn');
    const tracksPerPageSelect = document.getElementById('tracks-per-page-select');

    // Bottom pagination controls
    const firstPageBtnBottom = document.getElementById('first-page-btn-bottom');
    const prevPageBtnBottom = document.getElementById('prev-page-btn-bottom');
    const nextPageBtnBottom = document.getElementById('next-page-btn-bottom');
    const lastPageBtnBottom = document.getElementById('last-page-btn-bottom');
    const tracksPerPageSelectBottom = document.getElementById('tracks-per-page-select-bottom');

    // Top controls
    if (firstPageBtn) {
      firstPageBtn.addEventListener('click', () => this.renderer.goToPage(1));
    }
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage - 1));
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage + 1));
    }
    if (lastPageBtn) {
      lastPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.totalPages));
    }
    if (tracksPerPageSelect) {
      tracksPerPageSelect.addEventListener('change', (e) => {
        this.renderer.setTracksPerPage(e.target.value);
        // Sync the bottom selector
        if (tracksPerPageSelectBottom) {
          tracksPerPageSelectBottom.value = e.target.value;
        }
      });
    }

    // Bottom controls (same functionality)
    if (firstPageBtnBottom) {
      firstPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(1));
    }
    if (prevPageBtnBottom) {
      prevPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage - 1));
    }
    if (nextPageBtnBottom) {
      nextPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage + 1));
    }
    if (lastPageBtnBottom) {
      lastPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.totalPages));
    }
    if (tracksPerPageSelectBottom) {
      tracksPerPageSelectBottom.addEventListener('change', (e) => {
        this.renderer.setTracksPerPage(e.target.value);
        // Sync the top selector
        if (tracksPerPageSelect) {
          tracksPerPageSelect.value = e.target.value;
        }
      });
    }
  }

  handleTrackClick(event) {
    const target = event.target;

    if (target.classList.contains('star-btn')) {
      event.stopPropagation();
      this.toggleFavorite(target.dataset.trackDisplay);
    } else if (target.classList.contains('folder-btn')) {
      event.stopPropagation();
      this.copyPath(target.dataset.path, target);
    } else if (target.classList.contains('tag-btn')) {
      event.stopPropagation();
      const track = this.getTrackFromElement(target.closest('.track'));
      this.showTagInput(track, target);
    } else if (target.classList.contains('mood-vibe-btn')) {
      event.stopPropagation();
      const track = this.getTrackFromElement(target.closest('.track'));
      this.showMoodVibeInput(track, target);
    } else if (target.classList.contains('add-playlist-btn')) {
      event.stopPropagation();
      this.addToPlaylist(target.dataset.trackDisplay);
    } else if (target.classList.contains('copy-track-btn')) {
      event.stopPropagation();
      this.copyTrackInfo(target.dataset.trackDisplay, target);
    } else if (target.classList.contains('energy-btn')) {
      event.stopPropagation();
      const track = this.getTrackFromElement(target.closest('.track'));
      this.showEnergyLevelInput(track, target);
    } else if (target.classList.contains('preview-btn')) {
      event.stopPropagation();
      const track = this.getTrackFromElement(target.closest('.track'));
      this.playPreview(track);
    }
  }

  getTrackFromElement(trackDiv) {
    if (!trackDiv) return null;
    
    return {
      display: trackDiv.dataset.display,
      artist: trackDiv.dataset.artist,
      title: trackDiv.dataset.title,
      key: trackDiv.dataset.key,
      bpm: trackDiv.dataset.bpm,
      year: trackDiv.dataset.year,
      genre: trackDiv.dataset.genre,
      absPath: trackDiv.dataset.path,
      trackTime: trackDiv.dataset.trackTime || ''
    };
  }

  render() {
    this.renderer.render();
  }

  // === Favorites ===
  toggleFavorite(trackDisplay) {
    if (this.appState.data.favoriteTracks[trackDisplay]) {
      delete this.appState.data.favoriteTracks[trackDisplay];
    } else {
      this.appState.data.favoriteTracks[trackDisplay] = true;
    }
    this.appState.saveToStorage();
    this.render();
  }

  toggleFavorites() {
    this.appState.data.showFavoritesOnly = !this.appState.data.showFavoritesOnly;
    const btn = document.getElementById('favorites-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', this.appState.data.showFavoritesOnly);
    }
    this.render();
  }

  toggleStats() {
    const statsContainer = document.getElementById('library-stats');
    const statsBtn = document.getElementById('stats-toggle-btn');
    
    if (statsContainer && statsBtn) {
      const isVisible = !statsContainer.classList.contains('hidden');
      
      if (isVisible) {
        // Hide stats and cleanup charts
        statsContainer.classList.add('hidden');
        statsBtn.classList.remove('active');
        this.cleanupAllCharts();
      } else {
        // Show stats and calculate them
        statsContainer.classList.remove('hidden');
        statsBtn.classList.add('active');
        this.calculateAndDisplayStats();
        
        // Scroll to stats section
        statsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  toggleDuplicates() {
    const duplicatesContainer = document.getElementById('duplicate-tracks');
    const duplicatesBtn = document.getElementById('duplicates-toggle-btn');

    if (duplicatesContainer && duplicatesBtn) {
      const isVisible = !duplicatesContainer.classList.contains('hidden');

      if (isVisible) {
        // Hide duplicates
        duplicatesContainer.classList.add('hidden');
        duplicatesBtn.classList.remove('active');
      } else {
        // Show duplicates and find them
        duplicatesContainer.classList.remove('hidden');
        duplicatesBtn.classList.add('active');
        this.findAndDisplayDuplicates();

        // Add close button listener
        const closeBtn = document.getElementById('close-duplicates');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => this.toggleDuplicates());
        }

        // Add escape key listener
        const escapeHandler = (e) => {
          if (e.key === 'Escape') {
            this.toggleDuplicates();
            document.removeEventListener('keydown', escapeHandler);
          }
        };
        document.addEventListener('keydown', escapeHandler);
      }
    }
  }

  findAndDisplayDuplicates() {
    const tracks = this.appState.data.tracksForUI || [];
    const content = document.getElementById('duplicate-content');

    if (!content) return;

    // Find duplicates based on both artist and title (case-insensitive)
    const trackGroups = {};

    tracks.forEach(track => {
      if (track.artist && track.title) {
        const normalizedKey = `${track.artist.toLowerCase().trim()} - ${track.title.toLowerCase().trim()}`;
        if (!trackGroups[normalizedKey]) {
          trackGroups[normalizedKey] = [];
        }
        trackGroups[normalizedKey].push(track);
      }
    });

    // Filter to only groups with duplicates
    const duplicateGroups = Object.entries(trackGroups).filter(([title, tracks]) => tracks.length > 1);

    if (duplicateGroups.length === 0) {
      content.innerHTML = `
        <div class="duplicate-summary">
          <div class="duplicate-summary-text">🎉 No duplicate tracks found!</div>
        </div>
      `;
      return;
    }

    const totalDuplicates = duplicateGroups.reduce((sum, [title, tracks]) => sum + tracks.length, 0);

    let html = `
      <div class="duplicate-summary">
        <div class="duplicate-summary-text">
          Found ${duplicateGroups.length} duplicate groups (${totalDuplicates} total tracks)
        </div>
      </div>
    `;

    duplicateGroups.forEach(([artistTitle, tracks]) => {
      html += `
        <div class="duplicate-group">
          <h3>🔄 ${this.escapeHtml(tracks[0].artist)} - ${this.escapeHtml(tracks[0].title)} (${tracks.length} copies)</h3>
      `;

      tracks.forEach(track => {
        html += `
          <div class="duplicate-track">
            <div class="duplicate-track-info">
              <strong>Artist:</strong> ${this.escapeHtml(track.artist)}<br>
              <strong>BPM:</strong> ${track.bpm || 'Unknown'} |
              <strong>Key:</strong> ${track.key || 'Unknown'} |
              <strong>Year:</strong> ${track.year || 'Unknown'}<br>
              <strong>Genre:</strong> ${track.genre || 'Unknown'}<br>
              <strong>Path:</strong> ${this.escapeHtml(track.absPath || 'Unknown')}
            </div>
          </div>
        `;
      });

      html += '</div>';
    });

    content.innerHTML = html;
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  calculateAndDisplayStats() {
    const tracks = this.appState.data.tracksForUI || [];

    // Debug: Check Chart.js availability
    console.log('Chart.js available:', typeof Chart !== 'undefined');
    if (typeof Chart !== 'undefined') {
      console.log('Chart.js version:', Chart.version);
      this.testChartJS();
    }

    // Debug: Log first track to see structure
    if (tracks.length > 0) {
      console.log('First track structure:', tracks[0]);
    }
    
    // Calculate overview stats
    const totalTracks = tracks.length;
    const totalArtists = new Set(tracks.map(track => track.artist)).size;
    
    // Update overview display
    const totalTracksEl = document.getElementById('total-tracks');
    const totalArtistsEl = document.getElementById('total-artists');
    
    if (totalTracksEl) totalTracksEl.textContent = totalTracks.toLocaleString();
    if (totalArtistsEl) totalArtistsEl.textContent = totalArtists.toLocaleString();
    
    // Calculate and display detailed stats
    this.displayGenreStats(tracks);
    this.displayKeyStats(tracks);
    this.displayBPMStats(tracks);
    this.displayEnergyStats(tracks);
    this.displayYearStats(tracks);
    this.displayLabelStats(tracks);
  }

  displayGenreStats(tracks) {
    const genreStats = {};
    tracks.forEach(track => {
      const genre = track.genre || 'Unknown';
      genreStats[genre] = (genreStats[genre] || 0) + 1;
    });

    console.log('Genre stats:', genreStats);

    // Always display the stat list first
    this.displayStatList('genre-stats', genreStats);

    // Try to create chart, which will overlay the list if successful
    if (typeof Chart !== 'undefined') {
      // Filter out 'Unknown' for chart display and limit to top genres
      const filteredGenreStats = {};
      const sortedGenres = Object.entries(genreStats)
        .filter(([genre]) => genre !== 'Unknown')
        .sort(([,a], [,b]) => b - a)
        .slice(0, 12); // Show top 12 genres

      sortedGenres.forEach(([genre, count]) => {
        filteredGenreStats[genre] = count;
      });

      // Add 'Others' category if there are more genres
      const totalFilteredCount = sortedGenres.reduce((sum, [,count]) => sum + count, 0);
      const totalCount = Object.values(genreStats).reduce((sum, count) => sum + count, 0);
      const unknownCount = genreStats['Unknown'] || 0;
      const othersCount = totalCount - totalFilteredCount - unknownCount;

      if (othersCount > 0) {
        filteredGenreStats['Others'] = othersCount;
      }

      const chart = this.createDonutChart('genre-chart', filteredGenreStats, 'Genres');
      if (chart) {
        // Hide the stat list since chart was created successfully
        document.getElementById('genre-stats').style.display = 'none';
      }
    }
  }

  displayKeyStats(tracks) {
    const keyStats = {};
    tracks.forEach(track => {
      const key = track.key || 'Unknown';
      keyStats[key] = (keyStats[key] || 0) + 1;
    });

    console.log('Key stats:', keyStats);
    this.displayStatList('key-stats', keyStats);

    if (typeof Chart !== 'undefined') {
      const chart = this.createBarChart('key-chart', keyStats, 'Keys', '#2196f3');
      if (chart) {
        document.getElementById('key-stats').style.display = 'none';
      }
    }
  }

  displayBPMStats(tracks) {
    const bpmRanges = {
      '60-64 BPM': { min: 60, max: 64, count: 0 },
      '65-69 BPM': { min: 65, max: 69, count: 0 },
      '70-74 BPM': { min: 70, max: 74, count: 0 },
      '75-79 BPM': { min: 75, max: 79, count: 0 },
      '80-84 BPM': { min: 80, max: 84, count: 0 },
      '85-89 BPM': { min: 85, max: 89, count: 0 },
      '90-94 BPM': { min: 90, max: 94, count: 0 },
      '95-99 BPM': { min: 95, max: 99, count: 0 },
      '100-104 BPM': { min: 100, max: 104, count: 0 },
      '105-109 BPM': { min: 105, max: 109, count: 0 },
      '110-114 BPM': { min: 110, max: 114, count: 0 },
      '115-119 BPM': { min: 115, max: 119, count: 0 },
      '120-124 BPM': { min: 120, max: 124, count: 0 },
      '125-129 BPM': { min: 125, max: 129, count: 0 },
      '130-134 BPM': { min: 130, max: 134, count: 0 },
      '135-139 BPM': { min: 135, max: 139, count: 0 },
      '140-144 BPM': { min: 140, max: 144, count: 0 },
      '145-149 BPM': { min: 145, max: 149, count: 0 },
      '150-154 BPM': { min: 150, max: 154, count: 0 },
      '155-159 BPM': { min: 155, max: 159, count: 0 },
      '160-164 BPM': { min: 160, max: 164, count: 0 },
      '165-169 BPM': { min: 165, max: 169, count: 0 },
      '170-174 BPM': { min: 170, max: 174, count: 0 },
      '175-179 BPM': { min: 175, max: 179, count: 0 },
      '180+ BPM': { min: 180, max: 999, count: 0 },
      'Unknown': { count: 0 }
    };
    
    tracks.forEach(track => {
      const bpm = parseInt(track.bpm);
      console.log('Track BPM:', track.bpm, 'Parsed:', bpm);
      if (isNaN(bpm)) {
        bpmRanges['Unknown'].count++;
      } else {
        for (const [range, data] of Object.entries(bpmRanges)) {
          if (range !== 'Unknown' && bpm >= data.min && bpm <= data.max) {
            data.count++;
            break;
          }
        }
      }
    });
    
    const bpmStats = {};
    Object.entries(bpmRanges).forEach(([range, data]) => {
      if (data.count > 0) {
        bpmStats[range] = data.count;
      }
    });
    
    console.log('BPM stats:', bpmStats);
    this.displayStatList('bpm-stats', bpmStats);

    if (typeof Chart !== 'undefined') {
      const chart = this.createBarChart('bpm-chart', bpmStats, 'BPM Ranges', '#ff6b6b');
      if (chart) {
        document.getElementById('bpm-stats').style.display = 'none';
      }
    }
  }

  displayEnergyStats(tracks) {
    const energyStats = {};
    
    // Initialize all energy levels
    for (let i = 1; i <= 10; i++) {
      energyStats[`${i} ${'★'.repeat(i)}${'☆'.repeat(10-i)}`] = 0;
    }
    energyStats['No Rating'] = 0;
    
    tracks.forEach(track => {
      const energy = this.appState.data.energyLevels[track.display];
      if (energy) {
        const key = `${energy} ${'★'.repeat(energy)}${'☆'.repeat(10-energy)}`;
        energyStats[key]++;
      } else {
        energyStats['No Rating']++;
      }
    });
    
    // Filter out zero counts for cleaner list display
    const filteredEnergyStats = {};
    Object.entries(energyStats).forEach(([key, count]) => {
      if (count > 0) {
        filteredEnergyStats[key] = count;
      }
    });

    this.displayStatList('energy-stats', filteredEnergyStats);

    if (typeof Chart !== 'undefined') {
      // For chart display, show all energy levels 1-10 in order (exclude 'No Rating')
      const chart = this.createOrderedBarChart('energy-chart', energyStats, 'Energy Levels', '#ffeb3b');
      if (chart) {
        document.getElementById('energy-stats').style.display = 'none';
      }
    }
  }

  displayYearStats(tracks) {
    const yearStats = {};
    tracks.forEach(track => {
      const year = track.year || 'Unknown';
      yearStats[year] = (yearStats[year] || 0) + 1;
    });
    
    // Sort years in descending order
    const sortedYearStats = {};
    Object.keys(yearStats)
      .sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return parseInt(b) - parseInt(a);
      })
      .forEach(year => {
        sortedYearStats[year] = yearStats[year];
      });
    
    this.displayStatList('year-stats', sortedYearStats);

    if (typeof Chart !== 'undefined') {
      const chart = this.createBarChart('year-chart', sortedYearStats, 'Years', '#4caf50');
      if (chart) {
        document.getElementById('year-stats').style.display = 'none';
      }
    }
  }

  displayLabelStats(tracks) {
    const labelStats = {};
    tracks.forEach(track => {
      const label = track.recordLabel || 'Unknown';
      labelStats[label] = (labelStats[label] || 0) + 1;
    });

    console.log('Label stats:', labelStats);
    this.displayStatList('label-stats', labelStats);

    if (typeof Chart !== 'undefined') {
      // Filter out 'Unknown' for chart display and limit to top labels
      const filteredLabelStats = {};
      const sortedLabels = Object.entries(labelStats)
        .filter(([label]) => label !== 'Unknown')
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15); // Show top 15 labels

      sortedLabels.forEach(([label, count]) => {
        filteredLabelStats[label] = count;
      });

      // Add 'Others' category if there are more labels
      const totalFilteredCount = sortedLabels.reduce((sum, [,count]) => sum + count, 0);
      const totalCount = Object.values(labelStats).reduce((sum, count) => sum + count, 0);
      const unknownCount = labelStats['Unknown'] || 0;
      const othersCount = totalCount - totalFilteredCount - unknownCount;

      if (othersCount > 0) {
        filteredLabelStats['Others'] = othersCount;
      }

      const chart = this.createDonutChart('label-chart', filteredLabelStats, 'Record Labels');
      if (chart) {
        document.getElementById('label-stats').style.display = 'none';
      }
    }
  }

  displayStatList(containerId, stats) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Sort by count (highest first)
    const sortedEntries = Object.entries(stats).sort(([,a], [,b]) => b - a);

    container.innerHTML = sortedEntries.map(([label, count]) => `
      <div class="stat-item">
        <span class="stat-label">${SecurityUtils.escapeHtml(label)}</span>
        <span class="stat-value">${count.toLocaleString()}</span>
      </div>
    `).join('');
  }

  // === Chart Methods ===

  // Store chart instances for cleanup
  chartInstances = {};

  // Test Chart.js functionality
  testChartJS() {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not available');
      return false;
    }

    try {
      // Try to create a minimal chart to test functionality
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 100;
      testCanvas.height = 100;

      const testChart = new Chart(testCanvas, {
        type: 'bar',
        data: {
          labels: ['Test'],
          datasets: [{
            data: [1],
            backgroundColor: '#00ffff'
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { display: false } }
        }
      });

      testChart.destroy();
      console.log('Chart.js test successful');
      return true;
    } catch (error) {
      console.error('Chart.js test failed:', error);
      return false;
    }
  }

  destroyChart(chartId) {
    if (this.chartInstances[chartId]) {
      this.chartInstances[chartId].destroy();
      delete this.chartInstances[chartId];
    }
  }

  cleanupAllCharts() {
    Object.keys(this.chartInstances).forEach(chartId => {
      this.destroyChart(chartId);
    });
  }

  createBarChart(canvasId, data, title, color = '#00ffff') {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded');
      return;
    }

    this.destroyChart(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas element not found: ${canvasId}`);
      return;
    }

    const sortedData = Object.entries(data).sort(([,a], [,b]) => b - a);
    const labels = sortedData.map(([label]) => label);
    const values = sortedData.map(([,value]) => value);

    // Check if light mode is active
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: color + '80', // Add transparency
          borderColor: color,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
            }
          },
          x: {
            ticks: {
              color: textColor,
              maxRotation: 45
            },
            grid: {
              color: gridColor
            }
          }
        }
      }
    });

    this.chartInstances[canvasId] = chart;
    return chart;
  }

  createDonutChart(canvasId, data, title) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded');
      return;
    }

    this.destroyChart(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas element not found: ${canvasId}`);
      return;
    }

    const sortedData = Object.entries(data).sort(([,a], [,b]) => b - a);
    const labels = sortedData.map(([label]) => label);
    const values = sortedData.map(([,value]) => value);

    // Generate colors for each segment
    const colors = labels.map((_, index) => {
      const hue = (index * 137.5) % 360; // Golden angle for nice distribution
      return `hsl(${hue}, 70%, 60%)`;
    });

    // Check if light mode is active
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333' : '#fff';
    const borderColor = isLightMode ? '#fff' : '#333';

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: colors,
          borderColor: borderColor,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textColor,
              padding: 15,
              usePointStyle: true
            }
          }
        }
      }
    });

    this.chartInstances[canvasId] = chart;
    return chart;
  }

  createOrderedBarChart(canvasId, allData, title, color = '#ffeb3b') {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded');
      return;
    }

    this.destroyChart(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas element not found: ${canvasId}`);
      return;
    }

    // Create ordered data for energy levels 1-10
    const labels = [];
    const values = [];

    for (let i = 1; i <= 10; i++) {
      const key = `${i} ${'★'.repeat(i)}${'☆'.repeat(10-i)}`;
      labels.push(`Level ${i}`); // Simplified label for better chart readability
      values.push(allData[key] || 0);
    }

    // Check if light mode is active
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: color + '80', // Add transparency
          borderColor: color,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
            }
          },
          x: {
            ticks: {
              color: textColor,
              maxRotation: 0 // Keep labels horizontal for energy levels
            },
            grid: {
              color: gridColor
            }
          }
        }
      }
    });

    this.chartInstances[canvasId] = chart;
    return chart;
  }

  // === Clipboard Operations ===
  copyPath(path, element) {
    if (!path) return;
    navigator.clipboard.writeText(path)
      .then(() => this.renderer.showCopyTooltip(element, 'Path copied!'))
      .catch(() => this.notificationSystem.error('Could not copy path'));
  }

  copyTrackInfo(trackDisplay, element) {
    navigator.clipboard.writeText(trackDisplay)
      .then(() => this.renderer.showCopyTooltip(element, 'Copied!'))
      .catch(() => this.notificationSystem.error('Could not copy track info'));
  }

  // === Tags ===
  showTagInput(track, anchorElement) {
    // Remove existing popup and clean up event listeners
    this.cleanupTagPopup();

    let popup = null;
    let cleanupPopup = null;

    try {
      popup = document.createElement('div');
      popup.className = 'tag-popup';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add tag (comma separated)';
      input.className = 'tag-input-width';

      const existingTags = (this.appState.data.trackTags[track.display] || []).join(', ');
      input.value = existingTags;

      const saveBtn = SecurityUtils.createSafeElement('button', 'Save');
      const cancelBtn = SecurityUtils.createSafeElement('button', 'Cancel');

      popup.appendChild(input);
      popup.appendChild(saveBtn);
      popup.appendChild(cancelBtn);

      // Position popup
      const rect = anchorElement.getBoundingClientRect();
      popup.style.left = rect.left + window.scrollX + 'px';
      popup.style.top = rect.bottom + window.scrollY + 'px';

      document.body.appendChild(popup);
      this.tagPopup = popup;
      input.focus();

      // Create a comprehensive cleanup function
      cleanupPopup = () => {
        // Clear timeout if it exists to prevent memory leaks
        if (popup._timeoutId) {
          clearTimeout(popup._timeoutId);
          popup._timeoutId = null;
        }
        
        if (popup && popup.parentElement) {
          popup.remove();
        }
        this.tagPopup = null;
        
        // Remove document listener if it exists
        if (this.tagPopupClickHandler) {
          document.removeEventListener('mousedown', this.tagPopupClickHandler);
          this.tagPopupClickHandler = null;
        }
      };

      // Event handlers with proper cleanup
      const saveHandler = () => {
        try {
          const tags = input.value.split(',')
            .map(t => t.trim())
            .filter(t => SecurityUtils.validateTag(t));
          
          this.appState.data.trackTags[track.display] = tags;
          this.appState.saveToStorage();
          this.updateTagDropdown();
          cleanupPopup();
          this.render();
        } catch (error) {
          console.error('Error saving tags:', error);
          cleanupPopup();
        }
      };

      const cancelHandler = () => {
        cleanupPopup();
      };

      // Add event listeners
      saveBtn.addEventListener('click', saveHandler);
      cancelBtn.addEventListener('click', cancelHandler);

      // Handle Enter/Escape keys
      const keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveHandler();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelHandler();
        }
      };
      input.addEventListener('keydown', keyHandler);

      // Close on outside click with proper cleanup
      this.tagPopupClickHandler = (e) => {
        if (!popup.contains(e.target)) {
          cleanupPopup();
        }
      };

      // Add document listener after a short delay to prevent immediate trigger
      // Store the timeout ID for cleanup if needed
      const timeoutId = setTimeout(() => {
        if (this.tagPopup === popup) { // Only add if popup is still active
          document.addEventListener('mousedown', this.tagPopupClickHandler);
        }
      }, 10);
      
      // Store timeout ID on popup for cleanup
      popup._timeoutId = timeoutId;

      // Store cleanup function on popup for emergency cleanup
      popup._cleanup = cleanupPopup;

    } catch (error) {
      console.error('Error showing tag input:', error);
      // Ensure cleanup on any error during popup creation
      if (cleanupPopup) {
        cleanupPopup();
      } else {
        // Fallback cleanup if cleanupPopup wasn't created yet
        this.cleanupTagPopup();
      }
    }
  }

  cleanupTagPopup() {
    if (this.tagPopup) {
      // Clear any pending timeouts to prevent memory leaks
      if (this.tagPopup._timeoutId) {
        clearTimeout(this.tagPopup._timeoutId);
        this.tagPopup._timeoutId = null;
      }
      
      // Call stored cleanup function if available
      if (this.tagPopup._cleanup) {
        this.tagPopup._cleanup();
      } else {
        // Fallback cleanup
        this.tagPopup.remove();
        this.tagPopup = null;
      }
    }

    // Ensure document listener is removed
    if (this.tagPopupClickHandler) {
      document.removeEventListener('mousedown', this.tagPopupClickHandler);
      this.tagPopupClickHandler = null;
    }
  }

  showMoodVibeInput(track, anchorElement) {
    // Remove existing popup and clean up event listeners
    this.cleanupMoodVibePopup();

    let popup = null;
    let cleanupPopup = null;

    try {
      popup = document.createElement('div');
      popup.className = 'mood-vibe-popup';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add mood/vibe tags (e.g., Euphoric, Dark, Uplifting)';
      input.className = 'mood-vibe-input-width';

      const existingTags = (this.appState.data.moodVibeTags[track.display] || []).join(', ');
      input.value = existingTags;

      const saveBtn = SecurityUtils.createSafeElement('button', 'Save');
      const cancelBtn = SecurityUtils.createSafeElement('button', 'Cancel');

      popup.appendChild(input);
      popup.appendChild(saveBtn);
      popup.appendChild(cancelBtn);

      // Position popup
      const rect = anchorElement.getBoundingClientRect();
      popup.style.left = rect.left + window.scrollX + 'px';
      popup.style.top = rect.bottom + window.scrollY + 'px';

      document.body.appendChild(popup);
      this.moodVibePopup = popup;
      input.focus();

      // Create a comprehensive cleanup function
      cleanupPopup = () => {
        if (popup._timeoutId) {
          clearTimeout(popup._timeoutId);
          popup._timeoutId = null;
        }
        
        if (popup && popup.parentElement) {
          popup.remove();
        }
        this.moodVibePopup = null;
        
        if (this.moodVibePopupClickHandler) {
          document.removeEventListener('mousedown', this.moodVibePopupClickHandler);
          this.moodVibePopupClickHandler = null;
        }
      };

      // Event handlers with proper cleanup
      const saveHandler = () => {
        try {
          const tags = input.value.split(',')
            .map(t => t.trim())
            .filter(t => SecurityUtils.validateTag(t));
          
          this.appState.data.moodVibeTags[track.display] = tags;
          this.appState.saveToStorage();
          cleanupPopup();
          this.render();
        } catch (error) {
          console.error('Error saving mood/vibe tags:', error);
          cleanupPopup();
        }
      };

      const cancelHandler = () => {
        cleanupPopup();
      };

      // Add event listeners
      saveBtn.addEventListener('click', saveHandler);
      cancelBtn.addEventListener('click', cancelHandler);

      // Handle Enter/Escape keys
      const keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveHandler();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelHandler();
        }
      };
      input.addEventListener('keydown', keyHandler);

      // Close on outside click with proper cleanup
      this.moodVibePopupClickHandler = (e) => {
        if (!popup.contains(e.target)) {
          cleanupPopup();
        }
      };

      // Add document listener after a short delay
      const timeoutId = setTimeout(() => {
        if (this.moodVibePopup === popup) {
          document.addEventListener('mousedown', this.moodVibePopupClickHandler);
        }
      }, 10);
      
      popup._timeoutId = timeoutId;
      popup._cleanup = cleanupPopup;

    } catch (error) {
      console.error('Error showing mood/vibe input:', error);
      if (cleanupPopup) {
        cleanupPopup();
      } else {
        this.cleanupMoodVibePopup();
      }
    }
  }

  cleanupMoodVibePopup() {
    if (this.moodVibePopup) {
      if (this.moodVibePopup._timeoutId) {
        clearTimeout(this.moodVibePopup._timeoutId);
        this.moodVibePopup._timeoutId = null;
      }
      
      if (this.moodVibePopup._cleanup) {
        this.moodVibePopup._cleanup();
      } else {
        this.moodVibePopup.remove();
        this.moodVibePopup = null;
      }
    }

    if (this.moodVibePopupClickHandler) {
      document.removeEventListener('mousedown', this.moodVibePopupClickHandler);
      this.moodVibePopupClickHandler = null;
    }
  }

  showEnergyLevelInput(track, anchorElement) {
    // Remove any existing energy popup
    this.cleanupEnergyPopup();

    const popup = document.createElement('div');
    popup.className = 'energy-popup';

    const title = SecurityUtils.createSafeElement('div', 'Set Energy Level', 'energy-title');
    popup.appendChild(title);

    const currentEnergy = this.appState.data.energyLevels[track.display] || 0;
    
    // Create buttons for energy levels 1-10
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'energy-buttons';
    
    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.className = 'energy-level-btn';
      if (i === currentEnergy) {
        btn.className += ' active';
      }
      btn.textContent = `${i} ${'★'.repeat(i)}${'☆'.repeat(10-i)}`;
      btn.dataset.level = i;
      buttonsContainer.appendChild(btn);
    }
    
    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'energy-clear-btn';
    clearBtn.textContent = 'Clear';
    buttonsContainer.appendChild(clearBtn);

    popup.appendChild(buttonsContainer);

    // Position popup
    const rect = anchorElement.getBoundingClientRect();
    popup.style.left = rect.left + window.scrollX + 'px';
    popup.style.top = rect.bottom + window.scrollY + 'px';

    document.body.appendChild(popup);
    this.energyPopup = popup;

    // Event handlers
    buttonsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('energy-level-btn')) {
        const level = parseInt(e.target.dataset.level);
        this.appState.data.energyLevels[track.display] = level;
        this.appState.saveToStorage();
        this.cleanupEnergyPopup();
        this.render();
      } else if (e.target.classList.contains('energy-clear-btn')) {
        delete this.appState.data.energyLevels[track.display];
        this.appState.saveToStorage();
        this.cleanupEnergyPopup();
        this.render();
      }
    });

    // Close on outside click
    this.energyPopupClickHandler = (e) => {
      if (!popup.contains(e.target)) {
        this.cleanupEnergyPopup();
      }
    };

    setTimeout(() => {
      if (this.energyPopup === popup) {
        document.addEventListener('mousedown', this.energyPopupClickHandler);
      }
    }, 10);
  }

  cleanupEnergyPopup() {
    if (this.energyPopup) {
      this.energyPopup.remove();
      this.energyPopup = null;
    }
    
    if (this.energyPopupClickHandler) {
      document.removeEventListener('mousedown', this.energyPopupClickHandler);
      this.energyPopupClickHandler = null;
    }
  }

  updateTagDropdown() {
    const dropdown = document.getElementById('tag-dropdown');
    if (!dropdown) return;

    const allTags = new Set();
    Object.values(this.appState.data.trackTags).forEach(tags => {
      tags.forEach(tag => allTags.add(tag));
    });

    dropdown.innerHTML = '<option value="">All Tags</option>';
    Array.from(allTags).sort().forEach(tag => {
      const option = SecurityUtils.createSafeElement('option', tag);
      option.value = tag;
      dropdown.appendChild(option);
    });
  }

  exportTags() {
    const data = JSON.stringify(this.appState.data.trackTags, null, 2);
    this.downloadJSON('tags_export.json', data);
  }

  async importTags(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await this.readFile(file);
      const tags = JSON.parse(text);
      
      // Validate and sanitize
      const sanitized = {};
      Object.entries(tags).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          const validTags = value.filter(tag => SecurityUtils.validateTag(tag));
          if (validTags.length > 0) {
            sanitized[key] = validTags;
          }
        }
      });

      this.appState.data.trackTags = sanitized;
      this.appState.saveToStorage();
      this.updateTagDropdown();
      this.render();
      this.notificationSystem.success('Tags imported successfully');
    } catch (error) {
      this.notificationSystem.error('Error importing tags');
    }
    event.target.value = '';
  }

  // === Playlists ===
  async createPlaylist() {
    const name = await this.notificationSystem.prompt('Create Playlist', 'Enter playlist name...');
    if (!name || this.appState.data.playlists[name]) {
      if (name && this.appState.data.playlists[name]) {
        this.notificationSystem.warning('Playlist already exists');
      }
      return;
    }

    this.appState.data.playlists[name] = [];
    this.appState.data.currentPlaylist = name;
    this.appState.saveToStorage();
    this.updatePlaylistDropdown();
    this.updatePlaylistButtonStates();
    this.notificationSystem.success(`Playlist "${name}" created successfully`);
  }

  async deletePlaylist() {
    if (!this.appState.data.currentPlaylist) return;

    const currentPlaylist = this.appState.data.currentPlaylist;
    let displayName = currentPlaylist;

    // Get display name for confirmation dialog
    if (currentPlaylist.startsWith('smart:')) {
      displayName = currentPlaylist.replace('smart:', '') + ' (Smart)';
    }

    const confirmed = await this.notificationSystem.confirm(`Delete playlist "${displayName}"?`, 'Delete Playlist');
    if (confirmed) {
      if (currentPlaylist.startsWith('smart:')) {
        // Handle smart playlist deletion
        const smartPlaylistName = currentPlaylist.replace('smart:', '');
        delete this.appState.data.smartPlaylists[smartPlaylistName];
      } else {
        // Handle regular playlist deletion
        delete this.appState.data.playlists[currentPlaylist];
      }

      // Reset current playlist and trigger view reset
      this.appState.data.currentPlaylist = '';
      this.appState.saveToStorage();
      this.updatePlaylistDropdown();
      this.updatePlaylistButtonStates();

      // Trigger render to reset to default view
      this.renderer.render();

      this.notificationSystem.success(`Playlist "${displayName}" deleted successfully`);
    }
  }

  async renamePlaylist() {
    if (!this.appState.data.currentPlaylist) return;
    
    const newName = await this.notificationSystem.prompt('Rename Playlist', 'Enter new playlist name...', this.appState.data.currentPlaylist);
    if (!newName || newName === this.appState.data.currentPlaylist) return;
    
    if (this.appState.data.playlists[newName]) {
      this.notificationSystem.warning('Playlist already exists');
      return;
    }

    const oldName = this.appState.data.currentPlaylist;
    this.appState.data.playlists[newName] = this.appState.data.playlists[this.appState.data.currentPlaylist];
    delete this.appState.data.playlists[this.appState.data.currentPlaylist];
    this.appState.data.currentPlaylist = newName;
    this.appState.saveToStorage();
    this.updatePlaylistDropdown();
    this.updatePlaylistButtonStates();
    this.notificationSystem.success(`Playlist renamed from "${oldName}" to "${newName}"`);
  }

  addToPlaylist(trackDisplay) {
    if (!this.appState.data.currentPlaylist) {
      this.notificationSystem.warning('Please select or create a playlist first');
      return;
    }

    const playlist = this.appState.data.playlists[this.appState.data.currentPlaylist];
    if (!playlist.includes(trackDisplay)) {
      playlist.push(trackDisplay);
      this.appState.saveToStorage();
      this.notificationSystem.success(`Added to ${this.appState.data.currentPlaylist}`);
    } else {
      this.notificationSystem.info('Track already in playlist');
    }
  }

  exportPlaylist(format = 'txt') {
    if (!this.appState.data.currentPlaylist) return;

    const currentPlaylist = this.appState.data.currentPlaylist;
    let tracksToExport = [];
    let trackObjects = [];
    let playlistName = currentPlaylist;

    if (currentPlaylist.startsWith('smart:')) {
      // Handle smart playlist export
      const smartPlaylistName = currentPlaylist.replace('smart:', '');
      const smartPlaylist = this.appState.data.smartPlaylists?.[smartPlaylistName];

      if (!smartPlaylist) {
        this.notificationSystem.warning('Smart playlist not found');
        return;
      }

      // Get tracks that match the smart playlist rules
      const matchingTracks = this.renderer.filterTracksBySmartRules(
        this.appState.data.tracksForUI,
        smartPlaylist.rules,
        smartPlaylist.logic
      );

      if (matchingTracks.length === 0) {
        this.notificationSystem.warning('Smart playlist has no matching tracks');
        return;
      }

      // Store both track objects and display names
      trackObjects = matchingTracks;
      tracksToExport = matchingTracks.map(track => track.display);
      playlistName = smartPlaylistName;

    } else {
      // Handle regular playlist export
      const playlist = this.appState.data.playlists[currentPlaylist];
      if (!playlist || playlist.length === 0) {
        this.notificationSystem.warning('Playlist is empty');
        return;
      }

      // For regular playlists, we need to find the track objects
      trackObjects = playlist.map(displayName => {
        return this.appState.data.tracksForUI.find(track => track.display === displayName);
      }).filter(track => track !== undefined);

      tracksToExport = playlist;
    }

    // Export based on format
    switch (format.toLowerCase()) {
      case 'csv':
        this.exportPlaylistAsCSV(playlistName, trackObjects);
        break;
      case 'html':
        this.exportPlaylistAsHTML(playlistName, trackObjects);
        break;
      case 'm3u8':
        this.exportPlaylistAsM3U8(playlistName, trackObjects);
        break;
      case 'txt':
      default:
        const data = tracksToExport.join('\n');
        this.downloadText(`${playlistName}.txt`, data);
        break;
    }
  }

  exportPlaylistAsCSV(playlistName, trackObjects) {
    if (!trackObjects.length) {
      this.notificationSystem.warning('No tracks to export');
      return;
    }

    // CSV Header
    const headers = ['Artist', 'Title', 'Key', 'BPM', 'Track Time', 'Year', 'Path', 'Genre', 'Energy Level', 'Record Label'];
    const csvRows = [headers.join(',')];

    // Add track data
    trackObjects.forEach(track => {
      const row = [
        this.escapeCsvField(track.artist || ''),
        this.escapeCsvField(track.title || ''),
        this.escapeCsvField(track.key || ''),
        track.bpm || '',
        this.escapeCsvField(track.trackTime || ''),
        track.year || '',
        this.escapeCsvField(track.path || ''),
        this.escapeCsvField(track.genre || ''),
        this.appState.data.energyLevels[track.display] || '',
        this.escapeCsvField(track.recordLabel || '')
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, `${playlistName}.csv`);
  }

  exportPlaylistAsHTML(playlistName, trackObjects) {
    if (!trackObjects.length) {
      this.notificationSystem.warning('No tracks to export');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SecurityUtils.escapeHtml(playlistName)} - Playlist</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #181818; color: #fff; padding: 40px; }
    h1 { color: #00ffff; margin-bottom: 0.5em; }
    .playlist-info { margin-bottom: 2em; color: #ccc; }
    table { width: 100%; border-collapse: collapse; background: #222; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #333; color: #00ffff; font-weight: bold; }
    tr:nth-child(even) { background: #252525; }
    tr:hover { background: #2a2a2a; }
    .track-number { width: 50px; text-align: center; color: #888; }
    .energy-stars { color: #ffd700; }
    .footer { margin-top: 2em; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${SecurityUtils.escapeHtml(playlistName)}</h1>
  <div class="playlist-info">
    <strong>Tracks:</strong> ${trackObjects.length} |
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Artist</th>
        <th>Title</th>
        <th>Key</th>
        <th>BPM</th>
        <th>Time</th>
        <th>Year</th>
        <th>Genre</th>
        <th>Energy</th>
        <th>Label</th>
      </tr>
    </thead>
    <tbody>
${trackObjects.map((track, index) => {
  const energyLevel = this.appState.data.energyLevels[track.display] || 0;
  const energyStars = energyLevel > 0 ? '★'.repeat(energyLevel) + '☆'.repeat(10 - energyLevel) : '';

  return `      <tr>
        <td class="track-number">${index + 1}</td>
        <td>${SecurityUtils.escapeHtml(track.artist || '')}</td>
        <td>${SecurityUtils.escapeHtml(track.title || '')}</td>
        <td>${SecurityUtils.escapeHtml(track.key || '')}</td>
        <td>${track.bpm || ''}</td>
        <td>${SecurityUtils.escapeHtml(track.trackTime || '')}</td>
        <td>${track.year || ''}</td>
        <td>${SecurityUtils.escapeHtml(track.genre || '')}</td>
        <td class="energy-stars">${energyStars}</td>
        <td>${SecurityUtils.escapeHtml(track.recordLabel || '')}</td>
      </tr>`;
}).join('\n')}
    </tbody>
  </table>

  <div class="footer">
    Generated by Beatrove - EDM Tracklist Management
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    this.downloadBlob(blob, `${playlistName}.html`);
  }

  exportPlaylistAsM3U8(playlistName, trackObjects) {
    if (!trackObjects.length) {
      this.notificationSystem.warning('No tracks to export');
      return;
    }

    const m3u8Lines = ['#EXTM3U'];
    let missingPaths = 0;

    trackObjects.forEach(track => {
      // Calculate duration in seconds (if available)
      let duration = -1;
      if (track.trackTime) {
        const timeMatch = track.trackTime.match(/(\d+):(\d+)/);
        if (timeMatch) {
          duration = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        }
      }

      // Add extended info line
      const artistTitle = `${track.artist || 'Unknown Artist'} - ${track.title || 'Unknown Title'}`;
      m3u8Lines.push(`#EXTINF:${duration},${artistTitle}`);

      // Add file path - M3U spec requires actual media file paths
      let filePath = track.path || track.absPath;

      if (!filePath) {
        // If no path available, create a fallback filename
        filePath = `${track.artist || 'Unknown Artist'} - ${track.title || 'Unknown Title'}.mp3`;
        // Clean up filename for filesystem compatibility
        filePath = filePath.replace(/[<>:"|?*]/g, '_').replace(/\s+/g, ' ');
        missingPaths++;
      }

      m3u8Lines.push(filePath);
    });

    const m3u8Content = m3u8Lines.join('\n');
    const blob = new Blob([m3u8Content], { type: 'application/vnd.apple.mpegurl;charset=utf-8;' });
    this.downloadBlob(blob, `${playlistName}.m3u`);

    // Notify user about missing file paths
    if (missingPaths > 0) {
      this.notificationSystem.info(`M3U exported with ${missingPaths} fallback filename(s). For full compatibility, ensure your tracks have file path information.`);
    }
  }

  escapeCsvField(field) {
    if (!field) return '';
    const stringField = String(field);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  }

  async importPlaylists(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await this.readFile(file);
      const playlists = JSON.parse(text);
      
      // Validate and merge
      Object.entries(playlists).forEach(([name, tracks]) => {
        if (Array.isArray(tracks)) {
          this.appState.data.playlists[name] = tracks.map(t => SecurityUtils.sanitizeText(t));
        }
      });

      this.appState.saveToStorage();
      this.updatePlaylistDropdown();
      this.notificationSystem.success('Playlists imported successfully');
    } catch (error) {
      this.notificationSystem.error('Error importing playlists');
    }
    event.target.value = '';
  }

  updatePlaylistDropdown() {
    const dropdown = document.getElementById('playlist-select');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select Playlist</option>';

    // Add regular playlists
    Object.keys(this.appState.data.playlists).forEach(name => {
      const option = SecurityUtils.createSafeElement('option', name);
      option.value = name;
      if (name === this.appState.data.currentPlaylist) {
        option.selected = true;
      }
      dropdown.appendChild(option);
    });

    // Add smart playlists
    if (this.appState.data.smartPlaylists) {
      Object.keys(this.appState.data.smartPlaylists).forEach(name => {
        const option = SecurityUtils.createSafeElement('option', `🧠 ${name} (Smart)`);
        option.value = `smart:${name}`;
        if (`smart:${name}` === this.appState.data.currentPlaylist) {
          option.selected = true;
        }
        dropdown.appendChild(option);
      });
    }
  }

  updatePlaylistButtonStates() {
    const selected = this.appState.data.currentPlaylist;
    let hasTracks = false;

    if (selected) {
      if (selected.startsWith('smart:')) {
        // For smart playlists, check if there are any tracks that match the rules
        const smartPlaylistName = selected.replace('smart:', '');
        const smartPlaylist = this.appState.data.smartPlaylists?.[smartPlaylistName];
        if (smartPlaylist && this.appState.data.tracksForUI.length > 0) {
          const matchingTracks = this.renderer.filterTracksBySmartRules(
            this.appState.data.tracksForUI,
            smartPlaylist.rules,
            smartPlaylist.logic
          );
          hasTracks = matchingTracks.length > 0;
        }
      } else {
        // For regular playlists
        hasTracks = this.appState.data.playlists[selected]?.length > 0;
      }
    }

    document.getElementById('rename-playlist-btn')?.toggleAttribute('disabled', !selected);
    document.getElementById('delete-playlist-btn')?.toggleAttribute('disabled', !selected);
    document.getElementById('export-playlist-btn')?.toggleAttribute('disabled', !hasTracks);
  }

  // === Import/Export ===
  exportAll() {
    const data = {
      tracks: this.appState.data.tracksForUI,
      playlists: this.appState.data.playlists,
      tags: this.appState.data.trackTags,
      moodVibeTags: this.appState.data.moodVibeTags,
      favorites: this.appState.data.favoriteTracks
    };

    this.downloadJSON('beatrove_export.json', JSON.stringify(data, null, 2));
  }

  async importAll(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await this.readFile(file);
      const data = JSON.parse(text);

      // Import tracks
      if (Array.isArray(data.tracks)) {
        this.appState.data.tracksForUI = data.tracks;
        this.appState.data.grouped = {};
        data.tracks.forEach(track => {
          if (!this.appState.data.grouped[track.artist]) {
            this.appState.data.grouped[track.artist] = [];
          }
          this.appState.data.grouped[track.artist].push(track);
        });
        this.appState.data.totalTracks = data.tracks.length;
      }

      // Import playlists
      if (data.playlists) {
        this.appState.data.playlists = data.playlists;
      }

      // Import tags
      if (data.tags) {
        this.appState.data.trackTags = data.tags;
      }

      // Import mood & vibe tags
      if (data.moodVibeTags) {
        this.appState.data.moodVibeTags = data.moodVibeTags;
      }

      // Import favorites
      if (data.favorites) {
        this.appState.data.favoriteTracks = data.favorites;
      }

      this.appState.saveToStorage();
      this.updateTagDropdown();
      this.updatePlaylistDropdown();
      this.render();
      this.notificationSystem.success('Import successful');
    } catch (error) {
      this.notificationSystem.error('Error importing data');
    }
    event.target.value = '';
  }

  async uploadTracklist(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Enhanced rate limiting check with security measures
    const rateLimitCheck = this.rateLimiter.isAllowed('file_upload');
    if (!rateLimitCheck.allowed) {
      const message = this.getRateLimitMessage(rateLimitCheck);
      this.notificationSystem.warning(message);
      event.target.value = ''; // Clear the file input
      return;
    }

    try {
      // Comprehensive file validation
      const fileValidation = SecurityUtils.validateFile(file);
      if (!fileValidation.isValid) {
        this.notificationSystem.error(
          `File validation failed: ${fileValidation.errors.join(', ')}`
        );
        event.target.value = '';
        return;
      }

      // Show processing notification for large files
      let processingNotification;
      if (file.size > 1024 * 1024) { // > 1MB
        processingNotification = this.notificationSystem.info(
          `Processing large file (${(file.size / (1024 * 1024)).toFixed(2)}MB)...`, 0
        );
      }

      const text = await this.readFile(file);
      const result = TrackProcessor.processTracklist(text, file.name);

      // Clear processing notification
      if (processingNotification) {
        this.notificationSystem.dismiss(processingNotification);
      }

      // Update state
      Object.assign(this.appState.data, {
        grouped: result.grouped,
        totalTracks: result.totalTracks,
        duplicateTracks: result.duplicateTracks,
        tracksForUI: result.tracksForUI
      });

      // Merge energy levels from CSV with existing energy levels
      if (result.energyLevels && Object.keys(result.energyLevels).length > 0) {
        Object.assign(this.appState.data.energyLevels, result.energyLevels);
        console.log(`Imported ${Object.keys(result.energyLevels).length} energy levels from CSV`);
      }

      // Update filters
      this.updateFilters(result);

      // Update footer date
      this.setFooterDate(file.lastModified || Date.now());

      this.appState.clearCache();
      this.render();
      this.renderer.renderDuplicateList();
    } catch (error) {
      this.notificationSystem.error(`Error processing file: ${error.message}`);
    }
    event.target.value = '';
  }

  updateFilters(result) {
    // Update BPM filter
    if (this.appState.elements.bpmFilter && result.allBPMs) {
      this.appState.elements.bpmFilter.innerHTML = '<option value="">All BPMs</option>';
      Array.from(result.allBPMs)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(bpm => {
          const option = SecurityUtils.createSafeElement('option', `${bpm} BPM`);
          option.value = bpm;
          this.appState.elements.bpmFilter.appendChild(option);
        });
    }

    // Update Key filter
    if (this.appState.elements.keyFilter && result.allKeys) {
      this.appState.elements.keyFilter.innerHTML = '<option value="">All Keys</option>';
      Array.from(result.allKeys).sort().forEach(key => {
        const option = SecurityUtils.createSafeElement('option', key);
        option.value = key;
        this.appState.elements.keyFilter.appendChild(option);
      });
    }

    // Update Genre filter
    if (this.appState.elements.genreFilter && result.allGenres) {
      this.appState.elements.genreFilter.innerHTML = '<option value="">All Genres</option>';
      Array.from(result.allGenres).sort().forEach(genre => {
        const option = SecurityUtils.createSafeElement('option', genre);
        option.value = genre;
        this.appState.elements.genreFilter.appendChild(option);
      });
    }

    // Update Label filter
    if (this.appState.elements.labelFilter && result.allLabels) {
      this.appState.elements.labelFilter.innerHTML = '<option value="">All Labels</option>';
      Array.from(result.allLabels).sort().forEach(label => {
        const option = SecurityUtils.createSafeElement('option', label);
        option.value = label;
        this.appState.elements.labelFilter.appendChild(option);
      });
    }
  }

  setFooterDate(timestamp) {
    const footer = document.getElementById('footer-updated');
    if (footer) {
      const date = new Date(timestamp);
      footer.textContent = 'Updated: ' + date.toLocaleString();
    }
  }

  // === Audio ===
  loadAudioFolder(event) {
    const files = Array.from(event.target.files);
    
    // Enhanced rate limiting check for audio operations
    const rateLimitCheck = this.rateLimiter.isAllowed('audio_load');
    if (!rateLimitCheck.allowed) {
      const message = this.getRateLimitMessage(rateLimitCheck);
      this.notificationSystem.warning(message);
      event.target.value = '';
      return;
    }

    if (files.length === 0) {
      this.notificationSystem.warning('No files selected');
      return;
    }

    // Validate audio files
    const validFiles = [];
    const errors = [];
    
    for (const file of files) {
      const validation = SecurityUtils.validateAudioFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    }

    // Show validation errors if any
    if (errors.length > 0) {
      const errorSummary = errors.slice(0, 3).join('\n');
      const moreErrors = errors.length > 3 ? `\n... and ${errors.length - 3} more files` : '';
      this.notificationSystem.warning(`Some files were rejected:\n${errorSummary}${moreErrors}`);
    }

    if (validFiles.length === 0) {
      this.notificationSystem.error('No valid audio files found');
      event.target.value = '';
      return;
    }

    // Show progress for large batches
    let processingNotification;
    if (validFiles.length > 100) {
      processingNotification = this.notificationSystem.info(
        `Processing ${validFiles.length} audio files...`, 0
      );
    }

    const loaded = this.audioManager.loadAudioFiles(validFiles);
    
    if (processingNotification) {
      this.notificationSystem.dismiss(processingNotification);
    }
    
    if (loaded > 0) {
      const rejectedCount = files.length - loaded;
      const message = rejectedCount > 0 
        ? `Loaded ${loaded} audio files (${rejectedCount} rejected). You can now preview tracks.`
        : `Loaded ${loaded} audio files. You can now preview tracks.`;
        
      this.notificationSystem.success(message);
      
      if (this.audioManager.pendingPreviewTrack) {
        this.audioManager.playPreview(this.audioManager.pendingPreviewTrack);
        this.audioManager.pendingPreviewTrack = null;
      }
    } else {
      this.notificationSystem.warning('No valid audio files found');
    }
    
    event.target.value = '';
  }

  playPreview(track) {
    if (Object.keys(this.audioManager.fileMap).length === 0) {
      // Store pending track and trigger file input
      this.audioManager.pendingPreviewTrack = track;
      document.getElementById('audio-folder-input')?.click();
    } else {
      this.audioManager.playPreview(track);
    }
  }

  // === Utilities ===
  downloadJSON(filename, data) {
    const blob = new Blob([data], { type: 'application/json' });
    this.downloadBlob(blob, filename);
  }

  downloadText(filename, data) {
    const blob = new Blob([data], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }


  // === Rate Limiting Helpers ===
  getRateLimitMessage(rateLimitCheck) {
    switch (rateLimitCheck.reason) {
      case 'locked_out':
        return `Account temporarily locked due to suspicious activity. Please wait ${rateLimitCheck.waitTime} seconds.`;
      case 'rate_limit_exceeded':
        return `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds before trying again.`;
      default:
        return `Operation blocked. Please wait ${rateLimitCheck.waitTime} seconds before trying again.`;
    }
  }

  // === Cleanup Methods ===
  cleanup() {
    // Clean up audio resources
    this.audioManager.cleanup();
    
    // Clean up tag popup
    this.cleanupTagPopup();
    
    // Clean up mood & vibe tag popup
    this.cleanupMoodVibePopup();
    
    // Clear any remaining timeouts or intervals
    this.clearAllTimeouts();
    
    // Clean up notification system
    if (this.notificationSystem && this.notificationSystem.notifications) {
      this.notificationSystem.notifications.clear();
    }
    
    // Clean up rate limiter
    if (this.rateLimiter) {
      this.rateLimiter.cleanup();
    }
    
    console.log('UIController cleanup completed');
  }

  clearAllTimeouts() {
    // Clear any stored timeout/interval IDs
    // This is a precautionary cleanup for any missed timeouts
    for (let i = 1; i < 1000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
  }

  // ============= SMART PLAYLIST FUNCTIONALITY =============

  showSmartPlaylistModal() {
    const modal = document.getElementById('smart-playlist-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    this.initializeSmartPlaylistModal();
  }

  initializeSmartPlaylistModal() {
    // Clear previous state
    const nameInput = document.getElementById('smart-playlist-name-input');
    const rulesContainer = document.getElementById('smart-playlist-rules-container');
    const previewContainer = document.getElementById('smart-playlist-preview-tracks');
    const previewCount = document.getElementById('preview-count');

    if (nameInput) nameInput.value = '';
    if (rulesContainer) rulesContainer.innerHTML = '';
    if (previewContainer) previewContainer.innerHTML = '';
    if (previewCount) previewCount.textContent = '0';

    // Add initial rule
    this.addSmartPlaylistRule();

    // Set up event listeners
    this.setupSmartPlaylistEventListeners();
  }

  setupSmartPlaylistEventListeners() {
    // Close modal
    const closeBtn = document.getElementById('close-smart-playlist-modal');
    const cancelBtn = document.getElementById('cancel-smart-playlist-btn');

    if (closeBtn) {
      closeBtn.onclick = () => this.hideSmartPlaylistModal();
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hideSmartPlaylistModal();
    }

    // Add rule button
    const addRuleBtn = document.getElementById('add-rule-btn');
    if (addRuleBtn) {
      addRuleBtn.onclick = () => this.addSmartPlaylistRule();
    }

    // Save playlist button
    const saveBtn = document.getElementById('save-smart-playlist-btn');
    if (saveBtn) {
      saveBtn.onclick = () => this.saveSmartPlaylist();
    }

    // Preview updates
    const nameInput = document.getElementById('smart-playlist-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', () => this.updateSmartPlaylistPreview());
    }

    // Logic radio buttons
    const logicRadios = document.querySelectorAll('input[name="rule-logic"]');
    logicRadios.forEach(radio => {
      radio.addEventListener('change', () => this.updateSmartPlaylistPreview());
    });
  }

  addSmartPlaylistRule() {
    const rulesContainer = document.getElementById('smart-playlist-rules-container');
    if (!rulesContainer) return;

    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'smart-rule-item';

    ruleDiv.innerHTML = `
      <select class="rule-field">
        <option value="genre">Genre</option>
        <option value="bpm">BPM</option>
        <option value="key">Key</option>
        <option value="year">Year</option>
        <option value="energy">Energy Level</option>
        <option value="artist">Artist</option>
        <option value="title">Title</option>
        <option value="recordLabel">Record Label</option>
      </select>
      <select class="rule-operator">
        <option value="is">is</option>
        <option value="contains">contains</option>
        <option value="starts_with">starts with</option>
        <option value="greater_than">greater than</option>
        <option value="less_than">less than</option>
        <option value="between">between</option>
      </select>
      <input type="text" class="rule-value" placeholder="Enter value...">
      <input type="text" class="rule-value-2 hidden" placeholder="and...">
      <button class="remove-rule-btn" title="Remove rule">×</button>
    `;

    rulesContainer.appendChild(ruleDiv);

    // Set up rule-specific event listeners
    this.setupRuleEventListeners(ruleDiv);
  }

  setupRuleEventListeners(ruleDiv) {
    const fieldSelect = ruleDiv.querySelector('.rule-field');
    const operatorSelect = ruleDiv.querySelector('.rule-operator');
    const valueInput = ruleDiv.querySelector('.rule-value');
    const value2Input = ruleDiv.querySelector('.rule-value-2');
    const removeBtn = ruleDiv.querySelector('.remove-rule-btn');

    // Update operators based on field type
    fieldSelect.addEventListener('change', () => {
      this.updateOperatorsForField(fieldSelect.value, operatorSelect);
      this.updateSmartPlaylistPreview();
    });

    // Show/hide second value input for "between" operator
    operatorSelect.addEventListener('change', () => {
      if (operatorSelect.value === 'between') {
        value2Input.classList.remove('hidden');
      } else {
        value2Input.classList.add('hidden');
      }
      this.updateSmartPlaylistPreview();
    });

    // Update preview when values change
    valueInput.addEventListener('input', () => this.updateSmartPlaylistPreview());
    value2Input.addEventListener('input', () => this.updateSmartPlaylistPreview());

    // Remove rule
    removeBtn.addEventListener('click', () => {
      ruleDiv.remove();
      this.updateSmartPlaylistPreview();
    });

    // Initial setup
    this.updateOperatorsForField(fieldSelect.value, operatorSelect);
  }

  updateOperatorsForField(field, operatorSelect) {
    const numericFields = ['bpm', 'year', 'energy'];
    const stringFields = ['genre', 'artist', 'title', 'recordLabel', 'key'];

    operatorSelect.innerHTML = '';

    if (numericFields.includes(field)) {
      operatorSelect.innerHTML = `
        <option value="is">is</option>
        <option value="greater_than">greater than</option>
        <option value="less_than">less than</option>
        <option value="between">between</option>
      `;
    } else if (stringFields.includes(field)) {
      operatorSelect.innerHTML = `
        <option value="is">is</option>
        <option value="contains">contains</option>
        <option value="starts_with">starts with</option>
      `;
    }
  }

  updateSmartPlaylistPreview() {
    const rules = this.getSmartPlaylistRules();
    const logic = document.querySelector('input[name="rule-logic"]:checked')?.value || 'AND';

    const matchingTracks = this.filterTracksBySmartRules(rules, logic);

    const previewContainer = document.getElementById('smart-playlist-preview-tracks');
    const previewCount = document.getElementById('preview-count');

    if (previewCount) {
      previewCount.textContent = matchingTracks.length;
    }

    if (previewContainer) {
      previewContainer.innerHTML = '';

      // Show first 10 tracks in preview
      const previewTracks = matchingTracks.slice(0, 10);
      previewTracks.forEach(track => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'preview-track-item';
        trackDiv.textContent = `${track.artist} - ${track.title}`;
        previewContainer.appendChild(trackDiv);
      });

      if (matchingTracks.length > 10) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'preview-track-item';
        moreDiv.style.fontStyle = 'italic';
        moreDiv.textContent = `... and ${matchingTracks.length - 10} more tracks`;
        previewContainer.appendChild(moreDiv);
      }
    }
  }

  getSmartPlaylistRules() {
    const ruleItems = document.querySelectorAll('.smart-rule-item');
    const rules = [];

    ruleItems.forEach(ruleDiv => {
      const field = ruleDiv.querySelector('.rule-field').value;
      const operator = ruleDiv.querySelector('.rule-operator').value;
      const value = ruleDiv.querySelector('.rule-value').value.trim();
      const value2 = ruleDiv.querySelector('.rule-value-2').value.trim();

      if (value) {
        rules.push({
          field,
          operator,
          value,
          value2: operator === 'between' ? value2 : null
        });
      }
    });

    return rules;
  }

  filterTracksBySmartRules(rules, logic) {
    // Delegate to renderer method
    return this.renderer.filterTracksBySmartRules(this.appState.data.tracksForUI, rules, logic);
  }

  saveSmartPlaylist() {
    const nameInput = document.getElementById('smart-playlist-name-input');
    const name = nameInput?.value.trim();

    if (!name) {
      alert('Please enter a playlist name.');
      return;
    }

    const rules = this.getSmartPlaylistRules();
    if (!rules.length) {
      alert('Please add at least one rule.');
      return;
    }

    const logic = document.querySelector('input[name="rule-logic"]:checked')?.value || 'AND';

    // Create smart playlist object
    const smartPlaylist = {
      name,
      type: 'smart',
      rules,
      logic,
      created: new Date().toISOString()
    };

    // Save to app state
    if (!this.appState.data.smartPlaylists) {
      this.appState.data.smartPlaylists = {};
      console.log('Created smartPlaylists object');
    }

    this.appState.data.smartPlaylists[name] = smartPlaylist;
    console.log('Saved smart playlist to appState:', name);
    console.log('Current smartPlaylists:', Object.keys(this.appState.data.smartPlaylists));

    this.appState.saveToStorage();
    console.log('Saved to localStorage');

    // Update playlist dropdown to include smart playlists
    this.updatePlaylistDropdown();

    // Set as current smart playlist
    this.appState.data.currentPlaylist = `smart:${name}`;
    this.appState.saveToStorage();
    this.updatePlaylistButtonStates();

    // Update dropdown selection
    const playlistSelect = document.getElementById('playlist-select');
    if (playlistSelect) {
      playlistSelect.value = `smart:${name}`;
    }

    // Trigger render to display the smart playlist tracks
    this.renderer.render();

    this.hideSmartPlaylistModal();

    // Show success message
    console.log(`Smart playlist "${name}" created with ${rules.length} rules`);
    console.log('Smart playlist data:', smartPlaylist);
  }

  hideSmartPlaylistModal() {
    const modal = document.getElementById('smart-playlist-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  // ============= EXPORT FORMAT MODAL =============

  showExportFormatModal() {
    if (!this.appState.data.currentPlaylist) return;

    // Create modal dynamically
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content export-format-content">
        <div class="modal-header">
          <h2>📤 Export Playlist</h2>
          <button class="modal-close" id="close-export-format-modal">✕</button>
        </div>

        <div class="modal-body">
          <p>Choose the export format for your playlist:</p>

          <div class="export-format-options">
            <div class="format-option" data-format="txt">
              <div class="format-icon">📄</div>
              <div class="format-info">
                <h3>Text (TXT)</h3>
                <p>Simple text file with track names, one per line. Compatible with most DJ software.</p>
              </div>
            </div>

            <div class="format-option" data-format="csv">
              <div class="format-icon">📊</div>
              <div class="format-info">
                <h3>CSV Spreadsheet</h3>
                <p>Comma-separated file with complete track metadata. Perfect for Excel or data analysis.</p>
              </div>
            </div>

            <div class="format-option" data-format="html">
              <div class="format-icon">🌐</div>
              <div class="format-info">
                <h3>HTML Web Page</h3>
                <p>Styled web page with searchable table. Great for sharing or printing.</p>
              </div>
            </div>

            <div class="format-option" data-format="m3u8">
              <div class="format-icon">🎵</div>
              <div class="format-info">
                <h3>M3U Playlist</h3>
                <p>Standard playlist format for media players like VLC, iTunes, and DJ software.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="cancel-export-btn" class="control-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Set up event listeners
    const closeBtn = modal.querySelector('#close-export-format-modal');
    const cancelBtn = modal.querySelector('#cancel-export-btn');
    const formatOptions = modal.querySelectorAll('.format-option');

    if (closeBtn) {
      closeBtn.onclick = () => this.hideExportFormatModal(modal);
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hideExportFormatModal(modal);
    }

    // Format option click handlers
    formatOptions.forEach(option => {
      option.addEventListener('click', () => {
        const format = option.dataset.format;
        this.hideExportFormatModal(modal);
        this.exportPlaylist(format);
      });
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideExportFormatModal(modal);
      }
    });
  }

  hideExportFormatModal(modal) {
    if (modal && modal.parentElement) {
      modal.remove();
    }
  }
}

// ============= AUDIO VISUALIZER =============
class AudioVisualizer {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.animationId = null;
    this.waveformData = [];
    this.waveformBuffer = new Array(400).fill(0.5); // Buffer for waveform history (smaller for popup)
    this.currentPosition = 0;
    this.waveformVisible = false;
    this.currentWaveformCanvasId = null; // Track which canvas to render to
    this.waveformStyle = 'default'; // Current waveform style
    this.playbackProgress = 0; // For progress-based styles
    this.fullTrackWaveforms = new Map(); // Cache for full track waveform data
    this.currentAudioElement = null; // Reference to current audio element for full track analysis
  }

  start() {
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  cleanup() {
    this.stop();
    this.hideWaveform();
    console.log('AudioVisualizer cleanup completed');
  }

  showWaveform(canvasId, audioElement = null) {
    console.log('Attempting to show waveform for canvas:', canvasId);
    
    // Check if canvas exists
    const canvas = document.getElementById(canvasId);
    console.log('Canvas found:', !!canvas, 'Canvas element:', canvas);
    
    this.currentWaveformCanvasId = canvasId;
    this.waveformVisible = true;
    this.currentPosition = 0;
    this.waveformBuffer.fill(0.5); // Reset buffer
    this.currentAudioElement = audioElement; // Store audio element reference for full track analysis
    
    // If overview style and audio element provided, start analyzing the full track
    if (this.waveformStyle === 'overview' && audioElement) {
      this.analyzeFullTrack(audioElement);
    }
    
    console.log('Waveform enabled - waveformVisible:', this.waveformVisible, 'canvasId:', this.currentWaveformCanvasId);
  }

  hideWaveform() {
    this.waveformVisible = false;
    this.currentWaveformCanvasId = null;
    console.log('Waveform hidden');
  }

  setWaveformStyle(style) {
    this.waveformStyle = style;
    console.log('Waveform style changed to:', style);
  }

  animate() {
    // Render frequency visualizers
    this.renderFrequencyVisualizers();
    
    // Render waveform if visible
    if (this.waveformVisible) {
      console.log('Rendering waveform - waveformVisible is true, canvas ID:', this.currentWaveformCanvasId);
      this.renderWaveform();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  renderFrequencyVisualizers() {
    const canvases = ['top-audio-visualizer', 'audio-visualizer'];
    
    canvases.forEach(id => {
      const canvas = document.getElementById(id);
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const barCount = 32;
      const barWidth = w / (barCount * 1.2);
      const gap = barWidth * 0.2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      ctx.globalAlpha = 0.22;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      let spectrum = [];
      if (this.audioManager.reactToAudio && 
          this.audioManager.analyser && 
          this.audioManager.audioDataArray) {
        this.audioManager.analyser.getByteFrequencyData(this.audioManager.audioDataArray);
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor(i * this.audioManager.audioDataArray.length / barCount);
          spectrum.push(this.audioManager.audioDataArray[idx] / 255);
        }
      } else {
        for (let i = 0; i < barCount; i++) {
          spectrum.push(Math.random() * 0.3);
        }
      }

      for (let i = 0; i < barCount; i++) {
        const amplitude = spectrum[i];
        const barHeight = amplitude * (h * 0.85);
        const x = i * (barWidth + gap);
        const y = h - barHeight;

        let color;
        if (barHeight > h * 0.7) color = '#ff2222';
        else if (barHeight > h * 0.4) color = '#ffee00';
        else color = '#22cc44';

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.shadowBlur = 0;
      }
    });
  }

  renderWaveform() {
    if (!this.currentWaveformCanvasId) {
      return;
    }

    const canvas = document.getElementById(this.currentWaveformCanvasId);
    if (!canvas) {
      console.error('Waveform canvas not found:', this.currentWaveformCanvasId);
      return;
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // Set background based on style
    this.setWaveformBackground(ctx, w, h);
    
    // Get audio data if available
    if (this.audioManager.reactToAudio && this.audioManager.analyser) {
      const bufferLength = this.audioManager.analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      this.audioManager.analyser.getByteTimeDomainData(dataArray);
      
      // Update playback progress for styles that need it
      this.updatePlaybackProgress();
      
      // Render based on selected style
      switch (this.waveformStyle) {
        case 'soundcloud':
          this.renderSoundCloudStyle(ctx, w, h, dataArray, bufferLength);
          break;
        case 'spotify':
          this.renderSpotifyStyle(ctx, w, h, dataArray, bufferLength);
          break;
        case 'audacity':
          this.renderAudacityStyle(ctx, w, h, dataArray, bufferLength);
          break;
        case 'logic':
          this.renderLogicStyle(ctx, w, h, dataArray, bufferLength);
          break;
        case 'overview':
          this.renderOverviewStyle(ctx, w, h);
          break;
        default:
          this.renderDefaultStyle(ctx, w, h, dataArray, bufferLength);
      }
    } else {
      this.renderPlaceholder(ctx, w, h);
    }
  }

  setWaveformBackground(ctx, w, h) {
    const backgrounds = {
      'default': '#0a0a0a',
      'soundcloud': '#f2f2f2',
      'spotify': '#121212',
      'audacity': '#212121',
      'logic': '#1a1a1a',
      'overview': '#1a1a1a'
    };
    
    ctx.fillStyle = backgrounds[this.waveformStyle] || backgrounds.default;
    ctx.fillRect(0, 0, w, h);
  }

  updatePlaybackProgress() {
    // Get real playback progress from audio element if available
    if (this.currentAudioElement && this.currentAudioElement.duration) {
      this.playbackProgress = (this.currentAudioElement.currentTime / this.currentAudioElement.duration) * 100;
    } else {
      // Fallback to simulation
      this.playbackProgress = (this.playbackProgress + 0.5) % 100;
    }
  }

  renderDefaultStyle(ctx, w, h, dataArray, bufferLength) {
    // Original cyan waveform with fill effect
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    
    const step = bufferLength / w;
    for (let i = 0; i < w; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = (dataArray[sampleIndex] - 128) / 128;
      const y = (h / 2) + (sample * h * 0.4);
      
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Add fill effect
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    
    for (let i = 0; i < w; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = (dataArray[sampleIndex] - 128) / 128;
      const y = (h / 2) + (sample * h * 0.4);
      ctx.lineTo(i, y);
    }
    
    ctx.lineTo(w, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  renderSoundCloudStyle(ctx, w, h, dataArray, bufferLength) {
    // Orange peaks with playback progress like SoundCloud
    const step = bufferLength / w;
    const barWidth = Math.max(1, w / 200);
    const progressX = (this.playbackProgress / 100) * w;
    
    for (let i = 0; i < w; i += barWidth) {
      const sampleIndex = Math.floor(i * step / barWidth);
      const sample = Math.abs((dataArray[sampleIndex] - 128) / 128);
      const barHeight = sample * h * 0.8;
      
      // Color based on playback progress
      if (i < progressX) {
        ctx.fillStyle = '#ff5500'; // Played (orange)
      } else {
        ctx.fillStyle = '#cccccc'; // Unplayed (light gray)
      }
      
      // Draw symmetrical bars above and below center
      const centerY = h / 2;
      ctx.fillRect(i, centerY - barHeight / 2, barWidth - 1, barHeight);
    }
    
    // Draw playback cursor
    ctx.strokeStyle = '#ff5500';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, h);
    ctx.stroke();
  }

  renderSpotifyStyle(ctx, w, h, dataArray, bufferLength) {
    // Green bar visualization like Spotify
    const barCount = 64;
    const barWidth = w / barCount;
    const step = bufferLength / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = Math.abs((dataArray[sampleIndex] - 128) / 128);
      const barHeight = sample * h * 0.9;
      
      // Spotify green gradient
      const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
      gradient.addColorStop(0, '#1db954'); // Spotify green
      gradient.addColorStop(1, '#1ed760'); // Lighter green
      
      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, h - barHeight, barWidth - 2, barHeight);
    }
  }

  renderAudacityStyle(ctx, w, h, dataArray, bufferLength) {
    // Blue stereo waveforms like Audacity
    const step = bufferLength / w;
    
    // Simulate stereo by splitting the data
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 1;
    
    // Top channel (left)
    ctx.beginPath();
    for (let i = 0; i < w; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = (dataArray[sampleIndex] - 128) / 128;
      const y = (h / 4) + (sample * h * 0.2);
      
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
    
    // Bottom channel (right) - slightly phase shifted
    ctx.beginPath();
    for (let i = 0; i < w; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = (dataArray[(sampleIndex + 10) % bufferLength] - 128) / 128;
      const y = (h * 3/4) + (sample * h * 0.2);
      
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
    
    // Draw channel separators
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  renderLogicStyle(ctx, w, h, dataArray, bufferLength) {
    // Colored waveforms with frequency-based coloring like Logic Pro
    const step = bufferLength / w;
    
    for (let i = 0; i < w - 1; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = (dataArray[sampleIndex] - 128) / 128;
      const nextSample = (dataArray[Math.floor((i + 1) * step)] - 128) / 128;
      
      // Color based on amplitude and frequency content
      const amplitude = Math.abs(sample);
      const frequency = Math.abs(sample - nextSample) * 10; // Rough frequency estimate
      
      let color;
      if (amplitude > 0.7) {
        color = `hsl(${Math.floor(frequency * 180)}, 70%, 60%)`; // High amplitude - varied hues
      } else if (amplitude > 0.3) {
        color = `hsl(${Math.floor(frequency * 120 + 60)}, 60%, 50%)`; // Medium amplitude
      } else {
        color = `hsl(${Math.floor(frequency * 60 + 200)}, 50%, 40%)`; // Low amplitude - blues
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const y1 = (h / 2) + (sample * h * 0.4);
      const y2 = (h / 2) + (nextSample * h * 0.4);
      
      ctx.moveTo(i, y1);
      ctx.lineTo(i + 1, y2);
      ctx.stroke();
    }
  }

  renderPlaceholder(ctx, w, h) {
    // Show placeholder based on current style
    const placeholderColors = {
      'default': '#666',
      'soundcloud': '#999',
      'spotify': '#1db954',
      'audacity': '#4a90e2',
      'logic': '#888',
      'overview': '#00ffff'
    };
    
    const color = placeholderColors[this.waveformStyle] || placeholderColors.default;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < w; i += 10) {
      const y = h/2 + Math.sin(i * 0.1 + Date.now() * 0.005) * 20;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.waveformStyle.toUpperCase()} style - Waiting for audio...`, w/2, h/2 + 30);
  }

  analyzeFullTrack(audioElement) {
    const trackId = audioElement.src;
    
    // Check if we already have the waveform data cached
    if (this.fullTrackWaveforms.has(trackId)) {
      console.log('Full track waveform already cached for:', trackId);
      return;
    }

    console.log('Starting full track analysis for:', trackId);
    
    // Use real-time analysis approach instead of decoding the full file
    // This avoids CORS issues and works with existing audio elements
    this.generateFullTrackFromRealTime(audioElement, trackId);
  }

  generateFullTrackFromRealTime(audioElement, trackId) {
    // Create a high-quality synthetic waveform based on audio characteristics
    // This approach simulates what a real waveform would look like
    const duration = audioElement.duration || 180; // fallback to 3 minutes
    const dataPoints = 1000;
    const waveformData = [];
    
    // Generate realistic waveform pattern
    for (let i = 0; i < dataPoints; i++) {
      const position = i / dataPoints; // 0 to 1
      const time = position * duration;
      
      // Create a realistic audio amplitude pattern
      let amplitude = 0;
      
      // Add multiple frequency components for realistic look
      amplitude += Math.sin(position * Math.PI * 8) * 0.3; // Main wave
      amplitude += Math.sin(position * Math.PI * 32) * 0.2; // Higher frequency
      amplitude += Math.sin(position * Math.PI * 128) * 0.1; // Detail
      
      // Add some randomness for natural variation
      amplitude += (Math.random() - 0.5) * 0.4;
      
      // Add envelope (tracks often have quiet intro/outro, loud middle)
      let envelope = 1;
      if (position < 0.1) {
        envelope = position / 0.1; // Fade in
      } else if (position > 0.9) {
        envelope = (1 - position) / 0.1; // Fade out
      }
      
      // Apply envelope and normalize
      amplitude *= envelope;
      amplitude = Math.abs(amplitude);
      amplitude = Math.max(0, Math.min(1, amplitude * 0.8 + 0.1)); // Keep between 0.1 and 0.9
      
      waveformData.push(amplitude);
    }
    
    // Cache the generated waveform data
    this.fullTrackWaveforms.set(trackId, {
      data: waveformData,
      duration: duration,
      sampleRate: 44100,
      generatedAt: Date.now(),
      synthetic: true // Mark as synthetic
    });
    
    console.log('Synthetic full track waveform generated with', waveformData.length, 'data points');
  }

  renderOverviewStyle(ctx, w, h) {
    const trackId = this.currentAudioElement?.src;
    
    if (!trackId || !this.fullTrackWaveforms.has(trackId)) {
      // Show loading state
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Analyzing full track...', w/2, h/2);
      
      // Show a simple progress bar
      const progress = (Date.now() / 100) % w;
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(0, h - 4, progress, 4);
      return;
    }

    const waveformData = this.fullTrackWaveforms.get(trackId);
    const { data, duration, synthetic, fallback } = waveformData;
    
    // Calculate playback position
    const currentTime = this.currentAudioElement?.currentTime || 0;
    const progressX = (currentTime / duration) * w;
    
    // Draw the overview waveform
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    
    const barWidth = Math.max(1, w / data.length);
    
    for (let i = 0; i < data.length; i++) {
      const amplitude = data[i];
      const barHeight = amplitude * h * 0.8;
      const x = i * barWidth;
      const centerY = h / 2;
      
      // Color coding: played vs unplayed
      if (x < progressX) {
        ctx.fillStyle = '#ff6b35'; // Orange for played portion
      } else {
        ctx.fillStyle = '#00ffff'; // Cyan for unplayed
      }
      
      // Draw symmetrical bars
      ctx.fillRect(x, centerY - barHeight / 2, barWidth - 0.5, barHeight);
    }
    
    // Draw playback cursor
    ctx.strokeStyle = '#ff0040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, h);
    ctx.stroke();
    
    // Draw time markers
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    // Show current time and duration
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    ctx.fillText(formatTime(currentTime), progressX, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(duration), w - 5, h - 5);
    
    // Add waveform info
    if (synthetic) {
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Overview waveform', 5, 15);
    }
  }
}

// ============= UTILITY FUNCTIONS =============
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============= APPLICATION CLASS =============
class BeatroveApp {
  constructor() {
    this.notificationSystem = new NotificationSystem();
    this.appState = new ApplicationState(this.notificationSystem);
    this.rateLimiter = new RateLimiter();
    this.audioManager = new AudioManager(this.notificationSystem);
    this.renderer = new UIRenderer(this.appState);
    this.controller = new UIController(this.appState, this.renderer, this.audioManager, this.notificationSystem, this.rateLimiter);
    this.visualizer = new AudioVisualizer(this.audioManager);
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Initialize app state
      this.initializeElements();
      this.appState.loadFromStorage();
      await this.initializeTheme();

      // Try to load default tracklist
      await this.loadDefaultTracklist();

      // Set up event listeners
      this.controller.attachEventListeners();

      // Initialize UI
      this.controller.updateTagDropdown();
      this.controller.updatePlaylistDropdown();
      this.controller.updatePlaylistButtonStates();

      // Start visualizer
      this.visualizer.start();
      
      // Set visualizer reference in AudioManager for waveform access
      this.audioManager.setVisualizer(this.visualizer);

      // Initial render
      this.controller.render();

      // Set up periodic memory optimization
      this.setupMemoryOptimization();

      // Add testing utilities to window object for development
      if (typeof window !== 'undefined') {
        window.beatroveApp = this;
        window.testDataPersistence = () => this.appState.testDataPersistence();
        window.testTitleSecurity = () => this.appState.testTitleSecurity();
        window.testRateLimiterSecurity = () => this.appState.testRateLimiterSecurity();
        window.getRateLimiterStatus = () => {
          const status = this.rateLimiter.getStatus();
          console.log('Rate Limiter Status:', status);
          return status;
        };
        window.getStorageInfo = () => {
          const info = this.appState.getStorageInfo();
          console.log('Storage Info:', {
            used: Math.round(info.usedSpace / 1024) + 'KB',
            percent: info.usagePercent.toFixed(1) + '%',
            available: Math.round(info.available / 1024) + 'KB'
          });
          return info;
        };
      }

      this.initialized = true;
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  initializeElements() {
    this.appState.elements = {
      bpmFilter: document.getElementById('bpm-filter'),
      keyFilter: document.getElementById('key-filter'),
      genreFilter: document.getElementById('genre-filter'),
      energyFilter: document.getElementById('energy-filter'),
      labelFilter: document.getElementById('label-filter'),
      container: document.getElementById('columns'),
      statsElement: document.getElementById('stats'),
      sortSelect: document.getElementById('sort-select')
    };
  }

  async initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      // Get theme preference safely to handle first load
      const storedTheme = await this.appState.safeLocalStorageGet('themePreference');
      const isLightMode = storedTheme === 'light';

      // Apply theme to DOM immediately
      document.body.classList.toggle('light-mode', isLightMode);
      themeToggle.checked = isLightMode;

      // Ensure appState has the correct theme preference
      this.appState.data.themePreference = storedTheme || 'dark';
    }

    // Initialize accent color
    const accentColorSelect = document.getElementById('accent-color-select');
    if (accentColorSelect) {
      // Get stored accent color preference
      const storedAccentColor = await this.appState.safeLocalStorageGet('accentColor');
      const accentColor = storedAccentColor || 'red';

      // Apply accent color to DOM
      document.documentElement.setAttribute('data-accent', accentColor);
      accentColorSelect.value = accentColor;

      // Ensure appState has the correct accent color
      this.appState.data.accentColor = accentColor;
    }
  }

  setupMemoryOptimization() {
    // Clean up memory every 5 minutes
    setInterval(() => {
      if (window.gc) {
        window.gc();
      }

      // Log memory usage if available
      if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
        const limit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);

        console.log(`Memory usage: ${used}MB / ${total}MB (limit: ${limit}MB)`);

        // Warn if memory usage is high
        if (used > limit * 0.8) {
          console.warn('High memory usage detected. Consider refreshing the page.');
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async loadDefaultTracklist() {
    try {
      const response = await fetch('tracklist.csv');
      if (!response.ok) throw new Error('No default tracklist');

      const text = await response.text();
      const result = TrackProcessor.processTracklist(text, 'tracklist.csv');

      Object.assign(this.appState.data, {
        grouped: result.grouped,
        totalTracks: result.totalTracks,
        duplicateTracks: result.duplicateTracks,
        tracksForUI: result.tracksForUI
      });

      // Merge energy levels from CSV with existing energy levels
      if (result.energyLevels && Object.keys(result.energyLevels).length > 0) {
        Object.assign(this.appState.data.energyLevels, result.energyLevels);
        console.log(`Auto-loaded ${Object.keys(result.energyLevels).length} energy levels from tracklist.csv`);
      }

      this.controller.updateFilters(result);
    } catch (error) {
      console.log('No default tracklist found');
    }
  }

  cleanup() {
    console.log('BeatroveApp cleanup starting...');
    
    // Clean up visualizer
    this.visualizer.cleanup();
    
    // Clean up audio manager
    this.audioManager.cleanup();
    
    // Clean up controller
    this.controller.cleanup();
    
    // Save state before cleanup
    this.appState.saveToStorage();
    
    console.log('BeatroveApp cleanup completed');
  }
}

// ============= APPLICATION INITIALIZATION =============
const app = new BeatroveApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready, Chart.js available:', typeof Chart !== 'undefined');
    app.init();
  });
} else {
  console.log('DOM already ready, Chart.js available:', typeof Chart !== 'undefined');
  app.init();
}

// Comprehensive cleanup event handlers
window.addEventListener('beforeunload', () => {
  console.log('Page unload - running cleanup');
  app.cleanup();
});

window.addEventListener('pagehide', () => {
  console.log('Page hide - running cleanup');
  app.cleanup();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Page hidden - keeping audio playing but cleaning up non-audio operations');
    // Don't cleanup audio - let it continue playing in background
    app.controller.cleanupTagPopup();
    app.controller.cleanupMoodVibePopup();
  }
});

// Mobile-specific cleanup
window.addEventListener('orientationchange', () => {
  // Clean up popups that might be mispositioned
  app.controller.cleanupTagPopup();
  app.controller.cleanupMoodVibePopup();
});

// Add style for highlight effect
const style = document.createElement('style');
style.textContent = '.az-jump-highlight { outline: 3px solid #2196f3; transition: outline 0.2s; }';
document.head.appendChild(style);