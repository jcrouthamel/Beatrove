/**
 * Beatrove - Main Application Entry Point
 * Modular architecture with ES6 imports
 */

'use strict';

// Import core utilities
import { CONFIG, SecurityUtils, RateLimiter } from './core/security-utils.js';
import { FuzzySearchUtils } from './core/fuzzy-search.js';
import { ErrorHandler } from './core/error-handler.js';

// Import audio modules
import { AudioManager } from './audio/audio-manager.js';
import { AudioVisualizer } from './audio/audio-visualizer.js';

// Import UI modules
import { UIRenderer } from './ui/ui-renderer.js';
import { UIController } from './ui/ui-controller.js';

// ============= NOTIFICATION SYSTEM =============
class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.initContainer();
  }

  initContainer() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(notification);
    }, duration);

    // Remove on click
    notification.addEventListener('click', () => {
      this.remove(notification);
    });

    // Add close method to notification object
    notification.close = () => {
      this.remove(notification);
    };

    return notification;
  }

  remove(notification) {
    if (notification && notification.parentElement) {
      notification.remove();
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }
  }

  error(message) {
    return this.show(message, 'error', 8000);
  }

  success(message) {
    return this.show(message, 'success', 4000);
  }

  warning(message) {
    return this.show(message, 'warning', 6000);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  clear() {
    this.notifications.forEach(notification => this.remove(notification));
  }

  cleanup() {
    this.clear();
    if (this.container) {
      this.container.remove();
    }
  }
}

// ============= APPLICATION STATE =============
class ApplicationState {
  constructor(notificationSystem, errorHandler = null) {
    this.notificationSystem = notificationSystem;
    this.errorHandler = errorHandler || new ErrorHandler(notificationSystem);
    this.data = {
      grouped: {},
      totalTracks: 0,
      duplicateTracks: [],
      tracksForUI: [],
      favoriteTracks: {},
      playlists: {},
      currentPlaylist: '',
      trackTags: {},
      moodVibeTags: {},
      energyLevels: {},
      smartPlaylists: {},
      showFavoritesOnly: false,
      themePreference: 'dark',
      accentColor: 'red',
      waveformStyle: 'default',
      coverArtSettings: {
        showCoverArt: CONFIG.COVER_ART.SHOW_BY_DEFAULT,
        audioFolderPath: '',
        artworkDirectory: CONFIG.COVER_ART.DIRECTORY
      }
    };

    this.elements = {};
    this.cache = {
      filterResults: new Map(),
      sortResults: new Map()
    };

    this.operations = {
      rateLimitedOps: ['save', 'load', 'import', 'export'],
      criticalSaves: ['favoriteTracks', 'playlists', 'energyLevels', 'trackTags']
    };
  }

  async safeLocalStorageGet(key, defaultValue = null) {
    return this.errorHandler.safe(() => {
      const value = localStorage.getItem(key);
      return value !== null ? JSON.parse(value) : defaultValue;
    }, {
      component: 'ApplicationState',
      method: 'safeLocalStorageGet',
      fallbackValue: defaultValue,
      showUser: false,
      logToConsole: false
    });
  }

  async safeLocalStorageSet(key, value) {
    return this.errorHandler.safe(() => {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }, {
      component: 'ApplicationState',
      method: 'safeLocalStorageSet',
      fallbackValue: false,
      operation: 'local storage save',
      showUser: false
    });
  }

  loadFromStorage() {
    try {
      // Load critical data
      this.data.favoriteTracks = this.safeLocalStorageGet('favoriteTracks') || {};
      this.data.playlists = this.safeLocalStorageGet('playlists') || {};

      // Ensure currentPlaylist is always a string
      const currentPlaylist = this.safeLocalStorageGet('currentPlaylist');
      this.data.currentPlaylist = (typeof currentPlaylist === 'string') ? currentPlaylist : '';

      this.data.trackTags = this.safeLocalStorageGet('trackTags') || {};
      this.data.moodVibeTags = this.safeLocalStorageGet('moodVibeTags') || {};
      this.data.energyLevels = this.safeLocalStorageGet('energyLevels') || {};
      this.data.smartPlaylists = this.safeLocalStorageGet('smartPlaylists') || {};

      // Ensure theme preferences are strings
      const themePreference = this.safeLocalStorageGet('themePreference');
      this.data.themePreference = (typeof themePreference === 'string') ? themePreference : 'dark';

      const accentColor = this.safeLocalStorageGet('accentColor');
      this.data.accentColor = (typeof accentColor === 'string') ? accentColor : 'red';

      const waveformStyle = this.safeLocalStorageGet('waveformStyle');
      this.data.waveformStyle = (typeof waveformStyle === 'string') ? waveformStyle : 'default';

      // Load favorites filter state
      const showFavoritesOnly = this.safeLocalStorageGet('showFavoritesOnly');
      this.data.showFavoritesOnly = (typeof showFavoritesOnly === 'boolean') ? showFavoritesOnly : false;

      // Load cover art settings
      const coverArtSettings = this.safeLocalStorageGet('coverArtSettings');
      if (coverArtSettings) {
        Object.assign(this.data.coverArtSettings, coverArtSettings);
      }
    } catch (error) {
      if (this.notificationSystem) {
        this.notificationSystem.error('Error loading saved data');
      }
    }
  }

