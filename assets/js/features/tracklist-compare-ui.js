/**
 * Tracklist Comparison UI Controller
 * Handles all UI interactions for the tracklist comparison feature
 */

'use strict';

import { SecurityUtils } from '../core/security-utils.js';
import { TracklistComparer } from './tracklist-comparer.js';

export class TracklistCompareUI {
  constructor(notificationSystem, applicationState) {
    this.notificationSystem = notificationSystem;
    this.applicationState = applicationState;
    this.comparer = new TracklistComparer(notificationSystem, applicationState);
    this.currentTab = 'all';

    // Defer initialization to ensure DOM is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initElements();
        this.attachEventListeners();
      });
    } else {
      // DOM already loaded, but use setTimeout to ensure all elements are rendered
      setTimeout(() => {
        this.initElements();
        this.attachEventListeners();
      }, 0);
    }
  }

  initElements() {
    // Use querySelector as fallback since getElementById is failing
    this.modal = document.querySelector('#tracklist-compare-modal') || document.getElementById('tracklist-compare-modal');
    this.compareBtn = document.querySelector('#compare-tracklist-btn') || document.getElementById('compare-tracklist-btn');
    this.compareInput = document.querySelector('#compare-tracklist-input') || document.getElementById('compare-tracklist-input');
    this.closeModalBtn = document.querySelector('#close-compare-modal') || document.getElementById('close-compare-modal');
    this.closeBtn = document.querySelector('#close-compare-btn') || document.getElementById('close-compare-btn');
    this.dropzone = document.querySelector('#compare-dropzone') || document.getElementById('compare-dropzone');
    this.resultsSection = document.querySelector('#compare-results') || document.getElementById('compare-results');
    this.tracksList = document.querySelector('#compare-tracks-list') || document.getElementById('compare-tracks-list');

    // Stats elements
    this.totalTracksEl = document.querySelector('#compare-total-tracks') || document.getElementById('compare-total-tracks');
    this.matchedTracksEl = document.querySelector('#compare-matched-tracks') || document.getElementById('compare-matched-tracks');
    this.missingTracksEl = document.querySelector('#compare-missing-tracks') || document.getElementById('compare-missing-tracks');
    this.percentageEl = document.querySelector('#compare-percentage') || document.getElementById('compare-percentage');

    // Export buttons
    this.exportCSVBtn = document.querySelector('#export-missing-csv') || document.getElementById('export-missing-csv');
    this.exportTXTBtn = document.querySelector('#export-missing-txt') || document.getElementById('export-missing-txt');
    this.exportPlaylistBtn = document.querySelector('#export-matched-playlist') || document.getElementById('export-matched-playlist');

    // Tab buttons
    this.tabButtons = document.querySelectorAll('.compare-tab');
  }

  attachEventListeners() {
    // Open modal
    this.compareBtn?.addEventListener('click', () => {
      this.openModal();
    });

    // Close modal
    this.closeModalBtn?.addEventListener('click', () => this.closeModal());
    this.closeBtn?.addEventListener('click', () => this.closeModal());

    // Dropzone interactions
    this.dropzone?.addEventListener('click', () => this.compareInput?.click());
    this.dropzone?.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.dropzone?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.dropzone?.addEventListener('drop', (e) => this.handleDrop(e));

    // File input
    this.compareInput?.addEventListener('change', (e) => this.handleFileSelect(e));

    // Export buttons
    this.exportCSVBtn?.addEventListener('click', () => this.exportMissingCSV());
    this.exportTXTBtn?.addEventListener('click', () => this.exportMissingTXT());
    this.exportPlaylistBtn?.addEventListener('click', () => this.createMatchedPlaylist());

    // Tab switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Close modal on backdrop click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  openModal() {
    if (!this.modal) {
      return;
    }
    this.modal.classList.remove('hidden');
    this.resetModal();
  }

  closeModal() {
    this.modal?.classList.add('hidden');
    this.resetModal();
  }

  resetModal() {
    this.resultsSection.style.display = 'none';
    this.dropzone.style.display = 'block';
    this.currentTab = 'all';
    this.comparer.clearResults();

    // Reset file input
    if (this.compareInput) {
      this.compareInput.value = '';
    }

    // Reset tabs
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'all');
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropzone.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropzone.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropzone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  async processFile(file) {
    // Validate file type
    const validTypes = ['.txt', '.csv'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(fileExt)) {
      this.notificationSystem.error('Invalid file type. Please upload a TXT or CSV file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.notificationSystem.error('File too large. Maximum size is 5MB.');
      return;
    }

    try {
      const loadingNotif = this.notificationSystem.info('Analyzing tracklist...', 30000);

      // Read file
      const fileContent = await this.readFile(file);

      // Parse DJ set tracklist
      const djSetTracks = this.comparer.parseDJSetTracklist(fileContent);

      if (djSetTracks.length === 0) {
        loadingNotif.close();
        this.notificationSystem.error('No tracks found in file. Please check the format.');
        return;
      }

      // Get library tracks (flat array from appState)
      const libraryTracks = this.applicationState?.data?.tracksForUI || window.tracksForUI || [];

      if (libraryTracks.length === 0) {
        loadingNotif.close();
        this.notificationSystem.error('No tracks in library! Please upload your main tracklist using the "📁 Upload Tracklist" button first, then try comparing again.');

        // Also show an alert as fallback
        alert('⚠️ No tracks in library!\n\nPlease upload your main music tracklist first using the "📁 Upload Tracklist" button at the top of the page.\n\nThen you can use this feature to compare DJ sets against your library.');
        return;
      }

      // Compare with library
      const results = this.comparer.compareWithLibrary(djSetTracks, libraryTracks);

      loadingNotif.close();

      // Display results
      this.displayResults(results);

      this.notificationSystem.success(
        `Analysis complete! ${results.matched.length} matched, ${results.missing.length} missing`,
        5000
      );
    } catch (error) {
      console.error('Error processing tracklist:', error);
      this.notificationSystem.error('Error processing file: ' + error.message);
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  displayResults(results) {
    // Hide dropzone, show results
    this.dropzone.style.display = 'none';
    this.resultsSection.style.display = 'block';

    // Update stats
    this.totalTracksEl.textContent = results.totalTracks;
    this.matchedTracksEl.textContent = results.matched.length;
    this.missingTracksEl.textContent = results.missing.length;
    this.percentageEl.textContent = results.matchRate.toFixed(1) + '%';

    // Enable/disable export buttons
    this.exportCSVBtn.disabled = results.missing.length === 0;
    this.exportTXTBtn.disabled = results.missing.length === 0;
    this.exportPlaylistBtn.disabled = results.matched.length === 0;

    // Render tracks for current tab
    this.renderTracksList();
  }

  switchTab(tab) {
    this.currentTab = tab;

    // Update tab buttons
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Render tracks for selected tab
    this.renderTracksList();
  }

  renderTracksList() {
    const results = this.comparer.getResults();
    if (!results) return;

    let tracksToRender = [];

    switch (this.currentTab) {
      case 'all':
        tracksToRender = [
          ...results.matched.map(item => ({ ...item, status: 'matched' })),
          ...results.missing.map(item => ({ ...item, status: 'missing' }))
        ];
        break;
      case 'matched':
        tracksToRender = results.matched.map(item => ({ ...item, status: 'matched' }));
        break;
      case 'missing':
        tracksToRender = results.missing.map(item => ({ ...item, status: 'missing' }));
        break;
    }

    if (tracksToRender.length === 0) {
      this.tracksList.innerHTML = '<p class="no-tracks">No tracks to display</p>';
      return;
    }

    const html = tracksToRender.map((item, index) => {
      const track = item.djTrack;
      const statusClass = item.status;
      const statusIcon = item.status === 'matched' ? '✅' : '❌';
      const confidence = item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '';

      let matchInfo = '';
      if (item.status === 'matched') {
        const libTrack = item.libraryTrack;
        matchInfo = `
          <div class="match-info">
            <span class="match-label">Matched with:</span>
            <span class="match-track">${SecurityUtils.escapeHtml(libTrack.artist)} - ${SecurityUtils.escapeHtml(libTrack.title)}</span>
            ${confidence ? `<span class="match-confidence">${confidence} match</span>` : ''}
          </div>
        `;
      } else if (item.bestAttempt && confidence) {
        matchInfo = `
          <div class="match-info low-confidence">
            <span class="match-label">Closest match (${confidence}):</span>
            <span class="match-track">${SecurityUtils.escapeHtml(item.bestAttempt.artist)} - ${SecurityUtils.escapeHtml(item.bestAttempt.title)}</span>
          </div>
        `;
      }

      return `
        <div class="compare-track-item ${statusClass}">
          <div class="track-status">${statusIcon}</div>
          <div class="track-details">
            <div class="track-main">
              <span class="track-artist">${SecurityUtils.escapeHtml(track.artist)}</span>
              <span class="track-separator">-</span>
              <span class="track-title">${SecurityUtils.escapeHtml(track.title)}</span>
            </div>
            <div class="track-meta">
              ${track.bpm ? `<span class="track-bpm">${track.bpm} BPM</span>` : ''}
              ${track.key ? `<span class="track-key">${track.key}</span>` : ''}
              ${track.label ? `<span class="track-label">[${SecurityUtils.escapeHtml(track.label)}]</span>` : ''}
            </div>
            ${matchInfo}
          </div>
        </div>
      `;
    }).join('');

    this.tracksList.innerHTML = html;
  }

  exportMissingCSV() {
    this.comparer.exportMissingAsCSV();
  }

  exportMissingTXT() {
    this.comparer.exportMissingAsTXT();
  }

  createMatchedPlaylist() {
    const playlistData = this.comparer.createPlaylistFromMatched();

    if (!playlistData) {
      return;
    }

    // Prompt for playlist name
    const playlistName = prompt('Enter playlist name:', playlistData.name);

    if (!playlistName) {
      return;
    }

    try {
      // Get existing playlists from localStorage
      let playlists = JSON.parse(localStorage.getItem('playlists') || '{}');

      // Check if playlist name already exists
      if (playlists[playlistName]) {
        const overwrite = confirm(`Playlist "${playlistName}" already exists. Overwrite?`);
        if (!overwrite) {
          return;
        }
      }

      // Create playlist
      playlists[playlistName] = {
        type: 'regular',
        tracks: playlistData.tracks
      };

      // Save to localStorage
      localStorage.setItem('playlists', JSON.stringify(playlists));

      this.notificationSystem.success(`Created playlist "${playlistName}" with ${playlistData.count} tracks`);

      // Trigger playlist refresh if function exists
      if (window.populatePlaylistDropdown) {
        window.populatePlaylistDropdown();
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      this.notificationSystem.error('Failed to create playlist: ' + error.message);
    }
  }
}
