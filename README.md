# Beatrove - DJ Music Track Management Web Application

A powerful web application for DJs to manage, filter, and preview their music collections. Built with vanilla HTML, CSS, and JavaScript for fast, responsive performance.

## ✨ Features

### 🎵 Track Management
- **Upload Tracklists**: Support for CSV and TXT file formats
- **Auto-load**: Automatically loads `tracklist.csv` if present
- **Track Information**: Artist, title, key, BPM, year, genre, and file path
- **Duplicate Detection**: Identifies duplicate tracks in your collection

### 🔍 Filtering & Search
- **Text Search**: Find tracks by artist, title, or other metadata
- **BPM Filter**: Filter by tempo ranges
- **Key Filter**: Filter by musical key (Camelot notation)
- **Year Search**: Filter by release year or year ranges (e.g., "2020-2023")
- **Tag Filter**: Filter by custom tags
- **Favorites Filter**: Show only starred tracks
- **A-Z Navigation**: Quick jump to artists by letter

### 🎧 Audio Preview
- **Real-time Preview**: Play audio files directly in the browser
- **Audio Visualizer**: Animated spectrum visualization during playback
- **Folder Integration**: Select your audio files folder for seamless previews
- **Audio Controls**: Standard playback controls with track information

### 📋 Playlist Management
- **Create Playlists**: Organize tracks into custom playlists
- **Playlist Operations**: Add, remove, rename, and delete playlists
- **Export/Import**: Save and restore playlists as JSON files
- **Playlist Switching**: Easy dropdown selection between playlists

### 🏷️ Tagging System
- **Custom Tags**: Add multiple tags to any track
- **Tag Filtering**: Filter tracks by specific tags
- **Tag Management**: Edit and remove tags as needed
- **Tag Persistence**: Tags are saved in browser storage

### ⭐ Favorites System
- **Star Tracks**: Mark tracks as favorites with a simple click
- **Favorites View**: Toggle to show only starred tracks
- **Persistent Storage**: Favorites are saved across browser sessions

### 🎨 User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Themes**: Toggle between dark and light modes
- **Copy to Clipboard**: Copy track info and file paths easily
- **Drag & Drop**: Upload files by dragging them into the app
- **Export/Import**: Backup and restore all data (tracks, playlists, tags)

## 🚀 Setup & Installation

### Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server installation required - runs entirely in the browser

### Quick Start

1. **Download or Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/beatrove.git
   cd beatrove
   ```

2. **Open in Browser**
   ```bash
   # Option 1: Direct file access
   open index.html
   
   # Option 2: Local server (recommended)
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. **Prepare Your Music Data**
   - Create a tracklist file with this format:
     ```
     artist - title - key - BPM.extension - track time - year - path - genre
     ```
   - Save as `tracklist.csv` in the root directory for auto-loading

### Example Tracklist Format
```
&ME - Confusion - 5A - 120.flac - 6:56 - 2021 - /path/to/file.flac - Electro
Artbat - Horizon - 8A - 124.wav - 7:23 - 2022 - /path/to/file.wav - Techno
```

## 📁 Project Structure

```
beatrove/
├── index.html              # Main application file
├── assets/
│   ├── script.js           # Core application logic
│   ├── style.css           # Application styling
│   └── favicon.png         # App icon
├── tracklist.csv           # Default music data (auto-loaded)
├── User_Documentation.md   # Detailed user guide
├── CLAUDE.md              # Development documentation
└── README.md              # This file
```

## 🎯 Usage

### Getting Started
1. Open the application in your browser
2. Upload a tracklist file using the "📁 Upload Tracklist" button
3. Use the filters to find specific tracks
4. Click the preview button (▶️) to listen to tracks
5. Create playlists and organize your collection

### Track Format Details
- **Artist**: The artist or DJ name
- **Title**: Track title
- **Key**: Musical key in Camelot notation (e.g., 5A, 12B)
- **BPM.extension**: Tempo followed by file extension (e.g., 120.flac)
- **Track Time**: Duration in MM:SS format
- **Year**: Release year
- **Path**: Full file path to the audio file
- **Genre**: Musical genre (optional)

### Audio Preview Setup
1. Click any preview button (▶️) 
2. Select your audio files folder when prompted
3. Audio files will be matched by filename
4. Enjoy previewing your tracks with the visualizer

## 🔧 Advanced Features

### Import/Export
- **Export All**: Save tracks, playlists, and tags as JSON
- **Import All**: Restore complete data from JSON backup
- **Export Playlists**: Save individual playlists
- **Export Tags**: Save tagging data

### Keyboard Shortcuts
- Use the A-Z navigation bar for quick artist jumping
- Search supports partial matches across all track data

### Browser Storage
- Favorites, playlists, and tags are stored in localStorage
- Data persists across browser sessions
- Clear browser data to reset the application

## 🐛 Troubleshooting

### Common Issues
- **Audio not playing**: Ensure audio files are in the selected folder and filenames match the tracklist
- **Features not working**: Try refreshing the page or clearing browser cache
- **Data disappeared**: Check if browser data was cleared; restore from export backup
- **File upload fails**: Ensure file format is CSV or TXT with proper structure

### Browser Compatibility
- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support (may require user gesture for audio)
- **Edge**: Full support

## 📝 Data Format Notes

The application expects tracklist data in a specific format. The format supports both 6-part and 7+ part entries:

- **6-part**: `artist - title - key - BPM.ext - time - year`
- **7-part**: `artist - title - key - BPM.ext - time - year - genre`
- **8-part**: `artist - title - key - BPM.ext - time - year - path - genre`

The parser intelligently detects file paths (containing extensions) vs. genre tags.

## 🤝 Contributing

This project is open to contributions! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built for the EDM/DJ community to help manage and organize music collections efficiently.

---

**Enjoy managing your EDM music collection with Beatrove!** 🎵✨