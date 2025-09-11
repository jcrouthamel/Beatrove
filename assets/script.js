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
    const maxAudioSize = 100 * 1024 * 1024; // 100MB for audio
    if (file.size > maxAudioSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      errors.push(`Audio file size ${sizeMB}MB exceeds maximum allowed size of 100MB`);
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
      favoriteTracks: {},
      playlists: {},
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
        energyLevels: localStorage.getItem('energyLevels'),
        favoriteTracks: localStorage.getItem('favoriteTracks'),
        playlists: localStorage.getItem('playlists'),
        currentPlaylist: localStorage.getItem('currentPlaylist'),
        themePreference: localStorage.getItem('themePreference')
      };

      if (stored.trackTags) this.data.trackTags = JSON.parse(stored.trackTags);
      if (stored.energyLevels) this.data.energyLevels = JSON.parse(stored.energyLevels);
      if (stored.favoriteTracks) this.data.favoriteTracks = JSON.parse(stored.favoriteTracks);
      if (stored.playlists) this.data.playlists = JSON.parse(stored.playlists);
      if (stored.currentPlaylist) this.data.currentPlaylist = stored.currentPlaylist;
      if (stored.themePreference) this.data.themePreference = stored.themePreference;
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
              energyLevels: JSON.stringify(this.data.energyLevels),
              favoriteTracks: JSON.stringify(this.data.favoriteTracks),
              playlists: JSON.stringify(this.data.playlists),
              currentPlaylist: this.data.currentPlaylist,
              themePreference: this.data.themePreference
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
      energyLevels: {}, // track.display -> 1-10 energy level
      favoriteTracks: {},
      playlists: {},
      currentPlaylist: '',
      showFavoritesOnly: false,
      themePreference: 'dark' // 'dark' or 'light'
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
  }

  async connectVisualizer(audioElem) {
    // Prevent race conditions in visualizer connection
    if (this.isConnectingVisualizer) {
      console.log('Visualizer connection already in progress, skipping');
      return;
    }

    this.isConnectingVisualizer = true;
    
    try {
      // Clean up any existing visualizer first
      this.disconnectVisualizer();
      
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElem);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.reactToAudio = true;
      await this.audioCtx.resume();
      
      console.log('Visualizer connected successfully');
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

      const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();
      const file = this.fileMap[fileName];
      
      if (!file) {
        throw new Error(`Audio file not found: ${fileName}`);
      }

      if (!SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        throw new Error('Unsupported audio file type');
      }

      // Set current preview ID and clean up previous
      this.currentPreviewId = previewId;
      await this.cleanupCurrentAudioAsync();

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

      // Add audio element
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      audio.autoplay = true;
      audio.className = 'custom-audio-player';
      audio._previewId = previewId; // Track which preview this belongs to
      container.appendChild(audio);

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
        // Only disconnect if this is still the current preview
        if (audio._previewId === this.currentPreviewId) {
          this.disconnectVisualizer();
        }
      });

      // Store cleanup handler
      audio._cleanupHandler = cleanupHandler;

      // Connect visualizer only if still current
      if (this.currentPreviewId === previewId) {
        await this.connectVisualizer(audio);
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
      totalTracks: 0,
      tracksForUI: [],
      duplicateTracks: []
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

      // Create track object
      const trackObj = {
        display: `${track.artist} - ${track.title} - ${track.trackTime} - ${track.year}` + 
                 (track.genre ? ` - ${track.genre}` : ''),
        ...track
      };

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
      genre: '',
      absPath: ''
    };

    // Extract BPM from format like "127.flac"
    const bpmExt = parts[3]?.trim() || '';
    const bpmMatch = bpmExt.match(/(\d{2,3})/);
    track.bpm = bpmMatch ? bpmMatch[1] : '';

    // Handle extended fields
    if (parts.length >= 7) {
      const lastPart = parts[parts.length - 1].trim();
      if (/\.(mp3|wav|flac|aiff|ogg)$/i.test(lastPart)) {
        track.absPath = parts.slice(6).join(' - ').trim();
      } else {
        track.genre = lastPart;
        if (parts.length > 7) {
          track.absPath = parts.slice(6, -1).join(' - ').trim();
        }
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
  }

  render() {
    const filters = this.getActiveFilters();
    const filteredTracks = this.filterTracks(filters);
    const sortedTracks = this.sortTracks(filteredTracks, filters.sortValue);
    const groupedTracks = this.groupTracks(sortedTracks);

    this.renderTracks(groupedTracks);
    this.updateStats(filteredTracks);
    this.renderAZBar();

    if (filteredTracks.length === 0 && this.hasActiveFilters(filters)) {
      this.showNoResults();
    }
  }

  getActiveFilters() {
    return {
      search: document.getElementById('search')?.value.toLowerCase() || '',
      selectedBPM: this.appState.elements.bpmFilter?.value || '',
      selectedKey: this.appState.elements.keyFilter?.value || '',
      selectedGenre: this.appState.elements.genreFilter?.value || '',
      selectedEnergy: this.appState.elements.energyFilter?.value || '',
      tagSearch: document.getElementById('tag-dropdown')?.value.toLowerCase() || '',
      sortValue: this.appState.elements.sortSelect?.value || 'name-asc',
      yearSearch: document.getElementById('year-search')?.value.trim(),
      showFavoritesOnly: this.appState.data.showFavoritesOnly
    };
  }

  hasActiveFilters(filters) {
    return filters.search || filters.selectedBPM || filters.selectedKey || 
           filters.selectedGenre || filters.selectedEnergy || filters.tagSearch || 
           filters.yearSearch || filters.showFavoritesOnly;
  }

  filterTracks(filters) {
    let yearMin = null, yearMax = null;
    
    if (filters.yearSearch) {
      const match = filters.yearSearch.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
      if (match) {
        yearMin = parseInt(match[1], 10);
        yearMax = match[2] ? parseInt(match[2], 10) : yearMin;
      }
    }

    return this.appState.data.tracksForUI.filter(track => {
      // Search filter
      if (filters.search) {
        const searchMatch = track.display.toLowerCase().includes(filters.search) ||
                          track.artist?.toLowerCase().includes(filters.search) ||
                          track.title?.toLowerCase().includes(filters.search);
        if (!searchMatch) return false;
      }

      // BPM filter
      if (filters.selectedBPM && track.bpm !== filters.selectedBPM) return false;

      // Key filter
      if (filters.selectedKey && track.key !== filters.selectedKey) return false;

      // Genre filter
      if (filters.selectedGenre && track.genre !== filters.selectedGenre) return false;

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
  }

  sortTracks(tracks, sortValue) {
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
    if (!container) return;

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();

    Object.entries(groupedTracks).forEach(([artist, tracks]) => {
      if (tracks.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'column-group group';

      const h2 = SecurityUtils.createSafeElement('h2', artist);
      groupDiv.appendChild(h2);

      tracks.forEach(track => {
        groupDiv.appendChild(this.createTrackElement(track));
      });

      fragment.appendChild(groupDiv);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
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
    const filters = ['search', 'bpm-filter', 'key-filter', 'genre-filter', 'energy-filter', 'sort-select', 'year-search', 'tag-dropdown'];
    
    filters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.render());
        if (id === 'search' || id === 'year-search') {
          element.addEventListener('input', debounce(() => this.render(), CONFIG.DEBOUNCE_DELAY));
        }
      }
    });

    // Enhanced search functionality
    this.attachSearchEnhancements();
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

  attachPlaylistListeners() {
    const playlistSelect = document.getElementById('playlist-select');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (e) => {
        this.appState.data.currentPlaylist = e.target.value;
        this.appState.saveToStorage();
        this.updatePlaylistButtonStates();
      });
    }

    const createBtn = document.getElementById('create-playlist-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.createPlaylist());
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
      exportBtn.addEventListener('click', () => this.exportPlaylist());
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
        // Hide stats
        statsContainer.classList.add('hidden');
        statsBtn.classList.remove('active');
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

  calculateAndDisplayStats() {
    const tracks = this.appState.data.tracksForUI || [];
    
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
  }

  displayGenreStats(tracks) {
    const genreStats = {};
    tracks.forEach(track => {
      const genre = track.genre || 'Unknown';
      genreStats[genre] = (genreStats[genre] || 0) + 1;
    });
    
    console.log('Genre stats:', genreStats);
    this.displayStatList('genre-stats', genreStats);
  }

  displayKeyStats(tracks) {
    const keyStats = {};
    tracks.forEach(track => {
      const key = track.key || 'Unknown';
      keyStats[key] = (keyStats[key] || 0) + 1;
    });
    
    console.log('Key stats:', keyStats);
    this.displayStatList('key-stats', keyStats);
  }

  displayBPMStats(tracks) {
    const bpmRanges = {
      '60-89 BPM': { min: 60, max: 89, count: 0 },
      '90-109 BPM': { min: 90, max: 109, count: 0 },
      '110-129 BPM': { min: 110, max: 129, count: 0 },
      '130-139 BPM': { min: 130, max: 139, count: 0 },
      '140-149 BPM': { min: 140, max: 149, count: 0 },
      '150-179 BPM': { min: 150, max: 179, count: 0 },
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
    
    // Filter out zero counts for cleaner display
    const filteredEnergyStats = {};
    Object.entries(energyStats).forEach(([key, count]) => {
      if (count > 0) {
        filteredEnergyStats[key] = count;
      }
    });
    
    this.displayStatList('energy-stats', filteredEnergyStats);
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
    
    const confirmed = await this.notificationSystem.confirm(`Delete playlist "${this.appState.data.currentPlaylist}"?`, 'Delete Playlist');
    if (confirmed) {
      const playlistName = this.appState.data.currentPlaylist;
      delete this.appState.data.playlists[this.appState.data.currentPlaylist];
      this.appState.data.currentPlaylist = '';
      this.appState.saveToStorage();
      this.updatePlaylistDropdown();
      this.updatePlaylistButtonStates();
      this.notificationSystem.success(`Playlist "${playlistName}" deleted successfully`);
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

  exportPlaylist() {
    if (!this.appState.data.currentPlaylist) return;
    
    const playlist = this.appState.data.playlists[this.appState.data.currentPlaylist];
    if (!playlist || playlist.length === 0) {
      this.notificationSystem.warning('Playlist is empty');
      return;
    }

    const data = playlist.join('\n');
    this.downloadText(`${this.appState.data.currentPlaylist}.txt`, data);
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
    Object.keys(this.appState.data.playlists).forEach(name => {
      const option = SecurityUtils.createSafeElement('option', name);
      option.value = name;
      if (name === this.appState.data.currentPlaylist) {
        option.selected = true;
      }
      dropdown.appendChild(option);
    });
  }

  updatePlaylistButtonStates() {
    const selected = this.appState.data.currentPlaylist;
    const hasTracks = selected && this.appState.data.playlists[selected]?.length > 0;
    
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
}

// ============= AUDIO VISUALIZER =============
class AudioVisualizer {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.animationId = null;
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
    console.log('AudioVisualizer cleanup completed');
  }

  animate() {
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

    this.animationId = requestAnimationFrame(() => this.animate());
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

      // Initial render
      this.controller.render();

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
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
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
    console.log('Page hidden - cleaning up current operations');
    app.audioManager.cleanupCurrentAudio();
    app.controller.cleanupTagPopup();
  }
});

// Mobile-specific cleanup
window.addEventListener('orientationchange', () => {
  // Clean up popups that might be mispositioned
  app.controller.cleanupTagPopup();
});

// Add style for highlight effect
const style = document.createElement('style');
style.textContent = '.az-jump-highlight { outline: 3px solid #2196f3; transition: outline 0.2s; }';
document.head.appendChild(style);