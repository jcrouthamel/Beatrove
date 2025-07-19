// ============= SECURITY UTILITIES =============

// Sanitize text content to prevent XSS
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  // Only sanitize the most dangerous characters, leave & alone for artist names
  return text.replace(/[<>"']/g, function(match) {
    const escape = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escape[match] || match;
  });
}

// Sanitize for HTML insertion (more aggressive)
function sanitizeForHTML(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>"'&]/g, function(match) {
    const escape = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '&': '&amp;'
    };
    return escape[match] || match;
  });
}

// Create safe DOM element with text content
function createSafeElement(tagName, textContent = '', className = '') {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

// Validate file extension
function validateFileExtension(filename, allowedExtensions = ['.csv', '.txt', '.yaml', '.yml']) {
  if (!filename || typeof filename !== 'string') return false;
  const parts = filename.split('.');
  if (parts.length < 2) return false;
  const extension = '.' + parts.pop().toLowerCase();
  return allowedExtensions.includes(extension);
}

// Validate BPM range
function validateBPM(bpm) {
  const bpmNum = parseInt(bpm, 10);
  return !isNaN(bpmNum) && bpmNum >= 60 && bpmNum <= 200;
}

// Validate year
function validateYear(year) {
  if (!year) return true; // Optional field
  const yearNum = parseInt(year, 10);
  return !isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2030;
}

// Safe error display
function displayError(container, message) {
  if (!container) return;
  const errorDiv = createSafeElement('div', `Error: ${sanitizeForHTML(message)}`, 'no-results');
  container.innerHTML = '';
  container.appendChild(errorDiv);
}

// ============= ORIGINAL UTILITIES =============

// Utility to detect file extension
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

// Parse CSV line (simple, not RFC-complete)
function parseCSVLine(line) {
  // Handles basic CSV, not escaped commas/quotes
  return line.split(',').map(cell => cell.trim());
}

// Function to process tracklist data
function processTracklist(text, fileName) {
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid file content');
    }
    
    // Skip file extension validation for auto-loaded tracklist.csv
    if (fileName !== 'tracklist.csv' && !validateFileExtension(fileName)) {
      throw new Error('Invalid file type. Please use CSV, TXT, YAML, or YML files.');
    }
    
    let lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('File is empty or contains no valid data');
    }
    
    const grouped = {};
    const allBPMs = new Set();
    const allKeys = new Set();
    let totalTracks = 0;
    const tracksForUI = [];
    const seenTracks = new Map(); // Map of duplicateKey -> [trackObj]
    const duplicateTracks = [];
    const errors = [];

  // Hide any previous warning
  const warningDiv = document.getElementById('duplicate-warning');
  if (warningDiv) {
    warningDiv.style.display = 'none';
    warningDiv.textContent = '';
  }

  // Debug: Log the first few lines we're processing
  console.log('First 3 lines to process:', lines.slice(0, 3));

  // Treat as TXT-style: artist - title - key - BPM.extension - track time - year - path
  lines.forEach((line, index) => {
    // Accept both 6-part (no path) and 7+-part (with path/genre) formats
    const parts = line.split(' - ');
    if (parts.length < 6) {
      console.log('Skipping line (not enough parts):', line);
      return;
    }
    // Clean and trim input parts (minimal sanitization for data integrity)
    let artist = (parts[0]?.trim() || '');
    let title = (parts[1]?.trim() || '');
    let key = (parts[2]?.trim() || '');
    let bpmExt = (parts[3]?.trim() || '');
    let trackTime = (parts[4]?.trim() || '');
    let year = (parts[5]?.trim() || '');
    
    // Validate required fields (be more lenient for auto-loaded files)
    if (!artist && !title) {
      errors.push(`Line ${index + 1}: Missing both artist and title`);
      return;
    }
    
    // Use fallback values for missing fields
    if (!artist) {
      console.warn(`Line ${index + 1}: Missing artist field, using 'Unknown Artist'`);
      artist = 'Unknown Artist';
    }
    if (!title) {
      console.warn(`Line ${index + 1}: Missing title field, using 'Unknown Title'`);
      title = 'Unknown Title';
    }
    if (!key) {
      console.warn(`Line ${index + 1}: Missing key field, using empty string`);
    }
    if (!bpmExt) {
      console.warn(`Line ${index + 1}: Missing BPM field, using empty string`);
    }
    let genre = '';
    let absPath = '';
    if (parts.length === 7) {
      // Could be genre or absPath (detect by extension or by value)
      if (/\.(mp3|wav|flac|aiff|ogg)$/i.test(parts[6])) {
        absPath = parts[6].trim();
      } else if (/^[a-zA-Z][a-zA-Z0-9\- ]*$/i.test(parts[6])) {
        genre = parts[6].trim();
      } else {
        // If it's not a known extension and not a genre-like string, treat as genre
        genre = parts[6].trim();
      }
    } else if (parts.length > 7) {
      // If any of the later parts contains a file extension, treat all up to that as absPath, last as genre
      let lastPart = parts[parts.length - 1].trim();
      let pathParts = parts.slice(6, parts.length - 1);
      let pathCandidate = pathParts.join(' - ').trim();
      if (/\.(mp3|wav|flac|aiff|ogg)$/i.test(lastPart)) {
        absPath = [pathCandidate, lastPart].filter(Boolean).join(' - ');
        genre = '';
      } else {
        absPath = pathCandidate;
        genre = lastPart;
      }
    }

    // Extract BPM from the format (e.g., "127.flac")
    const bpmMatch = bpmExt.match(/(\d{2,3})/);
    const bpm = bpmMatch ? bpmMatch[1] : '';
    
    // Validate BPM (warn but don't reject)
    if (bpm && !validateBPM(bpm)) {
      console.warn(`Line ${index + 1}: Unusual BPM value (${bpm}). Expected 60-200.`);
    }
    
    // Validate year (warn but don't reject)
    if (year && !validateYear(year)) {
      console.warn(`Line ${index + 1}: Unusual year (${year}). Expected 1900-2030.`);
    }
    
    if (bpm) allBPMs.add(bpm);
    if (key) allKeys.add(key);

    // Normalize year to 4-digit string if possible
    let yearNorm = year;
    const yearMatch = year && year.match(/(19\d{2}|20\d{2}|2025)/);
    if (yearMatch) yearNorm = yearMatch[1];

    // Create safe display string
    const display = `${artist} - ${title} - ${key} - ${bpmExt} - ${trackTime} - ${year}` + (genre ? ` - ${genre}` : '');
    const trackObj = {
      display: display,
      absPath: absPath,
      bpm: bpm,
      key: key,
      artist: artist,
      title: title,
      year: yearNorm,
      trackTime: trackTime,
      genre: genre
    };

    // Group by artist
    if (!grouped[artist]) {
      grouped[artist] = [];
    }
    grouped[artist].push(trackObj);
    totalTracks++;
    tracksForUI.push(trackObj);

    // Duplicate detection (by artist, title, key, bpm)
    const duplicateKey = `${artist} - ${title} - ${key} - ${bpm}`;
    if (seenTracks.has(duplicateKey)) {
      // Store all duplicates
      duplicateTracks.push(trackObj);
    } else {
      seenTracks.set(duplicateKey, [trackObj]);
    }
  });

  // Display validation errors if any (only for manual uploads)
  if (errors.length > 0) {
    console.warn('Validation errors found:', errors);
    // Only show alert for manual uploads, not auto-loaded files
    if (fileName !== 'tracklist.csv') {
      const errorSummary = errors.slice(0, 5).join('\n');
      const moreErrors = errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : '';
      alert(`Warning: Found ${errors.length} validation errors:\n${errorSummary}${moreErrors}`);
    }
  }

  // Debug final results
  const groupedKeys = Object.keys(grouped);
  let sampleArtist = null;
  let sampleTracks = [];
  if (groupedKeys.length > 0) {
    sampleArtist = groupedKeys[0];
    sampleTracks = grouped[sampleArtist];
  }
  console.log('Processing complete:', {
    totalTracks,
    artistCount: groupedKeys.length,
    sampleArtist,
    sampleTracks,
    duplicateTracks,
    validationErrors: errors.length
  });

  return { grouped, allBPMs, allKeys, totalTracks, tracksForUI, duplicateTracks };
  
  } catch (error) {
    console.error('Error processing tracklist:', error);
    throw error;
  }
}

