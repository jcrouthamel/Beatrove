/**
 * Beatrove - EDM Track Manager
 * Refactored for security, performance, and maintainability
 * Version: 2.0.0
 */

'use strict';

// ============= CONFIGURATION =============
const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TAG_LENGTH: 50,
  MIN_BPM: 60,
  MAX_BPM: 200,
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  ALLOWED_FILE_EXTENSIONS: ['.csv', '.txt', '.yaml', '.yml'],
  ALLOWED_AUDIO_EXTENSIONS: ['.mp3', '.wav', '.flac', '.ogg', '.aiff'],
  DEBOUNCE_DELAY: 300,
  CACHE_SIZE_LIMIT: 50
};

// ============= SECURITY UTILITIES =============
class SecurityUtils {
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
  constructor() {
    this.elements = {};
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
        favoriteTracks: localStorage.getItem('favoriteTracks'),
        playlists: localStorage.getItem('playlists'),
        currentPlaylist: localStorage.getItem('currentPlaylist')
      };

      if (stored.trackTags) this.data.trackTags = JSON.parse(stored.trackTags);
      if (stored.favoriteTracks) this.data.favoriteTracks = JSON.parse(stored.favoriteTracks);
      if (stored.playlists) this.data.playlists = JSON.parse(stored.playlists);
      if (stored.currentPlaylist) this.data.currentPlaylist = stored.currentPlaylist;
    } catch (error) {
      console.error('Error loading stored data:', error);
      this.resetData();
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem('trackTags', JSON.stringify(this.data.trackTags));
      localStorage.setItem('favoriteTracks', JSON.stringify(this.data.favoriteTracks));
      localStorage.setItem('playlists', JSON.stringify(this.data.playlists));
      localStorage.setItem('currentPlaylist', this.data.currentPlaylist);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  resetData() {
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
    this.pendingPreviewTrack = null;
    this.notificationSystem = notificationSystem;
  }

  createBlobUrl(file) {
    const url = URL.createObjectURL(file);
    this.blobUrls.add(url);
    return url;
  }

  cleanup() {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls.clear();

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
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElem);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.reactToAudio = true;
      await this.audioCtx.resume();
    } catch (error) {
      console.error('Failed to connect audio visualizer:', error);
      this.disconnectVisualizer();
    }
  }

  async playPreview(track) {
    try {
      if (!track.absPath) {
        throw new Error('No file path for this track');
      }

      const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();
      const file = this.fileMap[fileName];
      
      if (!file) {
        throw new Error(`Audio file not found: ${fileName}`);
      }

      if (!SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        throw new Error('Unsupported audio file type');
      }

      // Clean up previous audio
      if (this.currentAudio) {
        this.disconnectVisualizer();
        if (this.currentAudio.parentElement) {
          this.currentAudio.parentElement.remove();
        }
        this.currentAudio = null;
      }

      const url = this.createBlobUrl(file);
      
      // Create container
      const container = document.createElement('div');
      container.className = 'audio-player-container';
      
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
      container.appendChild(audio);

      document.body.appendChild(container);
      this.currentAudio = audio;

      // Set up event handlers
      audio.addEventListener('ended', () => {
        this.disconnectVisualizer();
        container.remove();
        this.currentAudio = null;
        URL.revokeObjectURL(url);
        this.blobUrls.delete(url);
      });

      audio.addEventListener('pause', () => {
        this.disconnectVisualizer();
      });

      audio.addEventListener('error', () => {
        if (this.notificationSystem) {
          this.notificationSystem.error('Error playing audio file');
        }
        container.remove();
        this.currentAudio = null;
        URL.revokeObjectURL(url);
        this.blobUrls.delete(url);
      });

      await this.connectVisualizer(audio);
    } catch (error) {
      console.error('Preview error:', error);
      if (this.notificationSystem) {
        this.notificationSystem.error(error.message);
      }
    }
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
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid file content');
    }

    // Skip validation for auto-loaded files
    if (fileName !== 'tracklist.csv' && 
        !SecurityUtils.validateFileExtension(fileName, CONFIG.ALLOWED_FILE_EXTENSIONS)) {
      throw new Error('Invalid file type');
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

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

      // Duplicate detection
      const duplicateKey = `${track.artist}-${track.title}-${track.key}-${track.bpm}`;
      if (seenTracks.has(duplicateKey)) {
        const original = seenTracks.get(duplicateKey)[0];
        if (!result.duplicateTracks.includes(original)) {
          result.duplicateTracks.push(original);
        }
        result.duplicateTracks.push(trackObj);
      } else {
        seenTracks.set(duplicateKey, [trackObj]);
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
      tagSearch: document.getElementById('tag-dropdown')?.value.toLowerCase() || '',
      sortValue: this.appState.elements.sortSelect?.value || 'name-asc',
      yearSearch: document.getElementById('year-search')?.value.trim(),
      showFavoritesOnly: this.appState.data.showFavoritesOnly
    };
  }

  hasActiveFilters(filters) {
    return filters.search || filters.selectedBPM || filters.selectedKey || 
           filters.selectedGenre || filters.tagSearch || filters.yearSearch || 
           filters.showFavoritesOnly;
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
    const details = [
      { label: 'Key', value: track.key },
      { label: 'BPM', value: track.bpm },
      { label: 'Genre', value: track.genre },
      { label: 'Length', value: track.trackTime },
      { label: 'Year', value: track.year }
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
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    letters.forEach(letter => {
      const btn = document.createElement('button');
      btn.textContent = letter;
      btn.className = 'az-letter';
      btn.dataset.letter = letter;
      azBar.appendChild(btn);
    });
  }

  jumpToArtist(letter) {
    const tracks = document.querySelectorAll('.track');
    for (const track of tracks) {
      const artist = track.dataset.artist || '';
      if (artist.toUpperCase().startsWith(letter)) {
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
  constructor(appState, renderer, audioManager, notificationSystem) {
    this.appState = appState;
    this.renderer = renderer;
    this.audioManager = audioManager;
    this.notificationSystem = notificationSystem;
    this.tagPopup = null;
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
    const filters = ['search', 'bpm-filter', 'key-filter', 'genre-filter', 'sort-select', 'year-search', 'tag-dropdown'];
    
    filters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.render());
        if (id === 'search' || id === 'year-search') {
          element.addEventListener('input', debounce(() => this.render(), CONFIG.DEBOUNCE_DELAY));
        }
      }
    });
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

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.checked = document.body.classList.contains('light-mode');
      themeToggle.addEventListener('change', (e) => {
        document.body.classList.toggle('light-mode', e.target.checked);
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

    // Editable title
    const title = document.getElementById('editable-title');
    if (title) {
      title.addEventListener('blur', () => {
        this.validateAndSaveTitle(title);
      });
      
      title.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const sanitized = SecurityUtils.sanitizeText(paste);
        document.execCommand('insertText', false, sanitized);
      });

      title.addEventListener('input', () => {
        this.validateTitleInput(title);
      });
      
      const savedTitle = localStorage.getItem('appTitle');
      if (savedTitle) {
        const sanitizedTitle = SecurityUtils.sanitizeText(savedTitle);
        title.textContent = sanitizedTitle;
      }
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
    // Remove existing popup
    if (this.tagPopup) {
      this.tagPopup.remove();
      this.tagPopup = null;
    }

    const popup = document.createElement('div');
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

    // Event handlers
    saveBtn.addEventListener('click', () => {
      const tags = input.value.split(',')
        .map(t => t.trim())
        .filter(t => SecurityUtils.validateTag(t));
      
      this.appState.data.trackTags[track.display] = tags;
      this.appState.saveToStorage();
      this.updateTagDropdown();
      popup.remove();
      this.tagPopup = null;
      this.render();
    });

    cancelBtn.addEventListener('click', () => {
      popup.remove();
      this.tagPopup = null;
    });

    // Close on outside click
    setTimeout(() => {
      const handler = (e) => {
        if (!popup.contains(e.target)) {
          popup.remove();
          this.tagPopup = null;
          document.removeEventListener('mousedown', handler);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 10);
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

    try {
      const text = await this.readFile(file);
      const result = TrackProcessor.processTracklist(text, file.name);

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
    const loaded = this.audioManager.loadAudioFiles(files);
    
    if (loaded > 0) {
      this.notificationSystem.success(`Loaded ${loaded} audio files. You can now preview tracks.`);
      if (this.audioManager.pendingPreviewTrack) {
        this.audioManager.playPreview(this.audioManager.pendingPreviewTrack);
        this.audioManager.pendingPreviewTrack = null;
      }
    } else {
      this.notificationSystem.warning('No valid audio files found');
    }
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

  // === Title Validation ===
  validateTitleInput(titleElement) {
    const content = titleElement.textContent;
    const maxLength = 100;
    
    // Remove any HTML tags that might have been pasted
    const cleanContent = content.replace(/<[^>]*>/g, '');
    
    // Limit length
    if (cleanContent.length > maxLength) {
      const truncated = cleanContent.substring(0, maxLength);
      titleElement.textContent = truncated;
      
      // Position cursor at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(titleElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  validateAndSaveTitle(titleElement) {
    const content = titleElement.textContent.trim();
    
    // Sanitize content
    const sanitized = SecurityUtils.sanitizeText(content);
    
    // Validate length and content
    if (sanitized.length === 0) {
      titleElement.textContent = 'DJ Total Kaos - EDM Bangers'; // Default title
      localStorage.setItem('appTitle', titleElement.textContent);
      return;
    }
    
    if (sanitized.length > 100) {
      const truncated = sanitized.substring(0, 100).trim();
      titleElement.textContent = truncated;
      localStorage.setItem('appTitle', truncated);
      return;
    }
    
    // Update if content changed after sanitization
    if (titleElement.textContent !== sanitized) {
      titleElement.textContent = sanitized;
    }
    
    localStorage.setItem('appTitle', sanitized);
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
    this.appState = new ApplicationState();
    this.notificationSystem = new NotificationSystem();
    this.audioManager = new AudioManager(this.notificationSystem);
    this.renderer = new UIRenderer(this.appState);
    this.controller = new UIController(this.appState, this.renderer, this.audioManager, this.notificationSystem);
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
      container: document.getElementById('columns'),
      statsElement: document.getElementById('stats'),
      sortSelect: document.getElementById('sort-select')
    };
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
    this.visualizer.stop();
    this.audioManager.cleanup();
    this.appState.saveToStorage();
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => app.cleanup());
window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    app.audioManager.cleanup();
  }
});

// Add style for highlight effect
const style = document.createElement('style');
style.textContent = '.az-jump-highlight { outline: 3px solid #2196f3; transition: outline 0.2s; }';
document.head.appendChild(style);