  saveToStorage() {
    try {
      // Save all critical data
      this.safeLocalStorageSet('favoriteTracks', this.data.favoriteTracks);
      this.safeLocalStorageSet('playlists', this.data.playlists);
      this.safeLocalStorageSet('currentPlaylist', this.data.currentPlaylist);
      this.safeLocalStorageSet('trackTags', this.data.trackTags);
      this.safeLocalStorageSet('moodVibeTags', this.data.moodVibeTags);
      this.safeLocalStorageSet('energyLevels', this.data.energyLevels);
      this.safeLocalStorageSet('smartPlaylists', this.data.smartPlaylists);
      this.safeLocalStorageSet('themePreference', this.data.themePreference);
      this.safeLocalStorageSet('accentColor', this.data.accentColor);
      this.safeLocalStorageSet('waveformStyle', this.data.waveformStyle);
      this.safeLocalStorageSet('showFavoritesOnly', this.data.showFavoritesOnly);
      this.safeLocalStorageSet('coverArtSettings', this.data.coverArtSettings);

      return true;
    } catch (error) {
      if (this.notificationSystem) {
        this.notificationSystem.error('Error saving data');
      }
      return false;
    }
  }

  clearCache() {
    this.cache.filterResults.clear();
    this.cache.sortResults.clear();
  }
}

// ============= TRACK PROCESSOR =============
class TrackProcessor {
  static processTracklist(text, fileName) {
    const lines = text.split('\n').filter(line => line.trim());

    // Check if this is CSV format (has header)
    const isCSV = fileName.toLowerCase().endsWith('.csv') && lines[0].includes(',');

    if (isCSV) {
      return this.parseCSV(lines);
    } else {
      // Legacy dash-separated format
      return this.parseDashSeparated(lines);
    }
  }

