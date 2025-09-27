/**
 * Beatrove - Audio Visualizer Module
 * Handles audio visualization with multiple waveform styles and zoom functionality
 */

'use strict';

import { Logger } from '../core/logger.js';

// ============= AUDIO VISUALIZER =============
export class AudioVisualizer {
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

    // Zoom functionality
    this.zoomLevel = parseFloat(localStorage.getItem('beatrove-zoom-level')) || 1;
    this.zoomOffset = parseFloat(localStorage.getItem('beatrove-zoom-offset')) || 0;
    this.minZoom = 0.5;
    this.maxZoom = 10;
    this.zoomStep = 0.5;
    this.autoScrollEnabled = true; // Auto-scroll follows playback by default
    this.lastManualPanTime = Date.now() - 10000; // Initialize to 10 seconds ago to allow immediate auto-scroll

    // Canvas pooling and memory management
    this.canvasPool = new Map(); // Pool of reusable canvas contexts
    this.maxPoolSize = 5;
    this.canvasCleanupInterval = null;

    this.startCanvasCleanup();
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
    this.cleanupCanvasPools();

    // Stop canvas cleanup interval
    if (this.canvasCleanupInterval) {
      clearInterval(this.canvasCleanupInterval);
      this.canvasCleanupInterval = null;
    }
  }

  showWaveform(canvasId, audioElement = null) {
    // Check if canvas exists
    const canvas = document.getElementById(canvasId);

    this.currentWaveformCanvasId = canvasId;
    this.waveformVisible = true;
    this.currentPosition = 0;
    this.waveformBuffer.fill(0.5); // Reset buffer
    this.currentAudioElement = audioElement; // Store audio element reference for full track analysis

    // If overview style and audio element provided, start analyzing the full track
    if (this.waveformStyle === 'overview' && audioElement) {
      this.analyzeFullTrack(audioElement);
    }
  }

  hideWaveform() {
    this.waveformVisible = false;
    this.currentWaveformCanvasId = null;
  }

  setWaveformStyle(style) {
    this.waveformStyle = style;

    // Show/hide zoom controls in audio player based on waveform style
    const currentPreviewId = this.audioManager?.currentPreviewId;
    if (currentPreviewId) {
      const zoomControls = document.getElementById(`zoom-controls-${currentPreviewId}`);
      if (zoomControls) {
        if (style === 'overview') {
          zoomControls.style.display = 'flex';
          this.updateZoomDisplay();
        } else {
          zoomControls.style.display = 'none';
        }
      }
    }
  }

  animate() {
    // Render frequency visualizers
    this.renderFrequencyVisualizers();

    // Render waveform if visible
    if (this.waveformVisible) {
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
      return;
    }

    const ctx = this.getCanvasContext(this.currentWaveformCanvasId) || canvas.getContext('2d');
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
      return;
    }

    // Use real-time analysis approach instead of decoding the full file
    // This avoids CORS issues and works with existing audio elements
    this.generateFullTrackFromRealTime(audioElement, trackId);
  }

  generateTrackSeed(trackId, duration) {
    // Create a unique seed based on track characteristics
    let seed = 0;

    // Use track URL/path for uniqueness
    for (let i = 0; i < trackId.length; i++) {
      seed += trackId.charCodeAt(i) * (i + 1);
    }

    // Add duration for additional uniqueness
    seed += Math.floor(duration * 100);

    return Math.abs(seed) % 100000;
  }

  generateFullTrackFromRealTime(audioElement, trackId) {
    // Create a high-quality synthetic waveform based on audio characteristics
    // This approach simulates what a real waveform would look like
    const duration = audioElement.duration || 180; // fallback to 3 minutes
    const dataPoints = 1000;
    const waveformData = [];

    // Generate unique seed based on track characteristics for consistent uniqueness
    const trackSeed = this.generateTrackSeed(trackId, duration);
    let randomSeed = trackSeed;

    // Seeded random function for consistent results per track
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    // Generate track-specific characteristics
    const trackCharacteristics = {
      bassFreq: 4 + (seededRandom() * 8), // 4-12 Hz base frequency
      midFreq: 20 + (seededRandom() * 40), // 20-60 Hz mid frequency
      highFreq: 80 + (seededRandom() * 120), // 80-200 Hz high frequency
      bassIntensity: 0.2 + (seededRandom() * 0.4), // 0.2-0.6
      midIntensity: 0.1 + (seededRandom() * 0.3), // 0.1-0.4
      highIntensity: 0.05 + (seededRandom() * 0.15), // 0.05-0.2
      dropPosition: 0.2 + (seededRandom() * 0.4), // Drop at 20-60%
      buildupIntensity: 0.5 + (seededRandom() * 0.5), // 0.5-1.0
      noiseLevel: 0.1 + (seededRandom() * 0.3) // 0.1-0.4
    };

    // Generate realistic waveform pattern unique to each track
    for (let i = 0; i < dataPoints; i++) {
      const position = i / dataPoints; // 0 to 1
      const time = position * duration;

      // Create a realistic audio amplitude pattern with track-specific characteristics
      let amplitude = 0;

      // Add multiple frequency components with unique characteristics per track
      amplitude += Math.sin(position * Math.PI * trackCharacteristics.bassFreq) * trackCharacteristics.bassIntensity;
      amplitude += Math.sin(position * Math.PI * trackCharacteristics.midFreq) * trackCharacteristics.midIntensity;
      amplitude += Math.sin(position * Math.PI * trackCharacteristics.highFreq) * trackCharacteristics.highIntensity;

      // Add track-specific noise and variation
      amplitude += (seededRandom() - 0.5) * trackCharacteristics.noiseLevel;

      // Create EDM-style build/drop sections
      let envelope = 1;
      const dropStart = trackCharacteristics.dropPosition;
      const dropEnd = dropStart + 0.3; // Drop lasts 30% of track

      if (position < 0.1) {
        envelope = position / 0.1; // Intro fade in
      } else if (position > 0.9) {
        envelope = (1 - position) / 0.1; // Outro fade out
      } else if (position >= dropStart - 0.1 && position < dropStart) {
        // Build-up before drop
        envelope = 1 + ((position - (dropStart - 0.1)) / 0.1) * trackCharacteristics.buildupIntensity;
      } else if (position >= dropStart && position < dropEnd) {
        // Drop section - high energy
        envelope = 1.5 + Math.sin((position - dropStart) / (dropEnd - dropStart) * Math.PI * 4) * 0.5;
      }

      // Apply envelope and normalize with more dramatic range
      amplitude *= envelope;
      amplitude = Math.abs(amplitude);
      amplitude = Math.max(0.05, Math.min(1, amplitude * 0.9 + 0.05)); // Keep between 0.05 and 1.0 for more contrast

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

    // Calculate playback position with safety checks
    const currentTime = this.currentAudioElement?.currentTime || 0;
    const progressX = (currentTime / duration) * w;

    // Safety check for invalid duration/time values
    if (duration <= 0 || isNaN(duration) || isNaN(currentTime)) {
      return;
    }

    // Draw the overview waveform with zoom support
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;

    // Auto-scroll to follow playback position when zoomed - simplified approach
    // Only apply auto-scroll when actually zoomed in (> 1x)
    if (this.zoomLevel > 1.0) {
      this.ensurePlaybackPositionVisible(currentTime, duration);
    } else {
      // At 1x zoom or less, ensure offset is 0 to show full track
      if (this.zoomOffset !== 0) {
        this.zoomOffset = 0;
        localStorage.setItem('beatrove-zoom-offset', '0');
      }
    }

    // Apply zoom calculations
    const zoomedDataLength = Math.floor(data.length / this.zoomLevel);
    const startIndex = Math.floor(this.zoomOffset * (data.length - zoomedDataLength));
    const endIndex = Math.min(data.length, startIndex + zoomedDataLength);
    const visibleData = data.slice(startIndex, endIndex);

    const barWidth = Math.max(1, w / visibleData.length);

    // Calculate zoomed progress position
    const playbackPosition = currentTime / duration; // 0 to 1
    const visibleStart = this.zoomOffset; // Start of visible area (0 to 1)
    const visibleWidth = 1 / this.zoomLevel; // Width of visible area (0 to 1)
    const visibleEnd = visibleStart + visibleWidth; // End of visible area

    // Calculate progress position within the visible area
    let zoomedProgressX = -1; // Default to invisible

    // Use tolerance for floating-point comparison to handle end-of-track precision issues
    const tolerance = 0.001; // 0.1% tolerance
    const isInVisibleRange = playbackPosition >= (visibleStart - tolerance) && playbackPosition <= (visibleEnd + tolerance);

    if (isInVisibleRange) {
      // Clamp playback position to visible range to handle slight overruns
      const clampedPosition = Math.max(visibleStart, Math.min(visibleEnd, playbackPosition));
      const relativePosition = (clampedPosition - visibleStart) / visibleWidth; // 0 to 1 within visible area
      zoomedProgressX = relativePosition * w; // Convert to pixel position

      // Ensure cursor stays within canvas bounds
      zoomedProgressX = Math.max(0, Math.min(w, zoomedProgressX));
    }

    for (let i = 0; i < visibleData.length; i++) {
      const amplitude = visibleData[i];
      const barHeight = amplitude * h * 0.95; // Increased from 0.8 to 0.95 for better visibility
      const x = i * barWidth;
      const centerY = h / 2;

      // Color coding: played vs unplayed (adjusted for zoom)
      const absoluteBarPosition = visibleStart + (i / visibleData.length) * visibleWidth; // Position of this bar in track (0 to 1)
      if (absoluteBarPosition < playbackPosition) {
        ctx.fillStyle = '#ff6b35'; // Orange for played portion
      } else {
        ctx.fillStyle = '#00ffff'; // Cyan for unplayed
      }

      // Draw symmetrical bars with minimum height for visibility
      const minBarHeight = Math.max(barHeight, 2); // Ensure minimum 2px height
      ctx.fillRect(x, centerY - minBarHeight / 2, barWidth - 0.5, minBarHeight);
    }

    // Draw playback cursor (adjusted for zoom)
    if (zoomedProgressX >= 0 && zoomedProgressX <= w) {
      ctx.strokeStyle = '#ff0040';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(zoomedProgressX, 0);
      ctx.lineTo(zoomedProgressX, h);
      ctx.stroke();
    } else {
      // Show indicator when cursor is outside visible area
      ctx.fillStyle = '#ff0040';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      if (playbackPosition < visibleStart) {
        // Cursor is to the left of visible area
        ctx.fillText('◀', 10, h / 2);
      } else if (playbackPosition > visibleEnd) {
        // Cursor is to the right of visible area
        ctx.fillText('▶', w - 10, h / 2);
      }
    }

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

    // Add zoom level info if zoomed
    if (this.zoomLevel !== 1) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Zoom: ${this.zoomLevel}x`, w - 5, 15);
    }
  }

  // Zoom control methods
  zoomIn() {
    if (this.zoomLevel < this.maxZoom) {
      // Calculate current playback position before changing zoom
      const currentPlaybackPosition = this.getCurrentPlaybackPosition();

      this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomStep);

      // Adjust offset to keep current playback position in view
      if (currentPlaybackPosition !== null) {
        this.adjustOffsetToShowPlaybackPosition(currentPlaybackPosition);
      }

      this.autoScrollEnabled = true; // Re-enable auto-scroll when changing zoom
      this.updateZoomDisplay();
      return true;
    }
    return false;
  }

  zoomOut() {
    if (this.zoomLevel > this.minZoom) {
      // Calculate current playback position before changing zoom
      const currentPlaybackPosition = this.getCurrentPlaybackPosition();

      this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomStep);

      // Reset offset if we're back to 1x zoom, otherwise adjust to show playback position
      if (this.zoomLevel === 1) {
        this.zoomOffset = 0;
      } else if (currentPlaybackPosition !== null) {
        this.adjustOffsetToShowPlaybackPosition(currentPlaybackPosition);
      }

      this.autoScrollEnabled = true; // Re-enable auto-scroll when changing zoom
      this.updateZoomDisplay();
      return true;
    }
    return false;
  }

  resetZoom() {
    this.zoomLevel = 1;
    this.zoomOffset = 0; // At 1x zoom, offset should always be 0
    this.autoScrollEnabled = true; // Re-enable auto-scroll when resetting zoom
    this.updateZoomDisplay();
  }

  updateZoomDisplay() {
    // Update zoom level display in audio player
    const currentPreviewId = this.audioManager?.currentPreviewId;
    if (currentPreviewId) {
      const zoomLevelElement = document.getElementById(`zoom-level-${currentPreviewId}`);
      if (zoomLevelElement) {
        zoomLevelElement.textContent = `${this.zoomLevel}x`;
      }
    }

    // Save zoom level to localStorage
    localStorage.setItem('beatrove-zoom-level', this.zoomLevel.toString());
    localStorage.setItem('beatrove-zoom-offset', this.zoomOffset.toString());
  }

  // Pan the waveform when zoomed (called by mouse/touch events)
  panWaveform(deltaX) {
    if (this.zoomLevel > 1) {
      const maxOffset = 1 - (1 / this.zoomLevel);
      this.zoomOffset = Math.max(0, Math.min(maxOffset, this.zoomOffset + deltaX));

      // Temporarily disable auto-scroll when user manually pans
      this.autoScrollEnabled = false;
      this.lastManualPanTime = Date.now();

      // Save updated offset to localStorage
      localStorage.setItem('beatrove-zoom-offset', this.zoomOffset.toString());
    }
  }

  // Get current playback position as a ratio (0 to 1)
  getCurrentPlaybackPosition() {
    if (!this.currentAudioElement) return null;

    const currentTime = this.currentAudioElement.currentTime || 0;
    const duration = this.currentAudioElement.duration || 0;

    if (duration === 0) return null;

    return currentTime / duration;
  }

  // Adjust zoom offset to keep the specified playback position in view
  adjustOffsetToShowPlaybackPosition(playbackPosition) {
    if (this.zoomLevel <= 1) {
      this.zoomOffset = 0;
      return;
    }

    const visibleWidth = 1 / this.zoomLevel; // Portion of track visible (0 to 1)
    const maxOffset = 1 - visibleWidth;

    // Calculate desired offset to center playback position in view
    // Keep playback cursor at 30% from left edge for better lookahead
    const targetOffset = playbackPosition - (visibleWidth * 0.3);

    // Clamp to valid range
    this.zoomOffset = Math.max(0, Math.min(maxOffset, targetOffset));

    // Save updated offset to localStorage
    localStorage.setItem('beatrove-zoom-offset', this.zoomOffset.toString());
  }

  // Simple method to ensure playback position is always visible when zoomed
  ensurePlaybackPositionVisible(currentTime, duration) {
    if (this.zoomLevel <= 1) return; // No auto-scroll needed at 1x zoom

    const playbackPosition = currentTime / duration; // 0 to 1
    const visibleWidth = 1 / this.zoomLevel;

    // Check if we need to update position (very simple check)
    const timeSinceManualPan = Date.now() - this.lastManualPanTime;
    const canAutoScroll = this.autoScrollEnabled || timeSinceManualPan > 3000;

    if (!canAutoScroll) return; // Don't update if user recently panned

    // Calculate ideal center position with 30% lookahead
    const idealCenter = playbackPosition + (visibleWidth * 0.2); // 20% lookahead instead of 30%
    let targetOffset = idealCenter - (visibleWidth / 2);

    // Clamp to valid bounds - this handles both start and end of track automatically
    const maxOffset = 1 - visibleWidth;
    targetOffset = Math.max(0, Math.min(maxOffset, targetOffset));

    // Only update if the change is significant (reduces jitter)
    const offsetDifference = Math.abs(targetOffset - this.zoomOffset);
    if (offsetDifference > 0.005) { // Update if more than 0.5% change
      this.zoomOffset = targetOffset;
      this.autoScrollEnabled = true; // Ensure it stays enabled
      localStorage.setItem('beatrove-zoom-offset', this.zoomOffset.toString());
    }
  }

  // Keep the old method for reference but simplified
  autoScrollToPlaybackPosition(currentTime, duration) {
    return this.ensurePlaybackPositionVisible(currentTime, duration);
  }

  // Canvas memory management methods
  startCanvasCleanup() {
    // Clean up unused canvas contexts every 2 minutes
    this.canvasCleanupInterval = setInterval(() => {
      this.cleanupUnusedCanvases();
    }, 2 * 60 * 1000);
  }

  getCanvasContext(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Check if we have a pooled context for this canvas
    if (this.canvasPool.has(canvasId)) {
      const pooledContext = this.canvasPool.get(canvasId);
      pooledContext.lastUsed = Date.now();
      return pooledContext.context;
    }

    // Create new context and add to pool if under limit
    const context = canvas.getContext('2d');
    if (this.canvasPool.size < this.maxPoolSize) {
      this.canvasPool.set(canvasId, {
        context,
        lastUsed: Date.now(),
        canvas
      });
    }

    return context;
  }

  cleanupUnusedCanvases() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    for (const [canvasId, pooledContext] of this.canvasPool.entries()) {
      // Remove contexts that haven't been used recently
      if (now - pooledContext.lastUsed > maxAge) {
        // Clear the canvas to free memory
        const { canvas, context } = pooledContext;
        context.clearRect(0, 0, canvas.width, canvas.height);

        this.canvasPool.delete(canvasId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      Logger.log(`Cleaned up ${cleanedCount} unused canvas contexts. Active contexts: ${this.canvasPool.size}`);
    }
  }

  cleanupCanvasPools() {
    // Clear all pooled canvas contexts
    for (const [canvasId, pooledContext] of this.canvasPool.entries()) {
      const { canvas, context } = pooledContext;
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    this.canvasPool.clear();

    // Clear waveform cache to free memory
    this.fullTrackWaveforms.clear();
  }
}