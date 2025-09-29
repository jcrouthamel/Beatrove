/**
 * Beatrove - UI Controller Module
 * Handles user interactions and event management
 */

'use strict';

import { ErrorHandler } from '../core/error-handler.js';

// ============= UI CONTROLLER =============
export class UIController {
  constructor(appState, renderer, audioManager, notificationSystem, rateLimiter, trackProcessor, securityUtils) {
    this.appState = appState;
    this.renderer = renderer;
    this.audioManager = audioManager;
    this.notificationSystem = notificationSystem;
    this.rateLimiter = rateLimiter;
    this.TrackProcessor = trackProcessor;
    this.SecurityUtils = securityUtils;
    this.visualizer = null; // Will be set after construction
    this.tagPopup = null;
    this.tagPopupClickHandler = null;
    this.moodVibePopup = null;
    this.moodVibePopupClickHandler = null;

    // Chart instances
    this.genreChart = null;
    this.bpmChart = null;
    this.keyChart = null;
    this.energyChart = null;
    this.labelsChart = null;

    // Initialize error handler
    this.errorHandler = new ErrorHandler(notificationSystem);

    // Track active event listeners for cleanup
    this.activeEventListeners = new Map(); // element -> [listeners]
  }

  attachEventListeners() {
    // Pagination controls
    this.setupPaginationControls();

    // Track interaction handlers
    this.setupTrackInteractions();

    // Filter and search handlers
    this.setupFilterHandlers();

    // Theme and settings handlers
    this.setupThemeHandlers();

    // File upload handlers
    this.setupFileHandlers();
  }

