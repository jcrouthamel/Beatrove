/**
 * Beatrove - Play Queue Module
 * Manages playlist playback queue with auto-play and auto-mix capabilities
 */

'use strict';

import { Logger } from '../core/logger.js';

// ============= PLAY QUEUE MANAGER =============
export class PlayQueueManager {
  constructor(audioManager, appState, notificationSystem = null) {
    this.audioManager = audioManager;
    this.appState = appState;
    this.notificationSystem = notificationSystem;

    // Queue state
    this.queue = []; // Array of track objects
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isAutoPlayEnabled = false;
    this.isAutoMixEnabled = false;
    this.crossfadeDuration = 5; // seconds

    // Auto-mix state
    this.crossfadeStartTime = null;
    this.fadingAudio = null;
    this.fadingContainer = null;

    // Event listeners
    this.onQueueChangeCallbacks = [];
    this.onTrackChangeCallbacks = [];
  }

  /**
   * Initialize the play queue with tracks from current filtered view
   * @param {Array} tracks - Array of track objects to add to queue
   */
  initializeQueue(tracks) {
    if (!tracks || tracks.length === 0) {
      if (this.notificationSystem) {
        this.notificationSystem.warning('No tracks available to play');
      }
      return false;
    }

    this.queue = [...tracks];
    this.currentIndex = -1;
    this.notifyQueueChange();

    Logger.log(`Play queue initialized with ${this.queue.length} tracks`);
    return true;
  }

  /**
   * Start playing the queue from the beginning
   */
  async playQueue() {
    if (this.queue.length === 0) {
      if (this.notificationSystem) {
        this.notificationSystem.warning('Queue is empty');
      }
      return;
    }

    this.isAutoPlayEnabled = true;
    this.currentIndex = -1;
    await this.playNext();
  }

  /**
   * Play the next track in the queue
   */
  async playNext() {
    if (!this.isAutoPlayEnabled) {
      return;
    }

    this.currentIndex++;

    console.log(`▶️ playNext called: new currentIndex=${this.currentIndex}, queue length=${this.queue.length}`);

    if (this.currentIndex >= this.queue.length) {
      // End of queue
      console.log(`▶️ Reached end of queue`);
      this.stop();
      if (this.notificationSystem) {
        this.notificationSystem.info('Playlist finished');
      }
      return;
    }

    const track = this.queue[this.currentIndex];
    console.log(`▶️ Playing track at index ${this.currentIndex}: ${track.artist} - ${track.title}`);
    this.isPlaying = true;
    this.notifyTrackChange(track);

    try {
      await this.audioManager.playPreview(track);

      // Setup audio ended callback for auto-advance
      this.audioManager.setOnAudioEnded(() => {
        if (this.isAutoPlayEnabled) {
          if (this.isAutoMixEnabled) {
            // For auto-mix, check if crossfade already started
            if (!this.crossfadeStartTime) {
              // Crossfade didn't start (maybe track too short), just advance
              this.playNext();
            }
            // If crossfade started, it will handle advancing via setTimeout
          } else {
            // Normal auto-advance without crossfade
            this.playNext();
          }
        }
      });

      // Setup auto-mix if enabled and there's a next track
      if (this.isAutoMixEnabled && this.currentIndex < this.queue.length - 1) {
        // Wait a bit for audio metadata to load before setting up automix
        setTimeout(() => {
          if (this.isAutoMixEnabled && this.audioManager.currentAudio) {
            this.setupAutoMix();
          }
        }, 100);
      }
    } catch (error) {
      Logger.error('Error playing track:', error);
      // Skip to next track on error
      await this.playNext();
    }
  }

  /**
   * Manually skip to next track (with crossfade if auto-mix enabled)
   */
  async skipToNext() {
    if (this.currentIndex >= this.queue.length - 1) {
      return; // Already at last track
    }

    // If auto-mix is enabled and currently playing, trigger crossfade
    if (this.isAutoMixEnabled && this.isPlaying && this.audioManager.currentAudio) {
      await this.startCrossfade();
    } else {
      // Otherwise just play next normally
      await this.playNext();
    }
  }

