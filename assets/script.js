// Function to process tracklist data
function processTracklist(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const grouped = {};
  const allBPMs = new Set();
  const allKeys = new Set();
  let totalTracks = 0;

  // Parse track data
  lines.forEach(line => {
    const artist = line.split(' - ')[0];
    // Extract key and BPM with a more robust regex
    const match = line.match(/- (\d+[AB]) - (\d+)/);
    
    if (match) {
      const key = match[1];
      const bpm = match[2];
      
      allKeys.add(key);
      allBPMs.add(bpm);
    }
    
    if (!grouped[artist]) grouped[artist] = [];
    grouped[artist].push(line);
    totalTracks++;
  });

  return { grouped, allBPMs, allKeys, totalTracks };
}

// Function to update filters
function updateFilters(allBPMs, allKeys) {
  // Populate BPM filter
  const bpmFilter = document.getElementById('bpm-filter');
  bpmFilter.innerHTML = '<option value="">All BPMs</option>';
  Array.from(allBPMs).sort((a, b) => parseInt(a) - parseInt(b)).forEach(bpm => {
    const opt = document.createElement('option');
    opt.value = bpm;
    opt.textContent = bpm + ' BPM';
    bpmFilter.appendChild(opt);
  });

  // Populate key filter
  const keyFilter = document.getElementById('key-filter');
  keyFilter.innerHTML = '<option value="">All Keys</option>';
  Array.from(allKeys).sort().forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    keyFilter.appendChild(opt);
  });
}

// Handle file upload
document.getElementById('tracklist-upload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const { grouped, allBPMs, allKeys, totalTracks } = processTracklist(text);
      window.grouped = grouped; // Make grouped available globally
      window.totalTracks = totalTracks; // Make totalTracks available globally
      updateFilters(allBPMs, allKeys);
      render(); // Re-render the tracklist
    };
    reader.readAsText(file);
  }
});

// Initial load from data/tracklist.txt
fetch('data/tracklist.txt')
  .then(response => response.text())
  .then(text => {
    const { grouped, allBPMs, allKeys, totalTracks } = processTracklist(text);
    window.grouped = grouped; // Make grouped available globally
    window.totalTracks = totalTracks; // Make totalTracks available globally
    updateFilters(allBPMs, allKeys);
    render(); // Initial render
  })
  .catch(err => {
    document.getElementById('columns').innerHTML = '<p>Failed to load tracklist. Please check that the data file exists or upload your own tracklist.</p>';
    console.error('Error loading tracklist:', err);
  });

// Add visualization for tracks (mini frequency analyzer)
function createVisualizer() {
  const canvas = document.getElementById('audio-visualizer');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Just a placeholder animation
  function drawVisualizer() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = document.body.classList.contains('light-mode') ? '#333' : '#00ffff';
    
    // Draw some bars to simulate audio visualization
    for (let i = 0; i < 20; i++) {
      const barHeight = Math.random() * height * 0.8;
      ctx.fillRect(i * (width / 20), height - barHeight, width / 30, barHeight);
    }
    
    requestAnimationFrame(drawVisualizer);
  }
  
  drawVisualizer();
}

// Initialize visualizer if canvas exists
document.addEventListener('DOMContentLoaded', createVisualizer);

// Initialize variables
const container = document.getElementById('columns');
const statsElement = document.getElementById('stats');
const bpmFilter = document.getElementById('bpm-filter');
const keyFilter = document.getElementById('key-filter');

// Create dark/light mode toggle functionality
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isDarkMode = !document.body.classList.contains('light-mode');
    themeToggle.textContent = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', isDarkMode);
  });

  // Check for saved theme preference
  if (localStorage.getItem('darkMode') === 'false') {
    document.body.classList.add('light-mode');
    themeToggle.textContent = '🌙 Dark Mode';
  }
}

