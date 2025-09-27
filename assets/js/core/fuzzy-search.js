/**
 * Beatrove - Fuzzy Search Utilities Module
 * Provides intelligent search capabilities with typo tolerance
 */

'use strict';

// ============= FUZZY SEARCH UTILITIES =============
export class FuzzySearchUtils {
  // Calculate Levenshtein distance between two strings
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  // Calculate similarity score (0-1, where 1 is perfect match)
  static calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLen);
  }

  // Check if search term fuzzy matches target with threshold
  static fuzzyMatch(searchTerm, target, threshold = 0.6) {
    if (!searchTerm || !target) return false;

    // Direct substring match (highest priority)
    if (target.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    // Fuzzy matching for individual words
    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    const targetWords = target.toLowerCase().split(/\s+/);

    // Check if each search word fuzzy matches any target word
    return searchWords.every(searchWord => {
      return targetWords.some(targetWord => {
        // Allow shorter words to have lower threshold
        const adjustedThreshold = searchWord.length <= 3 ? 0.8 : threshold;
        return this.calculateSimilarity(searchWord, targetWord) >= adjustedThreshold;
      });
    });
  }
}