  /**
   * Play the previous track in the queue
   */
  async playPrevious() {
    if (this.currentIndex <= 0) {
      if (this.notificationSystem) {
        this.notificationSystem.info('Already at first track');
      }
      return;
    }

    this.currentIndex -= 2; // Go back two because playNext will increment
    await this.playNext();
  }

  /**
   * Stop playing the queue
   */
  stop() {
    this.isAutoPlayEnabled = false;
    this.isPlaying = false;
    this.cleanupCrossfade();

    // Clear audio ended callback
    if (this.audioManager) {
      this.audioManager.setOnAudioEnded(null);
    }

    this.notifyQueueChange();
  }

  /**
   * Pause/resume queue playback
   */
  togglePause() {
    if (this.audioManager.currentAudio) {
      if (this.audioManager.currentAudio.paused) {
        this.audioManager.currentAudio.play();
        this.isPlaying = true;
      } else {
        this.audioManager.currentAudio.pause();
        this.isPlaying = false;
      }
      this.notifyQueueChange();
    }
  }

  /**
   * Skip to a specific track in the queue
   * @param {number} index - Index of track to play
   */
  async skipToTrack(index) {
    if (index < 0 || index >= this.queue.length) {
      return;
    }

    this.currentIndex = index - 1; // Subtract 1 because playNext will increment
    await this.playNext();
  }

  /**
   * Enable/disable auto-mix crossfade
   * @param {boolean} enabled - Whether auto-mix should be enabled
   * @param {number} duration - Crossfade duration in seconds
   */
  setAutoMix(enabled, duration = 5) {
    this.isAutoMixEnabled = enabled;
    this.crossfadeDuration = Math.max(1, Math.min(15, duration)); // Clamp between 1-15 seconds

    Logger.log(`Auto-mix ${enabled ? 'enabled' : 'disabled'}, crossfade: ${this.crossfadeDuration}s`);
  }

  /**
   * Setup auto-mix crossfade for current track
   */
  setupAutoMix() {
    if (!this.audioManager.currentAudio) {
      return;
    }

    const audio = this.audioManager.currentAudio;
    const duration = audio.duration;

    if (!duration || isNaN(duration)) {
      Logger.log('Cannot setup automix: duration not available yet');
      // Try again after a short delay when metadata loads
      setTimeout(() => {
        if (this.isAutoMixEnabled && this.audioManager.currentAudio === audio) {
          this.setupAutoMix();
        }
      }, 500);
      return;
    }

    // Calculate when to start crossfade (crossfadeDuration seconds before end)
    const crossfadeStartTime = Math.max(0, duration - this.crossfadeDuration);

    Logger.log(`Auto-mix setup: will start crossfade at ${crossfadeStartTime.toFixed(1)}s (track duration: ${duration.toFixed(1)}s)`);

    // Monitor playback position
    const checkCrossfadeTime = () => {
      if (!audio || audio.paused || audio.ended || !this.isAutoMixEnabled) {
        return;
      }

      if (audio.currentTime >= crossfadeStartTime && !this.crossfadeStartTime) {
        this.startCrossfade();
      } else if (audio.currentTime < crossfadeStartTime) {
        // Not yet time, check again
        requestAnimationFrame(checkCrossfadeTime);
      }
    };

    requestAnimationFrame(checkCrossfadeTime);
  }

