/**
 * Beatrove - UI Renderer Module
 * Handles rendering of tracks, filters, pagination, and UI components
 */

'use strict';

import { CONFIG, SecurityUtils } from '../core/security-utils.js';
import { FuzzySearchUtils } from '../core/fuzzy-search.js';
import { FilterManager } from '../core/filter-manager.js';
import { BlobManager } from '../core/blob-manager.js';
import { ErrorHandler } from '../core/error-handler.js';

// ============= UI RENDERER =============
export class UIRenderer {
  constructor(appState) {
    this.appState = appState;
    this.azBarActive = null;

    // Pagination state
    this.currentPage = 1;
    this.tracksPerPage = 100;
    this.totalTracks = 0;
    this.totalPages = 1;
    this.currentFilteredTracks = [];

    // Image file map for cover art
    this.imageFileMap = {};

    // Initialize centralized filter manager
    this.filterManager = new FilterManager(this);

    // Initialize error handler
    this.errorHandler = new ErrorHandler();

    // Initialize blob manager for image URLs
    this.blobManager = new BlobManager();

    // Cache for A-Z bar optimization
    this.azBarCache = {
      lastAvailableInitials: new Set(),
      elementsMap: new Map() // Maps letter -> DOM element
    };
  }

  render() {
    const filters = this.getActiveFilters();
    let filteredTracks = this.filterTracks(filters);

    // Apply smart playlist filtering if a smart playlist is selected
    const currentPlaylist = this.appState.data.currentPlaylist;
    if (currentPlaylist && typeof currentPlaylist === 'string' && currentPlaylist.startsWith('smart:')) {
      const smartPlaylistName = currentPlaylist.replace('smart:', '');
      const smartPlaylist = this.appState.data.smartPlaylists?.[smartPlaylistName];

      if (smartPlaylist) {
        // Apply smart playlist rules to the already filtered tracks
        filteredTracks = this.filterTracksBySmartRules(filteredTracks, smartPlaylist.rules, smartPlaylist.logic);
      }
    }

    const sortedTracks = this.sortTracks(filteredTracks, filters.sortValue);

    // Store filtered tracks for pagination
    this.currentFilteredTracks = sortedTracks;
    this.totalTracks = sortedTracks.length;
    this.totalPages = this.tracksPerPage === Infinity ? 1 : Math.ceil(this.totalTracks / this.tracksPerPage);

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

    // If showing all tracks, return all filtered tracks
    if (this.tracksPerPage === Infinity) {
      return this.currentFilteredTracks;
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
  }

  goToPage(page) {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.render();
  }

  setTracksPerPage(tracksPerPage) {
    // Update filter manager if A-Z filter is active and pagination changes
    this.filterManager.updatePaginationDuringAZFilter(tracksPerPage);

    if (tracksPerPage === 'all') {
      this.tracksPerPage = Infinity; // Show all tracks
      this.appState.data.tracksPerPage = 'all';
    } else {
      this.tracksPerPage = parseInt(tracksPerPage);
      this.appState.data.tracksPerPage = parseInt(tracksPerPage);
    }
    this.appState.saveToStorage();
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
      showFavoritesOnly: this.appState.data.showFavoritesOnly || false,
      azFilter: this.filterManager.getAZFilterState()
    };

    return filters;
  }