  static parseCSV(lines) {
    const grouped = {};
    const duplicateTracks = [];
    const tracksForUI = [];
    const energyLevels = {};
    const allFileKeys = new Set();

    if (lines.length < 2) return { grouped, totalTracks: 0, duplicateTracks, tracksForUI, energyLevels };

    // Parse header to get column indices
    const header = this.parseCSVLine(lines[0]);
    const columnMap = {};
    header.forEach((col, index) => {
      columnMap[col.toLowerCase()] = index;
    });

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const track = this.parseCSVTrack(lines[i], columnMap);
        if (!track) continue;

        const fileKey = track.display;

        // Check for duplicates
        if (allFileKeys.has(fileKey)) {
          duplicateTracks.push(track);
          continue;
        }

        allFileKeys.add(fileKey);

        // Store energy level if found
        if (track.energyLevel) {
          energyLevels[fileKey] = track.energyLevel;
        }

        // Group by artist
        if (!grouped[track.artist]) {
          grouped[track.artist] = [];
        }
        grouped[track.artist].push(track);
        tracksForUI.push(track);

      } catch (error) {
        // Skip invalid lines
      }
    }

    return {
      grouped,
      totalTracks: tracksForUI.length,
      duplicateTracks,
      tracksForUI,
      energyLevels
    };
  }

  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  static parseCSVTrack(line, columnMap) {
    const values = this.parseCSVLine(line);

    const getColumn = (name) => {
      const index = columnMap[name.toLowerCase()];
      return index !== undefined ? values[index] || '' : '';
    };

    const artist = SecurityUtils.sanitizeText(getColumn('artist'));
    const title = SecurityUtils.sanitizeText(getColumn('title'));

    if (!artist || !title) return null;

    const track = {
      artist,
      title,
      key: SecurityUtils.sanitizeText(getColumn('key')),
      bpm: SecurityUtils.sanitizeText(getColumn('bpm')),
      trackTime: SecurityUtils.sanitizeText(getColumn('duration')),
      year: SecurityUtils.sanitizeText(getColumn('year')),
      absPath: SecurityUtils.sanitizeText(getColumn('path')),
      genre: SecurityUtils.sanitizeText(getColumn('genre')),
      recordLabel: SecurityUtils.sanitizeText(getColumn('label')),
      energyLevel: null
    };

    // Parse energy level
    const energyText = getColumn('energy');
    if (energyText) {
      const energyMatch = energyText.match(/Energy\s+(\d+)/i);
      if (energyMatch) {
        const energyValue = parseInt(energyMatch[1], 10);
        if (energyValue >= 1 && energyValue <= 10) {
          track.energyLevel = energyValue;
        }
      }
    }

    // Create display name
    track.display = `${track.artist} - ${track.title}`;
    track.filename = track.display;

    return track;
  }

  static parseDashSeparated(lines) {
    const grouped = {};
    const duplicateTracks = [];
    const tracksForUI = [];
    const energyLevels = {};
    const allFileKeys = new Set();

    lines.forEach((line, index) => {
      try {
        const track = this.parseLine(line, index + 1);
        if (!track) return;

        const fileKey = track.display;

        // Check for duplicates
        if (allFileKeys.has(fileKey)) {
          duplicateTracks.push(track);
          return;
        }

        allFileKeys.add(fileKey);

        // Store energy level if found
        if (track.energyLevel) {
          energyLevels[fileKey] = track.energyLevel;
        }

        // Group by artist
        if (!grouped[track.artist]) {
          grouped[track.artist] = [];
        }
        grouped[track.artist].push(track);
        tracksForUI.push(track);

      } catch (error) {
        // Skip invalid lines
      }
    });

    return {
      grouped,
      totalTracks: tracksForUI.length,
      duplicateTracks,
      tracksForUI,
      energyLevels
    };
  }

  static parseLine(line, lineNumber) {
    const parts = line.split(' - ');
    if (parts.length < 4) return null;

    const track = {
      artist: SecurityUtils.sanitizeText(parts[0] || ''),
      title: SecurityUtils.sanitizeText(parts[1] || ''),
      key: SecurityUtils.sanitizeText(parts[2] || ''),
      bpm: SecurityUtils.sanitizeText(parts[3]?.split('.')[0] || ''),
      trackTime: SecurityUtils.sanitizeText(parts[4] || ''),
      year: SecurityUtils.sanitizeText(parts[5] || ''),
      absPath: SecurityUtils.sanitizeText(parts[6] || ''),
      genre: SecurityUtils.sanitizeText(parts[7] || ''),
      recordLabel: SecurityUtils.sanitizeText(parts[9] || ''),
      energyLevel: null
    };

    // Parse energy level from parts[8] if it exists
    if (parts[8]) {
      const energyMatch = parts[8].match(/Energy\s+(\d+)/i);
      if (energyMatch) {
        const energyValue = parseInt(energyMatch[1], 10);
        if (energyValue >= 1 && energyValue <= 10) {
          track.energyLevel = energyValue;
        }
      }
    }

    // Create display name
    track.display = `${track.artist} - ${track.title}`;
    track.filename = track.display;

    return track;
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
    this.errorHandler = new ErrorHandler(this.notificationSystem);
    this.appState = new ApplicationState(this.notificationSystem, this.errorHandler);
    this.rateLimiter = new RateLimiter();
    this.audioManager = new AudioManager(this.notificationSystem);
    this.renderer = new UIRenderer(this.appState);
    this.controller = new UIController(this.appState, this.renderer, this.audioManager, this.notificationSystem, this.rateLimiter, TrackProcessor, SecurityUtils);
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

      // Populate filter dropdowns with track metadata
      this.controller.populateFilterDropdowns();

      // Update playlist selector with available playlists
      this.controller.updatePlaylistSelector();

      // Start visualizer
      this.visualizer.start();

      // Set visualizer reference in AudioManager for waveform access
      this.audioManager.setVisualizer(this.visualizer);

      // Set visualizer reference in UI Controller for waveform style control
      this.controller.setVisualizer(this.visualizer);

      // Initial render
      this.renderer.render();

      // Set up periodic memory optimization
      this.setupMemoryOptimization();

      // Add testing utilities to window object for development
      if (typeof window !== 'undefined') {
        window.beatroveApp = this;
        window.app = this; // For compatibility
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

        // Warn if memory usage is high
        if (used > limit * 0.8) {
          this.notificationSystem.warning('High memory usage detected. Consider refreshing the page.');
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async loadDefaultTracklist() {
    return this.errorHandler.safeAsync(async () => {
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
      }
    }, {
      component: 'BeatroveApp',
      method: 'loadDefaultTracklist',
      operation: 'default tracklist loading',
      showUser: false,
      logToConsole: false,
      fallbackValue: null
    });
  }

  cleanup() {
    // Clean up visualizer
    this.visualizer.cleanup();

    // Clean up audio manager
    this.audioManager.cleanup();

    // Clean up controller
    this.controller.cleanup();

    // Save state before cleanup
    this.appState.saveToStorage();
  }
}

// ============= APPLICATION INITIALIZATION =============
const app = new BeatroveApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}

// Comprehensive cleanup event handlers
window.addEventListener('beforeunload', () => {
  app.cleanup();
});

window.addEventListener('pagehide', () => {
  app.cleanup();
});

// Export for global access
window.app = app;