  setupPaginationControls() {
    // Top pagination
    const firstPageBtn = document.getElementById('first-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const lastPageBtn = document.getElementById('last-page-btn');

    if (firstPageBtn) firstPageBtn.addEventListener('click', () => this.renderer.goToPage(1));
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage - 1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage + 1));
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => this.renderer.goToPage(this.renderer.totalPages));

    // Bottom pagination
    const firstPageBtnBottom = document.getElementById('first-page-btn-bottom');
    const prevPageBtnBottom = document.getElementById('prev-page-btn-bottom');
    const nextPageBtnBottom = document.getElementById('next-page-btn-bottom');
    const lastPageBtnBottom = document.getElementById('last-page-btn-bottom');

    if (firstPageBtnBottom) firstPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(1));
    if (prevPageBtnBottom) prevPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage - 1));
    if (nextPageBtnBottom) nextPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.currentPage + 1));
    if (lastPageBtnBottom) lastPageBtnBottom.addEventListener('click', () => this.renderer.goToPage(this.renderer.totalPages));

    // Tracks per page selectors (top and bottom)
    const tracksPerPageSelectTop = document.getElementById('tracks-per-page-select');
    const tracksPerPageSelectBottom = document.getElementById('tracks-per-page-select-bottom');

    if (tracksPerPageSelectTop) {
      tracksPerPageSelectTop.addEventListener('change', (e) => {
        this.renderer.setTracksPerPage(e.target.value);
        // Sync the bottom dropdown
        if (tracksPerPageSelectBottom) {
          tracksPerPageSelectBottom.value = e.target.value;
        }
      });
    }

    if (tracksPerPageSelectBottom) {
      tracksPerPageSelectBottom.addEventListener('change', (e) => {
        this.renderer.setTracksPerPage(e.target.value);
        // Sync the top dropdown
        if (tracksPerPageSelectTop) {
          tracksPerPageSelectTop.value = e.target.value;
        }
      });
    }

    // Initialize tracks per page from storage or use default
    const savedTracksPerPage = this.appState.data.tracksPerPage || 100;
    if (tracksPerPageSelectTop) {
      tracksPerPageSelectTop.value = savedTracksPerPage;
    }
    if (tracksPerPageSelectBottom) {
      tracksPerPageSelectBottom.value = savedTracksPerPage;
    }
    this.renderer.setTracksPerPage(savedTracksPerPage);
  }

  setupTrackInteractions() {
    // Use event delegation for dynamic track elements
    const container = document.getElementById('columns');
    if (container) {
      container.addEventListener('click', (e) => {
        const target = e.target;

        // Star button
        if (target.classList.contains('star-btn')) {
          console.log('Star button clicked, trackDisplay:', target.dataset.trackDisplay);
          this.toggleFavorite(target.dataset.trackDisplay);
        }

        // Preview button
        else if (target.classList.contains('preview-btn')) {
          this.handlePreview(target.dataset.trackDisplay);
        }

        // Copy path button
        else if (target.classList.contains('folder-btn')) {
          this.copyToClipboard(target.dataset.path, 'Path copied to clipboard!');
        }

        // Copy track info button
        else if (target.classList.contains('copy-track-btn')) {
          this.copyTrackInfo(target.dataset.trackDisplay);
        }

        // Add to playlist button
        else if (target.classList.contains('add-playlist-btn')) {
          this.showPlaylistDialog(target.dataset.trackDisplay);
        }

        // Tag button
        else if (target.classList.contains('tag-btn')) {
          this.showTagDialog(target.dataset.trackDisplay);
        }

        // Tag remove button
        else if (target.classList.contains('tag-remove-btn')) {
          this.removeTag(target.dataset.trackDisplay, target.dataset.tagName);
        }

        // Mood & Vibe tag remove button
        else if (target.classList.contains('mood-vibe-remove-btn')) {
          this.removeMoodVibeTag(target.dataset.trackDisplay, target.dataset.tagName);
        }

        // Energy button
        else if (target.classList.contains('energy-btn')) {
          this.showEnergyDialog(target.dataset.trackDisplay, target);
        }

        // Mood & Vibe button
        else if (target.classList.contains('mood-vibe-btn')) {
          this.showMoodVibeInput(target.dataset.trackDisplay, target);
        }
      });
    }
  }

  setupFilterHandlers() {
    // Search input
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        // Clear A-Z filter when search is used
        this.renderer.clearAZFilterOnly();

        // Show/hide clear button based on input content
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
          if (searchInput.value.length > 0) {
            clearBtn.classList.add('visible');
          } else {
            clearBtn.classList.remove('visible');
          }
        }
        this.renderer.render();
      });
    }

    // Direct event listener for clear search button as backup
    const clearSearchBtn = document.getElementById('clear-search');
    console.log('Clear search button found:', clearSearchBtn);
    if (clearSearchBtn) {
      console.log('Adding direct click listener to clear search button');
      clearSearchBtn.addEventListener('click', (e) => {
        console.log('Direct clear search clicked');
        e.preventDefault();
        e.stopPropagation();
        const searchInput = document.getElementById('search');
        if (searchInput) {
          searchInput.value = '';
          clearSearchBtn.classList.remove('visible');
          this.renderer.render();
        }
      });
    }


    // Year search input
    const yearSearchInput = document.getElementById('year-search');
    if (yearSearchInput) {
      yearSearchInput.addEventListener('input', () => {
        this.renderer.clearAZFilterOnly();
        this.renderer.render();
      });
    }

    // Filter dropdowns
    const filterIds = ['bpm-filter', 'key-filter', 'genre-filter', 'energy-filter', 'label-filter'];
    filterIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.renderer.clearAZFilterOnly();
          this.renderer.render();
        });
      }
    });

    // Playlist selector
    const playlistSelector = document.getElementById('playlist-select');
    if (playlistSelector) {
      playlistSelector.addEventListener('change', (e) => {
        const selectedValue = e.target.value;

        // Update current playlist in app state
        this.appState.data.currentPlaylist = selectedValue;
        this.appState.saveToStorage();

        console.log('Playlist changed to:', selectedValue);

        // Update button states based on new selection
        this.updatePlaylistButtonStates();

        // Clear A-Z filter and re-render
        this.renderer.clearAZFilterOnly();
        this.renderer.render();
      });
    }

    // Sort selector
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.renderer.clearAZFilterOnly();
        this.renderer.render();
      });
    }

    // Duplicate tracks toggle button
    const duplicatesToggleBtn = document.getElementById('duplicates-toggle-btn');
    if (duplicatesToggleBtn) {
      duplicatesToggleBtn.addEventListener('click', () => {
        this.toggleDuplicatesView();
      });
    }

    // Library stats toggle button
    const statsToggleBtn = document.getElementById('stats-toggle-btn');
    if (statsToggleBtn) {
      statsToggleBtn.addEventListener('click', () => {
        this.toggleStatsView();
      });
    }

    // Favorites toggle button
    const favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
    if (favoritesToggleBtn) {
      favoritesToggleBtn.addEventListener('click', () => {
        this.toggleFavoritesFilter();
      });
    }

    // Cover art toggle button
    const coverArtBtn = document.getElementById('cover-art-toggle-btn');
    if (coverArtBtn) {
      coverArtBtn.addEventListener('click', () => {
        this.toggleCoverArt();
      });
    }

    // Filter drawer toggle button
    const filterDrawerBtn = document.getElementById('filter-drawer-btn');
    if (filterDrawerBtn) {
      filterDrawerBtn.addEventListener('click', () => {
        this.toggleFilterDrawer();
      });
    }

    // Export/Import buttons
    const exportTagsBtn = document.getElementById('export-tags');
    if (exportTagsBtn) {
      exportTagsBtn.addEventListener('click', () => {
        this.exportTags();
      });
    }

    const importTagsBtn = document.getElementById('import-tags-btn');
    if (importTagsBtn) {
      importTagsBtn.addEventListener('click', () => {
        document.getElementById('import-tags-input').click();
      });
    }

    const importTagsInput = document.getElementById('import-tags-input');
    if (importTagsInput) {
      importTagsInput.addEventListener('change', (e) => {
        this.handleImportTags(e);
      });
    }

    const exportAllBtn = document.getElementById('export-all');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => {
        this.exportAll();
      });
    }

    const importAllInput = document.getElementById('import-all-input');
    if (importAllInput) {
      importAllInput.addEventListener('change', (e) => {
        this.handleImportAll(e);
      });
    }

    // Playlist creation buttons
    const createPlaylistBtn = document.getElementById('create-playlist-btn');
    if (createPlaylistBtn) {
      createPlaylistBtn.addEventListener('click', () => {
        this.showCreatePlaylistDialog();
      });
    }

    const createSmartPlaylistBtn = document.getElementById('create-smart-playlist-btn');
    if (createSmartPlaylistBtn) {
      console.log('Smart playlist button found, adding event listener');
      createSmartPlaylistBtn.addEventListener('click', (e) => {
        console.log('Smart playlist button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.showSmartPlaylistModal();
      });
    } else {
      console.error('Create smart playlist button not found');
    }

    // Delete playlist button
    const deletePlaylistBtn = document.getElementById('delete-playlist-btn');
    if (deletePlaylistBtn) {
      console.log('Delete playlist button found, adding event listener');
      deletePlaylistBtn.addEventListener('click', (e) => {
        console.log('Delete playlist button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.deletePlaylist();
      });
    } else {
      console.error('Delete playlist button not found');
    }

    // Rename playlist button
    const renamePlaylistBtn = document.getElementById('rename-playlist-btn');
    if (renamePlaylistBtn) {
      renamePlaylistBtn.addEventListener('click', () => {
        this.renamePlaylist();
      });
    }

    // Export playlist button
    const exportPlaylistBtn = document.getElementById('export-playlist-btn');
    if (exportPlaylistBtn) {
      exportPlaylistBtn.addEventListener('click', () => {
        this.exportPlaylists();
      });
    }

    // Import playlist button and input
    const importPlaylistBtn = document.getElementById('import-playlists-btn');
    const importPlaylistInput = document.getElementById('import-playlists-input');
    if (importPlaylistBtn && importPlaylistInput) {
      importPlaylistBtn.addEventListener('click', () => {
        importPlaylistInput.click();
      });
      importPlaylistInput.addEventListener('change', (e) => {
        this.importPlaylists(e);
      });
    }

    // Global click handler for dynamic elements
    this.setupGlobalClickHandler();
    this.setupAZBarHandler();
  }

  setVisualizer(visualizer) {
    this.visualizer = visualizer;

    // Set initial waveform style from storage
    const savedWaveformStyle = this.appState.data.waveformStyle || 'default';
    if (this.visualizer && savedWaveformStyle) {
      this.visualizer.setWaveformStyle(savedWaveformStyle);
    }
  }

  setupThemeHandlers() {
    // Accent color selector
    const accentColorSelect = document.getElementById('accent-color-select');
    if (accentColorSelect) {
      accentColorSelect.addEventListener('change', () => {
        this.changeAccentColor(accentColorSelect.value);
      });

      // Set initial accent color from storage or default
      const savedAccentColor = this.appState.data.accentColor || 'red';
      accentColorSelect.value = savedAccentColor;
      this.changeAccentColor(savedAccentColor);
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        const isLightMode = themeToggle.checked;
        document.body.classList.toggle('light-mode', isLightMode);
        this.appState.data.themePreference = isLightMode ? 'light' : 'dark';
        this.appState.saveToStorage();
      });

      // Set initial theme from storage
      const savedTheme = this.appState.data.themePreference || 'dark';
      themeToggle.checked = savedTheme === 'light';
      document.body.classList.toggle('light-mode', savedTheme === 'light');
    }

    // Waveform style selector
    const waveformStyleSelect = document.getElementById('waveform-style-select');
    if (waveformStyleSelect) {
      waveformStyleSelect.addEventListener('change', (e) => {
        const newStyle = e.target.value;
        // Don't allow empty value
        if (newStyle && this.visualizer) {
          this.visualizer.setWaveformStyle(newStyle);
          this.appState.data.waveformStyle = newStyle;
          this.appState.saveToStorage();
          console.log('Waveform style changed to:', newStyle);
        }
      });

      // Set initial waveform style from storage
      const savedWaveformStyle = this.appState.data.waveformStyle || 'default';
      waveformStyleSelect.value = savedWaveformStyle;
    }
  }

  changeAccentColor(color) {
    // Define color mappings
    const colorMap = {
      'cyan': '#00ffff',
      'red': '#ff6b6b',
      'green': '#4ecdc4',
      'orange': '#ffa726'
    };

    const accentColor = colorMap[color] || colorMap['red'];

    // Update CSS custom property
    document.documentElement.style.setProperty('--accent-color', accentColor);

    // Create alpha version for hover effects
    const alphaColor = this.hexToRgba(accentColor, 0.2);
    document.documentElement.style.setProperty('--accent-color-alpha', alphaColor);

    // Create hover version (slightly lighter)
    const hoverColor = this.lightenColor(accentColor, 20);
    document.documentElement.style.setProperty('--accent-color-hover', hoverColor);

    // Save to storage
    this.appState.data.accentColor = color;
    this.appState.saveToStorage();
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  lightenColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  setupFileHandlers() {
    // File upload
    const fileInput = document.getElementById('tracklist-upload');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Audio folder input
    const audioFolderInput = document.getElementById('audio-folder-input');
    if (audioFolderInput) {
      audioFolderInput.addEventListener('change', (e) => this.handleAudioFolderUpload(e));
    }
  }

  // Helper methods
  toggleFavorite(trackDisplay) {
    console.log('toggleFavorite called with:', trackDisplay);
    // Decode HTML entities to ensure consistent storage keys
    const decodedTrackDisplay = this.SecurityUtils.safeUnescapeForComparison(trackDisplay);
    console.log('Decoded trackDisplay:', decodedTrackDisplay);

    if (this.appState.data.favoriteTracks[decodedTrackDisplay]) {
      delete this.appState.data.favoriteTracks[decodedTrackDisplay];
      console.log('Removed from favorites');
    } else {
      this.appState.data.favoriteTracks[decodedTrackDisplay] = true;
      console.log('Added to favorites');
    }
    console.log('Current favorites:', Object.keys(this.appState.data.favoriteTracks));
    this.appState.saveToStorage();
    this.renderer.render();
  }

  async handlePreview(trackDisplay) {
    const track = this.appState.data.tracksForUI.find(t => t.display === trackDisplay);
    if (track) {
      // Decode HTML entities in track data for proper filename matching
      const decodedTrack = {
        ...track,
        display: this.SecurityUtils.safeUnescapeForComparison(track.display),
        artist: this.SecurityUtils.safeUnescapeForComparison(track.artist),
        title: this.SecurityUtils.safeUnescapeForComparison(track.title),
        path: this.SecurityUtils.safeUnescapeForComparison(track.path)
      };

      // Check if audio files are loaded
      if (Object.keys(this.audioManager.fileMap).length === 0) {
        // Store pending track and trigger file input
        this.audioManager.pendingPreviewTrack = decodedTrack;
        document.getElementById('audio-folder-input')?.click();
      } else {
        await this.audioManager.playPreview(decodedTrack);
      }
    }
  }

  async copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    return this.errorHandler.safeAsync(async () => {
      await navigator.clipboard.writeText(text);
      if (this.notificationSystem) {
        this.notificationSystem.success(successMessage);
      }
    }, {
      component: 'UIController',
      method: 'copyToClipboard',
      operation: 'clipboard copying',
      fallbackValue: null
    });
  }

  copyTrackInfo(trackDisplay) {
    const track = this.appState.data.tracksForUI.find(t => t.display === trackDisplay);
    if (track) {
      const info = `${track.artist} - ${track.title} - ${track.key} - ${track.bpm} BPM`;
      this.copyToClipboard(info, 'Track info copied to clipboard!');
    }
  }

  showPlaylistDialog(trackDisplay) {
    return this.errorHandler.safe(() => {
      // Create modal for playlist selection
      const modal = document.createElement('div');
      modal.className = 'playlist-selection-modal';
      modal.innerHTML = `
        <div class="playlist-selection-dialog">
          <h3>Add Track to Playlist</h3>
          <div class="track-info">
            <strong>${trackDisplay}</strong>
          </div>
          <div class="playlist-options">
            <h4>Select Existing Playlist:</h4>
            <div class="existing-playlists" id="existing-playlists-list">
              <!-- Playlists will be populated here -->
            </div>
            <div class="new-playlist-section">
              <h4>Or Create New Playlist:</h4>
              <input type="text" id="new-playlist-name" placeholder="Enter new playlist name..." />
              <button id="create-new-playlist-btn" class="btn-create">Create & Add</button>
            </div>
          </div>
          <div class="playlist-dialog-buttons">
            <button id="cancel-playlist-btn" class="btn-cancel">Cancel</button>
          </div>
        </div>
      `;

      // Add styles
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      const dialog = modal.querySelector('.playlist-selection-dialog');
      dialog.style.cssText = `
        background: var(--bg-color, #1a1a1a);
        color: var(--text-color, #ffffff);
        padding: 2rem;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 70vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;

      // Style the sections
      const trackInfo = modal.querySelector('.track-info');
      trackInfo.style.cssText = `
        background: var(--secondary-bg, #333);
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
        font-family: monospace;
        font-size: 0.9rem;
      `;

      const existingPlaylists = modal.querySelector('.existing-playlists');
      existingPlaylists.style.cssText = `
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--border-color, #555);
        border-radius: 4px;
        margin: 0.5rem 0 1rem 0;
      `;

      const newPlaylistSection = modal.querySelector('.new-playlist-section');
      newPlaylistSection.style.cssText = `
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border-color, #555);
      `;

      const input = modal.querySelector('#new-playlist-name');
      input.style.cssText = `
        width: 100%;
        padding: 0.5rem;
        margin: 0.5rem 0;
        background: var(--secondary-bg, #333);
        color: var(--text-color, #fff);
        border: 1px solid var(--border-color, #555);
        border-radius: 4px;
        font-size: 0.9rem;
      `;

      const buttonsDiv = modal.querySelector('.playlist-dialog-buttons');
      buttonsDiv.style.cssText = `
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
        justify-content: flex-end;
      `;

      // Style buttons
      const buttons = modal.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.style.cssText = `
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        `;
      });

      const cancelBtn = modal.querySelector('#cancel-playlist-btn');
      cancelBtn.style.cssText += `
        background: var(--secondary-color, #666);
        color: white;
      `;

      const createBtn = modal.querySelector('#create-new-playlist-btn');
      createBtn.style.cssText += `
        background: var(--accent-color, #3498db);
        color: white;
      `;

      // Populate existing playlists
      this.populateExistingPlaylists(existingPlaylists, trackDisplay);

      // Event listeners
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });

      createBtn.addEventListener('click', () => {
        const newName = input.value.trim();
        if (newName) {
          this.addTrackToPlaylist(trackDisplay, newName, true);
          document.body.removeChild(modal);
        }
      });

      // Enter key to create new playlist
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const newName = input.value.trim();
          if (newName) {
            this.addTrackToPlaylist(trackDisplay, newName, true);
            document.body.removeChild(modal);
          }
        }
      });

      // Close on escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(modal);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);

      document.body.appendChild(modal);
    }, {
      component: 'UIController',
      method: 'showPlaylistDialog',
      operation: 'playlist dialog display',
      fallbackValue: null
    });
  }

  populateExistingPlaylists(container, trackDisplay) {
    const playlists = Object.keys(this.appState.data.playlists || {});

    if (playlists.length === 0) {
      container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--secondary-text, #888);">No playlists created yet</div>';
      return;
    }

    container.innerHTML = '';
    playlists.forEach(playlistName => {
      const playlistItem = document.createElement('div');
      playlistItem.className = 'playlist-item';
      playlistItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border-bottom: 1px solid var(--border-color, #555);
        cursor: pointer;
        transition: background-color 0.2s;
      `;

      const isAlreadyInPlaylist = this.appState.data.playlists[playlistName].includes(trackDisplay);

      playlistItem.innerHTML = `
        <span>${playlistName}</span>
        <span class="playlist-status">${isAlreadyInPlaylist ? '✓ Added' : 'Add'}</span>
      `;

      const statusSpan = playlistItem.querySelector('.playlist-status');
      statusSpan.style.cssText = `
        color: ${isAlreadyInPlaylist ? 'var(--success-color, #27ae60)' : 'var(--accent-color, #3498db)'};
        font-size: 0.8rem;
        font-weight: bold;
      `;

      if (!isAlreadyInPlaylist) {
        playlistItem.addEventListener('mouseenter', () => {
          playlistItem.style.backgroundColor = 'var(--hover-color, #444)';
        });

        playlistItem.addEventListener('mouseleave', () => {
          playlistItem.style.backgroundColor = 'transparent';
        });

        playlistItem.addEventListener('click', () => {
          this.addTrackToPlaylist(trackDisplay, playlistName, false);
          // Update the UI to show it's been added
          statusSpan.textContent = '✓ Added';
          statusSpan.style.color = 'var(--success-color, #27ae60)';
          playlistItem.style.cursor = 'default';

          // Auto-close dialog after successful addition with a short delay for visual feedback
          setTimeout(() => {
            const modal = document.querySelector('.playlist-selection-modal');
            if (modal) {
              document.body.removeChild(modal);
            }
          }, 500);
        });
      } else {
        playlistItem.style.cursor = 'default';
        playlistItem.style.opacity = '0.7';
      }

      container.appendChild(playlistItem);
    });
  }

  addTrackToPlaylist(trackDisplay, playlistName, isNewPlaylist) {
    return this.errorHandler.safe(() => {
      // Create playlist if it doesn't exist
      if (!this.appState.data.playlists[playlistName]) {
        this.appState.data.playlists[playlistName] = [];
      }

      // Check if track is already in playlist
      if (this.appState.data.playlists[playlistName].includes(trackDisplay)) {
        if (this.notificationSystem) {
          this.notificationSystem.warning(`Track already in playlist: ${playlistName}`);
        }
        return;
      }

      // Add track to playlist
      this.appState.data.playlists[playlistName].push(trackDisplay);
      this.appState.saveToStorage();

      // Update playlist selector if new playlist was created
      if (isNewPlaylist) {
        this.updatePlaylistSelector();
      }

      if (this.notificationSystem) {
        this.notificationSystem.success(`Added to playlist: ${playlistName}`);
      }
    }, {
      component: 'UIController',
      method: 'addTrackToPlaylist',
      operation: 'track playlist addition',
      fallbackValue: null
    });
  }

  async showTagDialog(trackDisplay) {
    try {
      const tag = await this.notificationSystem.prompt('Enter tag:', 'Add Tag');
      if (tag) {
        if (!this.appState.data.trackTags[trackDisplay]) {
          this.appState.data.trackTags[trackDisplay] = [];
        }
        if (!this.appState.data.trackTags[trackDisplay].includes(tag)) {
          this.appState.data.trackTags[trackDisplay].push(tag);
          this.appState.saveToStorage();
          this.renderer.render();
          if (this.notificationSystem) {
            this.notificationSystem.success(`Tag added: ${tag}`);
          }
        } else {
          if (this.notificationSystem) {
            this.notificationSystem.warning(`Tag "${tag}" already exists for this track`);
          }
        }
      }
    } catch (error) {
      console.error('Error showing tag dialog:', error);
      if (this.notificationSystem) {
        this.notificationSystem.error('Failed to show tag dialog');
      }
    }
  }

  removeTag(trackDisplay, tagName) {
    if (!this.appState.data.trackTags[trackDisplay]) {
      return;
    }

    const tagIndex = this.appState.data.trackTags[trackDisplay].indexOf(tagName);
    if (tagIndex > -1) {
      this.appState.data.trackTags[trackDisplay].splice(tagIndex, 1);

      // If no tags left, remove the track from trackTags entirely
      if (this.appState.data.trackTags[trackDisplay].length === 0) {
        delete this.appState.data.trackTags[trackDisplay];
      }

      this.appState.saveToStorage();
      this.renderer.render();

      if (this.notificationSystem) {
        this.notificationSystem.success(`Tag removed: ${tagName}`);
      }
    }
  }

  removeMoodVibeTag(trackDisplay, tagName) {
    if (!this.appState.data.moodVibeTags[trackDisplay]) {
      return;
    }

    const tagIndex = this.appState.data.moodVibeTags[trackDisplay].indexOf(tagName);
    if (tagIndex > -1) {
      this.appState.data.moodVibeTags[trackDisplay].splice(tagIndex, 1);

      // If no mood/vibe tags left, remove the track from moodVibeTags entirely
      if (this.appState.data.moodVibeTags[trackDisplay].length === 0) {
        delete this.appState.data.moodVibeTags[trackDisplay];
      }

      this.appState.saveToStorage();
      this.renderer.render();

      if (this.notificationSystem) {
        this.notificationSystem.success(`Mood/Vibe tag removed: ${tagName}`);
      }
    }
  }

  showEnergyDialog(trackDisplay, anchorElement) {
    // Remove any existing energy popup
    this.cleanupEnergyPopup();

    const popup = document.createElement('div');
    popup.className = 'energy-popup';
    popup.style.position = 'absolute';

    const currentEnergy = this.appState.data.energyLevels[trackDisplay] || 0;

    const titleText = currentEnergy > 0
      ? `Set Energy Level (Current: ${currentEnergy}/10)`
      : 'Set Energy Level (No Rating)';

    const title = this.SecurityUtils.createSafeElement('div', titleText, 'energy-title');
    popup.appendChild(title);

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

    popup.appendChild(buttonsContainer);

    // Clear energy button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'energy-clear-btn';
    clearBtn.textContent = '✕ Clear Rating';
    popup.appendChild(clearBtn);

    // Position popup near the anchor element
    const rect = anchorElement.getBoundingClientRect();
    popup.style.left = rect.left + window.scrollX + 'px';
    popup.style.top = rect.bottom + window.scrollY + 'px';

    document.body.appendChild(popup);
    this.energyPopup = popup;

    // Event handlers
    buttonsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('energy-level-btn')) {
        const level = parseInt(e.target.dataset.level);
        this.appState.data.energyLevels[trackDisplay] = level;
        this.appState.saveToStorage();
        this.cleanupEnergyPopup();
        this.renderer.render();
        if (this.notificationSystem) {
          this.notificationSystem.success(`Energy level set: ${level}/10`);
        }
      }
    });

    clearBtn.addEventListener('click', () => {
      delete this.appState.data.energyLevels[trackDisplay];
      this.appState.saveToStorage();
      this.cleanupEnergyPopup();
      this.renderer.render();
      if (this.notificationSystem) {
        this.notificationSystem.success('Energy rating cleared');
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

  showMoodVibeInput(trackDisplay, anchorElement) {
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

      const existingTags = (this.appState.data.moodVibeTags[trackDisplay] || []).join(', ');
      input.value = existingTags;

      const saveBtn = this.SecurityUtils.createSafeElement('button', 'Save');
      const cancelBtn = this.SecurityUtils.createSafeElement('button', 'Cancel');

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
            .filter(t => this.SecurityUtils.validateTag(t));

          this.appState.data.moodVibeTags[trackDisplay] = tags;
          this.appState.saveToStorage();
          cleanupPopup();
          this.renderer.render();
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
      } else if (this.moodVibePopup.parentElement) {
        this.moodVibePopup.remove();
        this.moodVibePopup = null;
      }
    }

    if (this.moodVibePopupClickHandler) {
      document.removeEventListener('mousedown', this.moodVibePopupClickHandler);
      this.moodVibePopupClickHandler = null;
    }
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.errorHandler.safe(() => {
          const result = this.TrackProcessor.processTracklist(e.target.result, file.name);

          // Update only track-related data, preserve user data
          this.appState.data.grouped = result.grouped;
          this.appState.data.totalTracks = result.totalTracks;
          this.appState.data.duplicateTracks = result.duplicateTracks;
          this.appState.data.tracksForUI = result.tracksForUI;

          // Repopulate filter dropdowns with new track data
          this.populateFilterDropdowns();

          this.renderer.render();
          if (this.notificationSystem) {
            this.notificationSystem.success(`Loaded ${result.totalTracks} tracks`);
          }
        }, {
          component: 'UIController',
          method: 'handleFileUpload',
          operation: 'file processing',
          fallbackValue: null
        });
      };
      reader.readAsText(file);
    }
  }

  handleAudioFolderUpload(event) {
    const files = Array.from(event.target.files);

    if (files.length === 0) {
      if (this.notificationSystem) {
        this.notificationSystem.warning('No files selected');
      }
      return;
    }

    // Validate audio files
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      const validation = this.SecurityUtils.validateAudioFile(file);
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
      if (this.notificationSystem) {
        this.notificationSystem.warning(`Some files were rejected:\n${errorSummary}${moreErrors}`);
      }
    }

    if (validFiles.length === 0) {
      if (this.notificationSystem) {
        this.notificationSystem.error('No valid audio files found');
      }
      event.target.value = '';
      return;
    }

    // Show progress for large batches
    let processingNotification;
    if (validFiles.length > 100 && this.notificationSystem) {
      processingNotification = this.notificationSystem.info(
        `Processing ${validFiles.length} audio files...`, 0
      );
    }

    const loaded = this.audioManager.loadAudioFiles(validFiles);

    // Also load image files for cover art
    const imageFiles = [];
    const allowedImageExtensions = window.CONFIG ? window.CONFIG.ALLOWED_IMAGE_EXTENSIONS : ['.jpg', '.jpeg', '.png', '.webp'];
    for (const file of files) {
      if (allowedImageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        imageFiles.push(file);
      }
    }

    // Store image files in renderer for cover art access
    // Don't reset if we already have image files - preserve them
    if (!this.renderer.imageFileMap || Object.keys(this.renderer.imageFileMap).length === 0) {
      this.renderer.imageFileMap = {};
    }

    for (const imageFile of imageFiles) {
      if (imageFile.webkitRelativePath) {
        this.renderer.imageFileMap[imageFile.webkitRelativePath] = imageFile;
      }
    }

    console.log('Cover art debug - loaded image files:', Object.keys(this.renderer.imageFileMap));

    // Clear processing notification
    if (processingNotification) {
      processingNotification.close();
    }

    if (loaded > 0) {
      const rejectedCount = files.length - validFiles.length;
      const imageMessage = imageFiles.length > 0 ? ` and ${imageFiles.length} image files` : '';
      const message = rejectedCount > 0
        ? `Loaded ${loaded} audio files${imageMessage} (${rejectedCount} total files rejected). You can now preview tracks.`
        : `Loaded ${loaded} audio files${imageMessage}. You can now preview tracks.`;

      if (this.notificationSystem) {
        this.notificationSystem.success(message);
      }

      // Update cover art directory path from the first file's path
      if (files.length > 0 && files[0].webkitRelativePath) {
        const firstFilePath = files[0].webkitRelativePath;
        const folderPath = firstFilePath.substring(0, firstFilePath.lastIndexOf('/'));
        this.renderer.updateCoverArtDirectory(folderPath);
      }
    } else {
      if (this.notificationSystem) {
        this.notificationSystem.success(`Loaded ${loaded} audio files`);
      }
    }

    // Reset file input
    event.target.value = '';
  }

  // View toggle methods
  toggleDuplicatesView() {
    const duplicatesSection = document.getElementById('duplicate-tracks');
    if (duplicatesSection) {
      const isVisible = !duplicatesSection.classList.contains('hidden');
      if (isVisible) {
        this.hideDuplicatesView();
      } else {
        this.showDuplicatesView();
      }
    }
  }

  showDuplicatesView() {
    const duplicatesSection = document.getElementById('duplicate-tracks');
    if (duplicatesSection) {
      duplicatesSection.classList.remove('hidden');
      this.renderer.renderDuplicateList();
      // Scroll to the duplicates section
      duplicatesSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  hideDuplicatesView() {
    const duplicatesSection = document.getElementById('duplicate-tracks');
    if (duplicatesSection) {
      duplicatesSection.classList.add('hidden');
    }
  }

  toggleStatsView() {
    const statsSection = document.getElementById('library-stats');
    if (statsSection) {
      const isVisible = !statsSection.classList.contains('hidden');
      if (isVisible) {
        this.hideStatsView();
      } else {
        this.showStatsView();
      }
    }
  }

  toggleFavoritesFilter() {
    this.appState.data.showFavoritesOnly = !this.appState.data.showFavoritesOnly;
    const btn = document.getElementById('favorites-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', this.appState.data.showFavoritesOnly);
    }
    this.appState.saveToStorage();
    this.renderer.clearAZFilter();
    this.renderer.render();
  }

  toggleCoverArt() {
    // Ensure coverArtSettings exists
    if (!this.appState.data.coverArtSettings) {
      this.appState.data.coverArtSettings = {
        showCoverArt: window.CONFIG ? window.CONFIG.COVER_ART.SHOW_BY_DEFAULT : true,
        artworkDirectory: window.CONFIG ? window.CONFIG.COVER_ART.DIRECTORY : 'covers',
        audioFolderPath: null
      };
    }

    // Toggle the setting
    this.appState.data.coverArtSettings.showCoverArt = !this.appState.data.coverArtSettings.showCoverArt;

    console.log('Cover art toggle debug - showCoverArt:', this.appState.data.coverArtSettings.showCoverArt);
    console.log('Cover art toggle debug - audioFolderPath:', this.appState.data.coverArtSettings.audioFolderPath);
    console.log('Cover art toggle debug - artworkDirectory:', this.appState.data.coverArtSettings.artworkDirectory);

    const btn = document.getElementById('cover-art-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', this.appState.data.coverArtSettings.showCoverArt);
    }

    // Save setting to localStorage
    this.appState.saveToStorage();

    // Re-render tracks to show/hide cover art
    this.renderer.render();
  }

  showStatsView() {
    const statsSection = document.getElementById('library-stats');
    if (statsSection) {
      statsSection.classList.remove('hidden');
      this.renderLibraryStats();
      // Scroll to the stats section
      statsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  hideStatsView() {
    const statsSection = document.getElementById('library-stats');
    if (statsSection) {
      statsSection.classList.add('hidden');
    }
  }

  renderLibraryStats() {
    const tracks = this.appState.data.tracksForUI || [];
    if (tracks.length === 0) return;

    // Calculate statistics
    const stats = this.calculateLibraryStats(tracks);

    // Update overview stats
    const totalTracksEl = document.getElementById('total-tracks');
    const totalArtistsEl = document.getElementById('total-artists');
    const avgBpmEl = document.getElementById('average-bpm');
    const totalDurationEl = document.getElementById('total-duration');

    if (totalTracksEl) totalTracksEl.textContent = stats.totalTracks.toLocaleString();
    if (totalArtistsEl) totalArtistsEl.textContent = stats.totalArtists.toLocaleString();
    if (avgBpmEl) avgBpmEl.textContent = stats.averageBPM;
    if (totalDurationEl) totalDurationEl.textContent = stats.totalDuration;

    // Create charts
    this.createGenreChart(stats.genres);
    this.createBPMChart(stats.bpmRanges);
    this.createKeyChart(stats.keys);
    this.createEnergyChart(stats.energyLevels);
    this.createYearChart(stats.years);
    this.createLabelsChart(stats.labels);

    // Force all charts to resize after creation
    this.resizeAllCharts();
  }

  calculateLibraryStats(tracks) {

    const stats = {
      totalTracks: tracks.length,
      totalArtists: new Set(tracks.map(t => t.artist)).size,
      totalDuration: '0:00',
      averageBPM: 0,
      genres: [],
      bpmRanges: [],
      keys: [],
      energyLevels: [],
      years: [],
      labels: []
    };

    // Calculate BPM average
    const bpms = tracks.map(t => parseInt(t.bpm)).filter(bpm => !isNaN(bpm));
    if (bpms.length > 0) {
      stats.averageBPM = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    }

    // Count occurrences
    const counters = {
      genres: {},
      keys: {},
      energyLevels: {},
      years: {},
      labels: {}
    };

    tracks.forEach(track => {
      // Genre counting
      if (track.genre) {
        counters.genres[track.genre] = (counters.genres[track.genre] || 0) + 1;
      }

      // Key counting
      if (track.key) {
        counters.keys[track.key] = (counters.keys[track.key] || 0) + 1;
      }

      // Energy level counting - check both custom ratings and CSV energy field
      let energy = this.appState.data.energyLevels[track.display];

      // If no custom energy rating, try to parse from track.energy field
      if (!energy && track.energy) {
        // Extract number from "Energy 5" format
        const match = track.energy.match(/(\d+)/);
        if (match) {
          energy = parseInt(match[1]);
        }
      }

      if (energy) {
        counters.energyLevels[energy] = (counters.energyLevels[energy] || 0) + 1;
      }

      // Year counting
      if (track.year) {
        counters.years[track.year] = (counters.years[track.year] || 0) + 1;
      }

      // Label counting
      if (track.recordLabel) {
        counters.labels[track.recordLabel] = (counters.labels[track.recordLabel] || 0) + 1;
      }
    });

    // Convert to sorted arrays
    stats.genres = Object.entries(counters.genres)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ label: name, value: count }));

    stats.keys = Object.entries(counters.keys)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ label: name, value: count }));

    // Create energy levels 1-10 with proper counts
    stats.energyLevels = [];
    for (let i = 1; i <= 10; i++) {
      const count = counters.energyLevels[i] || 0;
      stats.energyLevels.push({ label: `Level ${i}`, value: count });
    }

    stats.years = Object.entries(counters.years)
      .filter(([year, count]) => {
        const yearNum = parseInt(year);
        return yearNum >= 1950 && yearNum <= new Date().getFullYear() + 1; // Filter reasonable years
      })
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // Newest first
      .map(([year, count]) => ({ label: year, value: count }));

    // Process labels with "Others" grouping for better chart balance
    const sortedLabels = Object.entries(counters.labels)
      .sort((a, b) => b[1] - a[1]);

    const topLabels = sortedLabels.slice(0, 8); // Top 8 labels
    const remainingLabels = sortedLabels.slice(8);
    const othersCount = remainingLabels.reduce((sum, [, count]) => sum + count, 0);

    stats.labels = topLabels.map(([name, count]) => ({ label: name, value: count }));

    // Add "Others" category if there are remaining labels
    if (othersCount > 0) {
      stats.labels.push({ label: 'Others', value: othersCount });
    }

    // BPM ranges
    const bpmRanges = {
      '60-99': 0,
      '100-119': 0,
      '120-129': 0,
      '130-139': 0,
      '140-149': 0,
      '150+': 0
    };

    bpms.forEach(bpm => {
      if (bpm < 100) bpmRanges['60-99']++;
      else if (bpm < 120) bpmRanges['100-119']++;
      else if (bpm < 130) bpmRanges['120-129']++;
      else if (bpm < 140) bpmRanges['130-139']++;
      else if (bpm < 150) bpmRanges['140-149']++;
      else bpmRanges['150+']++;
    });

    stats.bpmRanges = Object.entries(bpmRanges)
      .filter(([range, count]) => count > 0)
      .map(([range, count]) => ({ label: range, value: count }));

    return stats;
  }

  updateStatsSection(sectionId, data) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const list = section.querySelector('.stats-list');
    if (!list) return;

    list.innerHTML = '';
    data.forEach(item => {
      const listItem = document.createElement('div');
      listItem.className = 'stats-item';
      listItem.innerHTML = `
        <span class="stats-label">${item.label}</span>
        <span class="stats-value">${item.value}</span>
      `;
      list.appendChild(listItem);
    });
  }

  // Helper method to retry chart resize with increasing delays
  retryChartResize(chart, chartName, attempt) {
    const delays = [100, 250, 500, 1000]; // Multiple retry delays

    if (attempt >= delays.length || !chart) return;

    setTimeout(() => {
      const canvas = chart.canvas;
      const container = canvas.parentElement;

      console.log(`🔄 ${chartName} chart resize attempt ${attempt + 1}:`);
      console.log('Container dimensions:', {
        width: container?.offsetWidth || 0,
        height: container?.offsetHeight || 0
      });

      if (container && (container.offsetWidth > 0 && container.offsetHeight > 0)) {
        chart.resize();
        chart.update('resize');
        console.log(`✅ ${chartName} chart successfully resized`);
      } else {
        console.log(`⏳ ${chartName} chart container still has 0 dimensions, retrying...`);
        this.retryChartResize(chart, chartName, attempt + 1);
      }
    }, delays[attempt]);
  }

  // Helper method to fix canvas sizing issues
  fixCanvasSize(ctx) {
    const container = ctx.parentElement;
    if (container) {
      container.style.height = '300px';
      container.style.width = '100%';
      container.style.display = 'block';

      // Force canvas to inherit container size
      ctx.style.width = '100%';
      ctx.style.height = '100%';
      ctx.width = container.clientWidth || 400;
      ctx.height = container.clientHeight || 300;

      console.log('Fixed canvas container and canvas size', {
        containerWidth: container.clientWidth,
        containerHeight: container.clientHeight,
        canvasWidth: ctx.width,
        canvasHeight: ctx.height
      });
    }
  }

  // Force all charts to resize
  resizeAllCharts() {
    setTimeout(() => {
      if (this.genreChart) this.genreChart.resize();
      if (this.bpmChart) this.bpmChart.resize();
      if (this.keyChart) this.keyChart.resize();
      if (this.energyChart) this.energyChart.resize();
      if (this.yearChart) this.yearChart.resize();
      if (this.labelsChart) this.labelsChart.resize();
      console.log('🔄 All charts resized');
    }, 100);
  }

  createGenreChart(genres) {
    console.log('🎨 Creating genre chart...');
    const ctx = document.getElementById('genre-chart');
    console.log('Canvas element:', ctx);
    console.log('Canvas parent:', ctx?.parentElement);
    console.log('Canvas dimensions:', {
      width: ctx?.clientWidth,
      height: ctx?.clientHeight,
      offsetWidth: ctx?.offsetWidth,
      offsetHeight: ctx?.offsetHeight
    });

    if (!ctx) {
      console.error('❌ Genre chart canvas not found');
      return;
    }

    if (!window.Chart) {
      console.error('❌ Chart.js is not loaded');
      return;
    }

    // Destroy existing chart if it exists
    if (this.genreChart) {
      this.genreChart.destroy();
    }

    const data = genres.slice(0, 8); // Top 8 genres
    console.log('Genre data for chart:', data);
    if (data.length === 0) {
      console.log('❌ No genre data available');
      return;
    }

    try {
      console.log('🚀 Creating Chart.js instance...');

      // Fix canvas sizing
      this.fixCanvasSize(ctx);
      console.log('After fix - dimensions:', {
        width: ctx.clientWidth,
        height: ctx.clientHeight
      });

      this.genreChart = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(g => g.label),
          datasets: [{
            data: data.map(g => g.value),
            backgroundColor: [
              '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
              '#ffeaa7', '#fab1a0', '#fd79a8', '#a29bfe'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#fff', font: { size: 11 } }
            }
          }
        }
      });

      // Trigger Chart.js resize after creation with multiple retries
      this.retryChartResize(this.genreChart, 'Genre', 0);

      console.log('✅ Genre chart created successfully!', this.genreChart);
    } catch (error) {
      console.error('Error creating genre chart:', error);
    }
  }

  createBPMChart(bpmRanges) {
    const ctx = document.getElementById('bpm-chart');
    if (!ctx) return;

    if (!window.Chart) {
      console.error('Chart.js is not loaded');
      return;
    }

    if (this.bpmChart) {
      this.bpmChart.destroy();
    }

    if (bpmRanges.length === 0) {
      console.log('No BPM range data available');
      return;
    }

    try {
      // Fix canvas sizing
      this.fixCanvasSize(ctx);

      this.bpmChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: bpmRanges.map(b => b.label),
          datasets: [{
            data: bpmRanges.map(b => b.value),
            backgroundColor: '#4ecdc4',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: '#fff', font: { size: 10 } } },
            y: { ticks: { color: '#fff', font: { size: 10 } } }
          }
        }
      });

      // Trigger Chart.js resize after creation with multiple retries
      this.retryChartResize(this.bpmChart, 'BPM', 0);

      console.log('BPM chart created successfully');
    } catch (error) {
      console.error('Error creating BPM chart:', error);
    }
  }

  createKeyChart(keys) {
    const ctx = document.getElementById('key-chart');
    if (!ctx) return;

    if (!window.Chart) {
      console.error('Chart.js is not loaded');
      return;
    }

    if (this.keyChart) {
      this.keyChart.destroy();
    }

    const data = keys.slice(0, 12); // Top 12 keys
    console.log('Key chart data:', data);

    // Fix canvas sizing
    this.fixCanvasSize(ctx);

    this.keyChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(k => k.label),
        datasets: [{
          label: 'Tracks',
          data: data.map(k => k.value),
          backgroundColor: '#45b7d1',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: {
              color: '#fff',
              font: { size: 10 },
              maxRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#fff',
              font: { size: 10 }
            }
          }
        }
      }
    });

    // Trigger Chart.js resize after creation with multiple retries
    this.retryChartResize(this.keyChart, 'Key', 0);
  }

  createEnergyChart(energyLevels) {
    const ctx = document.getElementById('energy-chart');
    if (!ctx) return;

    if (!window.Chart) {
      console.error('Chart.js is not loaded');
      return;
    }

    if (this.energyChart) {
      this.energyChart.destroy();
    }
    // Fix canvas sizing
    this.fixCanvasSize(ctx);

    this.energyChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: energyLevels.map(e => e.label),
        datasets: [{
          label: 'Tracks',
          data: energyLevels.map(e => e.value),
          backgroundColor: '#ffeaa7',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#fff', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#fff', font: { size: 10 } }
          }
        }
      }
    });

    // Trigger Chart.js resize after creation with multiple retries
    this.retryChartResize(this.energyChart, 'Energy', 0);
  }

  createLabelsChart(labels) {
    const ctx = document.getElementById('label-chart');
    if (!ctx) return;

    if (!window.Chart) {
      console.error('Chart.js is not loaded');
      return;
    }

    if (this.labelsChart) {
      this.labelsChart.destroy();
    }

    const data = labels; // Use all processed labels (includes "Others")
    console.log('Labels chart data:', data);

    // If no label data, show placeholder
    if (!data || data.length === 0) {
      data.push({ label: 'No Labels Found', value: 0 });
    }

    // Fix canvas sizing
    this.fixCanvasSize(ctx);

    this.labelsChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(l => l.label || 'Unknown'),
        datasets: [{
          data: data.map(l => l.value || 0),
          backgroundColor: [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fab1a0',
            '#fd79a8', '#a29bfe', '#ff7675', '#00b894', '#0984e3', '#6c5ce7'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#fff',
              font: { size: 10 },
              usePointStyle: true
            }
          }
        }
      }
    });

    // Trigger Chart.js resize after creation with multiple retries
    this.retryChartResize(this.labelsChart, 'Labels', 0);
  }

  createYearChart(years) {
    const ctx = document.getElementById('year-chart');
    if (!ctx) return;

    if (!window.Chart) {
      console.error('Chart.js is not loaded');
      return;
    }

    if (this.yearChart) {
      this.yearChart.destroy();
    }

    const data = years.slice(0, 20); // Top 20 years

    // Fix canvas sizing
    this.fixCanvasSize(ctx);

    this.yearChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(y => y.label),
        datasets: [{
          data: data.map(y => y.value),
          backgroundColor: '#9966FF',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: {
              color: '#fff',
              font: { size: 10 },
              maxRotation: 45
            }
          },
          y: { ticks: { color: '#fff', font: { size: 10 } } }
        }
      }
    });

    // Trigger Chart.js resize after creation with multiple retries
    this.retryChartResize(this.yearChart, 'Year', 0);
  }

  toggleFilterDrawer() {
    const filterDrawer = document.getElementById('filter-drawer');
    const filterDrawerBtn = document.getElementById('filter-drawer-btn');

    if (!filterDrawer || !filterDrawerBtn) return;

    // Toggle the collapsed class on both elements
    const isCollapsed = filterDrawer.classList.contains('collapsed');

    if (isCollapsed) {
      // Show the drawer
      filterDrawer.classList.remove('collapsed');
      filterDrawerBtn.classList.remove('collapsed');
    } else {
      // Hide the drawer
      filterDrawer.classList.add('collapsed');
      filterDrawerBtn.classList.add('collapsed');
    }

    // The arrow rotation is handled by CSS transform
    // .filter-toggle-btn.collapsed .filter-toggle-arrow { transform: rotate(-90deg); }
  }

  showCreatePlaylistDialog() {
    const playlistName = prompt('Enter playlist name:');
    if (playlistName && playlistName.trim()) {
      const trimmedName = playlistName.trim();

      // Check if playlist already exists
      if (this.appState.data.playlists[trimmedName]) {
        if (this.notificationSystem) {
          this.notificationSystem.error(`Playlist "${trimmedName}" already exists`);
        }
        return;
      }

      // Create new empty playlist
      this.appState.data.playlists[trimmedName] = [];
      this.appState.saveToStorage();

      // Update playlist selector
      this.updatePlaylistSelector();

      // Update button states but don't change current playlist
      this.updatePlaylistButtonStates();

      if (this.notificationSystem) {
        this.notificationSystem.success(`Created playlist: ${trimmedName}`);
      }

      // No need to re-render since we're staying in default view
    }
  }

  showSmartPlaylistModal() {
    return this.errorHandler.safe(() => {
      console.log('Opening smart playlist modal...');
      const modal = document.getElementById('smart-playlist-modal');
      if (!modal) {
        console.error('Smart playlist modal not found');
        return;
      }

      modal.classList.remove('hidden');
      modal.style.display = 'flex';

      // Initialize smart playlist modal if needed
      this.initializeSmartPlaylistModal();
      console.log('Smart playlist modal opened successfully');
    }, {
      component: 'UIController',
      method: 'showSmartPlaylistModal',
      operation: 'smart playlist modal opening',
      fallbackValue: null
    });
  }

  initializeSmartPlaylistModal() {
    return this.errorHandler.safe(() => {
      console.log('Initializing smart playlist modal...');

      // Add event listeners for modal close buttons
      const closeBtn = document.getElementById('close-smart-playlist-modal');
      const cancelBtn = document.getElementById('cancel-smart-playlist-btn');
      const saveBtn = document.getElementById('save-smart-playlist-btn');

      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hideSmartPlaylistModal());
      } else {
        console.warn('Close button not found in smart playlist modal');
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.hideSmartPlaylistModal());
      } else {
        console.warn('Cancel button not found in smart playlist modal');
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveSmartPlaylist());
      } else {
        console.warn('Save button not found in smart playlist modal');
      }

      // Initialize add rule button
      const addRuleBtn = document.getElementById('add-rule-btn');
      if (addRuleBtn) {
        addRuleBtn.addEventListener('click', () => this.addSmartPlaylistRule());
      } else {
        console.warn('Add rule button not found in smart playlist modal');
      }

      // Clear existing rules first
      const rulesContainer = document.getElementById('smart-playlist-rules-container');
      if (rulesContainer) {
        rulesContainer.innerHTML = '';
      }

      // Add initial rule
      this.addSmartPlaylistRule();
      console.log('Smart playlist modal initialized successfully');
    }, {
      component: 'UIController',
      method: 'initializeSmartPlaylistModal',
      operation: 'smart playlist modal initialization',
      fallbackValue: null
    });
  }

  hideSmartPlaylistModal() {
    const modal = document.getElementById('smart-playlist-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  addSmartPlaylistRule() {
    return this.errorHandler.safe(() => {
      console.log('Adding smart playlist rule...');
      const container = document.getElementById('smart-playlist-rules-container');
      if (!container) {
        console.error('Smart playlist rules container not found');
        return;
      }

    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'smart-rule-item';
    ruleDiv.innerHTML = `
      <select class="rule-field">
        <option value="artist">Artist</option>
        <option value="title">Title</option>
        <option value="genre">Genre</option>
        <option value="bpm">BPM</option>
        <option value="key">Key</option>
        <option value="year">Year</option>
        <option value="energy">Energy Level</option>
        <option value="label">Record Label</option>
      </select>
      <select class="rule-operator">
        <option value="contains">Contains</option>
        <option value="is">Is</option>
        <option value="starts_with">Starts with</option>
        <option value="greater_than">Greater than</option>
        <option value="less_than">Less than</option>
        <option value="between">Between</option>
      </select>
      <input type="text" class="rule-value" placeholder="Value">
      <input type="text" class="rule-value2" placeholder="Second value (for between)" style="display: none;">
      <button type="button" class="remove-rule-btn">✕</button>
    `;

    container.appendChild(ruleDiv);

    // Add event listeners
    const operatorSelect = ruleDiv.querySelector('.rule-operator');
    const value2Input = ruleDiv.querySelector('.rule-value2');

    operatorSelect.addEventListener('change', () => {
      if (operatorSelect.value === 'between') {
        value2Input.style.display = 'block';
      } else {
        value2Input.style.display = 'none';
      }
    });

    const removeBtn = ruleDiv.querySelector('.remove-rule-btn');
    removeBtn.addEventListener('click', () => {
      ruleDiv.remove();
      this.updateSmartPlaylistPreview();
    });

    // Update preview when rule changes
    const inputs = ruleDiv.querySelectorAll('select, input');
    inputs.forEach(input => {
      input.addEventListener('change', () => this.updateSmartPlaylistPreview());
      input.addEventListener('input', () => this.updateSmartPlaylistPreview());
    });

    this.updateSmartPlaylistPreview();
    console.log('Smart playlist rule added successfully');
    }, {
      component: 'UIController',
      method: 'addSmartPlaylistRule',
      operation: 'smart playlist rule creation',
      fallbackValue: null
    });
  }

  updateSmartPlaylistPreview() {
    const previewCount = document.getElementById('preview-count');
    const previewTracks = document.getElementById('smart-playlist-preview-tracks');

    if (!previewCount || !previewTracks) return;

    // Get all rules
    const rules = this.getSmartPlaylistRules();
    if (rules.length === 0) {
      previewCount.textContent = '0';
      previewTracks.innerHTML = '<p>Add rules to see matching tracks.</p>';
      return;
    }

    // Get rule logic (AND/OR)
    const logicType = document.querySelector('input[name="rule-logic"]:checked')?.value || 'AND';

    // Filter tracks based on rules
    const allTracks = this.appState.data.tracksForUI || [];
    const matchingTracks = allTracks.filter(track => {
      if (logicType === 'AND') {
        // All rules must match
        return rules.every(rule => this.evaluateSmartPlaylistRule(track, rule));
      } else {
        // At least one rule must match
        return rules.some(rule => this.evaluateSmartPlaylistRule(track, rule));
      }
    });

    // Update count
    previewCount.textContent = matchingTracks.length;

    // Show preview tracks (limit to first 10)
    if (matchingTracks.length === 0) {
      previewTracks.innerHTML = '<p>No tracks match the current rules.</p>';
    } else {
      const previewList = matchingTracks.slice(0, 10);
      const tracksHtml = previewList.map(track => `
        <div class="preview-track-item">
          <span class="preview-artist">${track.artist}</span> -
          <span class="preview-title">${track.title}</span>
          <span class="preview-details">(${track.bpm} BPM, ${track.key})</span>
        </div>
      `).join('');

      const moreText = matchingTracks.length > 10 ?
        `<p class="preview-more">... and ${matchingTracks.length - 10} more tracks</p>` : '';

      previewTracks.innerHTML = tracksHtml + moreText;
    }
  }

  getSmartPlaylistRules() {
    const rulesContainer = document.getElementById('smart-playlist-rules-container');
    if (!rulesContainer) return [];

    const ruleElements = rulesContainer.querySelectorAll('.smart-rule-item');
    const rules = [];

    ruleElements.forEach(ruleElement => {
      const field = ruleElement.querySelector('.rule-field')?.value;
      const operator = ruleElement.querySelector('.rule-operator')?.value;
      const value = ruleElement.querySelector('.rule-value')?.value;
      const value2 = ruleElement.querySelector('.rule-value2')?.value;

      if (field && operator && value) {
        rules.push({ field, operator, value, value2 });
      }
    });

    return rules;
  }

  evaluateSmartPlaylistRule(track, rule) {
    const { field, operator, value, value2 } = rule;

    // Get the track field value
    let trackValue;
    switch (field) {
      case 'artist':
        trackValue = track.artist;
        break;
      case 'title':
        trackValue = track.title;
        break;
      case 'genre':
        trackValue = track.genre;
        break;
      case 'bpm':
        trackValue = parseInt(track.bpm);
        break;
      case 'key':
        trackValue = track.key;
        break;
      case 'year':
        trackValue = parseInt(track.year);
        break;
      case 'energy':
        trackValue = this.appState.data.energyLevels[track.display] || 0;
        break;
      case 'label':
        trackValue = track.recordLabel;
        break;
      default:
        return false;
    }

    if (trackValue === undefined || trackValue === null) {
      return false;
    }

    // Convert to string for text operations
    const trackValueStr = String(trackValue).toLowerCase();
    const ruleValueStr = value.toLowerCase();

    // Evaluate based on operator
    switch (operator) {
      case 'contains':
        return trackValueStr.includes(ruleValueStr);

      case 'is':
        if (['bpm', 'year', 'energy'].includes(field)) {
          return parseFloat(trackValue) === parseFloat(value);
        }
        return trackValueStr === ruleValueStr;

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

  saveSmartPlaylist() {
    return this.errorHandler.safe(() => {
      console.log('Saving smart playlist...');

      const nameInput = document.getElementById('smart-playlist-name-input');
      if (!nameInput || !nameInput.value.trim()) {
        console.error('No playlist name provided');
        if (this.notificationSystem) {
          this.notificationSystem.error('Please enter a playlist name');
        }
        return;
      }

      const playlistName = nameInput.value.trim();
      console.log('Playlist name:', playlistName);

      // Check if playlist already exists (both regular and smart)
      if (this.appState.data.playlists[playlistName]) {
        console.error('Regular playlist already exists with this name');
        if (this.notificationSystem) {
          this.notificationSystem.error(`Playlist "${playlistName}" already exists`);
        }
        return;
      }

      // Initialize smart playlists if not exists
      if (!this.appState.data.smartPlaylists) {
        this.appState.data.smartPlaylists = {};
      }

      if (this.appState.data.smartPlaylists[playlistName]) {
        console.error('Smart playlist already exists with this name');
        if (this.notificationSystem) {
          this.notificationSystem.error(`Smart playlist "${playlistName}" already exists`);
        }
        return;
      }

      // Get rules and validate
      const rules = this.getSmartPlaylistRules();
      console.log('Rules:', rules);
      if (rules.length === 0) {
        console.error('No rules provided');
        if (this.notificationSystem) {
          this.notificationSystem.error('Please add at least one rule');
        }
        return;
      }

      // Get rule logic (AND/OR)
      const logicType = document.querySelector('input[name="rule-logic"]:checked')?.value || 'AND';
      console.log('Logic type:', logicType);

      // Test rules against current tracks to get count
      const allTracks = this.appState.data.tracksForUI || [];
      const matchingTracks = allTracks.filter(track => {
        if (logicType === 'AND') {
          return rules.every(rule => this.evaluateSmartPlaylistRule(track, rule));
        } else {
          return rules.some(rule => this.evaluateSmartPlaylistRule(track, rule));
        }
      });

      console.log('Matching tracks:', matchingTracks.length);

      // Save as smart playlist (store rules, not tracks)
      this.appState.data.smartPlaylists[playlistName] = {
        rules: rules,
        logic: logicType,
        created: Date.now()
      };

      this.appState.saveToStorage();
      console.log('Smart playlist saved to storage');

      // Update playlist selector
      this.updatePlaylistSelector();
      console.log('Playlist selector updated');

      if (this.notificationSystem) {
        this.notificationSystem.success(`Created smart playlist "${playlistName}" with ${matchingTracks.length} tracks`);
      }

      // Clear the modal
      const nameInputElement = document.getElementById('smart-playlist-name-input');
      if (nameInputElement) {
        nameInputElement.value = '';
      }

      this.hideSmartPlaylistModal();
      this.renderer.render();
      console.log('Smart playlist creation completed');
    }, {
      component: 'UIController',
      method: 'saveSmartPlaylist',
      operation: 'smart playlist saving',
      fallbackValue: null
    });
  }

  updatePlaylistSelector() {
    const playlistSelector = document.getElementById('playlist-select');
    if (!playlistSelector) return;

    // Clear existing options except the default ones
    Array.from(playlistSelector.options).forEach(option => {
      if (option.value !== '' && option.value !== 'favorites') {
        option.remove();
      }
    });

    // Add regular playlist options
    Object.keys(this.appState.data.playlists || {}).forEach(playlistName => {
      const option = document.createElement('option');
      option.value = playlistName;
      option.textContent = playlistName;
      playlistSelector.appendChild(option);
    });

    // Add smart playlist options
    Object.keys(this.appState.data.smartPlaylists || {}).forEach(smartPlaylistName => {
      const option = document.createElement('option');
      option.value = `smart:${smartPlaylistName}`;
      option.textContent = `🧠 ${smartPlaylistName}`;
      playlistSelector.appendChild(option);
    });

    // Set the current selection based on stored currentPlaylist
    if (this.appState.data.currentPlaylist) {
      playlistSelector.value = this.appState.data.currentPlaylist;
    }
  }

  async deletePlaylist() {
    console.log('deletePlaylist method called');
    return this.errorHandler.safe(async () => {
      console.log('Current playlist:', this.appState.data.currentPlaylist);
      if (!this.appState.data.currentPlaylist) {
        console.log('No current playlist selected, returning');
        return;
      }

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
        this.updatePlaylistSelector();
        this.updatePlaylistButtonStates();

        // Trigger render to reset to default view
        this.renderer.render();

        this.notificationSystem.success(`Playlist "${displayName}" deleted successfully`);
      }
    }, {
      component: 'UIController',
      method: 'deletePlaylist',
      operation: 'playlist deletion',
      fallbackValue: null
    });
  }

  async renamePlaylist() {
    return this.errorHandler.safe(async () => {
      if (!this.appState.data.currentPlaylist) return;

      const currentPlaylist = this.appState.data.currentPlaylist;
      let currentDisplayName = currentPlaylist;
      let isSmartPlaylist = false;

      if (currentPlaylist.startsWith('smart:')) {
        currentDisplayName = currentPlaylist.replace('smart:', '');
        isSmartPlaylist = true;
      }

      const newName = prompt(`Rename playlist "${currentDisplayName}" to:`, currentDisplayName);
      if (!newName || newName === currentDisplayName) return;

      // Check if new name already exists
      const nameExists = isSmartPlaylist ?
        this.appState.data.smartPlaylists?.[newName] :
        this.appState.data.playlists?.[newName];

      if (nameExists) {
        this.notificationSystem.error(`A playlist named "${newName}" already exists`);
        return;
      }

      if (isSmartPlaylist) {
        // Rename smart playlist
        this.appState.data.smartPlaylists[newName] = this.appState.data.smartPlaylists[currentDisplayName];
        delete this.appState.data.smartPlaylists[currentDisplayName];
        this.appState.data.currentPlaylist = `smart:${newName}`;
      } else {
        // Rename regular playlist
        this.appState.data.playlists[newName] = this.appState.data.playlists[currentDisplayName];
        delete this.appState.data.playlists[currentDisplayName];
        this.appState.data.currentPlaylist = newName;
      }

      this.appState.saveToStorage();
      this.updatePlaylistSelector();
      this.notificationSystem.success(`Playlist renamed to "${newName}"`);
    }, {
      component: 'UIController',
      method: 'renamePlaylist',
      operation: 'playlist renaming',
      fallbackValue: null
    });
  }

  exportPlaylists() {
    return this.errorHandler.safe(() => {
      const currentPlaylist = this.appState.data.currentPlaylist;

      if (!currentPlaylist || currentPlaylist === '' || currentPlaylist === 'favorites') {
        // Export all playlists metadata if no specific playlist is selected
        const exportData = {
          playlists: this.appState.data.playlists || {},
          smartPlaylists: this.appState.data.smartPlaylists || {},
          favorites: this.appState.data.favorites || {},
          trackTags: this.appState.data.trackTags || {},
          energyLevels: this.appState.data.energyLevels || {}
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'beatrove-all-playlists.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.notificationSystem.success('All playlists exported successfully');
        return;
      }

      // Export tracks from the currently selected playlist
      let playlistTracks = [];
      let playlistName = currentPlaylist;

      if (currentPlaylist.startsWith('smart:')) {
        // Handle smart playlist
        const smartPlaylistName = currentPlaylist.replace('smart:', '');
        const smartPlaylist = this.appState.data.smartPlaylists?.[smartPlaylistName];
        playlistName = smartPlaylistName;

        if (smartPlaylist) {
          // Get tracks that match the smart playlist rules
          const allTracks = this.appState.data.tracksForUI || [];
          playlistTracks = allTracks.filter(track => {
            if (smartPlaylist.logic === 'AND') {
              return smartPlaylist.rules.every(rule => this.evaluateSmartPlaylistRule(track, rule));
            } else {
              return smartPlaylist.rules.some(rule => this.evaluateSmartPlaylistRule(track, rule));
            }
          });
        }
      } else {
        // Handle regular playlist
        const trackDisplays = this.appState.data.playlists[currentPlaylist] || [];
        const allTracks = this.appState.data.tracksForUI || [];

        playlistTracks = trackDisplays.map(display =>
          allTracks.find(track => track.display === display)
        ).filter(track => track !== undefined);
      }

      if (playlistTracks.length === 0) {
        this.notificationSystem.warning(`Playlist "${playlistName}" is empty - nothing to export`);
        return;
      }

      // Create CSV content
      const csvHeaders = 'Artist,Title,Key,BPM,Duration,Year,Path,Genre,Energy,Label\n';
      const csvRows = playlistTracks.map(track => {
        const energy = this.appState.data.energyLevels[track.display] || '';
        const energyStr = energy ? `Energy ${energy}` : '';

        // Escape CSV values that contain commas or quotes
        const escapeCSV = (value) => {
          if (typeof value !== 'string') value = String(value || '');
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        };

        return [
          escapeCSV(track.artist || ''),
          escapeCSV(track.title || ''),
          escapeCSV(track.key || ''),
          escapeCSV(track.bpm || ''),
          escapeCSV(track.duration || ''),
          escapeCSV(track.year || ''),
          escapeCSV(track.path || ''),
          escapeCSV(track.genre || ''),
          escapeCSV(energyStr),
          escapeCSV(track.label || '')
        ].join(',');
      }).join('\n');

      const csvContent = csvHeaders + csvRows;
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${playlistName.replace(/[^a-z0-9]/gi, '_')}_tracks.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.notificationSystem.success(`Exported ${playlistTracks.length} tracks from playlist "${playlistName}"`);
    }, {
      component: 'UIController',
      method: 'exportPlaylists',
      operation: 'playlist export',
      fallbackValue: null
    });
  }

  async importPlaylists(event) {
    return this.errorHandler.safe(async () => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await this.readFile(file);
        const fileName = file.name.toLowerCase();
        let importData;
        let importedCount = 0;

        if (fileName.endsWith('.csv')) {
          // Handle CSV import - create a new playlist from the CSV tracks
          const playlistName = this.generatePlaylistNameFromFile(fileName);
          const tracks = this.parseCSVTracks(text);

          if (tracks.length === 0) {
            this.notificationSystem.warning('No valid tracks found in CSV file');
            return;
          }

          // Create playlist with track display names
          const trackDisplays = tracks.map(track => track.display);
          this.appState.data.playlists[playlistName] = trackDisplays;

          // Store track data for any new tracks not already in the system
          this.mergeImportedTracks(tracks);

          importedCount = 1;
          this.notificationSystem.success(`Created playlist "${playlistName}" with ${tracks.length} tracks from CSV`);

        } else {
          // Handle JSON import
          importData = JSON.parse(text);

          // Import regular playlists
          if (importData.playlists) {
          Object.entries(importData.playlists).forEach(([name, tracks]) => {
            if (Array.isArray(tracks)) {
              // Sanitize track names
              this.appState.data.playlists[name] = tracks.map(track =>
                this.SecurityUtils ? this.SecurityUtils.sanitizeText(track) : track
              );
              importedCount++;
            }
          });
        }

        // Import smart playlists
        if (importData.smartPlaylists) {
          if (!this.appState.data.smartPlaylists) {
            this.appState.data.smartPlaylists = {};
          }
          Object.entries(importData.smartPlaylists).forEach(([name, smartPlaylist]) => {
            if (smartPlaylist && smartPlaylist.rules) {
              this.appState.data.smartPlaylists[name] = smartPlaylist;
              importedCount++;
            }
          });
        }

        // Import other data if present
        if (importData.favorites) {
          this.appState.data.favorites = { ...this.appState.data.favorites, ...importData.favorites };
        }

        if (importData.trackTags) {
          this.appState.data.trackTags = { ...this.appState.data.trackTags, ...importData.trackTags };
        }

        if (importData.energyLevels) {
          this.appState.data.energyLevels = { ...this.appState.data.energyLevels, ...importData.energyLevels };
        }

        // Handle legacy format (just an object of playlists)
        if (!importData.playlists && !importData.smartPlaylists && typeof importData === 'object') {
          Object.entries(importData).forEach(([name, tracks]) => {
            if (Array.isArray(tracks)) {
              this.appState.data.playlists[name] = tracks.map(track =>
                this.SecurityUtils ? this.SecurityUtils.sanitizeText(track) : track
              );
              importedCount++;
            }
          });
          }
        }

        if (importedCount === 0) {
          this.notificationSystem.warning('No valid playlists found in the imported file');
          return;
        }

        // Save and update UI
        this.appState.saveToStorage();
        this.updatePlaylistSelector();
        this.updatePlaylistButtonStates();

        this.notificationSystem.success(`Successfully imported ${importedCount} playlist(s)`);

      } catch (error) {
        console.error('Import error:', error);
        this.notificationSystem.error('Error importing playlists. Please check file format.');
      }

      // Clear the input value so the same file can be imported again
      event.target.value = '';
    }, {
      component: 'UIController',
      method: 'importPlaylists',
      operation: 'playlist import',
      fallbackValue: null
    });
  }

  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  generatePlaylistNameFromFile(fileName) {
    // Extract playlist name from filename, removing extension and cleaning up
    let name = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    name = name.replace(/_tracks$/, ''); // Remove '_tracks' suffix if present
    name = name.replace(/[_-]/g, ' '); // Replace underscores and dashes with spaces
    name = name.replace(/\b\w/g, l => l.toUpperCase()); // Title case

    // Check if playlist already exists and add number if needed
    let finalName = name;
    let counter = 1;
    while (this.appState.data.playlists[finalName]) {
      finalName = `${name} (${counter})`;
      counter++;
    }

    return finalName;
  }

  parseCSVTracks(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Skip header line
    const dataLines = lines.slice(1);
    const tracks = [];

    dataLines.forEach((line, index) => {
      try {
        const values = this.parseCSVLine(line);
        if (values.length >= 4) { // Minimum: Artist, Title, Key, BPM
          const track = {
            artist: values[0] || '',
            title: values[1] || '',
            key: values[2] || '',
            bpm: values[3] || '',
            duration: values[4] || '',
            year: values[5] || '',
            path: values[6] || '',
            genre: values[7] || '',
            label: values[9] || ''
          };

          // Parse energy level from "Energy X" format
          const energyStr = values[8] || '';
          if (energyStr.startsWith('Energy ')) {
            const energyLevel = parseInt(energyStr.replace('Energy ', ''));
            if (!isNaN(energyLevel) && energyLevel >= 1 && energyLevel <= 10) {
              // Store energy level separately
              track.energy = energyLevel;
            }
          }

          // Create display name (same format as main tracklist)
          track.display = `${track.artist} - ${track.title} - ${track.key} - ${track.bpm}`;

          tracks.push(track);
        }
      } catch (error) {
        console.warn(`Error parsing CSV line ${index + 2}:`, error);
      }
    });

    return tracks;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current.trim());
    return result;
  }

  mergeImportedTracks(tracks) {
    // Add imported tracks to the main tracklist if they don't already exist
    const existingDisplays = new Set(
      (this.appState.data.tracksForUI || []).map(track => track.display)
    );

    tracks.forEach(track => {
      if (!existingDisplays.has(track.display)) {
        // Add to main tracklist
        if (!this.appState.data.tracksForUI) {
          this.appState.data.tracksForUI = [];
        }
        this.appState.data.tracksForUI.push(track);

        // Store energy level if present
        if (track.energy) {
          if (!this.appState.data.energyLevels) {
            this.appState.data.energyLevels = {};
          }
          this.appState.data.energyLevels[track.display] = track.energy;
        }
      }
    });
  }

  updatePlaylistButtonStates() {
    const currentPlaylist = this.appState.data.currentPlaylist;
    const selected = currentPlaylist && currentPlaylist !== '' && currentPlaylist !== 'favorites';

    // Enable/disable rename and delete buttons based on selection
    document.getElementById('rename-playlist-btn')?.toggleAttribute('disabled', !selected);
    document.getElementById('delete-playlist-btn')?.toggleAttribute('disabled', !selected);

    // Export button should be enabled if there are any playlists
    const hasPlaylists = Object.keys(this.appState.data.playlists || {}).length > 0 ||
                        Object.keys(this.appState.data.smartPlaylists || {}).length > 0;
    document.getElementById('export-playlist-btn')?.toggleAttribute('disabled', !hasPlaylists);
  }

  populateFilterDropdowns() {
    const tracks = this.appState.data.tracksForUI || [];
    if (tracks.length === 0) return;

    // Collect unique values for each filter
    const filterData = {
      bpms: new Set(),
      keys: new Set(),
      genres: new Set(),
      labels: new Set()
    };

    tracks.forEach(track => {
      if (track.bpm && track.bpm !== 'Unknown') {
        filterData.bpms.add(track.bpm);
      }
      if (track.key && track.key !== 'Unknown') {
        filterData.keys.add(track.key);
      }
      if (track.genre && track.genre !== 'Unknown') {
        filterData.genres.add(track.genre);
      }
      if (track.recordLabel && track.recordLabel !== 'Unknown') {
        filterData.labels.add(track.recordLabel);
      }
    });

    // Populate BPM filter
    this.populateSelectOptions('bpm-filter',
      Array.from(filterData.bpms).sort((a, b) => parseInt(a) - parseInt(b)),
      'All BPMs'
    );

    // Populate Key filter
    this.populateSelectOptions('key-filter',
      Array.from(filterData.keys).sort(),
      'All Keys'
    );

    // Populate Genre filter
    this.populateSelectOptions('genre-filter',
      Array.from(filterData.genres).sort(),
      'All Genres'
    );

    // Populate Label filter
    this.populateSelectOptions('label-filter',
      Array.from(filterData.labels).sort(),
      'All Labels'
    );
  }

  populateSelectOptions(selectId, options, defaultText) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Clear existing options except the first (default) one
    while (select.options.length > 1) {
      select.removeChild(select.lastChild);
    }

    // Update default option text
    if (select.options[0]) {
      select.options[0].textContent = defaultText;
    }

    // Add new options
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option;
      select.appendChild(optionElement);
    });
  }

  exportTags() {
    const tags = this.appState.data.trackTags || {};
    const energyLevels = this.appState.data.energyLevels || {};

    // Get all tracks that have tags
    const taggedTrackDisplays = Object.keys(tags);

    if (taggedTrackDisplays.length === 0) {
      this.notificationSystem.warning('No tagged tracks found to export');
      return;
    }

    // Find the actual track data for tagged tracks
    const taggedTracks = [];
    const allTracks = this.appState.data.tracksForUI || [];

    taggedTrackDisplays.forEach(trackDisplay => {
      const track = allTracks.find(t => t.display === trackDisplay);
      if (track) {
        // Create track object with tag information
        const trackWithTags = {
          ...track,
          tags: tags[trackDisplay] || [],
          energy: energyLevels[trackDisplay] || null
        };
        taggedTracks.push(trackWithTags);
      }
    });

    if (taggedTracks.length === 0) {
      this.notificationSystem.warning('No track data found for tagged tracks');
      return;
    }

    // Create CSV content with tagged tracks only
    const csvHeaders = 'Artist,Title,Key,BPM,Duration,Year,Path,Genre,Energy,Label,Tags\n';
    const csvRows = taggedTracks.map(track => {
      const energy = track.energy ? `Energy ${track.energy}` : '';
      const tagList = (track.tags || []).join('; ');

      // Escape CSV values that contain commas or quotes
      const escapeCSV = (value) => {
        if (typeof value !== 'string') value = String(value || '');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      };

      return [
        escapeCSV(track.artist || ''),
        escapeCSV(track.title || ''),
        escapeCSV(track.key || ''),
        escapeCSV(track.bpm || ''),
        escapeCSV(track.duration || ''),
        escapeCSV(track.year || ''),
        escapeCSV(track.path || ''),
        escapeCSV(track.genre || ''),
        escapeCSV(energy),
        escapeCSV(track.label || ''),
        escapeCSV(tagList)
      ].join(',');
    }).join('\n');

    const csvContent = csvHeaders + csvRows;
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(csvBlob);
    link.href = url;
    link.download = `beatrove-tagged-tracks-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL immediately after download
    setTimeout(() => URL.revokeObjectURL(url), 100);

    if (this.notificationSystem) {
      this.notificationSystem.success(`Exported ${taggedTracks.length} tagged tracks to CSV`);
    }
  }

  handleImportTags(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // Validate import data
        if (!importData.tags && !importData.energyLevels) {
          throw new Error('Invalid tags file format');
        }

        // Import tags
        if (importData.tags) {
          Object.assign(this.appState.data.trackTags, importData.tags);
        }

        // Import energy levels
        if (importData.energyLevels) {
          Object.assign(this.appState.data.energyLevels, importData.energyLevels);
        }

        this.appState.saveToStorage();
        this.renderer.render();

        const tagsCount = Object.keys(importData.tags || {}).length;
        const energyCount = Object.keys(importData.energyLevels || {}).length;

        if (this.notificationSystem) {
          this.notificationSystem.success(`Imported ${tagsCount} tags and ${energyCount} energy levels`);
        }

      } catch (error) {
        if (this.notificationSystem) {
          this.notificationSystem.error('Error importing tags: Invalid file format');
        }
      }
    };

    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  }

  exportAll() {
    const exportData = {
      playlists: this.appState.data.playlists || {},
      favoriteTracks: this.appState.data.favoriteTracks || {},
      trackTags: this.appState.data.trackTags || {},
      energyLevels: this.appState.data.energyLevels || {},
      currentPlaylist: this.appState.data.currentPlaylist || '',
      themePreference: this.appState.data.themePreference || 'dark',
      accentColor: this.appState.data.accentColor || 'red',
      tracksPerPage: this.appState.data.tracksPerPage || 100,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(dataBlob);
    link.href = url;
    link.download = `beatrove-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL immediately after download
    setTimeout(() => URL.revokeObjectURL(url), 100);

    if (this.notificationSystem) {
      this.notificationSystem.success('Full backup exported successfully');
    }
  }

  handleImportAll(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // Validate import data
        if (!importData.version) {
          throw new Error('Invalid backup file format');
        }

        // Import all data
        if (importData.playlists) {
          this.appState.data.playlists = importData.playlists;
        }
        if (importData.favoriteTracks) {
          this.appState.data.favoriteTracks = importData.favoriteTracks;
        }
        if (importData.trackTags) {
          this.appState.data.trackTags = importData.trackTags;
        }
        if (importData.energyLevels) {
          this.appState.data.energyLevels = importData.energyLevels;
        }
        if (importData.currentPlaylist) {
          this.appState.data.currentPlaylist = importData.currentPlaylist;
        }
        if (importData.themePreference) {
          this.appState.data.themePreference = importData.themePreference;
        }
        if (importData.accentColor) {
          this.appState.data.accentColor = importData.accentColor;
        }
        if (importData.tracksPerPage) {
          this.appState.data.tracksPerPage = importData.tracksPerPage;
        }

        this.appState.saveToStorage();

        // Update UI components
        this.updatePlaylistSelector();
        this.populateFilterDropdowns();
        this.renderer.render();

        // Apply imported theme and accent color
        if (importData.themePreference) {
          const themeToggle = document.getElementById('theme-toggle');
          if (themeToggle) {
            themeToggle.checked = importData.themePreference === 'light';
            document.body.classList.toggle('light-mode', importData.themePreference === 'light');
          }
        }
        if (importData.accentColor) {
          const accentColorSelect = document.getElementById('accent-color-select');
          if (accentColorSelect) {
            accentColorSelect.value = importData.accentColor;
            this.changeAccentColor(importData.accentColor);
          }
        }
        if (importData.tracksPerPage) {
          const tracksPerPageSelectTop = document.getElementById('tracks-per-page-select');
          const tracksPerPageSelectBottom = document.getElementById('tracks-per-page-select-bottom');
          if (tracksPerPageSelectTop) {
            tracksPerPageSelectTop.value = importData.tracksPerPage;
          }
          if (tracksPerPageSelectBottom) {
            tracksPerPageSelectBottom.value = importData.tracksPerPage;
          }
          this.renderer.setTracksPerPage(importData.tracksPerPage);
        }

        const playlistsCount = Object.keys(importData.playlists || {}).length;
        const favoritesCount = Object.keys(importData.favoriteTracks || {}).length;
        const tagsCount = Object.keys(importData.trackTags || {}).length;

        if (this.notificationSystem) {
          this.notificationSystem.success(`Imported ${playlistsCount} playlists, ${favoritesCount} favorites, and ${tagsCount} tags`);
        }

      } catch (error) {
        if (this.notificationSystem) {
          this.notificationSystem.error('Error importing backup: Invalid file format');
        }
      }
    };

    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  }

  setupGlobalClickHandler() {
    // Consolidated click handler for all dynamic elements
    document.addEventListener('click', (e) => {

      // Clear search button
      if (e.target.id === 'clear-search') {
        console.log('Clear search button clicked');
        const searchInput = document.getElementById('search');
        if (searchInput) {
          console.log('Search input found, clearing value:', searchInput.value);
          searchInput.value = '';
          e.target.classList.remove('visible');
          this.renderer.render();
          console.log('Search cleared and render called');
        } else {
          console.log('Search input not found!');
        }
      }
      // Close duplicates
      else if (e.target.id === 'close-duplicates') {
        this.hideDuplicatesView();
      }
    });
  }

  setupAZBarHandler() {
    // A-Z alphabetical filter bar
    const azBar = document.getElementById('az-bar');
    if (azBar) {
      azBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('az-letter')) {
          // Remove active class from all letters
          document.querySelectorAll('.az-letter').forEach(btn => btn.classList.remove('active'));
          // Add active class to clicked letter
          e.target.classList.add('active');

          // Handle "ALL" button - clear the filter
          if (e.target.dataset.letter === 'all') {
            this.renderer.clearAZFilter();
          } else {
            // Jump to artists starting with this letter
            this.renderer.jumpToArtist(e.target.dataset.letter);
          }
        }
      });
    }
  }

  /**
   * Add tracked event listener for proper cleanup
   * @param {Element} element - DOM element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  addTrackedEventListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);

    if (!this.activeEventListeners.has(element)) {
      this.activeEventListeners.set(element, []);
    }

    this.activeEventListeners.get(element).push({
      event,
      handler,
      options
    });

    // Mark element as having tracked listeners
    element.setAttribute('data-has-listeners', 'true');
    if (!element._eventListeners) {
      element._eventListeners = [];
    }
    element._eventListeners.push({event, handler});
  }

  /**
   * Remove tracked event listeners for an element
   * @param {Element} element - DOM element
   */
  removeTrackedEventListeners(element) {
    const listeners = this.activeEventListeners.get(element);
    if (listeners) {
      listeners.forEach(({event, handler, options}) => {
        element.removeEventListener(event, handler, options);
      });
      this.activeEventListeners.delete(element);
    }

    element.removeAttribute('data-has-listeners');
    delete element._eventListeners;
  }

  /**
   * Cleanup all tracked event listeners and resources
   */
  cleanup() {
    // Clean up tag popup
    this.cleanupTagPopup();

    // Clean up mood vibe popup
    this.cleanupMoodVibePopup();

    // Clean up all tracked event listeners
    for (const [element, listeners] of this.activeEventListeners.entries()) {
      listeners.forEach(({event, handler, options}) => {
        this.errorHandler.safe(() => {
          element.removeEventListener(event, handler, options);
        }, {
          component: 'UIController',
          method: 'cleanup',
          showUser: false,
          logToConsole: false
        });
      });
    }

    this.activeEventListeners.clear();

    // Cleanup chart instances
    [this.genreChart, this.bpmChart, this.keyChart, this.energyChart, this.labelsChart].forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        this.errorHandler.safe(() => {
          chart.destroy();
        }, {
          component: 'UIController',
          method: 'cleanup',
          operation: 'chart cleanup',
          showUser: false
        });
      }
    });

    // Clear chart references
    this.genreChart = null;
    this.bpmChart = null;
    this.keyChart = null;
    this.energyChart = null;
    this.labelsChart = null;
  }
}