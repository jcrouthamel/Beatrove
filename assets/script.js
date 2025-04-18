fetch('data/tracklist.txt')
  .then(response => response.text())
  .then(text => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const grouped = {};
    const allBPMs = new Set();
    const allKeys = new Set();
    const allGenres = new Set(); // New: Track genres
    let totalTracks = 0;

    // Parse track data
    lines.forEach(line => {
      const artist = line.split(' - ')[0];
      // Extract key and BPM with a more robust regex
      const match = line.match(/- (\d+[AB]) - (\d+)( - ([^-]+))?/);
      
      if (match) {
        const key = match[1];
        const bpm = match[2];
        // Extract genre if available (optional)
        const genre = match[4] ? match[4].trim() : "Unknown";
        
        allKeys.add(key);
        allBPMs.add(bpm);
        allGenres.add(genre);
      }
      
      if (!grouped[artist]) grouped[artist] = [];
      grouped[artist].push(line);
      totalTracks++;
    });

    // Populate BPM filter
    const bpmFilter = document.getElementById('bpm-filter');
    Array.from(allBPMs).sort((a, b) => parseInt(a) - parseInt(b)).forEach(bpm => {
      const opt = document.createElement('option');
      opt.value = bpm;
      opt.textContent = bpm + ' BPM';
      bpmFilter.appendChild(opt);
    });

    // Populate key filter
    const keyFilter = document.getElementById('key-filter');
    Array.from(allKeys).sort().forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      keyFilter.appendChild(opt);
    });

    // New: Populate genre filter
    const genreFilter = document.getElementById('genre-filter');
    if (genreFilter) { // Check if element exists
      Array.from(allGenres).sort().forEach(genre => {
        const opt = document.createElement('option');
        opt.value = genre;
        opt.textContent = genre;
        genreFilter.appendChild(opt);
      });
    }

    const container = document.getElementById('columns');
    const statsElement = document.getElementById('stats');

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
      const selectedGenre = genreFilter ? genreFilter.value : '';
      
      container.innerHTML = '';
      let visibleTracks = 0;
      let visibleArtists = 0;
      const visibleArtistsSet = new Set();

      Object.keys(grouped).sort().forEach(artist => {
        const tracks = grouped[artist].filter(track => {
          const searchMatch = track.toLowerCase().includes(search);
          const match = track.match(/- (\d+[AB]) - (\d+)( - ([^-]+))?/);
          
          const keyMatch = selectedKey ? match && match[1] === selectedKey : true;
          const bpmMatch = selectedBPM ? match && match[2] === selectedBPM : true;
          
          // Match genre if selected
          const genre = match && match[4] ? match[4].trim() : "Unknown";
          const genreMatch = selectedGenre ? genre === selectedGenre : true;
          
          return searchMatch && keyMatch && bpmMatch && genreMatch;
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
              <button class="export-btn" title="Export tracks for this artist" 
                onclick="navigator.clipboard.writeText('${tracks.join('\n')}')
                  .then(() => alert('Tracks copied to clipboard!'))
                  .catch(err => console.error('Failed to copy: ', err))">
                📥 Export
              </button>
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
          <div>Showing ${visibleTracks} of ${totalTracks} tracks</div>
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
    if (genreFilter) {
      genreFilter.addEventListener('change', render);
    }
    
    // Add sort functionality
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        const sortOption = this.value;
        
        if (sortOption === 'name-asc' || sortOption === 'name-desc' || 
            sortOption === 'tracks-asc' || sortOption === 'tracks-desc') {
          // These sorts work on the artist level
          const sortedArtists = Object.keys(grouped);
          
          if (sortOption === 'name-asc') {
            sortedArtists.sort();
          } else if (sortOption === 'name-desc') {
            sortedArtists.sort().reverse();
          } else if (sortOption === 'tracks-desc') {
            sortedArtists.sort((a, b) => grouped[b].length - grouped[a].length);
          } else if (sortOption === 'tracks-asc') {
            sortedArtists.sort((a, b) => grouped[a].length - grouped[b].length);
          }
          
          // Create a new object with sorted order
          const newGrouped = {};
          sortedArtists.forEach(artist => {
            newGrouped[artist] = grouped[artist];
          });
          grouped = newGrouped;
        } else if (sortOption === 'bpm-asc' || sortOption === 'bpm-desc') {
          // For BPM sorting, we need to sort tracks within each artist
          Object.keys(grouped).forEach(artist => {
            grouped[artist].sort((a, b) => {
              const bpmA = parseInt(a.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
              const bpmB = parseInt(b.match(/- (\d+[AB]) - (\d+)/)?.[2] || '0');
              
              return sortOption === 'bpm-asc' ? bpmA - bpmB : bpmB - bpmA;
            });
          });
        } else if (sortOption === 'key-asc' || sortOption === 'key-desc') {
          // For key sorting
          Object.keys(grouped).forEach(artist => {
            grouped[artist].sort((a, b) => {
              const keyA = a.match(/- (\d+[AB]) - (\d+)/)?.[1] || '';
              const keyB = b.match(/- (\d+[AB]) - (\d+)/)?.[1] || '';
              
              if (sortOption === 'key-asc') {
                return keyA.localeCompare(keyB);
              } else {
                return keyB.localeCompare(keyA);
              }
            });
          });
        } else if (sortOption === 'title-asc' || sortOption === 'title-desc') {
          // For title sorting
          Object.keys(grouped).forEach(artist => {
            grouped[artist].sort((a, b) => {
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
        }
        
        render();
      });
    }
    
    // Add export all functionality
    const exportAllBtn = document.getElementById('export-all');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', function() {
        let exportText = '';
        Object.keys(grouped).sort().forEach(artist => {
          exportText += artist + '\n';
          exportText += grouped[artist].map(track => '  ' + track).join('\n') + '\n\n';
        });
        
        navigator.clipboard.writeText(exportText)
          .then(() => alert('All tracks copied to clipboard!'))
          .catch(err => console.error('Failed to copy: ', err));
      });
    }
    
    // Initial render
    render();
  })
  .catch(err => {
    document.getElementById('columns').innerHTML = '<p>Failed to load tracklist. Please check that the data file exists.</p>';
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
