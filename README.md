<div align="center">
  <img src="beatrove-logo.png" alt="Beatrove Logo" width="400">
</div>

# Beatrove - DJ Music Track Management Web Application

A powerful web application for DJs to manage, filter, and preview their music collections. Built with vanilla HTML, CSS, and JavaScript for fast, responsive performance.

## ✨ Features

### 🎵 Track Management
- **Upload Tracklists**: Support for CSV and TXT file formats
- **Auto-load**: Automatically loads `tracklist.csv` if present
- **Track Information**: Artist, title, key, BPM, year, record label, genre, energy levels, and file path
- **Duplicate Detection**: Identifies duplicate tracks in your collection

### 🔍 Advanced Search & Filtering
- **Multi-Criteria Search**: Combine BPM + Genre + Key + Label filters simultaneously
- **Fuzzy Search**: Toggle-able typo-tolerant search using Levenshtein distance algorithm
- **Smart Text Search**: Find tracks by artist, title, genre, or record label
- **BPM Filter**: Filter by specific tempo ranges
- **Key Filter**: Filter by musical key (Camelot notation)
- **Genre Filter**: Filter by musical genre categories
- **Label Filter**: Filter by record label for professional DJ collections
- **Year Search**: Filter by release year or year ranges (e.g., "2020-2023")
- **Tag Filter**: Filter by custom user-defined tags
- **Energy Filter**: Filter by energy level (1-10 stars)
- **Favorites Filter**: Show only starred tracks
- **A-Z Navigation**: Quick jump to artists by letter
- **Typo Tolerance**: Find "Deadmau5" when searching "deadmaus" or "artbt" → "Artbat"

### 🎧 Audio Preview
- **Real-time Preview**: Play audio files directly in the browser
- **Audio Visualizer**: Animated spectrum visualization during playback
- **Folder Integration**: Select your audio files folder for seamless previews
- **Audio Controls**: Standard playback controls with track information

### 🌊 Waveform Visualization
- **Multiple Waveform Styles**: Choose from 6 different visualization styles
- **Real-time Audio Analysis**: Live waveform generation from audio data
- **Professional Style Options**: 
  - **Default (Cyan)**: High-resolution waveform with glow effects
  - **(Orange)**: SoundCloud-style peaks with playback progress
  - **(Green)**: Spotify-style bar visualization with gradients
  - **(Blue Stereo)**: Audacity-style dual-channel waveforms
  - **(Colored)**: Logic Pro-style frequency-based color mapping
  - **Full Track Overview**: Complete song visualization with progress tracking
- **Popup Integration**: Waveforms appear in audio player popup windows
- **Playback Position**: Real-time cursor showing current audio position
- **Style Switching**: Change waveform styles during playback
- **Synthetic Analysis**: CORS-free waveform generation for reliable performance

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

### 😎 Mood & Vibe Tags
- **Emotional Context**: Add mood and atmospheric tags to tracks (Euphoric, Dark, Uplifting, etc.)
- **Visual Differentiation**: Orange-gradient pills with 😎 icon to distinguish from regular tags
- **Professional DJ Workflow**: Organize tracks by emotional impact and atmosphere
- **Set Planning**: Plan mood progressions and vibe transitions for better set flow
- **Separate Management**: Independent system from regular tags with dedicated UI
- **Examples**: Euphoric, Dark, Melancholic, Driving, Hypnotic, Cinematic, Underground
- **Quick Access**: Click the 😎 icon next to any track to add mood/vibe tags
- **Persistent Storage**: Saved separately in browser storage with import/export support

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
- **Interactive Charts**: Beautiful bar charts and donut charts powered by Chart.js
- **Comprehensive Analytics**: Detailed breakdown of your music collection with visual representations
- **Overview Stats**: Total tracks and unique artists count
- **Genre Distribution**: Interactive donut chart showing track counts by musical genre (top 12 + others)
- **Key Analysis**: Color-coded bar chart showing distribution across musical keys
- **BPM Ranges**: Red bar chart with tempo analysis across organized ranges (60-89, 90-109, etc.)
- **Energy Statistics**: Sequential 1-10 energy level bar chart showing complete spectrum
- **Year Breakdown**: Green bar chart displaying track counts by release year
- **Record Label Analysis**: Full-width donut chart showing distribution by record label (top 15 + others)
- **Chart Features**: Hover tooltips, responsive design, theme-aware styling (light/dark mode)
- **Data Filtering**: Smart filtering removes "Unknown" entries from charts while preserving in lists
- **Fallback Support**: Graceful degradation to list view if charts fail to load
- **Professional Layout**: Clean 2-column grid with full-width record labels section

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