// Defensive: Ensure render is only called after DOMContentLoaded and grouped is available
function safeRender() {
  try {
    // Use AppState data if available, fallback to window references for compatibility
    const dataSource = AppState?.data || window;
    const groupedData = dataSource.grouped || window.grouped;
    const duplicateData = dataSource.duplicateTracks || window.duplicateTracks;
    
    if (!groupedData || typeof groupedData !== 'object') {
      const container = AppState?.elements?.container || document.getElementById('columns');
      if (container) {
        displayError(container, 'No track data loaded.');
      }
      renderDuplicateList([]);
      return;
    }
    render();
    // Also render duplicates if available
    if (duplicateData) {
      renderDuplicateList(duplicateData);
    }
  } catch (err) {
    const container = AppState?.elements?.container || document.getElementById('columns');
    if (container) {
      displayError(container, err.message);
    }
    renderDuplicateList([]);
    console.error('Render error:', err);
  }
}

// ============= APPLICATION STATE MANAGER =============
const AppState = {
  elements: {
    bpmFilter: null,
    keyFilter: null,
    container: null,
    statsElement: null,
    sortSelect: null
  },
  data: {
    grouped: {},
    totalTracks: 0,
    duplicateTracks: [],
    tracksForUI: [],
    trackTags: {},
    favoriteTracks: {},
    playlists: {},
    currentPlaylist: '',
    showFavoritesOnly: false
  },
  eventListeners: new Map(),
  audioResources: new Set(),
  
  // Performance optimization caches
  cache: {
    filterResults: new Map(),
    sortResults: new Map(),
    lastFilterHash: null,
    lastSortHash: null,
    domUpdateQueue: [],
    isUpdating: false
  }
};

// ============= MEMOIZATION UTILITIES =============

function createHash(obj) {
  return JSON.stringify(obj);
}

function memoize(fn, cache, keyGenerator) {
  return function(...args) {
    const key = keyGenerator ? keyGenerator(...args) : createHash(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    
    // Limit cache size to prevent memory issues
    if (cache.size > 50) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
}

function clearFilterCache() {
  AppState.cache.filterResults.clear();
  AppState.cache.sortResults.clear();
  AppState.cache.lastFilterHash = null;
  AppState.cache.lastSortHash = null;
}

// Clear cache when data changes
function invalidateCache(reason = 'data-change') {
  clearFilterCache();
  console.log(`Cache invalidated: ${reason}`);
}

// ============= DOM BATCHING UTILITIES =============

function queueDOMUpdate(updateFn) {
  AppState.cache.domUpdateQueue.push(updateFn);
  
  if (!AppState.cache.isUpdating) {
    AppState.cache.isUpdating = true;
    requestAnimationFrame(flushDOMUpdates);
  }
}

function flushDOMUpdates() {
  const startTime = performance.now();
  
  // Process all queued updates in a single frame
  while (AppState.cache.domUpdateQueue.length > 0) {
    const updateFn = AppState.cache.domUpdateQueue.shift();
    updateFn();
    
    // Yield if we've been processing for too long (>16ms for 60fps)
    if (performance.now() - startTime > 16) {
      if (AppState.cache.domUpdateQueue.length > 0) {
        requestAnimationFrame(flushDOMUpdates);
        return;
      }
    }
  }
  
  AppState.cache.isUpdating = false;
}

// ============= EVENT LISTENER MANAGEMENT =============
function addManagedEventListener(element, event, handler, key) {
  if (!element) return;
  
  // Remove existing listener if present
  removeManagedEventListener(key);
  
  element.addEventListener(event, handler);
  AppState.eventListeners.set(key, { element, event, handler });
}

function removeManagedEventListener(key) {
  if (AppState.eventListeners.has(key)) {
    const { element, event, handler } = AppState.eventListeners.get(key);
    element.removeEventListener(event, handler);
    AppState.eventListeners.delete(key);
  }
}

function cleanupAllEventListeners() {
  AppState.eventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  AppState.eventListeners.clear();
  console.log('Cleaned up all event listeners');
}

// ============= AUDIO RESOURCE MANAGEMENT =============
function addAudioResource(resource) {
  AppState.audioResources.add(resource);
}

function removeAudioResource(resource) {
  if (AppState.audioResources.has(resource)) {
    if (resource.src && resource.src.startsWith('blob:')) {
      URL.revokeObjectURL(resource.src);
    }
    if (resource.parentElement) {
      resource.parentElement.remove();
    }
    AppState.audioResources.delete(resource);
  }
}

function cleanupAllAudioResources() {
  AppState.audioResources.forEach(resource => {
    if (resource.src && resource.src.startsWith('blob:')) {
      URL.revokeObjectURL(resource.src);
    }
    if (resource.parentElement) {
      resource.parentElement.remove();
    }
  });
  AppState.audioResources.clear();
  console.log('Cleaned up all audio resources');
}

// ============= APPLICATION INITIALIZATION =============
function initializeApp() {
  // Define filter and container elements
  AppState.elements.bpmFilter = document.getElementById('bpm-filter');
  AppState.elements.keyFilter = document.getElementById('key-filter');
  AppState.elements.container = document.getElementById('columns');
  AppState.elements.statsElement = document.getElementById('stats');
  AppState.elements.sortSelect = document.getElementById('sort-select');
  
  // Set up legacy global references for backward compatibility
  window.bpmFilter = AppState.elements.bpmFilter;
  window.keyFilter = AppState.elements.keyFilter;
  window.container = AppState.elements.container;
  window.statsElement = AppState.elements.statsElement;
  window.sortSelect = AppState.elements.sortSelect;
  
  // Load stored data
  try {
    AppState.data.trackTags = JSON.parse(localStorage.getItem('trackTags') || '{}');
    AppState.data.favoriteTracks = JSON.parse(localStorage.getItem('favoriteTracks') || '{}');
    AppState.data.playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
    AppState.data.currentPlaylist = localStorage.getItem('currentPlaylist') || '';
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
  
  // Set up legacy global references for stored data
  window.trackTags = AppState.data.trackTags;
  window.favoriteTracks = AppState.data.favoriteTracks;
  window.playlists = AppState.data.playlists;
  window.currentPlaylist = AppState.data.currentPlaylist;
  window.showFavoritesOnly = AppState.data.showFavoritesOnly;
  
  // Attach event listeners with proper cleanup tracking
  const searchElement = document.getElementById('search');
  const yearElement = document.getElementById('year-search');
  
  addManagedEventListener(searchElement, 'input', safeRender, 'search-input');
  
  // Add debugging for BPM filter
  console.log('BPM Filter element:', AppState.elements.bpmFilter);
  if (AppState.elements.bpmFilter) {
    console.log('BPM Filter options:', AppState.elements.bpmFilter.innerHTML);
  }
  
  addManagedEventListener(AppState.elements.bpmFilter, 'change', function(event) {
    console.log('BPM Filter changed to:', event.target.value);
    safeRender();
  }, 'bpm-filter');
  
  addManagedEventListener(AppState.elements.keyFilter, 'change', safeRender, 'key-filter');
  addManagedEventListener(AppState.elements.sortSelect, 'change', safeRender, 'sort-select');
  addManagedEventListener(yearElement, 'input', safeRender, 'year-search');
  
  // Initial render
  safeRender();
}

// ============= CLEANUP FUNCTION =============
function cleanupApp() {
  cleanupAllEventListeners();
  cleanupAllAudioResources();
  
  // Clear global references
  delete window.bpmFilter;
  delete window.keyFilter;
  delete window.container;
  delete window.statsElement;
  delete window.sortSelect;
  delete window.trackTags;
  delete window.favoriteTracks;
  delete window.playlists;
  delete window.currentPlaylist;
  delete window.showFavoritesOnly;
  
  console.log('Application cleanup complete');
}

// ============= PAGE LIFECYCLE =============
document.addEventListener('DOMContentLoaded', initializeApp);

// Cleanup when page is about to unload
window.addEventListener('beforeunload', cleanupApp);

// Cleanup when page becomes hidden (mobile/tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cleanupAllAudioResources(); // Stop audio when page hidden
  }
});

