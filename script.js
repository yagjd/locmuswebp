document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const playerSection = document.getElementById('player-section');
    const playlistElement = document.getElementById('playlist');
    const trackCountElement = document.getElementById('track-count');
    const audioPlayer = document.getElementById('audio-player');
    
    // Player Controls
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const volumeSlider = document.getElementById('volume-slider');
    
    // Progress
    const progressBg = document.getElementById('progress-bg');
    const progressFill = document.getElementById('progress-fill');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    
    // Info
    const currentTitle = document.getElementById('current-title');
    const currentStatus = document.getElementById('current-status');
    const trackArtwork = document.querySelector('.track-artwork');

    // State
    let playlist = [];
    let currentIndex = -1;

    // --- Drag and Drop Handling ---

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        // Also prevent default on whole body to avoid accidental browser navigation when missing the drop zone
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    // Browse Button
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent triggering dropzone click
        fileInput.click();
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        handleFiles(this.files);
    });

    async function handleDrop(e) {
        const dt = e.dataTransfer;
        
        if (dt.items) {
            const promises = [];
            const files = [];
            
            for (let i = 0; i < dt.items.length; i++) {
                const item = dt.items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        promises.push(traverseFileTree(entry, files));
                    }
                }
            }
            
            await Promise.all(promises);
            handleFiles(files);
        } else {
            // Fallback for older browsers
            handleFiles(dt.files);
        }
    }

    function traverseFileTree(item, pathOrFilesList) {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    pathOrFilesList.push(file);
                    resolve();
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const entriesPromises = [];
                
                const readEntries = () => {
                    dirReader.readEntries((entries) => {
                        if (entries.length === 0) {
                            Promise.all(entriesPromises).then(() => resolve());
                        } else {
                            for (let i = 0; i < entries.length; i++) {
                                entriesPromises.push(traverseFileTree(entries[i], pathOrFilesList));
                            }
                            // Call recursively
                            readEntries();
                        }
                    });
                };
                readEntries();
            } else {
                resolve();
            }
        });
    }

    function handleFiles(files) {
        const validAudioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'));
        
        if (validAudioFiles.length === 0) {
            alert('Please drop valid audio files (.mp3, .wav, etc.)');
            return;
        }

        const wasEmpty = playlist.length === 0;

        // Add to playlist
        validAudioFiles.forEach(file => {
            playlist.push({
                file: file,
                name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
                url: URL.createObjectURL(file)
            });
        });

        updatePlaylistUI();

        // If player is hidden, show it
        if (playerSection.classList.contains('hidden')) {
            playerSection.classList.remove('hidden');
        }
        
        // Start playing the first track if the playlist was empty
        if (wasEmpty) {
            playTrack(0);
        } else if (currentIndex === -1) {
            playTrack(0);
        }
    }

    // --- Playlist Management ---

    function updatePlaylistUI() {
        trackCountElement.textContent = `${playlist.length} track${playlist.length !== 1 ? 's' : ''}`;
        
        playlistElement.innerHTML = '';
        
        if (playlist.length === 0) {
            playlistElement.innerHTML = '<li class="empty-state">Your playlist is empty</li>';
            return;
        }

        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            if (index === currentIndex) li.classList.add('active');
            
            li.innerHTML = `
                <ion-icon name="musical-note"></ion-icon>
                <span class="track-name">${track.name}</span>
            `;
            
            li.addEventListener('click', () => {
                playTrack(index);
            });
            
            playlistElement.appendChild(li);
        });
    }

    // --- Audio Playback ---

    function playTrack(index) {
        if (index < 0 || index >= playlist.length) return;
        
        currentIndex = index;
        const track = playlist[index];
        
        audioPlayer.src = track.url;
        
        // Update Info
        currentTitle.textContent = track.name;
        
        // Update Playlist highlighting
        updatePlaylistUI();

        audioPlayer.play()
            .then(() => {
                updatePlayPauseUI(true);
                currentStatus.textContent = 'Playing';
                // Start artwork animation ONLY on success
                trackArtwork.classList.add('playing');
            })
            .catch(err => {
                console.error("Playback blocked by browser (Autoplay policy):", err);
                updatePlayPauseUI(false);
                currentStatus.textContent = 'Paused (Click Play to start)';
                // Ensure artwork doesn't spin
                trackArtwork.classList.remove('playing');
            });
    }

    function togglePlay() {
        if (currentIndex === -1) return;

        if (audioPlayer.paused) {
            audioPlayer.play();
            updatePlayPauseUI(true);
            currentStatus.textContent = 'Playing';
            trackArtwork.classList.add('playing');
        } else {
            audioPlayer.pause();
            updatePlayPauseUI(false);
            currentStatus.textContent = 'Paused';
            trackArtwork.classList.remove('playing');
        }
    }

    function updatePlayPauseUI(isPlaying) {
        if (isPlaying) {
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
        } else {
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
        }
    }

    function playNext() {
        if (playlist.length === 0) return;
        let nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) nextIndex = 0; // loop back to start
        playTrack(nextIndex);
    }

    function playPrev() {
        if (playlist.length === 0) return;
        
        // If track is more than 3 seconds in, just restart it
        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = playlist.length - 1; // loop to end
        playTrack(prevIndex);
    }

    // --- Event Listeners ---

    btnPlayPause.addEventListener('click', togglePlay);
    btnNext.addEventListener('click', playNext);
    btnPrev.addEventListener('click', playPrev);

    audioPlayer.addEventListener('ended', playNext);

    // Progress Bar Update
    audioPlayer.addEventListener('timeupdate', () => {
        if (!audioPlayer.duration) return;
        
        const current = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        
        // Update text
        timeCurrent.textContent = formatTime(current);
        
        // Update bar
        const percent = (current / duration) * 100;
        progressFill.style.width = `${percent}%`;
    });

    // Duration Metadata load
    audioPlayer.addEventListener('loadedmetadata', () => {
        timeTotal.textContent = formatTime(audioPlayer.duration);
    });

    // Click on progress bar to seek
    progressBg.addEventListener('click', (e) => {
        if (!audioPlayer.duration) return;
        
        const rect = progressBg.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = pos * audioPlayer.duration;
    });

    // Volume Control
    volumeSlider.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value;
    });

    // Helper: Format Time
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
});