2. **Install Dependencies (Optional - for testing)**
   ```bash
   npm install
   ```

3. **Open in Browser**
   ```bash
   # Option 1: Direct file access
   open index.html

   # Option 2: Local server (recommended)
   npm run serve
   # Then visit http://localhost:8000

   # Option 3: Python server
   python -m http.server 8000
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
├── generate_music_list.py  # Python script to build tracklist.csv from audio files
├── music_file_fixer.py     # Python script to standardize audio filenames
├── User_Documentation.md   # Detailed user guide
├── CLAUDE.md              # Development documentation
└── README.md              # This file
```

## 🐍 Python Helper Scripts

Beatrove includes two Python utility scripts to help prepare your music collection for optimal use with the application.

> **⚠️ IMPORTANT: Backup Your Music Collection**
> Before using these scripts, especially `music_file_fixer.py`, **always create a complete backup of your music files**. The filename fixing script will rename your audio files, and while it includes safety checks, it's essential to have a backup in case you need to revert changes. Consider using a backup tool or simply copying your music directory to a safe location before proceeding.

### 📝 generate_music_list.py

Automatically scans your music directory and generates a properly formatted `tracklist.csv` file.

**Features:**
- Scans directories recursively for audio files (MP3, FLAC, WAV, AIFF, AAC)
- Extracts metadata from ID3 tags and file names
- Supports custom metadata fields (Energy Level, Record Label)
- Handles both standardized and non-standardized filenames
- Outputs in CSV or text format
- Validates BPM and musical key formats

**Requirements:**
```bash
pip install tinytag mutagen
```

**Usage:**
```bash
# Basic usage - scan directory and create text file
python generate_music_list.py /path/to/music/directory

# Output as CSV format
python generate_music_list.py /path/to/music/directory --csv -o tracklist.csv

# Custom output location
python generate_music_list.py /path/to/music/directory -o my_tracklist.txt
```

**Expected Filename Format:**
The script works best with files named: `Artist - Title - Key - BPM.extension`
Example: `Deadmau5 - Strobe - 8A - 126.flac`

### 🔧 music_file_fixer.py

Standardizes your music filenames to match the format expected by Beatrove and the generator script.

**Features:**
- Analyzes existing filenames and identifies formatting issues
- Suggests standardized renames following the `Artist - Title - Key - BPM.ext` format
- Dry-run mode to preview changes before applying
- Extracts BPM and key information from filenames
- Uses metadata as fallback for missing information
- Preserves complex track titles with multiple parts

**Requirements:**
```bash
pip install tinytag
```

**Usage:**
```bash
# Dry run - see what would be renamed (default)
python music_file_fixer.py /path/to/music/directory

# Apply renames with confirmation
python music_file_fixer.py /path/to/music/directory --apply

# Apply all renames without confirmation
python music_file_fixer.py /path/to/music/directory --apply --auto-yes

# Use custom defaults for missing BPM/key
python music_file_fixer.py /path/to/music/directory --default-key 1A --default-bpm 128
```

**Workflow Example:**
1. Use `music_file_fixer.py` to standardize your audio filenames
2. Run `generate_music_list.py` to create a comprehensive tracklist
3. Copy the generated `tracklist.csv` to your Beatrove directory
4. Open Beatrove and enjoy organized track management

### 🔄 Recommended Workflow

For best results with Beatrove, follow this preparation workflow:

1. **Organize Your Files**: Ensure your music files contain proper ID3 metadata
2. **Fix Filenames**: Run `music_file_fixer.py` to standardize naming
3. **Generate Tracklist**: Use `generate_music_list.py` to create your data file
4. **Load in Beatrove**: Place the generated file as `tracklist.csv` for auto-loading

## 🎯 Usage

