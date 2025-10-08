<div align="center">
  <img src="beatrove-logo.png" alt="Beatrove Logo" width="400">
</div>

# Beatrove - DJ Music Track Management Web Application

A powerful web application for DJs to manage, filter, and preview their music collections. Built with vanilla HTML, CSS, and JavaScript for fast, responsive performance.

## 🌐 Demo

Try Beatrove live: **[https://totalkaos.net/beatrove/](https://totalkaos.net/beatrove/)**

**Note:** The demo runs in restricted mode with uploads and audio preview disabled for security. To use the full application with all features, clone the repository and run it locally.

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

### 🎧 Audio Preview & Playlist Playback
- **Real-time Preview**: Play audio files directly in the browser
- **Audio Visualizer**: Animated spectrum visualization during playback
- **Folder Integration**: Select your audio files folder for seamless previews
- **Audio Controls**: Standard playback controls with track information
- **Playlist Auto-Play**: Play all tracks in a playlist sequentially with queue controls
- **Auto-Mix Crossfade**: Professional DJ-style crossfading between tracks (1-15 seconds)
- **Queue Management**: Previous, pause, next, and stop controls for playlist playback
- **Crossfade Duration**: Adjustable crossfade timing with real-time slider
- **Dual Player Display**: Visual indication during crossfade with fading player overlay

### 🎨 Cover Art Display
- **Visual Track Display**: Show album artwork alongside track information
- **Multiple Format Support**: JPG, JPEG, PNG, and WebP image formats
- **Automatic Detection**: Finds cover art in the `artwork` subdirectory
- **Smart Fallback**: Clean SVG placeholder when artwork is missing
- **Responsive Design**: Scales from 64px (desktop) to 48px (mobile)
- **Toggle Control**: Show/hide cover art with persistent preference
- **Performance Optimized**: Image caching and lazy loading

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
- **Playlist Playback**: Play entire playlists with auto-advance to next track
- **Auto-Mix Mode**: Enable DJ-style crossfading between tracks during playlist playback
- **Playback Controls**: Full queue control with previous, pause, next, and stop buttons
- **Track Progress**: Visual indicator showing current track position in playlist (e.g., "Track 4 of 156")

### 🧠 Smart Playlists
- **Rule-Based Filtering**: Automatically populate playlists based on metadata criteria
- **Multiple Rule Support**: Combine multiple conditions for precise track selection
- **Logical Operators**: Use AND/OR logic to create complex filtering rules
- **Real-time Updates**: Smart playlists dynamically update when your library changes
- **Professional Criteria**: Filter by BPM, genre, key, year, energy level, artist, title, and record label
- **Advanced Operators**: Support for "is", "contains", "starts with", "greater than", "less than", and "between" comparisons
- **Live Preview**: See matching tracks count and preview while creating rules
- **Export Support**: Export smart playlist results as regular playlists
- **Brain Icon**: Smart playlists display with 🧠 emoji in the dropdown for easy identification

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
├── index.html                          # Main application entry point
├── assets/
│   ├── style.css                       # Application styling and themes
│   └── js/
│       ├── main.js                     # Application initialization and state management
│       ├── audio/
│       │   ├── audio-manager.js        # Audio playback and Web Audio API
│       │   ├── audio-visualizer.js     # 6 waveform visualization styles
│       │   └── play-queue.js           # Playlist queue and auto-mix crossfade
│       ├── core/
│       │   ├── blob-manager.js         # Blob URL lifecycle management
│       │   ├── error-handler.js        # Centralized error handling
│       │   ├── filter-manager.js       # Multi-criteria track filtering
│       │   ├── fuzzy-search.js         # Typo-tolerant search algorithm
│       │   ├── logger.js               # Debug logging utility
│       │   └── security-utils.js       # Input sanitization and validation
│       └── ui/
│           ├── ui-controller.js        # User interaction and event handling
│           └── ui-renderer.js          # DOM rendering and updates
├── themes/                             # Animated theme CSS files
├── tests/                              # Vitest unit test suite
├── images/                             # Application images and logos
├── tracklist.csv                       # Default music data (auto-loaded)
├── generate_music_list.py              # Python script to build tracklist.csv
├── music_file_fixer.py                 # Python script to standardize filenames
├── User_Documentation.html             # Comprehensive user guide
├── CLAUDE.md                           # AI assistant project instructions
├── package.json                        # npm dependencies for testing
├── vitest.config.js                    # Test configuration
└── README.md                           # This file
```

## 🐍 Python Helper Scripts

Beatrove includes two Python utility scripts to help prepare your music collection for optimal use with the application.

> **⚠️ IMPORTANT: Backup Your Music Collection**
> Before using these scripts, especially `music_file_fixer.py`, **always create a complete backup of your music files**. The filename fixing script will rename your audio files, and while it includes safety checks, it's essential to have a backup in case you need to revert changes. Consider using a backup tool or simply copying your music directory to a safe location before proceeding.

### 📝 generate_music_list.py

Automatically scans your music directory and generates a properly formatted `tracklist.csv` file with professional metadata extraction.

**Features:**
- Scans directories recursively for audio files (MP3, FLAC, WAV, AIFF, AAC)
- Extracts metadata from ID3 tags and file names
- Supports custom metadata fields (Energy Level, Record Label)
- **🎨 Cover Art Extraction**: Extracts album artwork from MP3/FLAC files
- Handles both standardized and non-standardized filenames
- Outputs in professional CSV or legacy text format
- Validates BPM and musical key formats
- Progress reporting and detailed error handling

**Requirements:**
```bash
pip install tinytag mutagen
```

**Usage:**
```bash
# Get comprehensive help and examples
python generate_music_list.py --help

# Basic usage - scan directory and create text file
python generate_music_list.py /path/to/music/directory

# Professional CSV output with cover art extraction
python generate_music_list.py /path/to/music/directory --csv --extract-artwork -o tracklist.csv

# Extract artwork to custom directory
python generate_music_list.py /path/to/music/directory --csv --extract-artwork --artwork-dir ./covers

# Custom output location
python generate_music_list.py /path/to/music/directory -o my_tracklist.txt
```

**Cover Art Extraction:**
- Supports MP3 (ID3 tags) and FLAC (embedded pictures)
- Automatically detects JPEG/PNG formats
- Creates organized artwork directory with clean filenames
- Adds artwork paths to CSV output for future integration

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
# Get comprehensive help and examples
python music_file_fixer.py --help

# Dry run - see what would be renamed (default)
python music_file_fixer.py /path/to/music/directory

# Apply renames with confirmation
python music_file_fixer.py /path/to/music/directory --apply

# Apply all renames without confirmation
python music_file_fixer.py /path/to/music/directory --apply --auto-yes

# Use custom defaults for missing BPM/key
python music_file_fixer.py /path/to/music/directory --default-key 1A --default-bpm 128
```

**Professional Workflow:**
1. **Backup** your music collection (essential!)
2. Use `music_file_fixer.py --help` to understand filename standardization
3. Standardize filenames: `music_file_fixer.py /path/to/music --apply`
4. Generate comprehensive tracklist: `generate_music_list.py /path/to/music --csv --extract-artwork`
5. Copy generated `tracklist.csv` to your Beatrove directory
6. Enjoy organized track management with cover art support

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
11. **Play entire playlists** with the "▶️ Play All" button for continuous playback
12. **Enable Auto-Mix** for DJ-style crossfading between tracks during playlist playback

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

### Playlist Playback & Auto-Mix
1. **Select a Playlist**: Choose any playlist from the playlist dropdown
2. **Start Playback**: Click the "▶️ Play All" button to begin playing all tracks in sequence
3. **Queue Controls**:
   - **⏮️ Previous**: Jump to the previous track in the playlist
   - **⏸️/▶️ Pause/Resume**: Pause or resume the current track
   - **⏭️ Next**: Skip to the next track (supports auto-mix if enabled)
   - **⏹️ Stop**: Stop playlist playback completely
4. **Enable Auto-Mix**: Check the "🎚️ Auto-Mix" checkbox for DJ-style crossfading
5. **Adjust Crossfade Duration**: Use the slider to set crossfade time (1-15 seconds)
6. **Track Progress**: Monitor your position with the "Playing Track X of Y" indicator
7. **Crossfade Behavior**:
   - Tracks fade out smoothly as the next track fades in
   - Waveform visualization continues during crossfade
   - Both audio players visible during transition (fading player marked with "⏳ Fading out...")
   - Manual skip button (⏭️) also triggers crossfade when auto-mix is enabled

### Smart Playlist Creation
1. **Access Creation**: Click the "🧠 Smart Playlist" button in the playlist controls
2. **Name Your Playlist**: Enter a descriptive name (e.g., "High Energy House", "90s Hip-Hop")
3. **Add Rules**: Click "+ Add Rule" to create filtering conditions
4. **Configure Each Rule**:
   - **Field**: Select from Genre, BPM, Key, Year, Energy Level, Artist, Title, Record Label
   - **Operator**: Choose from "is", "contains", "starts with", "greater than", "less than", "between"
   - **Value**: Enter the criteria value (for "between", enter two values)
5. **Set Logic**: Choose "All rules must match (AND)" or "Any rule can match (OR)"
6. **Live Preview**: See real-time track count and preview of matching tracks
7. **Save & Use**: Create the smart playlist and it appears in the dropdown with 🧠 emoji

**Smart Playlist Examples**:
- **High Energy Techno**: Genre "contains" "Techno" AND Energy Level "greater than" 7
- **Harmonic House**: Genre "contains" "House" AND Key "is" "8A"
- **2020s Progressive**: Genre "contains" "Progressive" AND Year "between" 2020-2024
- **Peak Time**: BPM "between" 128-132 AND Energy Level "greater than" 8

### Playlist Export Formats
1. **Access Export**: Select any playlist and click "Export Playlists" button
2. **Choose Format**: Interactive modal with 4 professional export options:

**📄 TXT Format**:
- Simple text file with track names, one per line
- Perfect for DJ software compatibility
- Lightweight and universally supported

**📊 CSV Format**:
- Complete track metadata in spreadsheet format
- Includes artist, title, BPM, key, year, genre, energy level, record label
- Perfect for Excel analysis and data processing
- Proper CSV escaping for special characters

**🌐 HTML Format**:
- Professional styled web page with searchable table
- Dark theme styling consistent with app
- Energy levels displayed as gold stars (★★★★★☆☆☆☆☆)
- Perfect for sharing, printing, or web publishing
- Responsive design for all devices

**🎵 M3U Format**:
- Standard playlist format for media players
- Compatible with VLC, iTunes, Winamp, and DJ software
- Includes track duration and metadata
- Uses proper file paths for local playback

3. **Smart Playlist Support**: All formats work with both regular and smart playlists
4. **Automatic Download**: Files download with proper extensions and MIME types

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

### Supported File Formats
Beatrove supports two tracklist formats with automatic detection:

#### **New CSV Format** (Recommended)
Professional organized format with proper column headers:
```csv
Artist,Title,Key,BPM,Extension,Duration,Year,Path,Genre,Energy,Label
Artbat,Horizon,8A,124,.wav,7:23,2022,/path/to/file.wav,Techno,Energy 7,Diynamic
CamelPhat,Hope - Edit,4B,122,.flac,6:45,2023,/path/to/file.flac,House,Energy 8,Anjunadeep
```

**CSV Column Details**:
- **Artist**: Artist or DJ name
- **Title**: Track title (including remix info, features)
- **Key**: Musical key in Camelot notation (5A, 12B)
- **BPM**: Beats per minute (numeric only)
- **Extension**: File extension (.mp3, .flac, .wav)
- **Duration**: Track length in MM:SS format
- **Year**: Release year (4 digits)
- **Path**: Full absolute path to audio file
- **Genre**: Musical genre
- **Energy**: Energy level format "Energy 7" (1-10 scale)
- **Label**: Record label name
- **Artwork**: Cover art path (optional)

#### **Legacy Format** (Still Supported)
Dash-separated format for backward compatibility:
```
Artist - Title - Key - BPM.extension - Duration - Year - Path - Genre - Energy # - Label
```

**Automatic Detection**: Beatrove automatically detects which format your file uses and parses accordingly.

### Audio Preview Setup
1. Click any preview button (▶️)
2. Select your audio files folder when prompted
3. Audio files will be matched by filename
4. Enjoy previewing your tracks with the visualizer

### 🎨 Cover Art Setup

#### **Directory Structure**
```
Your-Music-Folder/
├── Artist - Title - Key - BPM.flac
├── Artist - Title - Key - BPM.mp3
└── artwork/                    ← Cover art directory
    ├── Artist - Title.jpg      ← Simplified naming (new)
    ├── Artist - Title.jpeg
    ├── Artist - Title.png
    └── Artist - Title.webp
```

#### **Supported Image Formats**
- **.jpg** (JPEG) - Recommended for smaller file sizes
- **.jpeg** (JPEG)
- **.png** (Portable Network Graphics)
- **.webp** (WebP)

#### **File Naming Convention**
Cover art files use a simplified **Artist - Title** format:

**Audio File:** `Deadmau5 - Strobe - 8A - 126.flac`
**Cover Art:** `artwork/Deadmau5 - Strobe.jpg`

*Note: Legacy full filename format (`Artist - Title - Key - BPM.jpg`) is still supported for backward compatibility.*

#### **How It Works**
1. **Automatic Detection**: When you select an audio folder, Beatrove looks for an `artwork` subdirectory
2. **Smart Matching**: For each track, searches for cover art in priority order (jpg → jpeg → png → webp)
3. **Fallback**: Shows clean SVG placeholder when no cover art is found
4. **Toggle Control**: Use the 🎨 Cover Art button to show/hide artwork

#### **Using the Python Script**
Extract cover art automatically from your audio files:

```bash
# Extract cover art to default 'artwork' directory
python generate_music_list.py /path/to/music --extract-artwork

# Extract to custom directory
python generate_music_list.py /path/to/music --extract-artwork --artwork-dir ./album_covers
```

**Extraction Features:**
- Supports MP3 (ID3 tags) and FLAC (embedded pictures)
- Automatically detects JPEG/PNG formats
- Creates organized artwork directory with clean filenames
- Adds artwork paths to CSV output

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
- **Export All**: Save tracks, playlists, smart playlists, tags, mood/vibe tags, and energy levels as JSON
- **Import All**: Restore complete data from JSON backup
- **Multi-Format Playlist Export**: Choose from 4 professional formats:
  - **TXT**: Simple text format, one track per line (DJ software compatible)
  - **CSV**: Complete metadata spreadsheet (Excel/data analysis ready)
  - **HTML**: Styled web page with searchable table (sharing/printing)
  - **M3U**: Standard playlist format (VLC, iTunes, media players)
- **Smart Playlist Export**: Export filtered results from smart playlists in any format
- **Interactive Format Selection**: Professional modal with format descriptions and icons
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