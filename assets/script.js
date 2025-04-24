// Utility to detect file extension
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// Parse CSV line (simple, not RFC-complete)
function parseCSVLine(line) {
  // Handles basic CSV, not escaped commas/quotes
  return line.split(',').map(cell => cell.trim());
}

// Function to process tracklist data
function processTracklist(text, fileName) {
  let lines = text.split('\n').filter(line => line.trim() !== '');
  const grouped = {};
  const allBPMs = new Set();
  const allKeys = new Set();
  let totalTracks = 0;
  const tracksForUI = [];
  const seenTracks = new Map(); // Map of duplicateKey -> [trackObj]
  const duplicateTracks = [];

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
    // Accept both 6-part (no path) and 7+-part (with path) formats
    const parts = line.split(' - ');
    if (parts.length < 6) {
      console.log('Skipping line (not enough parts):', line);
      return;
    }
    const artist = parts[0];
    const title = parts[1];
    const key = parts[2];
    const bpmExt = parts[3];
    const trackTime = parts[4];
    const year = parts[5];
    const absPath = parts.length > 6 ? parts.slice(6).join(' - ').trim() : '';

    // Extract BPM from the format (e.g., "127.flac")
    const bpmMatch = bpmExt.match(/(\d{2,3})/);
    const bpm = bpmMatch ? bpmMatch[1] : '';
    if (bpm) allBPMs.add(bpm);
    if (key) allKeys.add(key);

    // Normalize year to 4-digit string if possible
    let yearNorm = year;
    const yearMatch = year && year.match(/(19\d{2}|20\d{2}|2025)/);
    if (yearMatch) yearNorm = yearMatch[1];

    const display = `${artist} - ${title} - ${key} - ${bpmExt} - ${trackTime} - ${year}`;
    const trackObj = {
      display: display,
      absPath: absPath,
      bpm: bpm,
      key: key,
      artist: artist,
      title: title,
      year: yearNorm
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
    duplicateTracks
  });

  return { grouped, allBPMs, allKeys, totalTracks, tracksForUI, duplicateTracks };
}

