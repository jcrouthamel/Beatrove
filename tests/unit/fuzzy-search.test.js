import { describe, it, expect } from 'vitest'

// Import the FuzzySearchUtils class - we'll need to modify script.js to export it
// For now, let's copy the class here for testing
class FuzzySearchUtils {
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  static calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLen);
  }

  static fuzzyMatch(searchTerm, target, threshold = 0.6) {
    if (!searchTerm || !target) return false;

    if (target.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    const targetWords = target.toLowerCase().split(/\s+/);

    return searchWords.every(searchWord => {
      return targetWords.some(targetWord => {
        const adjustedThreshold = searchWord.length <= 3 ? 0.8 : threshold;
        return this.calculateSimilarity(searchWord, targetWord) >= adjustedThreshold;
      });
    });
  }
}

describe('FuzzySearchUtils', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(FuzzySearchUtils.levenshteinDistance('test', 'test')).toBe(0)
    })

    it('should return correct distance for different strings', () => {
      expect(FuzzySearchUtils.levenshteinDistance('cat', 'bat')).toBe(1)
      expect(FuzzySearchUtils.levenshteinDistance('kitten', 'sitting')).toBe(3)
      expect(FuzzySearchUtils.levenshteinDistance('', 'abc')).toBe(3)
      expect(FuzzySearchUtils.levenshteinDistance('abc', '')).toBe(3)
    })

    it('should handle case sensitivity', () => {
      expect(FuzzySearchUtils.levenshteinDistance('Test', 'test')).toBe(1)
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(FuzzySearchUtils.calculateSimilarity('test', 'test')).toBe(1)
    })

    it('should return correct similarity scores', () => {
      const similarity = FuzzySearchUtils.calculateSimilarity('deadmau5', 'deadmaus')
      expect(similarity).toBeGreaterThan(0.8)
      expect(similarity).toBeLessThan(1)
    })

    it('should handle empty strings', () => {
      expect(FuzzySearchUtils.calculateSimilarity('', '')).toBe(1)
      expect(FuzzySearchUtils.calculateSimilarity('', 'test')).toBe(0)
    })

    it('should be case insensitive', () => {
      expect(FuzzySearchUtils.calculateSimilarity('Test', 'test')).toBe(1)
    })
  })

  describe('fuzzyMatch', () => {
    it('should match exact substrings', () => {
      expect(FuzzySearchUtils.fuzzyMatch('dead', 'Deadmau5')).toBe(true)
      expect(FuzzySearchUtils.fuzzyMatch('mau5', 'Deadmau5')).toBe(true)
    })

    it('should match with typos (DJ name examples)', () => {
      expect(FuzzySearchUtils.fuzzyMatch('deadmaus', 'Deadmau5')).toBe(true)
      expect(FuzzySearchUtils.fuzzyMatch('artbt', 'Artbat')).toBe(true)
      expect(FuzzySearchUtils.fuzzyMatch('martin garex', 'Martin Garrix')).toBe(true)
    })

    it('should match track titles with typos', () => {
      expect(FuzzySearchUtils.fuzzyMatch('strob', 'Strobe')).toBe(true)
      expect(FuzzySearchUtils.fuzzyMatch('animels', 'Animals')).toBe(true)
    })

    it('should handle multiple words', () => {
      expect(FuzzySearchUtils.fuzzyMatch('eric prydz', 'Eric Prydz')).toBe(true)
      expect(FuzzySearchUtils.fuzzyMatch('eric prydz opus', 'Eric Prydz - Opus')).toBe(true)
    })

    it('should not match completely different strings', () => {
      expect(FuzzySearchUtils.fuzzyMatch('deadmau5', 'Skrillex')).toBe(false)
      expect(FuzzySearchUtils.fuzzyMatch('house', 'techno')).toBe(false)
    })

    it('should handle empty inputs', () => {
      expect(FuzzySearchUtils.fuzzyMatch('', 'test')).toBe(false)
      expect(FuzzySearchUtils.fuzzyMatch('test', '')).toBe(false)
      expect(FuzzySearchUtils.fuzzyMatch('', '')).toBe(false)
    })

    it('should respect threshold parameter', () => {
      // With high threshold, should not match
      expect(FuzzySearchUtils.fuzzyMatch('test', 'best', 0.9)).toBe(false)
      // With low threshold, should match
      expect(FuzzySearchUtils.fuzzyMatch('test', 'best', 0.5)).toBe(true)
    })

    it('should handle short words with stricter threshold', () => {
      // Short words (3 chars or less) use 0.8 threshold
      expect(FuzzySearchUtils.fuzzyMatch('cat', 'bat')).toBe(false)
      expect(FuzzySearchUtils.fuzzyMatch('cat', 'car')).toBe(false)
    })
  })
})