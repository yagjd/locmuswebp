const LASTFM_API_KEY = '481825092527eb6008d10743e2065155';
const LASTFM_API_SECRET = 'da2a97798b58dd7f8fec3c9aaa494a9a';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const playerSection = document.getElementById('player-section');
    const playlistElement = document.getElementById('playlist');
    const trackCountElement = document.getElementById('track-count');
    const audioPlayer = document.getElementById('audio-player');

    // Last.fm Elements
    const lastfmConnectBtn = document.getElementById('lastfm-connect-btn');
    const lastfmStatus = document.getElementById('lastfm-status');

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
    let currentTrackStartTime = 0;
    let hasScrobbledCurrent = false;

    // --- Last.fm Auth and Scrobbling ---
    let sessionKey = localStorage.getItem('lastfm_session_key');
    let lastfmSessionName = localStorage.getItem('lastfm_session_name');

    let pendingToken = localStorage.getItem('lastfm_pending_token');

    function checkLastFmAuth() {
        if (sessionKey) {
            lastfmConnectBtn.classList.add('hidden');
            lastfmStatus.classList.remove('hidden');
            lastfmStatus.innerHTML = `<ion-icon name="checkmark-circle"></ion-icon> Last.fm: ${lastfmSessionName || 'Connected'}`;
        } else if (pendingToken) {
            lastfmConnectBtn.innerHTML = '<ion-icon name="checkmark"></ion-icon> Complete Last.fm Setup';
            lastfmConnectBtn.classList.remove('hidden');
        } else if (LASTFM_API_KEY !== 'PASTE_YOUR_API_KEY_HERE') {
            lastfmConnectBtn.classList.remove('hidden');
        }
    }

    lastfmConnectBtn.addEventListener('click', async () => {
        if (LASTFM_API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
            alert('Please open script_lastfm.js and paste your LASTFM_API_KEY and LASTFM_API_SECRET at the top!');
            return;
        }

        if (pendingToken) {
            // Step 2: Complete Auth
            lastfmConnectBtn.innerHTML = 'Connecting...';
            const method = 'auth.getSession';
            const sigString = `api_key${LASTFM_API_KEY}method${method}token${pendingToken}${LASTFM_API_SECRET}`;
            const api_sig = SparkMD5.hash(sigString);
            
            const url = `http://ws.audioscrobbler.com/2.0/?method=${method}&api_key=${LASTFM_API_KEY}&token=${pendingToken}&api_sig=${api_sig}&format=json`;
            
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.session) {
                    sessionKey = data.session.key;
                    lastfmSessionName = data.session.name;
                    localStorage.setItem('lastfm_session_key', sessionKey);
                    localStorage.setItem('lastfm_session_name', lastfmSessionName);
                    localStorage.removeItem('lastfm_pending_token');
                    pendingToken = null;
                    checkLastFmAuth();
                } else {
                    throw new Error(data.message || 'Auth failed');
                }
            } catch (err) {
                console.error("Last.fm auth error", err);
                alert("Authentication failed. Did you click 'Allow' on Last.fm?");
                localStorage.removeItem('lastfm_pending_token');
                pendingToken = null;
                lastfmConnectBtn.innerHTML = '<ion-icon name="barcode-outline"></ion-icon> Connect Last.fm';
            }
        } else {
            // Step 1: Get Token and Open Browser
            try {
                lastfmConnectBtn.innerHTML = 'Loading...';
                const method = 'auth.getToken';
                const sigString = `api_key${LASTFM_API_KEY}method${method}${LASTFM_API_SECRET}`;
                const api_sig = SparkMD5.hash(sigString);
                
                const url = `http://ws.audioscrobbler.com/2.0/?method=${method}&api_key=${LASTFM_API_KEY}&api_sig=${api_sig}&format=json`;
                
                const res = await fetch(url);
                const data = await res.json();
                
                if (data.token) {
                    pendingToken = data.token;
                    localStorage.setItem('lastfm_pending_token', pendingToken);
                    window.open(`http://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&token=${pendingToken}`, '_blank');
                    checkLastFmAuth();
                } else {
                    alert("Failed to contact Last.fm. Check your API keys.");
                    lastfmConnectBtn.innerHTML = '<ion-icon name="barcode-outline"></ion-icon> Connect Last.fm';
                }
            } catch(e) {
                console.error(e);
                alert("Network error connecting to Last.fm");
                lastfmConnectBtn.innerHTML = '<ion-icon name="barcode-outline"></ion-icon> Connect Last.fm';
            }
        }
    });

    checkLastFmAuth();

    function createLastFmSignature(params) {
        const keys = Object.keys(params).sort();
        let sigString = '';
        keys.forEach(k => { sigString += `${k}${params[k]}`; });
        sigString += LASTFM_API_SECRET;
        return SparkMD5.hash(sigString);
    }

    function lastFmApiRequest(method, params) {
        if (!sessionKey) return Promise.resolve();
        params.api_key = LASTFM_API_KEY;
        params.method = method;
        params.sk = sessionKey;
        params.api_sig = createLastFmSignature(params);
        params.format = 'json';

        const form = new URLSearchParams();
        for (const key in params) form.append(key, params[key]);

        return fetch('http://ws.audioscrobbler.com/2.0/', {
            method: 'POST',
            body: form,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then(res => res.json()).catch(err => console.error("Last.fm API Error:", err));
    }

    function scrobbleNowPlaying(track) {
        if (track.artist === "Unknown Artist") return;
        lastFmApiRequest('track.updateNowPlaying', { artist: track.artist, track: track.track, album: track.album });
    }

    function scrobbleTrack(track) {
        if (track.artist === "Unknown Artist" || hasScrobbledCurrent) return;
        hasScrobbledCurrent = true;
        lastFmApiRequest('track.scrobble', {
            artist: track.artist,
            track: track.track,
            album: track.album,
            timestamp: currentTrackStartTime.toString()
        });
    }

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

    fileInput.addEventListener('change', function (e) {
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
                    file.customPath = item.fullPath;
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
        const validAudioFiles = Array.from(files).filter(file => {
            return file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i);
        });

        if (validAudioFiles.length === 0) {
            alert('Please drop valid audio files (.mp3, .wav, etc.)');
            return;
        }

        const wasEmpty = playlist.length === 0;

        // Add to playlist
        validAudioFiles.forEach(file => {
            const path = file.customPath || file.webkitRelativePath || file.name;
            const parts = path.split('/').filter(p => p);

            let artist = "Unknown Artist";
            let album = "Unknown Album";
            let trackTitle = file.name.replace(/\.[^/.]+$/, "");
            let folderName = "";

            if (parts.length >= 2) {
                folderName = parts[parts.length - 2];
                // folder format: artist - year - album title
                const fParts = folderName.split(' - ');
                if (fParts.length >= 3) {
                    artist = fParts[0].trim();
                    album = fParts.slice(2).join(' - ').trim();
                } else {
                    artist = fParts[0].trim();
                }

                const filename = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
                const match = filename.match(/^(?:\[?\d+\]?\s*-\s*)?\d+\s*-\s*(.*)$/);
                if (match) {
                    trackTitle = match[1].trim();
                } else {
                    trackTitle = filename.trim();
                }
            } else {
                const filename = file.name.replace(/\.[^/.]+$/, "");
                const match = filename.match(/^(?:\[?\d+\]?\s*-\s*)?\d+\s*-\s*(.*)$/);
                if (match) {
                    trackTitle = match[1].trim();
                } else {
                    trackTitle = filename.trim();
                }
            }

            const display = folderName ? `${folderName} / ${trackTitle}` : trackTitle;

            playlist.push({
                file: file,
                name: display,
                artist: artist,
                album: album,
                track: trackTitle,
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
        currentTrackStartTime = Math.floor(Date.now() / 1000);
        hasScrobbledCurrent = false;

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
                scrobbleNowPlaying(track);
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
            audioPlayer.play().then(() => {
                updatePlayPauseUI(true);
                currentStatus.textContent = 'Playing';
                trackArtwork.classList.add('playing');
                scrobbleNowPlaying(playlist[currentIndex]);
            });
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
        if (nextIndex >= playlist.length) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            updatePlayPauseUI(false);
            currentStatus.textContent = 'Playlist ended';
            trackArtwork.classList.remove('playing');
            return;
        }
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

        // Scrobble at 50%
        if (!hasScrobbledCurrent && duration > 0 && current > duration / 2) {
            scrobbleTrack(playlist[currentIndex]);
        }

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