### Getting Started
1. Open the application in your browser
2. Upload a tracklist file using the "📁 Upload Tracklist" button
3. Use the **multi-criteria search** to find specific tracks with precise filtering
4. **Enable fuzzy search** for typo-tolerant searching by checking the "🔤 Fuzzy Search" toggle
5. Click the preview button (▶️) to listen to tracks
6. **Select a waveform style** from the "Waveform Style" dropdown for visual audio analysis
7. Rate tracks with energy levels (⚡) from 1-10 stars
8. **Add mood & vibe tags** by clicking the 😎 icon to categorize tracks by emotional impact
9. **View interactive library statistics** with the "📊 Library Stats" button to see visual charts and analytics
10. Create playlists and organize your collection

### Advanced Search Features
1. **Multi-Criteria Filtering**: Combine multiple filters for precise track discovery
   - Example: "120-125 BPM + Techno + 5A Key + Drumcode Label"
2. **Fuzzy Search**: Enable typo-tolerant search for forgiving text matching
   - Example: "deadmaus" finds "Deadmau5", "artbt" finds "Artbat"
3. **Smart Field Matching**: Search automatically checks artist, title, genre, and label fields
4. **Threshold Optimization**: Short words require higher similarity, longer words are more forgiving

### Waveform Visualization
1. **Choose a style** from the Waveform Style dropdown in the top controls
2. **Play any track** to see real-time waveform visualization in the audio player popup
3. **Switch styles** during playback to compare different visualizations
4. **Use Full Track Overview** to see the entire song with playback progress
5. **View different data representations** - from simple bars to complex frequency mapping

### Library Statistics & Charts
1. **Access Statistics**: Click the "📊 Library Stats" button in the top controls
2. **Interactive Charts**: View your collection through beautiful, interactive visualizations:
   - **Genre Donut Chart**: See genre distribution with hover tooltips and dynamic colors
   - **Keys Bar Chart**: Analyze key distribution across your tracks (blue theme)
   - **BPM Ranges Bar Chart**: Visualize tempo distribution in organized ranges (red theme)
   - **Energy Levels Bar Chart**: Complete 1-10 energy spectrum visualization (yellow theme)
   - **Years Bar Chart**: Track collection timeline by release year (green theme)
   - **Record Labels Donut Chart**: Full-width chart showing label distribution
3. **Chart Features**:
   - Hover over chart elements for detailed tooltips
   - Charts automatically adapt to light/dark theme
   - Responsive design works on all screen sizes
   - Smart data filtering shows top entries with "Others" category
4. **Fallback Lists**: If charts don't load, complete data is still available in list format
5. **Layout**: Professional 2-column grid with full-width record labels section

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

## 🧪 Testing

Beatrove includes a comprehensive test suite to ensure reliability and quality.

### Running Tests

```bash
# Install dependencies first
npm install

# Run all tests once
npm test

# Run tests in watch mode (reruns on changes)
npm run test:watch

# Open interactive test UI in browser
npm run test:ui

# Generate test coverage report
npm run test:coverage
```

### Test Coverage

The test suite covers:
- **Fuzzy Search Algorithms**: Validates typo-tolerant search with DJ name examples
- **Security Utilities**: Tests input sanitization and validation functions
- **Track Processing**: Ensures CSV parsing handles various track formats correctly
- **Data Validation**: Validates BPM ranges, years, and file formats

### Test Structure

```
tests/
├── unit/
│   ├── fuzzy-search.test.js    # Search algorithm tests
│   ├── security-utils.test.js  # Security validation tests
│   └── track-processor.test.js # CSV parsing tests
├── fixtures/
│   └── sample-tracklist.csv    # Test data
└── setup.js                   # Test environment setup
```

## 🔧 Advanced Features

### Import/Export
- **Export All**: Save tracks, playlists, tags, mood/vibe tags, and energy levels as JSON
- **Import All**: Restore complete data from JSON backup
- **Export Playlists**: Save individual playlists
- **Export Tags**: Save tagging data

### Mood & Vibe Tag Management
- **Quick Tagging**: Click the 😎 icon next to any track to add mood/vibe tags
- **Emotional Categories**: Tag tracks with moods like Euphoric, Dark, Melancholic, Uplifting
- **Atmospheric Vibes**: Add vibe tags like Driving, Hypnotic, Cinematic, Underground
- **Visual Recognition**: Orange-gradient pills make mood/vibe tags instantly recognizable
- **Set Planning**: Organize tracks by emotional journey for seamless mood transitions
- **Professional Workflow**: Plan set progression from introspective to euphoric moments
- **Independent System**: Separate from regular tags for specialized DJ categorization

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