// Defensive: Ensure render is only called after DOMContentLoaded and grouped is available
function safeRender() {
  try {
    if (!window.grouped || typeof window.grouped !== 'object') {
      document.getElementById('columns').innerHTML = '<div class="no-results">No track data loaded.</div>';
      renderDuplicateList([]);
      return;
    }
    render();
    // Also render duplicates if available
    if (window.duplicateTracks) {
      renderDuplicateList(window.duplicateTracks);
    }
  } catch (err) {
    document.getElementById('columns').innerHTML = '<div class="no-results">Error: ' + err.message + '</div>';
    renderDuplicateList([]);
    console.error('Render error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Define filter and container elements inside DOMContentLoaded
  window.bpmFilter = document.getElementById('bpm-filter');
  window.keyFilter = document.getElementById('key-filter');
  window.container = document.getElementById('columns');
  window.statsElement = document.getElementById('stats');
  window.sortSelect = document.getElementById('sort-select');

  // Only call safeRender after DOM is ready
  safeRender();

  // Attach all event listeners using safeRender
  document.getElementById('search').addEventListener('input', safeRender);
  window.bpmFilter.addEventListener('change', safeRender);
  window.keyFilter.addEventListener('change', safeRender);
  if (window.sortSelect) {
    window.sortSelect.addEventListener('change', safeRender);
  }
});

// Patch file upload handler to pass fileName
const uploadInput = document.getElementById('tracklist-upload');
if (uploadInput) {
  uploadInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
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
    window.container.innerHTML = '<div class="no-results">No tracks found matching your filters.</div>';
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

  // Track name on top
  const trackName = document.createElement('span');
  trackName.className = 'track-name';
  trackName.textContent = track.display;

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
  trackDiv.appendChild(trackName);
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
let favoriteTracks = JSON.parse(localStorage.getItem('favoriteTracks') || '{}');
window.favoriteTracks = favoriteTracks;
window.showFavoritesOnly = false;

function toggleFavorite(trackDisplay) {
  favoriteTracks = JSON.parse(localStorage.getItem('favoriteTracks') || '{}');
  if (favoriteTracks[trackDisplay]) {
    delete favoriteTracks[trackDisplay];
  } else {
    favoriteTracks[trackDisplay] = true;
  }
  localStorage.setItem('favoriteTracks', JSON.stringify(favoriteTracks));
  window.favoriteTracks = favoriteTracks;
  safeRender();
}

// Favorites toggle button logic
function setupFavoritesToggle() {
  const btn = document.getElementById('favorites-toggle-btn');
  if (!btn) return;
  btn.onclick = function() {
    window.showFavoritesOnly = !window.showFavoritesOnly;
    btn.classList.toggle('active', window.showFavoritesOnly);
    safeRender();
  };
}
window.addEventListener('DOMContentLoaded', setupFavoritesToggle);

// --- Tagging System ---
let trackTags = JSON.parse(localStorage.getItem('trackTags') || '{}');
window.trackTags = trackTags;

function showTagInput(track, anchorElement) {
  // Remove any existing popup
  document.querySelectorAll('.tag-popup').forEach(el => el.remove());

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'tag-popup';
  popup.style.position = 'absolute';
  popup.style.zIndex = 1000;
  popup.innerHTML = `
    <input type="text" id="tag-input-field" placeholder="Add tag (comma separated)" style="width: 180px;" />
    <button id="save-tag-btn">Save</button>
    <button id="cancel-tag-btn">Cancel</button>
  `;

  // Position popup near the anchor
  const rect = anchorElement.getBoundingClientRect();
  popup.style.left = rect.left + window.scrollX + 'px';
  popup.style.top = rect.bottom + window.scrollY + 'px';

  document.body.appendChild(popup);

  // Fill with existing tags
  const field = popup.querySelector('#tag-input-field');
  const existingTags = (window.trackTags[track.display] || []).join(', ');
  field.value = existingTags;
  field.focus();

  // Save handler
  popup.querySelector('#save-tag-btn').onclick = function() {
    const tags = field.value.split(',').map(t => t.trim()).filter(Boolean);
    window.trackTags[track.display] = tags;
    localStorage.setItem('trackTags', JSON.stringify(window.trackTags));
    popup.remove();
    safeRender();
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
let playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
let currentPlaylist = localStorage.getItem('currentPlaylist') || '';
window.playlists = playlists;
window.currentPlaylist = currentPlaylist;

function savePlaylists() {
  localStorage.setItem('playlists', JSON.stringify(playlists));
}
function setCurrentPlaylist(name) {
  currentPlaylist = name;
  window.currentPlaylist = name;
  localStorage.setItem('currentPlaylist', name);
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}
function updatePlaylistDropdown() {
  const dropdown = document.getElementById('playlist-select');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  Object.keys(playlists).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === currentPlaylist) opt.selected = true;
    dropdown.appendChild(opt);
  });
}
function createPlaylist(name) {
  if (!playlists[name]) {
    playlists[name] = [];
    savePlaylists();
    setCurrentPlaylist(name);
    updatePlaylistDropdown();
    updatePlaylistButtonStates();
  }
}
function deletePlaylist(name) {
  delete playlists[name];
  savePlaylists();
  if (currentPlaylist === name) {
    currentPlaylist = '';
    window.currentPlaylist = '';
    localStorage.removeItem('currentPlaylist');
  }
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}
function renamePlaylist(oldName, newName) {
  if (!playlists[oldName] || playlists[newName]) return;
  playlists[newName] = playlists[oldName];
  delete playlists[oldName];
  savePlaylists();
  if (currentPlaylist === oldName) setCurrentPlaylist(newName);
  updatePlaylistDropdown();
  updatePlaylistButtonStates();
}

function updatePlaylistButtonStates() {
  const dropdown = document.getElementById('playlist-select');
  const renameBtn = document.getElementById('rename-playlist-btn');
  const deleteBtn = document.getElementById('delete-playlist-btn');
  const exportBtn = document.getElementById('export-playlist-btn');
  const selected = dropdown && dropdown.value;
  const hasTracks = selected && playlists[selected] && playlists[selected].length > 0;
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
      if (currentPlaylist && confirm('Delete playlist?')) {
        deletePlaylist(currentPlaylist);
        updatePlaylistDropdown();
        setCurrentPlaylist('');
        updatePlaylistButtonStates();
      }
    };
  }
  const renameBtn = document.getElementById('rename-playlist-btn');
  if (renameBtn) {
    renameBtn.onclick = function() {
      if (!currentPlaylist) return;
      const newName = prompt('New playlist name?', currentPlaylist);
      if (!newName || newName === currentPlaylist) return;
      if (playlists[newName]) {
        alert('A playlist with this name already exists!');
        return;
      }
      renamePlaylist(currentPlaylist, newName);
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
      if (!selected || !playlists[selected] || playlists[selected].length === 0) {
        alert('No playlist selected or playlist is empty!');
        return;
      }
      const data = playlists[selected].join('\n');
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
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const playlists = JSON.parse(evt.target.result);
        if (typeof playlists === 'object' && playlists !== null) {
          localStorage.setItem('playlists', JSON.stringify(playlists));
          alert('Playlists imported successfully!');
        } else {
          alert('Invalid playlist data.');
        }
      } catch (err) {
        alert('Failed to import playlists: ' + err.message);
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
      if (!window.playlists || Object.keys(window.playlists).length === 0) {
        alert('No playlists to export!');
        return;
      }
      const data = JSON.stringify(window.playlists, null, 2);
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
  let playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
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
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        // Restore tracks
        if (Array.isArray(data.tracks)) {
          window.tracksForUI = data.tracks;
          // Group by artist for window.grouped
          window.grouped = {};
          data.tracks.forEach(track => {
            if (!window.grouped[track.artist]) window.grouped[track.artist] = [];
            window.grouped[track.artist].push(track);
          });
        }
        // Restore tags
        if (data.tags && typeof data.tags === 'object') {
          window.trackTags = data.tags;
          localStorage.setItem('trackTags', JSON.stringify(window.trackTags));
        }
        // Restore playlists
        if (data.playlists && typeof data.playlists === 'object') {
          localStorage.setItem('playlists', JSON.stringify(data.playlists));
        }
        // Update UI
        updateTagDropdown && updateTagDropdown();
        safeRender();
        alert('Import successful!');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be uploaded again if needed
    e.target.value = '';
  });
}

