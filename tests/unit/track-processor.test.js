import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock the CONFIG object
const CONFIG = {
  MAX_TRACKS_PER_FILE: 10000,
  MAX_LINE_LENGTH: 2000,
  MIN_BPM: 60,
  MAX_BPM: 200,
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1
}

// Copy TrackProcessor functionality for testing
class TrackProcessor {
  static parseTrackLine(line) {
    if (!line || typeof line !== 'string') return null

    const trimmedLine = line.trim()
    if (!trimmedLine) return null

    // Split by " - " delimiter
    const parts = trimmedLine.split(' - ')
    if (parts.length < 4) return null

    // Extract basic info: artist - title - key - BPM.extension
    const artist = parts[0]?.trim()
    const title = parts[1]?.trim()
    const key = parts[2]?.trim()
    const bpmWithExt = parts[3]?.trim()

    if (!artist || !title || !key || !bpmWithExt) return null

    // Extract BPM and extension
    const bpmMatch = bpmWithExt.match(/^(\d+(?:\.\d+)?)/);
    const extMatch = bpmWithExt.match(/\.([^.]+)$/);

    if (!bpmMatch) return null

    const bpm = parseFloat(bpmMatch[1])
    const extension = extMatch ? extMatch[1].toLowerCase() : ''

    // Validate BPM
    if (bpm < CONFIG.MIN_BPM || bpm > CONFIG.MAX_BPM) return null

    // Process remaining parts (duration, year, path, genre, energy, label)
    let duration = '', year = '', filePath = '', genre = '', energy = '', recordLabel = ''

    if (parts.length > 4) {
      let remainingParts = parts.slice(4)

      // Duration (MM:SS format)
      if (remainingParts.length > 0 && /^\d{1,2}:\d{2}$/.test(remainingParts[0])) {
        duration = remainingParts.shift()
      }

      // Year (4 digits)
      if (remainingParts.length > 0 && /^\d{4}$/.test(remainingParts[0])) {
        const yearNum = parseInt(remainingParts[0])
        if (yearNum >= CONFIG.MIN_YEAR && yearNum <= CONFIG.MAX_YEAR) {
          year = remainingParts.shift()
        }
      }

      // File path (contains path separators)
      if (remainingParts.length > 0 && (remainingParts[0].includes('/') || remainingParts[0].includes('\\\\'))) {
        filePath = remainingParts.shift()
      }

      // Genre
      if (remainingParts.length > 0) {
        genre = remainingParts.shift()
      }

      // Energy level (Energy #)
      if (remainingParts.length > 0 && remainingParts[0].startsWith('Energy ')) {
        energy = remainingParts.shift()
      }

      // Record label (remaining part)
      if (remainingParts.length > 0) {
        recordLabel = remainingParts.join(' - ') // Join remaining parts in case label has " - "
      }
    }

    return {
      artist,
      title,
      key,
      bpm,
      extension,
      duration,
      year,
      path: filePath,
      genre,
      energy,
      recordLabel,
      filename: `${artist} - ${title} - ${key} - ${bpm}.${extension}`
    }
  }

  static processTracklist(fileContent) {
    if (typeof fileContent !== 'string') {
      throw new Error('Invalid file content')
    }

    const lines = fileContent.split('\n')
    if (lines.length > CONFIG.MAX_TRACKS_PER_FILE) {
      throw new Error(`File contains too many tracks (max: ${CONFIG.MAX_TRACKS_PER_FILE})`)
    }

    const tracks = []
    const errors = []

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      if (line.length > CONFIG.MAX_LINE_LENGTH) {
        errors.push(`Line ${lineNumber}: Line too long`)
        return
      }

      try {
        const track = this.parseTrackLine(line)
        if (track) {
          tracks.push(track)
        } else if (line.trim()) {
          errors.push(`Line ${lineNumber}: Invalid format - ${line.substring(0, 50)}...`)
        }
      } catch (error) {
        errors.push(`Line ${lineNumber}: ${error.message}`)
      }
    })

    return { tracks, errors }
  }
}