// Patch file upload handler to pass fileName
const uploadInput = document.getElementById('tracklist-upload');
if (uploadInput) {
  uploadInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file before processing
    if (!validateFileExtension(file.name)) {
      alert('Invalid file type. Please select a CSV, TXT, YAML, or YML file.');
      e.target.value = ''; // Clear the input
      return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Please select a file smaller than 10MB.');
      e.target.value = ''; // Clear the input
      return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = function() {
      alert('Error reading file. Please try again.');
      e.target.value = ''; // Clear the input
    };
    
    reader.onload = function(evt) {
      try {
        const text = evt.target.result;
        console.log('File loaded, processing...');
        
        const result = processTracklist(text, file.name);
        console.log('Process result:', {
          totalTracks: result.totalTracks,
          artistCount: Object.keys(result.grouped).length
        });
        
        window.grouped = result.grouped;
        window.totalTracks = result.totalTracks;
        window.duplicateTracks = result.duplicateTracks;
        window.tracksForUI = result.tracksForUI;
        
      } catch (error) {
        console.error('Error processing file:', error);
        alert(`Error processing file: ${error.message}`);
        e.target.value = ''; // Clear the input
        return;
      }
      
      // Update BPM filter options
      if (window.bpmFilter) {
        window.bpmFilter.innerHTML = '<option value="">All BPMs</option>';
        Array.from(result.allBPMs).sort((a, b) => Number(a) - Number(b)).forEach(bpm => {
          const option = document.createElement('option');
          option.value = bpm;
          option.textContent = bpm + ' BPM';
          window.bpmFilter.appendChild(option);
        });
      }

      // Update Key filter options
      if (window.keyFilter) {
        window.keyFilter.innerHTML = '<option value="">All Keys</option>';
        Array.from(result.allKeys).sort().forEach(key => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = key;
          window.keyFilter.appendChild(option);
        });
      }
      
      // Debug: Verify data is stored
      console.log('Data stored in window:', {
        groupedKeys: Object.keys(window.grouped),
        totalTracks: window.totalTracks
      });
      
      safeRender();
    };
    reader.readAsText(file);
  });
}