// --- Audio Preview System ---
let audioFileMap = {};
let currentAudio = null;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let audioDataArray = null;
let reactToAudio = false;

async function connectAudioVisualizer(audioElem) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  audioDataArray = new Uint8Array(analyser.frequencyBinCount);
  sourceNode = audioCtx.createMediaElementSource(audioElem);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  reactToAudio = true;
  try {
    await audioCtx.resume();
    // For debugging: log state
    // console.log('AudioContext state:', audioCtx.state);
  } catch (e) {
    console.error('AudioContext resume failed:', e);
  }
}

function disconnectAudioVisualizer() {
  reactToAudio = false;
  sourceNode = null;
  analyser = null;
  audioDataArray = null;
  audioCtx = null;
}

async function playPreviewForTrack(track) {
  // Try to find the file by filename from absPath
  if (!track.absPath) return alert('No file path for this track.');
  const fileName = track.absPath.split(/[\\/]/).pop().toLowerCase();
  const file = audioFileMap[fileName];
  if (!file) {
    alert('Audio file not found in selected folder: ' + fileName);
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

  // Track info label
  const label = document.createElement('div');
  label.className = 'audio-player-label';
  label.textContent = `${track.artist || ''} — ${track.title || ''}`;
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
  await connectAudioVisualizer(audio);
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
  audioFileMap = {};
  files.forEach(file => {
    // Map by filename only (case-insensitive)
    audioFileMap[file.name.toLowerCase()] = file;
  });
  alert('Audio files loaded! You can now preview tracks.');
  // If a preview was pending, play it now
  if (pendingPreviewTrack) {
    playPreviewForTrack(pendingPreviewTrack);
    pendingPreviewTrack = null;
  }
}

function addPreviewButtonToRow(row, track) {
  const btn = document.createElement('button');
  btn.className = 'preview-btn';
  btn.title = 'Preview';
  btn.innerHTML = '▶️';
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!Object.keys(audioFileMap).length) {
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
    if (reactToAudio && analyser && audioDataArray) {
      analyser.getByteFrequencyData(audioDataArray);
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor(i * audioDataArray.length / barCount);
        spectrum.push(audioDataArray[idx] / 255);
      }
    } else {
      for (let i = 0; i < barCount; i++) spectrum.push(Math.random());
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
  let html = `<div style="color:#ffb300;font-weight:bold;margin-bottom:6px;">Duplicate Tracks Detected (${duplicateTracks.length}):</div>`;
  html += '<ul style="max-height:200px;overflow:auto;background:#181818;padding:10px 16px 10px 22px;border-radius:8px;font-size:1em;">';
  duplicateTracks.forEach(track => {
    html += `<li style='word-break:break-all;margin-bottom:3px;'>${track.display}</li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
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