describe('TrackProcessor', () => {
  describe('parseTrackLine', () => {
    it('should parse basic track format correctly', () => {
      const line = 'Deadmau5 - Strobe - 8A - 126.flac'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result).toEqual({
        artist: 'Deadmau5',
        title: 'Strobe',
        key: '8A',
        bpm: 126,
        extension: 'flac',
        duration: '',
        year: '',
        path: '',
        genre: '',
        energy: '',
        recordLabel: '',
        filename: 'Deadmau5 - Strobe - 8A - 126.flac'
      })
    })

    it('should parse full format with all fields', () => {
      const line = 'Artbat - Horizon - 5A - 124.wav - 7:23 - 2022 - /path/to/artbat_horizon.wav - Melodic Techno - Energy 8 - Diynamic'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result).toEqual({
        artist: 'Artbat',
        title: 'Horizon',
        key: '5A',
        bpm: 124,
        extension: 'wav',
        duration: '7:23',
        year: '2022',
        path: '/path/to/artbat_horizon.wav',
        genre: 'Melodic Techno',
        energy: 'Energy 8',
        recordLabel: 'Diynamic',
        filename: 'Artbat - Horizon - 5A - 124.wav'
      })
    })

    it('should handle decimal BPM values', () => {
      const line = 'Artist - Title - 1A - 128.5.mp3'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result.bpm).toBe(128.5)
    })

    it('should handle tracks without extension', () => {
      const line = 'Artist - Title - 1A - 128'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result.extension).toBe('')
      expect(result.bpm).toBe(128)
    })

    it('should handle complex titles with multiple parts', () => {
      const line = 'Eric Prydz - Opus Four Tet Remix - 12A - 128.mp3 - 9:21 - 2015 - /path/to/file.mp3 - Progressive House'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result).not.toBeNull()
      expect(result.artist).toBe('Eric Prydz')
      expect(result.title).toBe('Opus Four Tet Remix')
    })

    it('should reject invalid BPM values', () => {
      expect(TrackProcessor.parseTrackLine('Artist - Title - 1A - 50.mp3')).toBeNull() // too low
      expect(TrackProcessor.parseTrackLine('Artist - Title - 1A - 250.mp3')).toBeNull() // too high
      expect(TrackProcessor.parseTrackLine('Artist - Title - 1A - abc.mp3')).toBeNull() // not numeric
    })

    it('should reject invalid years', () => {
      const line = 'Artist - Title - 1A - 128.mp3 - 4:30 - 1800 - /path - Genre'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result.year).toBe('') // Invalid year should be ignored
    })

    it('should handle missing required fields', () => {
      expect(TrackProcessor.parseTrackLine('Artist - Title')).toBeNull()
      expect(TrackProcessor.parseTrackLine('Artist')).toBeNull()
      expect(TrackProcessor.parseTrackLine('')).toBeNull()
      expect(TrackProcessor.parseTrackLine(null)).toBeNull()
    })

    it('should handle label names with dashes', () => {
      const line = 'Artist - Title - 1A - 128.mp3 - 4:30 - 2023 - /path - Genre - Energy 5 - Armada Music - Special Edition'
      const result = TrackProcessor.parseTrackLine(line)

      expect(result.recordLabel).toBe('Armada Music - Special Edition')
    })

    it('should trim whitespace from fields', () => {
      const line = '  Artist Name  -  Track Title  -  8A  -  126.flac  '
      const result = TrackProcessor.parseTrackLine(line)

      expect(result.artist).toBe('Artist Name')
      expect(result.title).toBe('Track Title')
      expect(result.key).toBe('8A')
    })
  })

  describe('processTracklist', () => {
    it('should process multiple tracks correctly', () => {
      const content = `Deadmau5 - Strobe - 8A - 126.flac - 10:34 - 2009 - /path/to/strobe.flac - Progressive House - Energy 7 - Mau5trap
Artbat - Horizon - 5A - 124.wav - 7:23 - 2022 - /path/to/horizon.wav - Melodic Techno - Energy 8 - Diynamic`

      const result = TrackProcessor.processTracklist(content)

      expect(result.tracks).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      expect(result.tracks[0].artist).toBe('Deadmau5')
      expect(result.tracks[1].artist).toBe('Artbat')
    })

    it('should handle mixed valid and invalid lines', () => {
      const content = `Deadmau5 - Strobe - 8A - 126.flac
Invalid Line
Artist - Title - 1A - 128.mp3
Another Invalid`

      const result = TrackProcessor.processTracklist(content)

      expect(result.tracks).toHaveLength(2)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toContain('Line 2')
      expect(result.errors[1]).toContain('Line 4')
    })

    it('should handle empty lines gracefully', () => {
      const content = `Deadmau5 - Strobe - 8A - 126.flac

Artist - Title - 1A - 128.mp3
`

      const result = TrackProcessor.processTracklist(content)

      expect(result.tracks).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject non-string input', () => {
      expect(() => TrackProcessor.processTracklist(null)).toThrow('Invalid file content')
      expect(() => TrackProcessor.processTracklist(undefined)).toThrow('Invalid file content')
      expect(() => TrackProcessor.processTracklist(123)).toThrow('Invalid file content')
    })

    it('should handle very long lines', () => {
      const longLine = 'Artist - ' + 'Very Long Title '.repeat(200) + ' - 1A - 128.mp3'
      const result = TrackProcessor.processTracklist(longLine)

      expect(result.tracks).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Line too long')
    })

    it('should process sample fixture file', () => {
      const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'sample-tracklist.csv')
      if (fs.existsSync(fixturePath)) {
        const content = fs.readFileSync(fixturePath, 'utf-8')
        const result = TrackProcessor.processTracklist(content)

        expect(result.tracks.length).toBeGreaterThan(0)
        expect(result.tracks[0].artist).toBe('Deadmau5')
        expect(result.tracks[0].title).toBe('Strobe')
      }
    })
  })
})