// Main render function
const render = () => {
  console.log('Render started:', {
    grouped: window.grouped,
    totalTracks: window.totalTracks,
    hasContainer: !!window.container,
    hasStats: !!window.statsElement
  });

  const search = document.getElementById('search')?.value.toLowerCase() || '';
  const selectedBPM = window.bpmFilter?.value || '';
  const selectedKey = window.keyFilter?.value || '';
  const tagDropdown = document.getElementById('tag-dropdown');
  const tagSearch = tagDropdown ? tagDropdown.value.trim().toLowerCase() : '';
  const sortValue = window.sortSelect?.value || 'name-asc';
  const yearSearch = document.getElementById('year-search')?.value.trim();
  
  // Debug logging for filter values
  console.log('Render filter values:', { 
    search, 
    selectedBPM, 
    selectedKey, 
    bpmFilterElement: window.bpmFilter,
    bpmFilterValue: window.bpmFilter?.value
  });
  
  let yearMin = null, yearMax = null;
  if (yearSearch) {
    // Accept any 4-digit year or range, and match against year as string
    const match = yearSearch.match(/^(19\d{2}|20\d{2}|2025)(?:\s*-\s*(19\d{2}|20\d{2}|2025))?$/);
    if (match) {
      yearMin = parseInt(match[1], 10);
      yearMax = match[2] ? parseInt(match[2], 10) : yearMin;
      // Only accept years in the range 1900-2025
      if (yearMin < 1900 || yearMax > 2025) {
        yearMin = null;
        yearMax = null;
      }
    }
  }

  if (!window.container) {
    return;
  }

  const tracksForUI = window.tracksForUI || [];

  // --- DEBUG: Log all parsed tracks and their years ---
  console.log('All parsed tracks:', tracksForUI.map(t => ({display: t.display, year: t.year})));
  // --- DEBUG: Add event listener for year-search to trigger render ---
  const yearInput = document.getElementById('year-search');
  if (yearInput && !yearInput._cascadeYearListener) {
    yearInput.addEventListener('input', () => { safeRender(); });
    yearInput._cascadeYearListener = true;
    console.log('DEBUG: Added year-search input event listener');
  }

  // Filter tracks
  let filteredTracks = tracksForUI.filter(track => {
    // Search filter
    const matchSearch =
      !search ||
      track.display.toLowerCase().includes(search) ||
      (track.artist && track.artist.toLowerCase().includes(search)) ||
      (track.title && track.title.toLowerCase().includes(search));
    // BPM filter
    const matchBPM = !selectedBPM || track.bpm === selectedBPM;
    // Key filter
    const matchKey = !selectedKey || track.key === selectedKey;
    // Tag filter
    let matchTags = true;
    if (tagSearch) {
      const tags = (window.trackTags && window.trackTags[track.display]) || [];
      matchTags = tags.map(t => t.toLowerCase()).includes(tagSearch);
    }
    // Favorites filter
    let matchFavorites = true;
    if (window.showFavoritesOnly) {
      matchFavorites = window.favoriteTracks && window.favoriteTracks[track.display];
    }
    // Year search logic
    if (yearMin !== null && yearMax !== null) {
      // --- DEBUG: Log year filter values and candidate tracks ---
      console.log('Year filter:', {yearSearch, yearMin, yearMax});
      const trackYearStr = (track.year || '').trim();
      const trackYear = /^(19\d{2}|20\d{2}|2025)$/.test(trackYearStr) ? parseInt(trackYearStr, 10) : NaN;
      if (isNaN(trackYear) || trackYear < yearMin || trackYear > yearMax) {
        // --- DEBUG: Log why track was skipped ---
        console.log('Skipping track (year mismatch):', track.display, 'track.year:', track.year, 'parsed:', trackYear);
        return false;
      }
    }
    return matchSearch && matchBPM && matchKey && matchTags && matchFavorites;
  });

  // Sort tracks
  if (sortValue === 'most-tracks' || sortValue === 'fewest-tracks') {
    // Sort by number of tracks per artist
    const artistCounts = {};
    filteredTracks.forEach(t => {
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
    });
    filteredTracks.sort((a, b) => {
      const diff = artistCounts[b.artist] - artistCounts[a.artist];
      return sortValue === 'most-tracks' ? diff : -diff;
    });
  } else {
    filteredTracks.sort((a, b) => {
      switch (sortValue) {
        case 'name-asc':
          return a.artist.localeCompare(b.artist);
        case 'name-desc':
          return b.artist.localeCompare(a.artist);
        case 'bpm-asc':
          return Number(a.bpm) - Number(b.bpm);
        case 'bpm-desc':
          return Number(b.bpm) - Number(a.bpm);
        case 'key-asc':
          return a.key.localeCompare(b.key);
        case 'key-desc':
          return b.key.localeCompare(a.key);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return a.artist.localeCompare(b.artist);
      }
    });
  }

  // Group tracks by artist again for display
  const groupedSorted = {};
  filteredTracks.forEach(track => {
    if (!groupedSorted[track.artist]) groupedSorted[track.artist] = [];
    groupedSorted[track.artist].push(track);
  });

  // Render grouped tracks with artist headers
  window.container.innerHTML = '';
  Object.entries(groupedSorted).forEach(([artist, tracks]) => {
    if (tracks.length === 0) return;
    const groupDiv = document.createElement('div');
    groupDiv.className = 'column-group group';
    const h2 = document.createElement('h2');
    h2.textContent = artist;
    groupDiv.appendChild(h2);
    tracks.forEach(track => {
      groupDiv.appendChild(createTrackHTML(track));
    });
    window.container.appendChild(groupDiv);
  });

  // Update stats
  if (window.statsElement) {
    const visibleTracks = filteredTracks.length;
    const visibleArtists = new Set(filteredTracks.map(t => t.artist)).size;
    let bpmStat = '';
    const bpmArr = filteredTracks.map(t => parseInt(t.bpm)).filter(Boolean);
    if (bpmArr.length === 1) {
      bpmStat = `${bpmArr[0]} BPM`;
    } else if (bpmArr.length > 1) {
      bpmArr.sort((a, b) => a - b);
      bpmStat = `${bpmArr[0]}–${bpmArr[bpmArr.length - 1]} BPM`;
    } else {
      bpmStat = '';
    }
    const statsText = [
      `${visibleTracks} tracks`,
      `${visibleArtists} artists`,
      bpmStat
    ].filter(Boolean);
    window.statsElement.innerHTML = statsText.join(' • ');
  }

  // Show no results message if needed
  if (filteredTracks.length === 0 && (search || selectedBPM || selectedKey || tagSearch || window.showFavoritesOnly || yearSearch)) {
    const noResultsDiv = createSafeElement('div', 'No tracks found matching your filters.', 'no-results');
    window.container.innerHTML = '';
    window.container.appendChild(noResultsDiv);
  }
  renderAZBar();
};

// Helper function to create track HTML
function createTrackHTML(track) {
  const trackDiv = document.createElement('div');
  // Add favorite class if needed
  if (window.favoriteTracks && window.favoriteTracks[track.display]) {
    trackDiv.className = 'track favorite-track';
  } else {
    trackDiv.className = 'track';
  }
  trackDiv.setAttribute('data-artist', track.artist || '');

  // Track name on top (now split into two lines)
  const trackMain = document.createElement('span');
  trackMain.className = 'track-main';
  trackMain.textContent = `${track.artist} - ${track.title} - ${track.key} - ${track.bpm ? track.bpm + (track.absPath ? '.' + getFileExtension(track.absPath) : '') : ''}`;

  // Genre line (above Length)
  const trackGenre = document.createElement('span');
  trackGenre.className = 'track-details';
  if (track.genre) {
    trackGenre.textContent = `Genre: ${track.genre}`;
  } else {
    trackGenre.textContent = '';
  }

  // Second line: Length: time, third line: Year: YYYY
  const trackLength = document.createElement('span');
  trackLength.className = 'track-details';
  if (track.trackTime || track.time) {
    trackLength.textContent = `Length: ${track.trackTime || track.time}`;
  } else if (track.display) {
    // Fallback: try to extract from display string
    const match = track.display.match(/ - (\d{1,2}:\d{2}) -/);
    trackLength.textContent = match ? `Length: ${match[1]}` : '';
  }

  const trackYear = document.createElement('span');
  trackYear.className = 'track-details';
  if (track.year) {
    trackYear.textContent = `Year: ${track.year}`;
  } else {
    trackYear.textContent = '';
  }

  // Container for all lines
  const nameContainer = document.createElement('div');
  nameContainer.appendChild(trackMain);
  // No <br> between details for zero spacing
  nameContainer.appendChild(trackGenre);
  nameContainer.appendChild(trackLength);
  nameContainer.appendChild(trackYear);

  // Icons below
  const iconRow = document.createElement('div');
  iconRow.className = 'track-icons-row';

  // Star/favorite button
  const starBtn = document.createElement('button');
  starBtn.className = 'star-btn' + (window.favoriteTracks && window.favoriteTracks[track.display] ? ' favorited' : '');
  starBtn.title = window.favoriteTracks && window.favoriteTracks[track.display] ? 'Unstar' : 'Mark as favorite';
  starBtn.innerHTML = window.favoriteTracks && window.favoriteTracks[track.display] ? '★' : '☆';
  starBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(track.display);
  };
  iconRow.appendChild(starBtn);

  // Create folder button if path exists
  if (track.absPath && track.absPath.trim()) {
    const folderBtn = document.createElement('button');
    folderBtn.className = 'folder-btn';
    folderBtn.title = 'Copy Path to Clipboard';
    folderBtn.innerHTML = '📁';
    folderBtn.onclick = (e) => {
      e.stopPropagation();
      if (track.absPath) {
        navigator.clipboard.writeText(track.absPath)
          .then(() => {
            showCopyTooltip(folderBtn, 'Path copied!');
          })
          .catch(() => {
            alert('Could not copy the path to clipboard.');
          });
      }
    };
    iconRow.appendChild(folderBtn);
  }
  // Tag button
  const tagBtn = document.createElement('button');
  tagBtn.className = 'tag-btn';
  tagBtn.title = 'Tag';
  tagBtn.innerHTML = '🏷️';
  tagBtn.onclick = (e) => {
    e.stopPropagation();
    showTagInput(track, tagBtn);
  };
  iconRow.appendChild(tagBtn);
  // Add to playlist button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-playlist-btn';
  addBtn.title = 'Add to Playlist';
  addBtn.innerHTML = '+';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    addToPlaylist(track);
  };
  iconRow.appendChild(addBtn);
  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-track-btn';
  copyBtn.title = 'Copy Track Info';
  copyBtn.innerHTML = '📋';
  copyBtn.onclick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(track.display);
    showCopyTooltip(copyBtn, 'Copied!');
  };
  iconRow.appendChild(copyBtn);
  // Preview button
  addPreviewButtonToRow(iconRow, track);

  // Add name and icons in order
  trackDiv.appendChild(nameContainer);
  trackDiv.appendChild(iconRow);

  // Add tags (if any) as a separate row below
  const tags = window.trackTags?.[track.display] || [];
  if (tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tags';
    tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag';
      tagSpan.textContent = tag;
      tagsDiv.appendChild(tagSpan);
    });
    trackDiv.appendChild(tagsDiv);
  }

  return trackDiv;
}

