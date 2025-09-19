import { describe, it, expect } from 'vitest'

// Copy SecurityUtils class for testing
class SecurityUtils {
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').replace(/[<>&"']/g, (match) => {
      const escapeMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return escapeMap[match];
    });
  }

  static escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[&<>"']/g, (match) => {
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return escapeMap[match];
    });
  }

  static validateFileName(fileName) {
    if (typeof fileName !== 'string') return false;
    // Check for dangerous characters and patterns
    const dangerousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, // Windows reserved names
      /^\./,            // Hidden files starting with dot
      /\s$/,            // Trailing whitespace
    ];

    return !dangerousPatterns.some(pattern => pattern.test(fileName)) &&
           fileName.length > 0 &&
           fileName.length <= 255;
  }

  static isValidBPM(bpm) {
    const num = parseFloat(bpm);
    return !isNaN(num) && num >= 60 && num <= 200;
  }

  static isValidYear(year) {
    const num = parseInt(year);
    const currentYear = new Date().getFullYear();
    return !isNaN(num) && num >= 1900 && num <= currentYear + 1;
  }

  static sanitizeCSVField(field) {
    if (typeof field !== 'string') return '';
    // Remove potential CSV injection attempts
    return field.replace(/^[=+\-@]/, '').trim();
  }
}

describe('SecurityUtils', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      expect(SecurityUtils.sanitizeText('<script>alert("xss")</script>')).toBe('alert(&quot;xss&quot;)')
      expect(SecurityUtils.sanitizeText('<div>content</div>')).toBe('content')
      expect(SecurityUtils.sanitizeText('<img src="x" onerror="alert(1)">')).toBe('')
    })

    it('should escape dangerous characters', () => {
      expect(SecurityUtils.sanitizeText('<>&"\'test')).toBe('&amp;&quot;&#x27;test')
    })

    it('should handle non-string inputs', () => {
      expect(SecurityUtils.sanitizeText(null)).toBe('')
      expect(SecurityUtils.sanitizeText(undefined)).toBe('')
      expect(SecurityUtils.sanitizeText(123)).toBe('')
    })

    it('should preserve safe text', () => {
      expect(SecurityUtils.sanitizeText('Deadmau5 - Strobe')).toBe('Deadmau5 - Strobe')
      expect(SecurityUtils.sanitizeText('Track (Original Mix)')).toBe('Track (Original Mix)')
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(SecurityUtils.escapeHtml('&<>"\'test')).toBe('&amp;&lt;&gt;&quot;&#x27;test')
    })

    it('should handle non-string inputs', () => {
      expect(SecurityUtils.escapeHtml(null)).toBe('')
      expect(SecurityUtils.escapeHtml(undefined)).toBe('')
      expect(SecurityUtils.escapeHtml(123)).toBe('')
    })

    it('should preserve safe text', () => {
      expect(SecurityUtils.escapeHtml('Normal text')).toBe('Normal text')
    })
  })

  describe('validateFileName', () => {
    it('should accept valid filenames', () => {
      expect(SecurityUtils.validateFileName('tracklist.csv')).toBe(true)
      expect(SecurityUtils.validateFileName('my-music-2023.txt')).toBe(true)
      expect(SecurityUtils.validateFileName('beatrove_export.json')).toBe(true)
    })

    it('should reject dangerous filenames', () => {
      expect(SecurityUtils.validateFileName('../../../etc/passwd')).toBe(false)
      expect(SecurityUtils.validateFileName('file<script>.txt')).toBe(false)
      expect(SecurityUtils.validateFileName('CON.txt')).toBe(false)
      expect(SecurityUtils.validateFileName('.htaccess')).toBe(false)
      expect(SecurityUtils.validateFileName('file ')).toBe(false) // trailing space
    })

    it('should handle edge cases', () => {
      expect(SecurityUtils.validateFileName('')).toBe(false)
      expect(SecurityUtils.validateFileName(null)).toBe(false)
      expect(SecurityUtils.validateFileName(undefined)).toBe(false)
      expect(SecurityUtils.validateFileName('a'.repeat(256))).toBe(false) // too long
    })
  })

  describe('isValidBPM', () => {
    it('should accept valid BPM values', () => {
      expect(SecurityUtils.isValidBPM('120')).toBe(true)
      expect(SecurityUtils.isValidBPM('128.5')).toBe(true)
      expect(SecurityUtils.isValidBPM('80')).toBe(true)
      expect(SecurityUtils.isValidBPM('180')).toBe(true)
    })

    it('should reject invalid BPM values', () => {
      expect(SecurityUtils.isValidBPM('50')).toBe(false)   // too low
      expect(SecurityUtils.isValidBPM('250')).toBe(false)  // too high
      expect(SecurityUtils.isValidBPM('abc')).toBe(false)  // not a number
      expect(SecurityUtils.isValidBPM('')).toBe(false)     // empty
      expect(SecurityUtils.isValidBPM('-120')).toBe(false) // negative
    })
  })

  describe('isValidYear', () => {
    it('should accept valid years', () => {
      expect(SecurityUtils.isValidYear('2023')).toBe(true)
      expect(SecurityUtils.isValidYear('1990')).toBe(true)
      expect(SecurityUtils.isValidYear('2024')).toBe(true)
    })

    it('should reject invalid years', () => {
      expect(SecurityUtils.isValidYear('1800')).toBe(false) // too old
      expect(SecurityUtils.isValidYear('2030')).toBe(false) // too future
      expect(SecurityUtils.isValidYear('abc')).toBe(false)  // not a number
      expect(SecurityUtils.isValidYear('')).toBe(false)     // empty
    })
  })

  describe('sanitizeCSVField', () => {
    it('should remove CSV injection characters', () => {
      expect(SecurityUtils.sanitizeCSVField('=cmd|"calc"')).toBe('cmd|"calc"')
      expect(SecurityUtils.sanitizeCSVField('+HYPERLINK("http://evil.com")')).toBe('HYPERLINK("http://evil.com")')
      expect(SecurityUtils.sanitizeCSVField('-2+3+cmd|"calc"')).toBe('2+3+cmd|"calc"')
      expect(SecurityUtils.sanitizeCSVField('@SUM(1+1)')).toBe('SUM(1+1)')
    })

    it('should handle normal CSV content', () => {
      expect(SecurityUtils.sanitizeCSVField('Deadmau5')).toBe('Deadmau5')
      expect(SecurityUtils.sanitizeCSVField('Track Name')).toBe('Track Name')
      expect(SecurityUtils.sanitizeCSVField('  spaced  ')).toBe('spaced')
    })

    it('should handle non-string inputs', () => {
      expect(SecurityUtils.sanitizeCSVField(null)).toBe('')
      expect(SecurityUtils.sanitizeCSVField(undefined)).toBe('')
      expect(SecurityUtils.sanitizeCSVField(123)).toBe('')
    })
  })
})