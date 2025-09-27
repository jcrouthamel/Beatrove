/**
 * Beatrove - Audio Manager Module
 * Handles audio file management, playback, and Web Audio API integration
 */

'use strict';

import { CONFIG, SecurityUtils } from '../core/security-utils.js';
import { Logger } from '../core/logger.js';

// ============= AUDIO MANAGER =============
export class AudioManager {
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
  }

  startPeriodicCleanup() {
    // Clean up unused blob URLs every 30 seconds
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupUnusedBlobUrls();
      this.cleanupStaleAudioElements();
    }, 30000);
  }

  cleanupUnusedBlobUrls() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;

    for (const url of this.blobUrls) {
      // Clean up old URLs or URLs not currently in use
      const meta = this.blobMeta.get(url);
      if (meta && (now - meta.createdAt > maxAge) && url !== this.currentBlobUrl) {
        this.revokeBlobUrl(url);
        cleanedCount++;
      }
    }

    // Log cleanup stats for monitoring
    if (cleanedCount > 0) {
      Logger.log(`Cleaned up ${cleanedCount} unused blob URLs. Active URLs: ${this.blobUrls.size}`);
    }

    // Force garbage collection if available and many URLs were cleaned
    if (cleanedCount > 5 && window.gc) {
      window.gc();
    }
  }

  cleanup() {
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
      this.audioCtx.close().catch(() => {});
    }

    this.fileMap = {};
  }

  // Clean up stale audio elements that may be orphaned
  cleanupStaleAudioElements() {
    const audioElements = document.querySelectorAll('audio');
    let removedCount = 0;

    audioElements.forEach(audio => {
      // Remove audio elements that are ended, have no src, or are orphaned
      if (audio.ended || !audio.src || !audio.parentElement) {
        if (audio.src && audio.src.startsWith('blob:')) {
          this.revokeBlobUrl(audio.src);
        }
        if (audio.parentElement) {
          audio.parentElement.remove();
        }
        removedCount++;
      }
    });

    if (removedCount > 0) {
      Logger.log(`Cleaned up ${removedCount} stale audio elements`);
    }
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
      return;
    }

    // If already connected and working, don't reconnect
    if (this.reactToAudio && this.audioCtx && this.audioCtx.state === 'running') {
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
    } catch (error) {
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

      const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();

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
        }
      }

      if (!file) {
        throw new Error(`Audio file not found: ${fileName}. Available files: ${Object.keys(this.fileMap).slice(0, 5).join(', ')}${Object.keys(this.fileMap).length > 5 ? '...' : ''}`);
      }

      if (!SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        throw new Error('Unsupported audio file type');
      }

      // Clean up previous audio first, then set new preview ID
      await this.cleanupCurrentAudioAsync();
      this.currentPreviewId = previewId;

      // Check if this preview was superseded during cleanup
      if (this.currentPreviewId !== previewId) {
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

      // Add zoom controls to the audio player popup
      const zoomControlsContainer = document.createElement('div');
      zoomControlsContainer.className = 'audio-player-zoom-controls';
      zoomControlsContainer.id = `zoom-controls-${previewId}`;
      // Initially hide zoom controls - they will be shown when overview style is selected
      if (this.visualizer?.waveformStyle !== 'overview') {
        zoomControlsContainer.style.display = 'none';
      }

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.className = 'audio-zoom-btn';
      zoomOutBtn.textContent = '🔍-';
      zoomOutBtn.title = 'Zoom Out';

      const zoomLevel = document.createElement('span');
      zoomLevel.className = 'audio-zoom-level';
      zoomLevel.id = `zoom-level-${previewId}`;
      zoomLevel.textContent = '1x';

      const zoomInBtn = document.createElement('button');
      zoomInBtn.className = 'audio-zoom-btn';
      zoomInBtn.textContent = '🔍+';
      zoomInBtn.title = 'Zoom In';

      const zoomResetBtn = document.createElement('button');
      zoomResetBtn.className = 'audio-zoom-btn';
      zoomResetBtn.textContent = '↻';
      zoomResetBtn.title = 'Reset Zoom';

      zoomControlsContainer.appendChild(zoomOutBtn);
      zoomControlsContainer.appendChild(zoomLevel);
      zoomControlsContainer.appendChild(zoomInBtn);
      zoomControlsContainer.appendChild(zoomResetBtn);
      container.appendChild(zoomControlsContainer);

      // Check again if superseded before adding to DOM
      if (this.currentPreviewId !== previewId) {
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
      });

      audio.addEventListener('play', () => {
        // Reconnect visualizer if needed when resuming playback
        if (audio._previewId === this.currentPreviewId) {
          // Ensure visualizer is connected
          if (!this.reactToAudio) {
            this.connectVisualizer(audio, `waveform-${audio._previewId}`).catch(() => {});
          }
        }
      });

      audio.addEventListener('seeked', () => {
        // Ensure visualizer stays connected after seeking
        if (audio._previewId === this.currentPreviewId) {
          // Ensure visualizer is connected
          if (!this.reactToAudio) {
            this.connectVisualizer(audio, `waveform-${audio._previewId}`).catch(() => {});
          }
        }
      });

      // Prevent automatic pause when tab becomes inactive
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && audio && !audio.paused && audio._previewId === this.currentPreviewId) {
          // Keep playing in background - don't pause
        }
      });

      // Store cleanup handler
      audio._cleanupHandler = cleanupHandler;

      // Add zoom control event listeners
      zoomInBtn.addEventListener('click', () => {
        if (this.visualizer && this.currentPreviewId === previewId) {
          this.visualizer.zoomIn();
          const zoomLevelElement = document.getElementById(`zoom-level-${previewId}`);
          if (zoomLevelElement) {
            zoomLevelElement.textContent = `${this.visualizer.zoomLevel}x`;
          }
        }
      });

      zoomOutBtn.addEventListener('click', () => {
        if (this.visualizer && this.currentPreviewId === previewId) {
          this.visualizer.zoomOut();
          const zoomLevelElement = document.getElementById(`zoom-level-${previewId}`);
          if (zoomLevelElement) {
            zoomLevelElement.textContent = `${this.visualizer.zoomLevel}x`;
          }
        }
      });

      zoomResetBtn.addEventListener('click', () => {
        if (this.visualizer && this.currentPreviewId === previewId) {
          this.visualizer.resetZoom();
          const zoomLevelElement = document.getElementById(`zoom-level-${previewId}`);
          if (zoomLevelElement) {
            zoomLevelElement.textContent = `${this.visualizer.zoomLevel}x`;
          }
        }
      });

      // Connect visualizer only if still current
      if (this.currentPreviewId === previewId) {
        await this.connectVisualizer(audio, `waveform-${previewId}`);

        // Show waveform immediately to at least display the test pattern
        if (this.visualizer) {
          this.visualizer.showWaveform(`waveform-${previewId}`, audio);
        }

        // Wait for audio to start playing before showing waveform
        audio.addEventListener('play', () => {
          if (this.visualizer) {
            this.visualizer.showWaveform(`waveform-${previewId}`, audio);
          }
        }, { once: true });

        // Also try enabling waveform when audio data is loading
        audio.addEventListener('loadeddata', () => {
          if (this.visualizer) {
            this.visualizer.showWaveform(`waveform-${previewId}`, audio);
          }
        }, { once: true });
      }

    } catch (error) {
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
  }

  loadAudioFiles(files) {
    this.fileMap = {};
    files.forEach(file => {
      if (SecurityUtils.validateFileExtension(file.name, CONFIG.ALLOWED_AUDIO_EXTENSIONS)) {
        this.fileMap[file.name.toLowerCase()] = file;
      }
    });

    // Handle pending preview if there was one
    if (this.pendingPreviewTrack) {
      const track = this.pendingPreviewTrack;
      this.pendingPreviewTrack = null;
      // Play the pending track
      this.playPreview(track).catch(error => {
        console.error('Error playing pending preview:', error);
      });
    }

    return Object.keys(this.fileMap).length;
  }
}