// --- Favorite/Starred Tracks System ---
function toggleFavorite(trackDisplay) {
  if (AppState.data.favoriteTracks[trackDisplay]) {
    delete AppState.data.favoriteTracks[trackDisplay];
  } else {
    AppState.data.favoriteTracks[trackDisplay] = true;
  }
  
  localStorage.setItem('favoriteTracks', JSON.stringify(AppState.data.favoriteTracks));
  window.favoriteTracks = AppState.data.favoriteTracks; // Keep legacy reference
  safeRender();
}

// Favorites toggle button logic
function setupFavoritesToggle() {
  const btn = document.getElementById('favorites-toggle-btn');
  if (!btn) return;
  
  const handler = function() {
    AppState.data.showFavoritesOnly = !AppState.data.showFavoritesOnly;
    window.showFavoritesOnly = AppState.data.showFavoritesOnly; // Keep legacy reference
    btn.classList.toggle('active', AppState.data.showFavoritesOnly);
    
    // Invalidate cache since filter changed
    invalidateCache('favorites-filter-toggle');
    safeRender();
  };
  
  addManagedEventListener(btn, 'click', handler, 'favorites-toggle');
}

window.addEventListener('DOMContentLoaded', setupFavoritesToggle);

// --- Tagging System ---
// trackTags now managed through AppState.data.trackTags

function showTagInput(track, anchorElement) {
  // Remove any existing popup
  document.querySelectorAll('.tag-popup').forEach(el => el.remove());

  // Create popup safely
  const popup = document.createElement('div');
  popup.className = 'tag-popup';
  popup.style.position = 'absolute';
  popup.style.zIndex = 1000;
  
  // Create elements safely instead of using innerHTML
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'tag-input-field';
  input.placeholder = 'Add tag (comma separated)';
  input.style.width = '180px';
  
  const saveBtn = createSafeElement('button', 'Save');
  saveBtn.id = 'save-tag-btn';
  
  const cancelBtn = createSafeElement('button', 'Cancel');
  cancelBtn.id = 'cancel-tag-btn';
  
  popup.appendChild(input);
  popup.appendChild(saveBtn);
  popup.appendChild(cancelBtn);

  // Position popup near the anchor
  const rect = anchorElement.getBoundingClientRect();
  popup.style.left = rect.left + window.scrollX + 'px';
  popup.style.top = rect.bottom + window.scrollY + 'px';

  document.body.appendChild(popup);

  // Fill with existing tags
  const field = popup.querySelector('#tag-input-field');
  const existingTags = (AppState.data.trackTags[track.display] || []).join(', ');
  field.value = existingTags;
  field.focus();

  // Save handler
  popup.querySelector('#save-tag-btn').onclick = function() {
    try {
      const tags = field.value.split(',').map(t => t.trim()).filter(Boolean);
      // Validate tags (no dangerous characters, reasonable length)
      const validTags = tags.filter(tag => {
        return tag.length <= 50 && !/[<>"']/.test(tag);
      });
      
      if (validTags.length !== tags.length) {
        alert('Some tags were invalid and have been removed. Tags can only contain letters, numbers, spaces, hyphens, and underscores.');
      }
      
      AppState.data.trackTags[track.display] = validTags;
      window.trackTags = AppState.data.trackTags; // Keep legacy reference
      localStorage.setItem('trackTags', JSON.stringify(AppState.data.trackTags));
      popup.remove();
      safeRender();
    } catch (error) {
      console.error('Error saving tags:', error);
      alert('Error saving tags. Please try again.');
    }
  };
  // Cancel handler
  popup.querySelector('#cancel-tag-btn').onclick = function() {
    popup.remove();
  };
  // Close popup on outside click
  setTimeout(() => {
    document.addEventListener('mousedown', function handler(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('mousedown', handler);
      }
    });
  }, 10);
}

// --- End Tagging System ---

// --- Playlist System ---
// playlists and currentPlaylist now managed through AppState.data

function savePlaylists() {
  window.playlists = AppState.data.playlists; // Keep legacy reference
  localStorage.setItem('playlists', JSON.stringify(AppState.data.playlists));
}
function setCurrentPlaylist(name) {
  AppState.data.currentPlaylist = name;
  window.currentPlaylist = name; // Keep legacy reference
  localStorage.setItem('currentPlaylist', name);
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}
function updatePlaylistDropdown() {
  const dropdown = document.getElementById('playlist-select');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  Object.keys(AppState.data.playlists).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === AppState.data.currentPlaylist) opt.selected = true;
    dropdown.appendChild(opt);
  });
}
function createPlaylist(name) {
  if (!AppState.data.playlists[name]) {
    AppState.data.playlists[name] = [];
    savePlaylists();
    setCurrentPlaylist(name);
    updatePlaylistDropdown();
    updatePlaylistButtonStates();
  }
}
function deletePlaylist(name) {
  delete AppState.data.playlists[name];
  savePlaylists();
  if (AppState.data.currentPlaylist === name) {
    AppState.data.currentPlaylist = '';
    window.currentPlaylist = '';
    localStorage.removeItem('currentPlaylist');
  }
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}
function renamePlaylist(oldName, newName) {
  if (!AppState.data.playlists[oldName] || AppState.data.playlists[newName]) return;
  AppState.data.playlists[newName] = AppState.data.playlists[oldName];
  delete AppState.data.playlists[oldName];
  savePlaylists();
  if (AppState.data.currentPlaylist === oldName) setCurrentPlaylist(newName);
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}

function updatePlaylistButtonStates() {
  const dropdown = document.getElementById('playlist-select');
  const renameBtn = document.getElementById('rename-playlist-btn');
  const deleteBtn = document.getElementById('delete-playlist-btn');
  const exportBtn = document.getElementById('export-playlist-btn');
  const selected = dropdown && dropdown.value;
  const hasTracks = selected && AppState.data.playlists[selected] && AppState.data.playlists[selected].length > 0;
  if (renameBtn) renameBtn.disabled = !selected;
  if (deleteBtn) deleteBtn.disabled = !selected;
  if (exportBtn) exportBtn.disabled = !hasTracks;
}