  hasActiveFilters(filters) {
    return filters.search || filters.selectedBPM || filters.selectedKey ||
           filters.selectedGenre || filters.selectedEnergy || filters.selectedLabel ||
           filters.tagSearch || filters.yearSearch || filters.showFavoritesOnly ||
           filters.azFilter;
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
      const decodedDisplay = SecurityUtils.safeUnescapeForComparison(track.display);
      if (filters.showFavoritesOnly && !this.appState.data.favoriteTracks[decodedDisplay]) {
        return false;
      }

      // Year filter
      if (yearMin !== null && yearMax !== null) {
        const trackYear = parseInt(track.year, 10);
        if (isNaN(trackYear) || trackYear < yearMin || trackYear > yearMax) return false;
      }

      // A-Z filter
      if (filters.azFilter) {
        const artistFirstChar = this.normalizeFirstCharacter(track.artist || '');

        if (filters.azFilter === 'numbers' && artistFirstChar !== 'numbers') return false;
        if (filters.azFilter === 'symbols' && artistFirstChar !== 'symbols') return false;
        if (filters.azFilter.length === 1 && artistFirstChar !== filters.azFilter) return false;
      }

      return true;
    });

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
    if (!container) {
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
        const trackElement = this.createTrackElement(track);
        if (trackElement) {
          groupDiv.appendChild(trackElement);
          totalRendered++;
        }
      });

      fragment.appendChild(groupDiv);
    });

    container.appendChild(fragment);
  }

  cleanupTrackElements(container) {
    return this.errorHandler.safe(() => {
      // Batch DOM queries for performance
      const existingTracks = container.querySelectorAll('.track');
      const coverArtImages = container.querySelectorAll('.cover-art-img[data-blob-url]');
      const audioElements = container.querySelectorAll('audio');

      // Clean up blob URLs for cover art images
      coverArtImages.forEach(img => {
        if (img.dataset.blobUrl) {
          this.blobManager.removeReference(img.dataset.blobUrl);
          // Clean up any load/error event listeners
          img.onload = null;
          img.onerror = null;
          delete img.dataset.blobUrl;
        }
      });

      // Clean up audio elements and their event listeners
      audioElements.forEach(audio => {
        // Remove all audio event listeners by cloning the element
        const cleanAudio = audio.cloneNode(false);
        if (audio.parentNode) {
          audio.parentNode.replaceChild(cleanAudio, audio);
        }
        // Cleanup audio resources
        audio.pause();
        audio.src = '';
        audio.load();
      });

      // Clean up any ResizeObserver instances (if any)
      existingTracks.forEach(track => {
        if (track._resizeObserver) {
          track._resizeObserver.disconnect();
          delete track._resizeObserver;
        }

        // Clean up any Intersection Observer instances
        if (track._intersectionObserver) {
          track._intersectionObserver.disconnect();
          delete track._intersectionObserver;
        }

        // Clean up any custom event listeners stored as properties
        const elementsWithListeners = track.querySelectorAll('[data-has-listeners]');
        elementsWithListeners.forEach(element => {
          if (element._eventListeners) {
            element._eventListeners.forEach(({event, handler}) => {
              element.removeEventListener(event, handler);
            });
            delete element._eventListeners;
          }
          element.removeAttribute('data-has-listeners');
        });
      });

      // Efficient container clearing using modern DOM API
      container.replaceChildren();

      // Force garbage collection hint and cleanup
      if (window.gc) {
        requestIdleCallback(() => window.gc());
      }
    }, {
      component: 'UIRenderer',
      method: 'cleanupTrackElements',
      operation: 'track element cleanup',
      showUser: false
    });
  }

  createTrackElement(track) {
    // Safety check - ensure track has required properties
    if (!track || typeof track !== 'object') {
      return null;
    }

    // Ensure display property exists
    if (!track.display) {
      track.display = `${track.artist || 'Unknown'} - ${track.title || 'Unknown'}`;
    }

    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';

    const decodedTrackDisplay = SecurityUtils.safeUnescapeForComparison(track.display);
    if (this.appState.data.favoriteTracks[decodedTrackDisplay]) {
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

    // Main content container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'track-main-container';

    // Cover art (if enabled)
    if (this.appState.data.coverArtSettings && this.appState.data.coverArtSettings.showCoverArt) {
      const coverArtContainer = this.createCoverArtElement(track);
      if (coverArtContainer) {
        mainContainer.appendChild(coverArtContainer);
      }
    }

    // Track info container
    const nameContainer = document.createElement('div');
    nameContainer.className = 'track-info-container';

    const trackMain = SecurityUtils.createSafeElement('span',
      `${track.artist} - ${track.title}`, 'track-main');
    nameContainer.appendChild(trackMain);

    // Details
    const trackKey = track.display || track.filename || `${track.artist} - ${track.title}`;
    const energyLevel = this.appState.data.energyLevels[trackKey];
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

    // Append track info to main container
    mainContainer.appendChild(nameContainer);

    // Icons row
    const iconRow = this.createIconRow(track);

    trackDiv.appendChild(mainContainer);
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

  createCoverArtElement(track) {
    const coverArtContainer = document.createElement('div');
    coverArtContainer.className = 'track-cover-art';

    const coverArtImg = document.createElement('img');
    coverArtImg.className = 'cover-art-image';

    // Try to find cover art for this track
    const coverArtPath = this.resolveCoverArtPath(track);

    if (coverArtPath) {
      // Always load cover art fresh to avoid revoked blob URL issues
      this.loadCoverArt(coverArtPath, coverArtImg);
    } else {
      // Show placeholder
      coverArtImg.src = this.createPlaceholderDataUrl();
      coverArtImg.classList.add('placeholder');
    }

    coverArtImg.alt = `Cover art for ${track.artist} - ${track.title}`;
    coverArtImg.title = `Cover art for ${track.artist} - ${track.title}`;

    // Error handling
    coverArtImg.onerror = () => {
      coverArtImg.src = this.createPlaceholderDataUrl();
      coverArtImg.classList.add('placeholder');
    };

    coverArtContainer.appendChild(coverArtImg);
    return coverArtContainer;
  }

  createIconRow(track) {
    const iconRow = document.createElement('div');
    iconRow.className = 'track-icons-row';

    // Star button
    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn';
    starBtn.dataset.trackDisplay = track.display;
    // Use decoded track display for favorites check to handle HTML entities
    const decodedTrackDisplay = SecurityUtils.safeUnescapeForComparison(track.display);

    if (this.appState.data.favoriteTracks[decodedTrackDisplay]) {
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

  // === Cover Art Methods ===
  resolveCoverArtPath(track) {
    if (!this.appState.data.coverArtSettings.audioFolderPath) {
      return null;
    }

    const artworkDir = this.appState.data.coverArtSettings.artworkDirectory;
    const basePath = this.appState.data.coverArtSettings.audioFolderPath;

    // Try simplified format first: Artist - Title.extension (new format)
    const simplifiedName = `${track.artist} - ${track.title}`;
    const cleanSimplifiedName = simplifiedName.replace(/[<>:"/\\|?*]/g, '_');

    // Try full filename format: Artist - Title - Key - BPM.extension (legacy format)
    const trackFilename = track.filename || track.display;
    const fullFilename = trackFilename.replace(/\.[^/.]+$/, ''); // Remove extension

    // Generate possible cover art paths in priority order
    const possiblePaths = [
      // New simplified format (preferred)
      `${basePath}/${artworkDir}/${cleanSimplifiedName}.jpg`,
      `${basePath}/${artworkDir}/${cleanSimplifiedName}.jpeg`,
      `${basePath}/${artworkDir}/${cleanSimplifiedName}.png`,
      `${basePath}/${artworkDir}/${cleanSimplifiedName}.webp`,
      // Legacy full filename format (backward compatibility)
      `${basePath}/${artworkDir}/${fullFilename}.jpg`,
      `${basePath}/${artworkDir}/${fullFilename}.jpeg`,
      `${basePath}/${artworkDir}/${fullFilename}.png`,
      `${basePath}/${artworkDir}/${fullFilename}.webp`
    ];

    // For now, return the first possible path (we'll check if it exists during loading)
    return possiblePaths[0];
  }

  async loadCoverArt(coverArtPath, imgElement) {
    return this.errorHandler.safeAsync(async () => {
      // Check if we have the cover art file in our audio manager's file map
      const coverArtFile = this.findCoverArtFile(coverArtPath);

      if (coverArtFile) {
        // Create blob URL for the file using BlobManager
        const blobUrl = this.blobManager.createImageBlobUrl(coverArtFile);
        imgElement.src = blobUrl;

        // Add reference to prevent cleanup while image is loading/displayed
        this.blobManager.addReference(blobUrl);
        imgElement.dataset.blobUrl = blobUrl;

        // Set up cleanup when image is no longer needed
        imgElement.addEventListener('load', () => {
          // Remove reference after successful load
          this.blobManager.removeReference(blobUrl);
        }, { once: true });

        imgElement.addEventListener('error', () => {
          // Clean up on error
          this.blobManager.removeReference(blobUrl);
          this.blobManager.revokeBlobUrl(blobUrl);
        }, { once: true });
      } else {
        imgElement.src = this.createPlaceholderDataUrl();
        imgElement.classList.add('placeholder');
      }
    }, {
      component: 'UIRenderer',
      method: 'loadCoverArt',
      fallbackValue: (() => {
        imgElement.src = this.createPlaceholderDataUrl();
        imgElement.classList.add('placeholder');
      })(),
      operation: 'cover art loading',
      showUser: false
    });
  }

  findCoverArtFile(coverArtPath) {
    // Extract the expected filename from the path
    const filename = coverArtPath.split('/').pop();

    // Check if we have any files in the audio manager
    if (this.audioManager && this.audioManager.fileMap) {
      // Look for the exact filename in the fileMap
      for (const [filePath, file] of Object.entries(this.audioManager.fileMap)) {
        const filePathParts = filePath.split('/');
        const actualFilename = filePathParts[filePathParts.length - 1];

        if (actualFilename === filename) {
          return file;
        }
      }
    }

    // Also check if we have any image files stored separately
    if (this.imageFileMap) {
      for (const [filePath, file] of Object.entries(this.imageFileMap)) {
        const filePathParts = filePath.split('/');
        const actualFilename = filePathParts[filePathParts.length - 1];

        if (actualFilename === filename) {
          return file;
        }
      }
    }

    return null;
  }

  createPlaceholderDataUrl() {
    // Create a simple SVG placeholder for cover art
    const svg = `
      <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="150" height="150" fill="#2a2a2a"/>
        <g fill="#555" stroke="none">
          <circle cx="75" cy="60" r="20"/>
          <rect x="55" y="85" width="40" height="3" rx="1"/>
          <rect x="60" y="92" width="30" height="2" rx="1"/>
          <rect x="65" y="98" width="20" height="2" rx="1"/>
        </g>
        <text x="75" y="125" font-family="Arial, sans-serif" font-size="12" fill="#777" text-anchor="middle">No Cover</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  updateCoverArtDirectory(directoryPath) {
    if (directoryPath) {
      this.appState.data.coverArtSettings.audioFolderPath = directoryPath;
      // Ensure we're using the correct artwork directory from config
      this.appState.data.coverArtSettings.artworkDirectory = CONFIG.COVER_ART.DIRECTORY;

      this.appState.saveToStorage();

      // Re-render tracks if cover art is currently shown
      if (this.appState.data.coverArtSettings && this.appState.data.coverArtSettings.showCoverArt) {
        this.render();
      }
    }
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

    // Clear container efficiently by removing children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const noResults = SecurityUtils.createSafeElement('div',
      'No tracks found matching your filters.', 'no-results');
    container.appendChild(noResults);
  }

  renderAZBar() {
    const azBar = document.getElementById('az-bar');
    if (!azBar) return;

    // Get current available initials
    const currentInitials = this.getAvailableArtistInitials();

    // Check if we need to rebuild (first time or initials changed)
    if (!this.azBarCache.lastAvailableInitials ||
        !this.setsEqual(this.azBarCache.lastAvailableInitials, currentInitials)) {

      this.rebuildAZBar(azBar, currentInitials);
      this.azBarCache.lastAvailableInitials = new Set(currentInitials);
    } else {
      // Just update visual state if content hasn't changed
      this.filterManager.updateAZBarVisualState();
    }
  }

  /**
   * Efficiently rebuild the A-Z bar when content changes
   */
  rebuildAZBar(azBar, availableInitials) {
    // Clear cache and DOM
    this.azBarCache.elementsMap.clear();
    while (azBar.firstChild) {
      azBar.removeChild(azBar.firstChild);
    }

    // Create and cache "ALL" button
    const allBtn = this.createAZButton('ALL', 'all', 'all', 'az-letter az-all');
    azBar.appendChild(allBtn);
    this.azBarCache.elementsMap.set('all', allBtn);

    // Build categories: Numbers, Letters, Symbols
    const categories = [
      { label: '#', type: 'numbers', chars: '0123456789' },
      { label: 'A-Z', type: 'letters', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
      { label: '★', type: 'symbols', chars: '' }
    ];

    // Use document fragment for efficient DOM operations
    const fragment = document.createDocumentFragment();

    categories.forEach(category => {
      if (category.type === 'letters') {
        // Individual letter buttons
        for (const char of category.chars) {
          if (availableInitials.has(char)) {
            const btn = this.createAZButton(char, char, 'letter', 'az-letter');
            fragment.appendChild(btn);
            this.azBarCache.elementsMap.set(char, btn);
          }
        }
      } else {
        // Category buttons for numbers and symbols
        const hasContent = category.type === 'numbers'
          ? Array.from(category.chars).some(char => availableInitials.has(char))
          : availableInitials.has('symbols');

        if (hasContent) {
          const btn = this.createAZButton(category.label, category.type, category.type, 'az-letter az-category');
          fragment.appendChild(btn);
          this.azBarCache.elementsMap.set(category.type, btn);
        }
      }
    });

    // Single DOM append for all elements
    azBar.appendChild(fragment);

    // Update visual state
    this.filterManager.updateAZBarVisualState();
  }

  /**
   * Create a standardized A-Z button element
   */
  createAZButton(text, letter, type, className) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = className;
    btn.dataset.letter = letter;
    btn.dataset.type = type;
    return btn;
  }

  /**
   * Efficiently compare two sets for equality
   */
  setsEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  /**
   * Clear A-Z bar cache (useful when data changes significantly)
   */
  clearAZBarCache() {
    this.azBarCache.lastAvailableInitials.clear();
    this.azBarCache.elementsMap.clear();
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
    this.filterManager.setAZFilter(letter);
  }

  clearAZFilter() {
    this.filterManager.clearAZFilter();
  }

  clearAZFilterOnly() {
    this.filterManager.clearAZFilterOnOtherFilterUse();
  }

  renderDuplicateList() {
    const container = document.getElementById('duplicate-content');
    if (!container) return;

    const duplicates = this.appState.data.duplicateTracks;
    if (!duplicates || duplicates.length === 0) {
      // Clear container efficiently by removing children
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
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

    // Clear container efficiently by removing children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
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