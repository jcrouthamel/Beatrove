/**
 * Beatrove - Blob URL Manager
 * Centralized management of all blob URLs with automatic cleanup and memory optimization
 */

'use strict';

export class BlobManager {
  constructor() {
    this.blobUrls = new Map(); // url -> { file, createdAt, refs, type, autoCleanup }
    this.autoCleanupEnabled = true;
    this.maxAge = 5 * 60 * 1000; // 5 minutes default
    this.cleanupInterval = 30 * 1000; // Clean every 30 seconds
    this.maxBlobUrls = 50; // Prevent memory bloat
    this.cleanupIntervalId = null;

    this.startPeriodicCleanup();
  }

  /**
   * Create a blob URL with automatic lifecycle management
   * @param {File|Blob} file - The file or blob to create URL for
   * @param {Object} options - Configuration options
   * @param {string} options.type - Type identifier (audio, image, download)
   * @param {boolean} options.autoCleanup - Whether to auto-cleanup (default: true)
   * @param {number} options.maxAge - Custom max age in milliseconds
   * @param {boolean} options.immediate - Clean up immediately after first use
   * @returns {string} The blob URL
   */
  createBlobUrl(file, options = {}) {
    const {
      type = 'unknown',
      autoCleanup = true,
      maxAge = this.maxAge,
      immediate = false
    } = options;

    // Enforce maximum blob URL limit
    if (this.blobUrls.size >= this.maxBlobUrls) {
      this.forceCleanupOldest();
    }

    const url = URL.createObjectURL(file);

    this.blobUrls.set(url, {
      file,
      createdAt: Date.now(),
      refs: 0,
      type,
      autoCleanup,
      maxAge,
      immediate
    });

    return url;
  }

  /**
   * Create a blob URL for one-time use (downloads, temporary operations)
   * @param {File|Blob} file - The file or blob
   * @param {string} type - Type identifier
   * @returns {string} The blob URL that will be cleaned up immediately after use
   */
  createTemporaryBlobUrl(file, type = 'temporary') {
    return this.createBlobUrl(file, {
      type,
      immediate: true,
      autoCleanup: true,
      maxAge: 30000 // 30 seconds max for temporary URLs
    });
  }

  /**
   * Create a blob URL for downloads with immediate cleanup
   * @param {Blob} blob - The blob to download
   * @param {string} filename - Filename for the download
   */
  createDownloadUrl(blob, filename) {
    const url = this.createTemporaryBlobUrl(blob, 'download');

    // Create download link and trigger
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up immediately after download
    setTimeout(() => this.revokeBlobUrl(url), 100);

    return url;
  }

  /**
   * Add a reference to a blob URL (prevents cleanup while in use)
   * @param {string} url - The blob URL
   */
  addReference(url) {
    const blob = this.blobUrls.get(url);
    if (blob) {
      blob.refs++;
    }
  }

  /**
   * Remove a reference from a blob URL
   * @param {string} url - The blob URL
   */
  removeReference(url) {
    const blob = this.blobUrls.get(url);
    if (blob) {
      blob.refs = Math.max(0, blob.refs - 1);

      // If immediate cleanup and no refs, clean up now
      if (blob.immediate && blob.refs === 0) {
        this.revokeBlobUrl(url);
      }
    }
  }

  /**
   * Revoke a specific blob URL
   * @param {string} url - The blob URL to revoke
   */
  revokeBlobUrl(url) {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
      return true;
    }
    return false;
  }

  /**
   * Force cleanup of oldest blob URLs when limit is reached
   */
  forceCleanupOldest() {
    const sortedUrls = Array.from(this.blobUrls.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);

    // Clean up oldest 25% when limit reached
    const toCleanup = Math.ceil(sortedUrls.length * 0.25);

    for (let i = 0; i < toCleanup && sortedUrls[i]; i++) {
      const [url, blob] = sortedUrls[i];
      // Only clean up unreferenced blobs
      if (blob.refs === 0) {
        this.revokeBlobUrl(url);
      }
    }
  }

  /**
   * Clean up expired blob URLs
   */
  cleanupExpiredUrls() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [url, blob] of this.blobUrls.entries()) {
      const shouldCleanup = blob.autoCleanup &&
                           blob.refs === 0 &&
                           (now - blob.createdAt > blob.maxAge);

      if (shouldCleanup) {
        this.revokeBlobUrl(url);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Start periodic cleanup of expired blob URLs
   */
  startPeriodicCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    this.cleanupIntervalId = setInterval(() => {
      if (this.autoCleanupEnabled) {
        const cleaned = this.cleanupExpiredUrls();

        // Force garbage collection if many URLs were cleaned
        if (cleaned > 10 && window.gc) {
          window.gc();
        }
      }
    }, this.cleanupInterval);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Get statistics about current blob URL usage
   */
  getStats() {
    const stats = {
      total: this.blobUrls.size,
      byType: {},
      withReferences: 0,
      totalMemory: 0
    };

    for (const [url, blob] of this.blobUrls.entries()) {
      // Count by type
      stats.byType[blob.type] = (stats.byType[blob.type] || 0) + 1;

      // Count referenced blobs
      if (blob.refs > 0) {
        stats.withReferences++;
      }

      // Estimate memory usage
      if (blob.file && blob.file.size) {
        stats.totalMemory += blob.file.size;
      }
    }

    return stats;
  }

  /**
   * Clean up all blob URLs (for shutdown)
   */
  cleanup() {
    this.stopPeriodicCleanup();

    for (const url of this.blobUrls.keys()) {
      URL.revokeObjectURL(url);
    }

    this.blobUrls.clear();
  }

  /**
   * Check if a URL is managed by this blob manager
   * @param {string} url - The URL to check
   */
  isManaged(url) {
    return this.blobUrls.has(url);
  }

  /**
   * Create a blob URL for audio with appropriate settings
   * @param {File} file - The audio file
   */
  createAudioBlobUrl(file) {
    return this.createBlobUrl(file, {
      type: 'audio',
      autoCleanup: true,
      maxAge: 10 * 60 * 1000 // 10 minutes for audio
    });
  }

  /**
   * Create a blob URL for images with appropriate settings
   * @param {File} file - The image file
   */
  createImageBlobUrl(file) {
    return this.createBlobUrl(file, {
      type: 'image',
      autoCleanup: true,
      maxAge: 15 * 60 * 1000 // 15 minutes for images
    });
  }
}