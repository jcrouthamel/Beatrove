/**
 * Tracklist Comparer Module
 * Compares DJ set tracklists against the main library to identify missing tracks
 */

'use strict';

import { SecurityUtils } from '../core/security-utils.js';
import { FuzzySearchUtils } from '../core/fuzzy-search.js';

export class TracklistComparer {
  constructor(notificationSystem, applicationState) {
    this.notificationSystem = notificationSystem;
    this.applicationState = applicationState;
    this.comparisonResults = null;
  }

  /**
   * Parse a DJ set tracklist from uploaded file content
   * Supports multiple formats:
   * - Timestamped: [00:12] Artist - Title [Label]
   * - Simple: Artist - Title
   * - Numbered: 1. Artist - Title
   * - Full format: artist - title - key - BPM.ext - time - year - path - genre - energy - label
   *
   * @param {string} fileContent - Raw file content
   * @returns {Array} Parsed tracks with artist, title, and original line
   */
  parseDJSetTracklist(fileContent) {
    const lines = fileContent.split('\n');
    const tracks = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Skip empty lines, headers, URLs, and metadata
      if (!line ||
          line.startsWith('//') ||
          line.startsWith('#') ||
          line.startsWith('http') ||
          line.startsWith('Please set') ||
          line.includes('tracklist') && line.length < 50) {
        continue;
      }

      // Track data to extract
      let artist = '';
      let title = '';
      let bpm = '';
      let key = '';
      let label = '';

      // Pattern 1: Timestamped format [00:12] Artist - Title [Label]
      const timestampMatch = line.match(/^\[[\d:]+\]\s*(.+)/);
      if (timestampMatch) {
        line = timestampMatch[1].trim();
      }

      // Pattern 2: Numbered format "1. Artist - Title"
      const numberedMatch = line.match(/^\d+[\.\)]\s*(.+)/);
      if (numberedMatch) {
        line = numberedMatch[1].trim();
      }