  /**
   * Start the crossfade transition to next track
   */
  async startCrossfade() {
    if (this.crossfadeStartTime) {
      Logger.log('Crossfade already in progress, skipping');
      return; // Already crossfading
    }

    this.crossfadeStartTime = Date.now();

    // Check if there's a next track
    if (this.currentIndex + 1 >= this.queue.length) {
      Logger.log('No next track available for crossfade');
      return;
    }

    const nextTrack = this.queue[this.currentIndex + 1];
    console.log(`🎚️ CROSSFADE START: Current=${this.currentIndex}, Next will be=${this.currentIndex + 1}: ${nextTrack.artist} - ${nextTrack.title}`);
    Logger.log(`Starting crossfade to: ${nextTrack.artist} - ${nextTrack.title}`);

    try {
      const currentAudio = this.audioManager.currentAudio;
      const currentAudioContainer = currentAudio?.parentElement;

      if (!currentAudio || !currentAudioContainer) {
        Logger.log('No current audio or container for crossfade');
        return;
      }

      console.log(`🎚️ Current audio found, volume: ${currentAudio.volume}, time: ${currentAudio.currentTime.toFixed(1)}s`);

      // Store reference to current audio for crossfade
      this.fadingAudio = currentAudio;
      this.fadingContainer = currentAudioContainer;

      // Mark this audio as fading so AudioManager won't clean it up immediately
      currentAudio._isFading = true;

      // Remove any 'ended' event listeners to prevent premature cleanup
      // The old audio element has an 'ended' listener that calls cleanup
      const oldEnded = currentAudio.onended;
      currentAudio.onended = null;

      // Add visual indicator that this player is fading
      currentAudioContainer.classList.add('fading');

      // Start fading out current track
      this.performFadeOut(currentAudio);

      // Tell AudioManager to start next track at volume 0 for crossfade
      this.audioManager.startNextAtZeroVolume = true;

      // Tell AudioManager to skip visualizer for the new track during crossfade
      // The old track will keep its visualizer until crossfade completes
      this.audioManager.skipVisualizerDuringCrossfade = true;

      // Start next track immediately (it will create a new audio player)
      await this.playNext();

      // Fade in the new track after a short delay to ensure it's playing
      setTimeout(() => {
        if (this.audioManager.currentAudio) {
          console.log(`🎚️ New audio created, starting fade in`);
          this.performFadeIn(this.audioManager.currentAudio);
        } else {
          console.log(`🎚️ ERROR: No current audio for fade in`);
        }
      }, 50);

      // Clean up the old fading audio after crossfade completes
      setTimeout(async () => {
        console.log(`🎚️ CROSSFADE COMPLETE: Cleaning up old audio player`);

        // Disconnect old visualizer and cleanup old audio
        this.audioManager.disconnectVisualizer(false);

        if (this.fadingContainer && this.fadingContainer.parentElement) {
          this.fadingContainer.remove();
        }
        if (this.fadingAudio && this.fadingAudio.src) {
          const url = this.fadingAudio.src;
          if (url.startsWith('blob:')) {
            this.audioManager.blobManager.revokeBlobUrl(url);
          }
        }
        this.fadingAudio = null;
        this.fadingContainer = null;

        // Re-enable visualizer for new audio
        this.audioManager.skipVisualizerDuringCrossfade = false;

        // Connect visualizer to new audio
        if (this.audioManager.currentAudio) {
          const previewId = this.audioManager.currentAudio._previewId;
          await this.audioManager.connectVisualizer(this.audioManager.currentAudio, `waveform-${previewId}`);

          // Show waveform for new track
          if (this.audioManager.visualizer) {
            this.audioManager.visualizer.showWaveform(`waveform-${previewId}`, this.audioManager.currentAudio);
          }
        }

        this.cleanupCrossfade();
      }, this.crossfadeDuration * 1000);

    } catch (error) {
      Logger.error('Error during crossfade:', error);
      console.error('🎚️ CROSSFADE ERROR:', error);
      this.cleanupCrossfade();
      // Fall back to regular next track
      await this.playNext();
    }
  }

  /**
   * Fade out audio element
   * @param {HTMLAudioElement} audio - Audio element to fade out
   */
  performFadeOut(audio) {
    const startTime = Date.now();
    const duration = this.crossfadeDuration * 1000; // Convert to milliseconds
    const startVolume = audio.volume;

    console.log(`🎚️ FADE OUT started: duration=${this.crossfadeDuration}s, startVolume=${startVolume}, paused=${audio.paused}, ended=${audio.ended}`);

    const fadeCurve = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Check audio state
      if (!audio) {
        console.log(`🎚️ FADE OUT stopped: audio element is null at ${elapsed}ms`);
        return;
      }

      if (audio.paused) {
        console.log(`🎚️ FADE OUT stopped: audio is paused at ${elapsed}ms, volume=${audio.volume}`);
      }

      if (audio.ended) {
        console.log(`🎚️ FADE OUT stopped: audio has ended at ${elapsed}ms, volume=${audio.volume}`);
      }

      // Fade out current track - continue even if paused/ended to ensure volume reaches 0
      if (audio) {
        const newVolume = Math.max(0, startVolume * (1 - progress));
        audio.volume = newVolume;

        // Log volume at intervals to verify fade is happening
        if (elapsed % 2000 < 50) { // Log approximately every 2 seconds
          console.log(`🎚️ FADE OUT progress: ${(progress * 100).toFixed(0)}%, volume=${newVolume.toFixed(2)}, time=${audio.currentTime.toFixed(1)}s, playing=${!audio.paused}`);
        }
      }

      if (progress < 1 && audio) {
        requestAnimationFrame(fadeCurve);
      } else {
        const finalStatus = audio ? `volume=${audio.volume}, paused=${audio.paused}, ended=${audio.ended}` : 'audio=null';
        console.log(`🎚️ FADE OUT complete: ${finalStatus}`);
      }
    };

