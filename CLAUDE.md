# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beatrove is an advanced EDM tracklist web application that allows DJs to manage, filter, and preview their music collections with professional-grade features. It's a client-side HTML/CSS/JavaScript application that processes music tracklist files and provides comprehensive features for organizing tracks, creating playlists, audio previewing, and real-time waveform visualization.

## Commands

This is a static web application with comprehensive testing setup. Common operations:

- **Run locally**: Open `index.html` in a web browser or serve via a local HTTP server
  - `npm run serve` - Start local development server on port 8000
- **Testing**: Comprehensive test suite using Vitest
  - `npm test` - Run all tests once
  - `npm run test:watch` - Run tests in watch mode (reruns on file changes)
  - `npm run test:ui` - Open interactive test UI in browser
  - `npm run test:coverage` - Generate test coverage report
- **No build/compile step**: Direct HTML/CSS/JS files

## Architecture

### Core Structure
- **index.html**: Main application entry point with UI layout and waveform controls
- **assets/script.js**: Main application logic (~4600+ lines) including waveform visualization
- **assets/style.css**: Application styling with waveform theming
- **tracklist.csv**: Default music data file (auto-loaded on startup)
- **User_Documentation.html**: Comprehensive user guide
- **README.md**: Project documentation and feature overview

### Data Format
The application expects tracklist data in this format:
```
artist - title - key - BPM.extension - track time - year - path - genre - Energy # - Record Label
```
Energy levels (1-10 stars) and record labels are optional fields that enhance track organization.

### Key Features
1. **Track Management**: Import/export CSV/TXT tracklists with comprehensive metadata
2. **Advanced Filtering**: By BPM, key, year, genre, tags, energy levels, favorites
3. **Audio Preview**: Play tracks with Web Audio API and multiple visualization styles
4. **Waveform Visualization**: 6 professional waveform styles (Default, Orange, Green, Blue Stereo, Colored, Full Track Overview)
5. **Playlists**: Create, manage, export/import playlists with full track organization
6. **Energy Level System**: 10-point star rating system for track intensity organization
7. **Tagging System**: Custom tags with filtering and management
8. **Library Statistics**: Comprehensive analytics with genre, BPM, key, energy, and label distribution
9. **Data Persistence**: Uses localStorage for favorites, playlists, tags, and energy ratings
10. **Theme Support**: Dark/light mode toggle with consistent styling

### Data Flow
1. CSV/TXT file uploaded → `processTracklist()` function
2. Data parsed into track objects with artist, title, BPM, key, year, genre, path, energy, label
3. Stored in `window.grouped` (by artist) and `window.tracksForUI` (flat array)
4. Filtered and rendered via `render()` function with multiple filter criteria
5. User interactions update localStorage and trigger re-renders
6. Audio playback triggers waveform analysis and visualization
7. Real-time waveform rendering based on selected style

### Key Classes and Functions
- **BeatroveApp**: Main application class with initialization and state management
- **AudioManager**: Handles audio playback, file selection, and visualizer integration
- **AudioVisualizer**: Manages waveform rendering with 6 different visualization styles
- **ApplicationState**: Manages app data with thread-safe operations
- **UIController**: Handles user interactions, filtering, and DOM manipulation
- **UIRenderer**: Renders track displays and manages UI updates
- `processTracklist()`: Parses uploaded tracklist files with energy and label extraction
- `render()`: Filters and displays tracks based on current filters
- `createTrackHTML()`: Generates DOM elements for individual tracks with all metadata

### Browser Storage
- **localStorage**: Stores playlists, favorites, tags, energy ratings, and current playlist
- **File handling**: Supports drag-and-drop CSV/TXT uploads with comprehensive parsing
- **Audio folder**: Users can select folder containing audio files for preview
- **Waveform cache**: Stores generated waveform data for Full Track Overview style

### Waveform System Architecture
- **AudioVisualizer class**: Manages 6 different waveform rendering styles
- **Real-time analysis**: Uses Web Audio API with getByteTimeDomainData() for live waveforms
- **Synthetic generation**: CORS-free waveform creation for Full Track Overview
- **Style switching**: Dynamic waveform style changes during playback
- **Canvas rendering**: High-performance waveform visualization with custom styling
- **Progress tracking**: Real-time playback position in waveforms

### Audio System Architecture
- **AudioManager class**: Centralized audio playback and analysis
- **Web Audio API**: Professional audio analysis with AnalyserNode
- **Visualizer integration**: Seamless connection between audio and waveform systems
- **Race condition prevention**: Robust state management for audio operations
- **Blob URL management**: Efficient memory handling for audio file access

### Testing Architecture
- **Unit Tests**: Vitest-based tests for core functionality
  - `FuzzySearchUtils`: Search algorithm testing with typo tolerance validation
  - `SecurityUtils`: Input sanitization and validation testing
  - `TrackProcessor`: CSV parsing and data validation testing
- **Test Setup**: Comprehensive browser API mocking (localStorage, Audio, Canvas, etc.)
- **Coverage**: Detailed code coverage reports for quality assurance
- **Watch Mode**: Continuous testing during development
- **Fixtures**: Sample data files for testing tracklist processing

## Development Notes

- Pure vanilla JavaScript, no frameworks (~4600+ lines)
- Modern ES6+ class-based architecture with comprehensive error handling
- Responsive design with CSS Grid/Flexbox and custom button styling
- Multiple canvas-based visualizers (frequency bars + waveforms)
- File path copying uses Clipboard API with cross-browser support
- Supports both light and dark themes with consistent waveform theming
- Thread-safe data operations with ApplicationState class
- Professional audio analysis comparable to DAW software