// Main render function
const render = () => {
  const search = document.getElementById('search').value.toLowerCase();
  const selectedBPM = bpmFilter.value;
  const selectedKey = keyFilter.value;
  
  container.innerHTML = '';
  let visibleTracks = 0;
  let visibleArtists = 0;
  const visibleArtistsSet = new Set();

  // Get the current sort option
  const currentSort = sortSelect ? sortSelect.value : 'name-asc';
  console.log('Current sort option in render:', currentSort);
  
  // Get artists in the correct order based on current sort
  let artistsToRender = Object.keys(window.grouped);
  
  // Only apply sorting if we're not already in a sorted state
  if (currentSort === 'name-asc') {
    artistsToRender.sort((a, b) => a.localeCompare(b));
  } else if (currentSort === 'name-desc') {
    artistsToRender.sort((a, b) => b.localeCompare(a));
  }
  
  console.log('Artists to render:', artistsToRender);

  artistsToRender.forEach(artist => {
    const tracks = window.grouped[artist].filter(track => {
      const searchMatch = track.toLowerCase().includes(search);
      const match = track.match(/- (\d+[AB]) - (\d+)/);
      
      const keyMatch = selectedKey ? match && match[1] === selectedKey : true;
      const bpmMatch = selectedBPM ? match && match[2] === selectedBPM : true;
      
      return searchMatch && keyMatch && bpmMatch;
    });

    if (tracks.length > 0) {
      visibleArtistsSet.add(artist);
      visibleTracks += tracks.length;
      
      const groupDiv = document.createElement('div');
      groupDiv.classList.add('column-group');
      
      // Added play buttons and exportable tracklist
      const trackElements = tracks.map(t => {
        const trackDiv = document.createElement('div');
        trackDiv.classList.add('track');
        
        // Create play button
        const playBtn = document.createElement('button');
        playBtn.classList.add('play-btn');
        playBtn.innerHTML = '▶️';
        playBtn.title = 'Preview (if available)';
        playBtn.onclick = () => alert('Preview functionality would be here for: ' + t);
        
        // Add track details with better formatting
        const trackDetails = document.createElement('span');
        trackDetails.textContent = t;
        
        // Add copy button for track info
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.innerHTML = '📋';
        copyBtn.title = 'Copy track info';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(t)
            .then(() => {
              copyBtn.innerHTML = '✓';
              setTimeout(() => copyBtn.innerHTML = '📋', 1000);
            })
            .catch(err => console.error('Failed to copy: ', err));
        };
        
        trackDiv.appendChild(playBtn);
        trackDiv.appendChild(trackDetails);
        trackDiv.appendChild(copyBtn);
        
        return trackDiv.outerHTML;
      });
      
      groupDiv.innerHTML = `
        <div class="artist-header">
          <h2>${artist}</h2>
        </div>
        <div class="tracks-container">${trackElements.join('')}</div>
      `;
      
      container.appendChild(groupDiv);
    }
  });

  visibleArtists = visibleArtistsSet.size;
  
  // Update stats
  if (statsElement) {
    statsElement.innerHTML = `
      <div>Showing ${visibleTracks} of ${window.totalTracks} tracks</div>
      <div>${visibleArtists} artists</div>
    `;
  }
  
  // If no results, show message
  if (visibleTracks === 0) {
    container.innerHTML = '<div class="no-results">No tracks found matching your filters.</div>';
  }
};

// Add event listeners for all filters
document.getElementById('search').addEventListener('input', render);
bpmFilter.addEventListener('change', render);
keyFilter.addEventListener('change', render);