    requestAnimationFrame(fadeCurve);
  }

  /**
   * Fade in audio element
   * @param {HTMLAudioElement} audio - Audio element to fade in
   */
  performFadeIn(audio) {
    if (!audio) {
      console.log(`🎚️ FADE IN error: no audio element`);
      return;
    }

    // Check if audio is playing
    if (audio.paused) {
      console.log(`🎚️ FADE IN warning: audio is paused, attempting to play`);
      audio.play().catch(err => console.error('Failed to play audio for fade in:', err));
    }

    // Start at zero volume
    audio.volume = 0;

    const startTime = Date.now();
    const duration = this.crossfadeDuration * 1000; // Convert to milliseconds

    console.log(`🎚️ FADE IN started: duration=${this.crossfadeDuration}s, audio paused=${audio.paused}`);

    const fadeCurve = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Fade in new track
      if (audio && !audio.paused && !audio.ended) {
        audio.volume = progress;

        // Log volume at intervals to verify fade is happening
        if (elapsed % 2000 < 50) { // Log approximately every 2 seconds
          console.log(`🎚️ FADE IN progress: ${(progress * 100).toFixed(0)}%, volume=${audio.volume.toFixed(2)}, time=${audio.currentTime.toFixed(1)}s, playing=${!audio.paused}`);
        }
      } else if (audio && audio.paused && progress < 0.1) {
        // If audio got paused early, try to resume
        console.log(`🎚️ FADE IN: audio paused during fade, resuming`);
        audio.play().catch(err => console.error('Failed to resume audio:', err));
      }

      if (progress < 1 && audio) {
        requestAnimationFrame(fadeCurve);
      } else {
        const finalStatus = audio ? `paused=${audio.paused}, ended=${audio.ended}, volume=${audio.volume}` : 'N/A';
        console.log(`🎚️ FADE IN complete: ${finalStatus}`);
      }
    };

    requestAnimationFrame(fadeCurve);
  }

  /**
   * Cleanup crossfade state
   */
  cleanupCrossfade() {
    this.crossfadeStartTime = null;
  }

  /**
   * Get current queue state
   */
  getQueueState() {
    return {
      queue: this.queue,
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      isAutoPlayEnabled: this.isAutoPlayEnabled,
      isAutoMixEnabled: this.isAutoMixEnabled,
      crossfadeDuration: this.crossfadeDuration,
      currentTrack: this.currentIndex >= 0 ? this.queue[this.currentIndex] : null
    };
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.stop();
    this.queue = [];
    this.currentIndex = -1;
    this.notifyQueueChange();
  }

  /**
   * Register callback for queue changes
   */
  onQueueChange(callback) {
    this.onQueueChangeCallbacks.push(callback);
  }

  /**
   * Register callback for track changes
   */
  onTrackChange(callback) {
    this.onTrackChangeCallbacks.push(callback);
  }

  /**
   * Notify listeners of queue state change
   */
  notifyQueueChange() {
    const state = this.getQueueState();
    this.onQueueChangeCallbacks.forEach(callback => callback(state));
  }

  /**
   * Notify listeners of current track change
   */
  notifyTrackChange(track) {
    this.onTrackChangeCallbacks.forEach(callback => callback(track, this.currentIndex));
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stop();
    this.cleanupCrossfade();
    this.queue = [];
    this.onQueueChangeCallbacks = [];
    this.onTrackChangeCallbacks = [];
  }
}