// --- Playlist Controls: Wire up to existing HTML ---
function attachPlaylistHandlers() {
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
  const dropdown = document.getElementById('playlist-select');
  if (dropdown) {
    dropdown.onchange = function(e) {
      setCurrentPlaylist(e.target.value);
      updatePlaylistButtonStates();
    };
  }
  const createBtn = document.getElementById('create-playlist-btn');
  if (createBtn) {
    createBtn.onclick = function() {
      console.log('[DEBUG] New Playlist button clicked');
      const name = prompt('Playlist name?');
      if (name && !playlists[name]) {
        createPlaylist(name);
        updatePlaylistDropdown();
        setCurrentPlaylist(name);
        updatePlaylistButtonStates();
        console.log('[DEBUG] Created playlist:', name);
      } else if (playlists[name]) {
        alert('A playlist with this name already exists!');
      }
    };
  } else {
    console.log('[DEBUG] Could not find #create-playlist-btn');
  }
  const deleteBtn = document.getElementById('delete-playlist-btn');
  if (deleteBtn) {
    deleteBtn.onclick = function() {
      if (AppState.data.currentPlaylist && confirm('Delete playlist?')) {
        deletePlaylist(AppState.data.currentPlaylist);
        updatePlaylistDropdown();
        setCurrentPlaylist('');
        updatePlaylistButtonStates();
      }
    };
  }
  const renameBtn = document.getElementById('rename-playlist-btn');
  if (renameBtn) {
    renameBtn.onclick = function() {
      if (!AppState.data.currentPlaylist) return;
      const newName = prompt('New playlist name?', AppState.data.currentPlaylist);
      if (!newName || newName === AppState.data.currentPlaylist) return;
      if (AppState.data.playlists[newName]) {
        alert('A playlist with this name already exists!');
        return;
      }
      renamePlaylist(AppState.data.currentPlaylist, newName);
      updatePlaylistDropdown();
      setCurrentPlaylist(newName);
      updatePlaylistButtonStates();
      console.log(`[DEBUG] Renamed playlist to: ${newName}`);
    };
  }
  const exportBtn = document.getElementById('export-playlist-btn');
  if (exportBtn) {
    exportBtn.onclick = function() {
      const dropdown = document.getElementById('playlist-select');
      const selected = dropdown && dropdown.value;
      if (!selected || !AppState.data.playlists[selected] || AppState.data.playlists[selected].length === 0) {
        alert('No playlist selected or playlist is empty!');
        return;
      }
      const data = AppState.data.playlists[selected].join('\n');
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected}.txt`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachPlaylistHandlers);
} else {
  attachPlaylistHandlers();
}

// --- Import Playlists handler ---
const importPlaylistsBtn = document.getElementById('import-playlists-btn');
const importPlaylistsInput = document.getElementById('import-playlists-input');
if (importPlaylistsBtn && importPlaylistsInput) {
  importPlaylistsBtn.addEventListener('click', function() {
    importPlaylistsInput.click();
  });
  importPlaylistsInput.addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please select a valid JSON file.');
      e.target.value = '';
      return;
    }
    
    // Check file size (2MB limit for playlist imports)
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Please select a file smaller than 2MB.');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = function() {
      alert('Error reading file. Please try again.');
      e.target.value = '';
    };
    
    reader.onload = function(evt) {
      try {
        const playlists = JSON.parse(evt.target.result);
        if (typeof playlists === 'object' && playlists !== null) {
          // Sanitize playlist data
          const sanitizedPlaylists = {};
          Object.keys(playlists).forEach(key => {
            if (Array.isArray(playlists[key])) {
              const validTracks = playlists[key]
                .map(track => sanitizeText(track))
                .filter(Boolean);
              if (validTracks.length > 0) {
                sanitizedPlaylists[sanitizeText(key)] = validTracks;
              }
            }
          });
          localStorage.setItem('playlists', JSON.stringify(sanitizedPlaylists));
          alert('Playlists imported successfully!');
        } else {
          alert('Invalid playlist data.');
        }
      } catch (err) {
        console.error('Playlist import error:', err);
        alert(`Failed to import playlists: ${sanitizeText(err.message)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// --- Export All Playlists ---
function attachExportAllHandler() {
  const btn = document.getElementById('export-all');
  if (btn) {
    btn.onclick = function() {
      if (!AppState.data.playlists || Object.keys(AppState.data.playlists).length === 0) {
        alert('No playlists to export!');
        return;
      }
      const data = JSON.stringify(AppState.data.playlists, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_playlists.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachExportAllHandler);
} else {
  attachExportAllHandler();
}

// Export all: tracks, playlists, tags
function exportAll() {
  // Get tags
  let tags = window.trackTags || {};
  // Get playlists
  let playlists = AppState.data.playlists;
  // Get tracks (visible in UI)
  let tracks = [];
  if (window.tracksForUI && Array.isArray(window.tracksForUI)) {
    tracks = window.tracksForUI;
  } else if (window.grouped) {
    // fallback: flatten grouped
    tracks = Object.values(window.grouped).flat();
  }
  const data = {
    tracks: tracks,
    playlists: playlists,
    tags: tags
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edm_bangers_export.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

window.addEventListener('DOMContentLoaded', function() {
  const exportAllBtn = document.getElementById('export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', exportAll);
  }
});

// --- Import All (JSON) handler ---
const importAllInput = document.getElementById('import-all-input');
if (importAllInput) {
  importAllInput.addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please select a valid JSON file.');
      e.target.value = '';
      return;
    }
    
    // Check file size (5MB limit for JSON imports)
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Please select a file smaller than 5MB.');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = function() {
      alert('Error reading file. Please try again.');
      e.target.value = '';
    };
    
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        
        // Validate JSON structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid JSON format');
        }
        
        // Restore tracks with validation
        if (Array.isArray(data.tracks)) {
          // Sanitize track data
          const sanitizedTracks = data.tracks.map(track => {
            if (!track || typeof track !== 'object') return null;
            return {
              display: sanitizeText(track.display || ''),
              absPath: sanitizeText(track.absPath || ''),
              bpm: sanitizeText(track.bpm || ''),
              key: sanitizeText(track.key || ''),
              artist: sanitizeText(track.artist || ''),
              title: sanitizeText(track.title || ''),
              year: sanitizeText(track.year || ''),
              trackTime: sanitizeText(track.trackTime || ''),
              genre: sanitizeText(track.genre || '')
            };
          }).filter(Boolean);
          
          window.tracksForUI = sanitizedTracks;
          // Group by artist for window.grouped
          window.grouped = {};
          sanitizedTracks.forEach(track => {
            if (!window.grouped[track.artist]) window.grouped[track.artist] = [];
            window.grouped[track.artist].push(track);
          });
        }
        
        // Restore tags with validation
        if (data.tags && typeof data.tags === 'object') {
          const sanitizedTags = {};
          Object.keys(data.tags).forEach(key => {
            if (Array.isArray(data.tags[key])) {
              const validTags = data.tags[key]
                .map(tag => sanitizeText(tag))
                .filter(tag => tag.length <= 50 && /^[a-zA-Z0-9\s\-_]+$/.test(tag));
              if (validTags.length > 0) {
                sanitizedTags[sanitizeText(key)] = validTags;
              }
            }
          });
          window.trackTags = sanitizedTags;
          localStorage.setItem('trackTags', JSON.stringify(window.trackTags));
        }
        
        // Restore playlists with validation
        if (data.playlists && typeof data.playlists === 'object') {
          const sanitizedPlaylists = {};
          Object.keys(data.playlists).forEach(key => {
            if (Array.isArray(data.playlists[key])) {
              const validTracks = data.playlists[key]
                .map(track => sanitizeText(track))
                .filter(Boolean);
              if (validTracks.length > 0) {
                sanitizedPlaylists[sanitizeText(key)] = validTracks;
              }
            }
          });
          localStorage.setItem('playlists', JSON.stringify(sanitizedPlaylists));
        }
        
        // Update UI
        updateTagDropdown && updateTagDropdown();
        safeRender();
        alert('Import successful!');
      } catch (err) {
        console.error('Import error:', err);
        alert(`Failed to import: ${sanitizeText(err.message)}`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be uploaded again if needed
    e.target.value = '';
  });
}

// --- Audio Preview System ---
const AudioManager = {
  fileMap: {},
  currentAudio: null,
  audioCtx: null,
  analyser: null,
  sourceNode: null,
  audioDataArray: null,
  reactToAudio: false,
  
  cleanup() {
    if (this.currentAudio) {
      removeAudioResource(this.currentAudio);
      this.currentAudio = null;
    }
    this.disconnectVisualizer();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.fileMap = {};
    console.log('Audio manager cleanup complete');
  },
  
  disconnectVisualizer() {
    this.reactToAudio = false;
    this.sourceNode = null;
    this.analyser = null;
    this.audioDataArray = null;
    this.audioCtx = null;
  }
};

async function connectAudioVisualizer(audioElem) {
  AudioManager.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  AudioManager.analyser = AudioManager.audioCtx.createAnalyser();
  AudioManager.analyser.fftSize = 64;
  AudioManager.audioDataArray = new Uint8Array(AudioManager.analyser.frequencyBinCount);
  AudioManager.sourceNode = AudioManager.audioCtx.createMediaElementSource(audioElem);
  AudioManager.sourceNode.connect(AudioManager.analyser);
  AudioManager.analyser.connect(AudioManager.audioCtx.destination);
  AudioManager.reactToAudio = true;
  try {
    await AudioManager.audioCtx.resume();
  } catch (e) {
    console.error('AudioContext resume failed:', e);
  }
}

function disconnectAudioVisualizer() {
  AudioManager.disconnectVisualizer();
}

async function playPreviewForTrack(track) {
  try {
    // Try to find the file by filename from absPath
    if (!track.absPath) {
      alert('No file path for this track.');
      return;
    }
    
    const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();
    const file = AudioManager.fileMap[fileName];
    if (!file) {
      alert(`Audio file not found in selected folder: ${sanitizeText(fileName)}`);
      return;
    }
    
    // Validate file type
    const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/aiff'];
    if (!allowedAudioTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|ogg|aiff)$/i)) {
      alert('Unsupported audio file type.');
      return;
    }
  // Remove previous audio and visualizer, but do not close context
  if (currentAudio) {
    disconnectAudioVisualizer();
    // Remove both audio and label if present
    if (currentAudio.parentElement && currentAudio.parentElement.classList.contains('audio-player-container')) {
      currentAudio.parentElement.remove();
    } else {
      currentAudio.remove();
    }
    currentAudio = null;
  }
    const url = URL.createObjectURL(file);
    // Create a container for track info and audio player
    const container = document.createElement('div');
    container.className = 'audio-player-container';
    container.style.position = 'fixed';
    container.style.left = '50%';
    container.style.bottom = '80px';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = 9999;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '8px';

    // Track info label (sanitized)
    const label = createSafeElement('div', `${track.artist || ''} — ${track.title || ''}`, 'audio-player-label');
    container.appendChild(label);

  const audio = document.createElement('audio');
  audio.src = url;
  audio.controls = true;
  audio.autoplay = true;
  audio.className = 'custom-audio-player';
  container.appendChild(audio);

  document.body.appendChild(container);
  currentAudio = audio;
    audio.onended = () => { disconnectAudioVisualizer(); container.remove(); currentAudio = null; URL.revokeObjectURL(url); };
    audio.onpause = () => disconnectAudioVisualizer();
    audio.onerror = () => {
      alert('Error playing audio file.');
      container.remove();
      currentAudio = null;
      URL.revokeObjectURL(url);
    };
    await connectAudioVisualizer(audio);
  } catch (error) {
    console.error('Error playing preview:', error);
    alert('Error playing audio preview.');
  }
}