      // Extract label in brackets at the end [LABEL NAME]
      const labelMatch = line.match(/\[([^\]]+)\]\s*$/);
      if (labelMatch) {
        label = labelMatch[1].trim();
        line = line.replace(/\[([^\]]+)\]\s*$/, '').trim();
      }

      // Pattern 3: Full tracklist format (like main library)
      // artist - title - key - BPM.ext - time - year - path - genre - energy - label
      const parts = line.split(' - ');

      if (parts.length >= 2) {
        // Check if it's full format (has BPM, key, etc.)
        if (parts.length >= 4) {
          artist = SecurityUtils.stripHtmlTags(parts[0].trim());
          title = SecurityUtils.stripHtmlTags(parts[1].trim());
          key = parts[2] ? parts[2].trim() : '';

          // Extract BPM from "128.mp3" or "128 BPM" format
          if (parts[3]) {
            const bpmMatch = parts[3].match(/(\d+)/);
            if (bpmMatch) {
              bpm = bpmMatch[1];
            }
          }
        } else {
          // Simple format: Artist - Title
          artist = SecurityUtils.stripHtmlTags(parts[0].trim());
          title = SecurityUtils.stripHtmlTags(parts[1].trim());
        }

        // Handle variations like "Artist feat. OtherArtist" or "Artist & Artist"
        // Clean up common DJ notation
        artist = this.normalizeArtistName(artist);
        title = this.normalizeTrackTitle(title);

        if (artist && title) {
          tracks.push({
            artist,
            title,
            bpm,
            key,
            label,
            originalLine: lines[i].trim(),
            lineNumber: i + 1
          });
        }
      }
    }

    return tracks;
  }

  /**
   * Normalize artist name for better matching
   */
  normalizeArtistName(artist) {
    return artist
      .replace(/\([^)]*\)/g, '') // Remove parenthetical info like (US), (UK), etc.
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed info
      .replace(/\s+ft\.?\s+/gi, ' feat. ')
      .replace(/\s+featuring\s+/gi, ' feat. ')
      .replace(/\s+vs\.?\s+/gi, ' & ')
      .replace(/\s+x\s+/gi, ' & ')
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Normalize track title for better matching
   */
  normalizeTrackTitle(title) {
    return title
      .replace(/\s+\(.*?remix.*?\)/gi, '') // Remove remix notation for initial match
      .replace(/\s+\[.*?\]/g, '') // Remove bracketed info
      .replace(/\s+-\s+.*(edit|mix|version|vip).*$/gi, '') // Remove version info
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Compare parsed DJ set tracks against library
   * Uses fuzzy matching for resilient matching
   *
   * @param {Array} djSetTracks - Parsed DJ set tracks
   * @param {Array} libraryTracks - All tracks from main library (flat array)
   * @returns {Object} Comparison results with matched and missing tracks
   */
  compareWithLibrary(djSetTracks, libraryTracks) {
    const matched = [];
    const missing = [];

    // Create searchable library array with normalized names
    const librarySearchData = libraryTracks.map(track => ({
      original: track,
      artistNorm: this.normalizeForComparison(track.artist),
      titleNorm: this.normalizeForComparison(track.title),
      artistTitleNorm: this.normalizeForComparison(`${track.artist} ${track.title}`)
    }));

    for (const djTrack of djSetTracks) {
      // Extract first artist BEFORE normalization (while & is still present)
      const djFirstArtistRaw = djTrack.artist.split(/[&,]/)[0].trim();
      const djFirstArtist = this.normalizeForComparison(djFirstArtistRaw);

      const djArtistNorm = this.normalizeForComparison(djTrack.artist);
      const djTitleNorm = this.normalizeForComparison(djTrack.title);
      const djFullNorm = this.normalizeForComparison(`${djTrack.artist} ${djTrack.title}`);

      let bestMatch = null;
      let bestScore = 0;
      let matchMethod = '';

      // Try different matching strategies
      for (const libTrack of librarySearchData) {
        // Extract first artist from library track (before normalization removed &)
        const libFirstArtistRaw = libTrack.original.artist.split(/[&,]/)[0].trim();
        const libFirstArtist = this.normalizeForComparison(libFirstArtistRaw);

        // Strategy 1: Exact artist + exact title
        if (djArtistNorm === libTrack.artistNorm && djTitleNorm === libTrack.titleNorm) {
          bestMatch = libTrack.original;
          bestScore = 1.0;
          matchMethod = 'exact';
          break;
        }

        // Strategy 1.5: Collaboration artist match + exact title
        // Handles various collaboration scenarios:
        // - "Jazzy" vs "Jazzy & Luuk van Dijk"
        // - "Confidence Man & DJ Seinfeld" vs "DJ Seinfeld"
        // - "Sama" vs "Sama (US)"
        if (djTitleNorm === libTrack.titleNorm) {
          // Split both artists by & or , to get all collaborators
          const djArtists = djTrack.artist.split(/[&,]/).map(a => this.normalizeForComparison(a.trim()));
          const libArtists = libTrack.original.artist.split(/[&,]/).map(a => this.normalizeForComparison(a.trim()));

          // Check if any artist from DJ set matches any artist from library
          const hasCommonArtist = djArtists.some(djArt =>
            libArtists.some(libArt => djArt === libArt)
          );

          if (hasCommonArtist) {
            if (0.95 > bestScore) { // High score but not perfect
              bestMatch = libTrack.original;
              bestScore = 0.95;
              matchMethod = 'collaboration-artist-exact-title';
            }
          }
        }

        // Strategy 2: Fuzzy artist + exact title (more lenient threshold)
        const artistSimilarity = FuzzySearchUtils.calculateSimilarity(djArtistNorm, libTrack.artistNorm);
        if (artistSimilarity > 0.7 && djTitleNorm === libTrack.titleNorm) {
          if (artistSimilarity > bestScore) {
            bestMatch = libTrack.original;
            bestScore = artistSimilarity;
            matchMethod = 'fuzzy-artist-exact-title';
          }
        }

        // Strategy 3: Exact artist + fuzzy title (more lenient threshold)
        const titleSimilarity = FuzzySearchUtils.calculateSimilarity(djTitleNorm, libTrack.titleNorm);
        if (djArtistNorm === libTrack.artistNorm && titleSimilarity > 0.7) {
          if (titleSimilarity > bestScore) {
            bestMatch = libTrack.original;
            bestScore = titleSimilarity;
            matchMethod = 'exact-artist-fuzzy-title';
          }
        }

        // Strategy 4: Fuzzy both (more lenient threshold)
        if (artistSimilarity > 0.65 && titleSimilarity > 0.65) {
          const combinedScore = (artistSimilarity + titleSimilarity) / 2;
          if (combinedScore > bestScore && combinedScore > 0.7) {
            bestMatch = libTrack.original;
            bestScore = combinedScore;
            matchMethod = 'fuzzy-both';
          }
        }

        // Strategy 5: Full string fuzzy match (fallback for very different formatting)
        const fullSimilarity = FuzzySearchUtils.calculateSimilarity(djFullNorm, libTrack.artistTitleNorm);
        if (fullSimilarity > 0.85 && fullSimilarity > bestScore) {
          bestMatch = libTrack.original;
          bestScore = fullSimilarity;
          matchMethod = 'fuzzy-full';
        }
      }

      // Threshold for accepting a match (lowered to be more lenient)
      if (bestMatch && bestScore >= 0.65) {
        matched.push({
          djTrack,
          libraryTrack: bestMatch,
          confidence: bestScore,
          matchMethod
        });
      } else {
        missing.push({
          djTrack,
          bestAttempt: bestMatch,
          confidence: bestScore
        });
      }
    }

    this.comparisonResults = {
      totalTracks: djSetTracks.length,
      matched,
      missing,
      matchRate: djSetTracks.length > 0 ? (matched.length / djSetTracks.length) * 100 : 0
    };

    return this.comparisonResults;
  }

  /**
   * Normalize string for comparison (lowercase, remove special chars, extra spaces)
   */
  normalizeForComparison(str) {
    return str
      .replace(/\([^)]*\)/g, '') // Remove parenthetical info like (US), (UK), etc.
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed info
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Export missing tracks as CSV
   */
  exportMissingAsCSV() {
    if (!this.comparisonResults || this.comparisonResults.missing.length === 0) {
      this.notificationSystem.warning('No missing tracks to export');
      return;
    }

    const headers = ['Artist', 'Title', 'BPM', 'Key', 'Label', 'Original Line'];
    const rows = [headers];

    for (const item of this.comparisonResults.missing) {
      const track = item.djTrack;
      rows.push([
        track.artist,
        track.title,
        track.bpm || '',
        track.key || '',
        track.label || '',
        track.originalLine
      ]);
    }

    const csvContent = rows.map(row =>
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    this.downloadFile(csvContent, 'missing_tracks.csv', 'text/csv');
    this.notificationSystem.success(`Exported ${this.comparisonResults.missing.length} missing tracks as CSV`);
  }

  /**
   * Export missing tracks as TXT
   */
  exportMissingAsTXT() {
    if (!this.comparisonResults || this.comparisonResults.missing.length === 0) {
      this.notificationSystem.warning('No missing tracks to export');
      return;
    }

    const lines = ['Missing Tracks from DJ Set', '='.repeat(50), ''];

    for (const item of this.comparisonResults.missing) {
      const track = item.djTrack;
      let line = `${track.artist} - ${track.title}`;

      if (track.bpm) line += ` - ${track.bpm} BPM`;
      if (track.key) line += ` - ${track.key}`;
      if (track.label) line += ` [${track.label}]`;

      lines.push(line);
    }

    lines.push('');
    lines.push(`Total missing tracks: ${this.comparisonResults.missing.length}`);

    const txtContent = lines.join('\n');

    this.downloadFile(txtContent, 'missing_tracks.txt', 'text/plain');
    this.notificationSystem.success(`Exported ${this.comparisonResults.missing.length} missing tracks as TXT`);
  }

  /**
   * Create playlist from matched tracks
   */
  createPlaylistFromMatched() {
    if (!this.comparisonResults || this.comparisonResults.matched.length === 0) {
      this.notificationSystem.warning('No matched tracks to create playlist');
      return null;
    }

    // Extract library tracks from matched results
    const playlistTracks = this.comparisonResults.matched.map(item => ({
      artist: item.libraryTrack.artist,
      title: item.libraryTrack.title
    }));

    return {
      name: 'DJ Set - Matched Tracks',
      tracks: playlistTracks,
      count: playlistTracks.length
    };
  }

  /**
   * Helper to download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get current comparison results
   */
  getResults() {
    return this.comparisonResults;
  }

  /**
   * Clear comparison results
   */
  clearResults() {
    this.comparisonResults = null;
  }
}