// Add sort functionality
const sortSelect = document.getElementById('sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', function() {
    const sortOption = this.value;
    console.log('Sort option selected:', sortOption);
    
    // Get all artists
    const artists = Object.keys(window.grouped);
    console.log('Artists before sorting:', artists);
    
    // Sort artists based on the selected option
    let sortedArtists;
    
    if (sortOption === 'name-asc') {
      sortedArtists = [...artists].sort((a, b) => a.localeCompare(b));
      console.log('Artists after A-Z sorting:', sortedArtists);
    } else if (sortOption === 'name-desc') {
      sortedArtists = [...artists].sort((a, b) => b.localeCompare(a));
      console.log('Artists after Z-A sorting:', sortedArtists);
    } else if (sortOption === 'tracks-desc') {
      sortedArtists = [...artists].sort((a, b) => window.grouped[b].length - window.grouped[a].length);
    } else if (sortOption === 'tracks-asc') {
      sortedArtists = [...artists].sort((a, b) => window.grouped[a].length - window.grouped[b].length);
    } else if (sortOption === 'bpm-asc' || sortOption === 'bpm-desc') {
      // For BPM sorting, we need to sort tracks within each artist
      // First, sort tracks within each artist by BPM
      Object.keys(window.grouped).forEach(artist => {
        window.grouped[artist].sort((a, b) => {
          const bpmA = parseInt(a.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
          const bpmB = parseInt(b.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
          
          return sortOption === 'bpm-asc' ? bpmA - bpmB : bpmB - bpmA;
        });
      });
      
      // Then sort artists by their first track's BPM
      sortedArtists = [...artists].sort((a, b) => {
        // Get the first track for each artist
        const trackA = window.grouped[a][0] || '';
        const trackB = window.grouped[b][0] || '';
        
        // Extract BPM values
        const bpmA = parseInt(trackA.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
        const bpmB = parseInt(trackB.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
        
        console.log(`Artist ${a} first track BPM: ${bpmA}, Artist ${b} first track BPM: ${bpmB}`);
        
        return sortOption === 'bpm-asc' ? bpmA - bpmB : bpmB - bpmA;
      });
      
      console.log('Artists after BPM sorting:', sortedArtists);
    } else if (sortOption === 'key-asc' || sortOption === 'key-desc') {
      // For key sorting
      Object.keys(window.grouped).forEach(artist => {
        window.grouped[artist].sort((a, b) => {
          const keyA = a.match(/- (\d+[AB]) - (\d+)/)?.[1] || '';
          const keyB = b.match(/- (\d+[AB]) - (\d+)/)?.[1] || '';
          
          if (sortOption === 'key-asc') {
            return keyA.localeCompare(keyB);
          } else {
            return keyB.localeCompare(keyA);
          }
        });
      });
      sortedArtists = artists; // Keep original artist order for key sorting
    } else if (sortOption === 'title-asc' || sortOption === 'title-desc') {
      // For title sorting
      Object.keys(window.grouped).forEach(artist => {
        window.grouped[artist].sort((a, b) => {
          // Extract title between first '-' and the key pattern
          const titleA = a.split(' - ')[1]?.split(' - ')[0] || '';
          const titleB = b.split(' - ')[1]?.split(' - ')[0] || '';
          
          if (sortOption === 'title-asc') {
            return titleA.localeCompare(titleB);
          } else {
            return titleB.localeCompare(titleA);
          }
        });
      });
      sortedArtists = artists; // Keep original artist order for title sorting
    }
    
    // Create a new object with sorted order
    const newGrouped = {};
    sortedArtists.forEach(artist => {
      newGrouped[artist] = window.grouped[artist];
    });
    
    // Update the global grouped object
    window.grouped = newGrouped;
    
    // Re-render the tracklist
    render();
  });
}

// Add export all functionality
const exportAllBtn = document.getElementById('export-all');
if (exportAllBtn) {
  exportAllBtn.addEventListener('click', function() {
    let exportText = '';
    Object.keys(window.grouped).sort().forEach(artist => {
      exportText += artist + '\n';
      exportText += window.grouped[artist].map(track => '  ' + track).join('\n') + '\n\n';
    });
    
    navigator.clipboard.writeText(exportText)
      .then(() => alert('All tracks copied to clipboard!'))
      .catch(err => console.error('Failed to copy: ', err));
  });
}