// --- Audio Preview: Retry logic for first click ---
let pendingPreviewTrack = null;

function promptAudioFolderAndPreview(track) {
  pendingPreviewTrack = track;
  // This must be called synchronously from the click event!
  const audioInput = document.getElementById('audio-folder-input');
  if (audioInput) audioInput.click();
}

function handleAudioFolderInput(e) {
  const files = Array.from(e.target.files);
  AudioManager.fileMap = {};
  files.forEach(file => {
    // Map by filename only (case-insensitive)
    AudioManager.fileMap[file.name.toLowerCase()] = file;
  });
  alert('Audio files loaded! You can now preview tracks.');
  // If a preview was pending, play it now
  if (AudioManager.pendingPreviewTrack) {
    playPreviewForTrack(AudioManager.pendingPreviewTrack);
    AudioManager.pendingPreviewTrack = null;
  }
}

function addPreviewButtonToRow(row, track) {
  const btn = document.createElement('button');
  btn.className = 'preview-btn';
  btn.title = 'Preview';
  btn.innerHTML = '▶️';
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!Object.keys(AudioManager.fileMap).length) {
      promptAudioFolderAndPreview(track); // Synchronous call
    } else {
      playPreviewForTrack(track);
    }
  };
  row.appendChild(btn);
}

// Ensure file input handler is always attached
window.addEventListener('DOMContentLoaded', function() {
  const audioInput = document.getElementById('audio-folder-input');
  if (audioInput) {
    audioInput.addEventListener('change', handleAudioFolderInput);
  }
});

