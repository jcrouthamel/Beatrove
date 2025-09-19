// Vitest setup file
import { vi } from 'vitest'

// Mock browser APIs that Beatrove uses
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// Mock File API
global.File = class MockFile {
  constructor(parts, filename, properties = {}) {
    this.parts = parts
    this.name = filename
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0)
    this.type = properties.type || ''
    this.lastModified = properties.lastModified || Date.now()
  }
}

global.FileReader = class MockFileReader {
  constructor() {
    this.result = null
    this.error = null
    this.readyState = 0
    this.onload = null
    this.onerror = null
  }

  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2
      this.result = file.parts ? file.parts.join('') : ''
      if (this.onload) this.onload({ target: this })
    }, 0)
  }
}

// Mock Audio API
global.Audio = class MockAudio {
  constructor() {
    this.src = ''
    this.currentTime = 0
    this.duration = 0
    this.paused = true
    this.volume = 1
  }

  play() {
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
  }

  load() {}
}

// Mock AudioContext for waveform testing
global.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.sampleRate = 44100
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn()
    }
  }

  createMediaElementSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn()
    }
  }

  close() {
    return Promise.resolve()
  }
}

// Mock Canvas API for waveform visualization testing
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}))

// Mock Clipboard API
global.navigator.clipboard = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve(''))
}