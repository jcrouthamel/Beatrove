# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beatrove is an EDM tracklist web application that allows DJs to manage, filter, and preview their music collections. It's a client-side HTML/CSS/JavaScript application that processes music tracklist files and provides features for organizing tracks, creating playlists, and audio previewing.

## Commands

This is a static web application with no build process. Common operations:

- **Run locally**: Open `index.html` in a web browser or serve via a local HTTP server
- **No build/compile step**: Direct HTML/CSS/JS files
- **No testing framework**: Manual testing through browser interaction

## Architecture

### Core Structure
- **index.html**: Main application entry point with UI layout
- **assets/script.js**: Main application logic (~1300 lines)
- **assets/style.css**: Application styling
- **tracklist.csv**: Default music data file (auto-loaded on startup)

### Data Format
The application expects tracklist data in this format:
```
artist - title - key - BPM.extension - track time - year - path - genre
```

### Key Features
1. **Track Management**: Import/export CSV/TXT tracklists
2. **Filtering**: By BPM, key, year, tags, favorites
3. **Audio Preview**: Play tracks with Web Audio API visualizer
4. **Playlists**: Create, manage, and export playlists
5. **Tagging**: Add custom tags to tracks
6. **Data Persistence**: Uses localStorage for favorites, playlists, and tags

### Data Flow
1. CSV/TXT file uploaded → `processTracklist()` function
2. Data parsed into track objects with artist, title, BPM, key, year, genre, path
3. Stored in `window.grouped` (by artist) and `window.tracksForUI` (flat array)
4. Filtered and rendered via `render()` function
5. User interactions update localStorage and trigger re-renders

### Key Functions
- `processTracklist()`: Parses uploaded tracklist files
- `render()`: Filters and displays tracks based on current filters
- `safeRender()`: Defensive wrapper for render function
- `createTrackHTML()`: Generates DOM elements for individual tracks
- Audio preview system with Web Audio API integration

### Browser Storage
- **localStorage**: Stores playlists, favorites, tags, and current playlist
- **File handling**: Supports drag-and-drop CSV/TXT uploads
- **Audio folder**: Users can select folder containing audio files for preview

## Development Notes

- Pure vanilla JavaScript, no frameworks
- Responsive design with CSS Grid/Flexbox
- Audio visualizer using Canvas API
- File path copying uses Clipboard API
- Supports both light and dark themes