// --- Audio Visualizer: Robust fix for MediaElementSource reuse ---
function animateVisualizer() {
  const topCanvas = document.getElementById('top-audio-visualizer');
  const bottomCanvas = document.getElementById('audio-visualizer');
  [topCanvas, bottomCanvas].forEach(canvas => {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const barCount = 32;
    const barWidth = w / (barCount * 1.2);
    const gap = barWidth * 0.2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#111';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    let spectrum = [];
    if (AudioManager.reactToAudio && AudioManager.analyser && AudioManager.audioDataArray) {
      AudioManager.analyser.getByteFrequencyData(AudioManager.audioDataArray);
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor(i * AudioManager.audioDataArray.length / barCount);
        spectrum.push(AudioManager.audioDataArray[idx] / 255);
      }
    } else {
      for (let i = 0; i < barCount; i++) spectrum.push(Math.random() * 0.3);
    }
    for (let i = 0; i < barCount; i++) {
      const amplitude = spectrum[i];
      const barHeight = amplitude * (h * 0.85);
      const x = i * (barWidth + gap);
      const y = h - barHeight;
      let color;
      if (barHeight > h * 0.7) {
        color = '#ff2222';
      } else if (barHeight > h * 0.4) {
        color = '#ffee00';
      } else {
        color = '#22cc44';
      }
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.shadowBlur = 0;
    }
  });
  requestAnimationFrame(animateVisualizer);
}

window.addEventListener('DOMContentLoaded', function() {
  animateVisualizer();
});

// --- Audio Visualizer Bar Logic ---
function renderAZBar() {
  const azBar = document.getElementById('az-bar');
  if (!azBar) return;
  azBar.innerHTML = '';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    const btn = document.createElement('button');
    btn.textContent = letter;
    btn.className = 'az-letter';
    btn.onclick = function() {
      jumpToArtistLetter(letter);
      document.querySelectorAll('.az-letter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    azBar.appendChild(btn);
  });
}

function jumpToArtistLetter(letter) {
  // Find the first track row whose artist starts with the letter
  const tracks = document.querySelectorAll('.track');
  for (let trackDiv of tracks) {
    const artist = trackDiv.getAttribute('data-artist') || '';
    if (artist.toUpperCase().startsWith(letter)) {
      trackDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      trackDiv.classList.add('az-jump-highlight');
      setTimeout(() => trackDiv.classList.remove('az-jump-highlight'), 1200);
      break;
    }
  }
}

// Add highlight style
const azStyle = document.createElement('style');
azStyle.textContent = `.az-jump-highlight { outline: 3px solid #2196f3; transition: outline 0.2s; }`;
document.head.appendChild(azStyle);

// Call renderAZBar on DOMContentLoaded and after rendering tracks
window.addEventListener('DOMContentLoaded', renderAZBar);

// --- Update footer date on tracklist upload ---
function setFooterUpdatedDate(date) {
  const footerUpdated = document.getElementById('footer-updated');
  if (footerUpdated) {
    const d = new Date(date);
    if (!isNaN(d)) {
      const formatted = d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      footerUpdated.textContent = 'Updated: ' + formatted;
    }
  }
}

// Patch the tracklist upload logic to update the footer date
window.addEventListener('DOMContentLoaded', function() {
  const tracklistInput = document.getElementById('tracklist-upload');
  if (tracklistInput) {
    tracklistInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        setFooterUpdatedDate(e.target.files[0].lastModified);
      }
    });
  }
});

// Render duplicate tracks at the bottom
function renderDuplicateList(duplicateTracks) {
  const container = document.getElementById('duplicate-list');
  if (!container) return;
  if (!duplicateTracks || duplicateTracks.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  // Create elements safely
  container.innerHTML = '';
  
  const headerDiv = createSafeElement('div', `Duplicate Tracks Detected (${duplicateTracks.length}):`);
  headerDiv.style.color = '#ffb300';
  headerDiv.style.fontWeight = 'bold';
  headerDiv.style.marginBottom = '6px';
  
  const ul = document.createElement('ul');
  ul.style.maxHeight = '200px';
  ul.style.overflow = 'auto';
  ul.style.background = '#181818';
  ul.style.padding = '10px 16px 10px 22px';
  ul.style.borderRadius = '8px';
  ul.style.fontSize = '1em';
  
  duplicateTracks.forEach(track => {
    const li = createSafeElement('li', track.display);
    li.style.wordBreak = 'break-all';
    li.style.marginBottom = '3px';
    ul.appendChild(li);
  });
  
  container.appendChild(headerDiv);
  container.appendChild(ul);
}

// --- Populate tag dropdown and handle filtering ---
function updateTagDropdown() {
  const dropdown = document.getElementById('tag-dropdown');
  if (!dropdown) return;
  // Collect all unique tags
  const allTagsSet = new Set();
  Object.values(window.trackTags || {}).forEach(tagArr => {
    (tagArr || []).forEach(tag => allTagsSet.add(tag));
  });
  const allTags = Array.from(allTagsSet).sort();
  // Clear and repopulate dropdown
  dropdown.innerHTML = '<option value="">All Tags</option>';
  allTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    dropdown.appendChild(opt);
  });
}

// When dropdown changes, trigger render directly
function attachTagDropdownHandler() {
  const dropdown = document.getElementById('tag-dropdown');
  if (!dropdown) return;
  dropdown.addEventListener('change', function() {
    safeRender();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  updateTagDropdown();
  attachTagDropdownHandler();
});

// When tags are updated, repopulate dropdown
function saveTagsAndUpdateDropdown() {
  localStorage.setItem('trackTags', JSON.stringify(window.trackTags));
  updateTagDropdown();
}
window.saveTagsAndUpdateDropdown = saveTagsAndUpdateDropdown;

const origShowTagInput = window.showTagInput;
window.showTagInput = function(track, anchorElement) {
  origShowTagInput(track, anchorElement);
  setTimeout(updateTagDropdown, 400);
};

// --- Theme Toggle (Light Mode) ---
function attachThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.onclick = function() {
      document.body.classList.toggle('light-mode');
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachThemeToggle);
} else {
  attachThemeToggle();
}

// (Removed per user request)

// --- Auto-load tracklist.csv if present ---
window.addEventListener('DOMContentLoaded', function() {
  fetch('tracklist.csv')
    .then(response => {
      if (!response.ok) throw new Error('No CSV found');
      return response.text();
    })
    .then(text => {
      try {
        // Use existing processTracklist logic
        const result = processTracklist(text, 'tracklist.csv');
        window.grouped = result.grouped;
        window.totalTracks = result.totalTracks;
        window.duplicateTracks = result.duplicateTracks;
        window.tracksForUI = result.tracksForUI;
        
        // Update BPM filter options
        if (window.bpmFilter && result.allBPMs) {
          window.bpmFilter.innerHTML = '<option value="">All BPMs</option>';
          Array.from(result.allBPMs).sort((a, b) => Number(a) - Number(b)).forEach(bpm => {
            const option = document.createElement('option');
            option.value = bpm;
            option.textContent = bpm + ' BPM';
            window.bpmFilter.appendChild(option);
          });
        }
        // Update Key filter options
        if (window.keyFilter && result.allKeys) {
          window.keyFilter.innerHTML = '<option value="">All Keys</option>';
          Array.from(result.allKeys).sort().forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            window.keyFilter.appendChild(option);
          });
        }
        
        safeRender();
      } catch (error) {
        console.error('Error processing default tracklist:', error);
        // Don't show alert for auto-loaded file errors, but still try to render empty state
        safeRender();
        return;
      }
      safeRender();
    })
    .catch((error) => {
      // Silently ignore if file not present, but log network errors
      if (error.message !== 'No CSV found') {
        console.warn('Error loading default tracklist:', error);
      }
    });
});
