# Beatrove - DJ Music Track Management Web Application

A powerful web application for DJs to manage, filter, and preview their music collections. Built with vanilla HTML, CSS, and JavaScript for fast, responsive performance.

## ✨ Features

### 🎵 Track Management
- **Upload Tracklists**: Support for CSV and TXT file formats
- **Auto-load**: Automatically loads `tracklist.csv` if present
- **Track Information**: Artist, title, key, BPM, year, record label, genre, energy levels, and file path
- **Duplicate Detection**: Identifies duplicate tracks in your collection

### 🔍 Filtering & Search
- **Text Search**: Find tracks by artist, title, or other metadata
- **BPM Filter**: Filter by tempo ranges
- **Key Filter**: Filter by musical key (Camelot notation)
- **Year Search**: Filter by release year or year ranges (e.g., "2020-2023")
- **Tag Filter**: Filter by custom tags
- **Energy Filter**: Filter by energy level (1-10 stars)
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

### ⚡ Energy Level System
- **10-Point Rating Scale**: Rate tracks from 1-10 stars for energy intensity
- **Visual Star Display**: See energy levels with filled/empty star patterns
- **Energy Filtering**: Filter tracks by specific energy levels
- **Quick Rating**: Click the lightning bolt (⚡) icon to set energy levels
- **Smart Organization**: Organize tracks by intensity for better set planning

### ⭐ Favorites System
- **Star Tracks**: Mark tracks as favorites with a simple click
- **Favorites View**: Toggle to show only starred tracks
- **Persistent Storage**: Favorites are saved across browser sessions

### 📊 Library Statistics
- **Comprehensive Analytics**: Detailed breakdown of your music collection
- **Overview Stats**: Total tracks and unique artists count
- **Genre Distribution**: Track counts by musical genre
- **Key Analysis**: Distribution across musical keys
- **BPM Ranges**: Tempo analysis with organized ranges (60-89, 90-109, etc.)
- **Energy Statistics**: Energy level distribution across your collection
- **Year Breakdown**: Track counts by release year
- **Record Label Analysis**: Distribution of tracks by record label
- **Interactive Display**: Toggle stats view with smooth scrolling

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
     artist - title - key - BPM.extension - track time - year - path - genre - Energy # - Record Label
     ```
   - Save as `tracklist.csv` in the root directory for auto-loading

### Example Tracklist Format
```
&ME - Confusion - 5A - 120.flac - 6:56 - 2021 - /path/to/file.flac - Electro - Energy 5 - Keinemusik
Artbat - Horizon - 8A - 124.wav - 7:23 - 2022 - /path/to/file.wav - Techno - Energy 7 - Diynamic
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
5. Rate tracks with energy levels (⚡) from 1-10 stars
6. View library statistics with the "📊 Library Stats" button
7. Create playlists and organize your collection

### Track Format Details
- **Artist**: The artist or DJ name
- **Title**: Track title
- **Key**: Musical key in Camelot notation (e.g., 5A, 12B)
- **BPM.extension**: Tempo followed by file extension (e.g., 120.flac)
- **Track Time**: Duration in MM:SS format
- **Year**: Release year
- **Path**: Full file path to the audio file
- **Genre**: Musical genre (optional)
- **Energy Level**: "Energy #" format where # is 1-10 (optional)
- **Record Label**: Label name (optional)

### Audio Preview Setup
1. Click any preview button (▶️) 
2. Select your audio files folder when prompted
3. Audio files will be matched by filename
4. Enjoy previewing your tracks with the visualizer

## 🔧 Advanced Features

### Import/Export
- **Export All**: Save tracks, playlists, tags, and energy levels as JSON
- **Import All**: Restore complete data from JSON backup
- **Export Playlists**: Save individual playlists
- **Export Tags**: Save tagging data

### Energy Level Management
- **Quick Rating**: Click the lightning bolt (⚡) icon next to any track
- **10-Point Scale**: Choose from 1 star (low energy) to 10 stars (high energy)
- **Clear Ratings**: Remove energy ratings when needed
- **Filter by Energy**: Use the Energy dropdown to view tracks by intensity level
- **Set Planning**: Organize tracks by energy for better DJ set flow

### Library Analytics
- **Stats Overview**: View comprehensive collection statistics
- **Genre Insights**: See which genres dominate your library
- **Tempo Analysis**: Understand your BPM distribution across ranges
- **Key Breakdown**: Analyze harmonic mixing opportunities
- **Energy Distribution**: See how your tracks are rated by intensity
- **Timeline View**: Track collection growth by release year

### Keyboard Shortcuts
- Use the A-Z navigation bar for quick artist jumping
- Search supports partial matches across all track data

### Browser Storage
- Favorites, playlists, tags, and energy levels are stored in localStorage
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

The application expects tracklist data in a specific format. The format supports multiple entry types:

- **Basic**: `artist - title - key - BPM.ext - time - year`
- **With Genre**: `artist - title - key - BPM.ext - time - year - genre`
- **With Path**: `artist - title - key - BPM.ext - time - year - path - genre`
- **With Energy**: `artist - title - key - BPM.ext - time - year - path - genre - Energy #`
- **Full Format**: `artist - title - key - BPM.ext - time - year - path - genre - Energy # - Record Label`

The parser intelligently detects file paths, genre tags, energy levels, and record labels in flexible positions.

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