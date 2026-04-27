import { ServerConnections } from 'lib/jellyfin-apiclient';
import 'elements/emby-select/emby-select';
import 'elements/emby-button/emby-button';

// eslint-disable-next-line sonarjs/no-clear-text-protocols
const REC_API_BASE = 'http://129.114.25.107:30089';
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNjM1ZjliMDM0YTM1OGUyNDVmMGNiYmFjM2I1MzJjMyIsIm5iZiI6MTc3NzI2NDcyNi41MzUsInN1YiI6IjY5ZWVlODU2NjBiYmYwOTkxNDAyOThlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.iNQVVxrQwXRo9qPNeRP-EE9_Hz5pc2dAIiWg9JA2qq0';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';

export default function (view) {
    const grid = view.querySelector('.recGrid');
    const status = view.querySelector('.recStatus');
    const userBadge = view.querySelector('.recUserBadge');
    const modelSelect = view.querySelector('.recModelSelect');
    const topNSelect = view.querySelector('.recTopNSelect');
    const refreshBtn = view.querySelector('.recRefreshBtn');
    const adminBtn = view.querySelector('.recAdminBtn');
    const syncBtn = view.querySelector('.recSyncBtn');
    const syncBar = view.querySelector('.recSyncBar');
    const syncCount = view.querySelector('.recSyncCount');
    const syncProgress = view.querySelector('.recSyncProgress');
    const syncDetail = view.querySelector('.recSyncDetail');
    const movieSearchInput = view.querySelector('.recMovieSearchInput');
    const movieSearchResults = view.querySelector('.recMovieSearchResults');
    const movieIdDirectInput = view.querySelector('.recMovieIdDirectInput');
    const selectedMovieLabel = view.querySelector('.recSelectedMovieLabel');
    const durationInput = view.querySelector('.recDurationInput');
    const submitPrefBtn = view.querySelector('.recSubmitPrefBtn');
    const prefStatus = view.querySelector('.recPrefStatus');

    let selectedMovieId = null;
    let searchDebounceTimer = null;

    let currentUsername = null;
    let currentNumericUserId = null; // integer user_id returned by the API
    let currentRequestId = null;

    function loadCurrentUser() {
        const apiClient = ServerConnections.currentApiClient();
        return apiClient.getCurrentUser().then(user => {
            currentUsername = user.Name;
            userBadge.textContent = `(${currentUsername})`;
            return user;
        });
    }

    function loadModelVersions() {
        return Promise.resolve();
    }

    function loadRecommendations() {
        if (!currentUsername) {
            status.textContent = 'No logged-in user.';
            return;
        }

        const modelVersion = modelSelect.value;
        const topN = topNSelect.value;

        status.textContent = `Loading recommendations for "${currentUsername}"...`;
        grid.innerHTML = '';
        currentRequestId = `${currentUsername}-${Date.now()}`;

        const url = `${REC_API_BASE}/api/recommend_by_username/${encodeURIComponent(currentUsername)}?top_n=${topN}&model_version=${encodeURIComponent(modelVersion)}`;

        fetch(url)
            .then(r => {
                if (!r.ok) {
                    return r.json().then(j => {
                        throw new Error(j.error || `HTTP ${r.status}`);
                    });
                }
                return r.json();
            })
            .then(data => {
                if (data.user_id != null) currentNumericUserId = data.user_id;

                const recs = data.recommendations || [];
                if (recs.length === 0) {
                    status.textContent = 'No recommendations returned.';
                    return;
                }
                status.textContent = `${recs.length} recommendations from ${data.model_version}`;
                renderRecommendations(recs);
            })
            .catch(err => {
                console.error(err);
                status.innerHTML = `<span style="color:#ff6b6b;">Error: ${err.message}</span><br>
                    <small style="opacity:0.6;">Make sure your Jellyfin username is a numeric MovieLens user_id (e.g., "12345" or "user_12345").</small>`;
            });
    }

    function fetchTmdbPoster(card, rawTitle) {
        const yearMatch = rawTitle.match(/\((\d{4})\)\s*$/);
        const year = yearMatch ? yearMatch[1] : '';
        const query = rawTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim();

        fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&year=${year}&language=en-US&page=1`, {
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}` }
        })
            .then(r => r.json())
            .then(data => {
                const hit = data.results && data.results[0];
                if (!hit || !hit.poster_path) return;
                const img = card.querySelector('.recPosterImg');
                const fallback = card.querySelector('.recPosterFallback');
                if (!img) return;
                img.onload = () => {
                    img.style.display = 'block';
                    if (fallback) fallback.style.display = 'none';
                };
                img.onerror = () => {};
                img.src = `${TMDB_IMG_BASE}${hit.poster_path}`;
            })
            .catch(() => {});
    }

    function renderRecommendations(recs) {
        grid.innerHTML = '';
        recs.forEach((rec, i) => {
            const title = rec.title || rec.movie_title || `Movie ${rec.movie_id}`;
            const score = rec.score != null ? rec.score.toFixed(2) : '';
            const genres = rec.genres ? rec.genres.split('|').join(' · ') : '';
            const posterUrl = rec.poster_url || rec.poster || '';

            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = [
                'background: rgba(255,255,255,0.05)',
                'border-radius: 12px',
                'overflow: hidden',
                'transition: transform 0.18s ease, box-shadow 0.18s ease',
                'border: 1px solid rgba(255,255,255,0.07)',
                'display: flex',
                'flex-direction: column'
            ].join(';');
            card.onmouseenter = () => {
                card.style.transform = 'translateY(-5px)';
                card.style.boxShadow = '0 12px 32px rgba(0,164,220,0.18)';
            };
            card.onmouseleave = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
            };

            const posterHtml = `
                <div style="position:relative; width:100%; aspect-ratio: 2/3; background:#111; flex-shrink:0;">
                    <img class="recPosterImg" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}"
                         style="width:100%; height:100%; object-fit:cover; display:${posterUrl ? 'block' : 'none'};">
                    <div class="recPosterFallback" style="display:${posterUrl ? 'none' : 'flex'}; position:absolute; inset:0; background:linear-gradient(135deg,#1f2a3f,#0a1421); align-items:center; justify-content:center; font-size:2.4em;">🎬</div>
                </div>`;

            card.innerHTML = `
                ${posterHtml}
                <div style="padding: 0.75em 0.8em 0.85em; display:flex; flex-direction:column; flex:1;">
                    <div class="recCardTitle" style="font-weight: 600; font-size: 0.92em; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; cursor: pointer; flex:1;">
                        ${escapeHtml(title)}
                    </div>
                    ${genres ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${
                        genres.split(' · ').map(g =>
                            `<span style="font-size: 0.68em; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.55); white-space: nowrap;">${escapeHtml(g)}</span>`
                        ).join('')
                    }</div>` : ''}
                    ${score ? `<div style="font-size: 0.82em; color: #FFD700; margin-top: 5px; font-weight: 700; text-shadow: 0 0 8px rgba(255,215,0,0.5);">★ ${score}</div>` : ''}
                    <button class="recLikeBtn"
                            style="margin-top: 10px; width: 100%; padding: 6px 0; border: 1px solid rgba(255,255,255,0.18); border-radius: 20px; background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 0.8em; font-weight: 600; letter-spacing: 0.3px; transition: all 0.18s ease;">
                        ♡ Like
                    </button>
                </div>
            `;

            card.querySelector('.recCardTitle').addEventListener('click', () => {
                // eslint-disable-next-line sonarjs/slow-regex
                const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
                window.location.href = `#/search.html?query=${encodeURIComponent(cleanTitle)}`;
            });

            const likeBtn = card.querySelector('.recLikeBtn');
            likeBtn.addEventListener('click', e => {
                e.stopPropagation();
                handleLike(likeBtn, rec.movie_id, i + 1);
            });

            grid.appendChild(card);
            setTimeout(() => fetchTmdbPoster(card, title), i * 50);
        });
    }

    function handleLike(btn, movieId, rank) {
        if (btn.dataset.liked === 'true') {
            btn.dataset.liked = 'false';
            btn.textContent = '♡ Like';
            btn.style.color = 'rgba(255,255,255,0.65)';
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
            btn.style.background = 'transparent';
            return;
        }

        btn.disabled = true;
        btn.textContent = '...';

        /* eslint-disable @typescript-eslint/naming-convention */
        fetch(`${REC_API_BASE}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request_id: currentRequestId || `${currentUsername}-${Date.now()}`,
                user_id: String(currentNumericUserId != null ? currentNumericUserId : currentUsername),
                clicked_movie_id: String(movieId),
                clicked_rank: rank
            })
        })
        /* eslint-enable @typescript-eslint/naming-convention */
            .then(r => r.json())
            .catch(err => console.warn('[recommend] feedback error:', err));

        if (currentNumericUserId != null) {
            // eslint-disable-next-line sonarjs/pseudo-random
            const watchDuration = Math.floor(Math.random() * (7200 - 900 + 1)) + 900;
            /* eslint-disable @typescript-eslint/naming-convention */
            fetch(`${REC_API_BASE}/api/ingest-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentNumericUserId,
                    movie_id: String(movieId),
                    watch_duration_seconds: watchDuration
                })
            })
            /* eslint-enable @typescript-eslint/naming-convention */
                .then(r => r.json())
                .then(d => console.debug('[recommend] ingest-event:', d))
                .catch(err => console.warn('[recommend] ingest-event error:', err));
        }

        btn.disabled = false;
        btn.dataset.liked = 'true';
        btn.textContent = '❤ Liked';
        btn.style.color = '#2ecc71';
        btn.style.borderColor = '#2ecc71';
        btn.style.background = 'rgba(46,204,113,0.1)';
    }

    function searchMovies(q) {
        if (!q || q.length < 2) {
            movieSearchResults.style.display = 'none';
            return;
        }
        fetch(`${REC_API_BASE}/api/search?q=${encodeURIComponent(q)}&limit=8`)
            .then(r => r.json())
            .then(data => {
                const results = data.results || [];
                if (!results.length) {
                    movieSearchResults.style.display = 'none';
                    return;
                }
                movieSearchResults.innerHTML = results.map(m =>
                    `<div class="recSearchItem" data-id="${m.movie_id}" data-title="${escapeHtml(m.title)}"
                          style="padding: 0.6em 1em; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.88em; transition: background 0.1s;">
                        <span style="font-weight: 600;">${escapeHtml(m.title)}</span>
                        <span style="opacity: 0.45; font-size: 0.85em; margin-left: 8px;">${escapeHtml(m.genres || '')}</span>
                     </div>`
                ).join('');
                movieSearchResults.querySelectorAll('.recSearchItem').forEach(item => {
                    item.addEventListener('mouseenter', () => {
                        item.style.background = 'rgba(106,90,205,0.25)';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.background = '';
                    });
                    item.addEventListener('click', () => {
                        selectedMovieId = item.dataset.id;
                        movieSearchInput.value = item.dataset.title;
                        selectedMovieLabel.textContent = `ID: ${selectedMovieId}`;
                        movieSearchResults.style.display = 'none';
                    });
                });
                movieSearchResults.style.display = 'block';
            })
            .catch(() => {
                movieSearchResults.style.display = 'none';
            });
    }

    document.addEventListener('click', e => {
        if (!movieSearchResults.contains(e.target) && e.target !== movieSearchInput) {
            movieSearchResults.style.display = 'none';
        }
    });

    // When search selects a movie, also fill the direct ID box
    movieSearchInput.addEventListener('input', () => {
        selectedMovieId = null;
        selectedMovieLabel.textContent = '';
        movieIdDirectInput.value = '';
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => searchMovies(movieSearchInput.value.trim()), 280);
    });

    // When user types directly in the ID box, clear search selection
    movieIdDirectInput.addEventListener('input', () => {
        selectedMovieId = null;
        selectedMovieLabel.textContent = '';
        movieSearchInput.value = '';
        movieSearchResults.style.display = 'none';
    });

    function handleSubmitPreference() {
        prefStatus.style.color = '';
        prefStatus.textContent = '';

        // Prefer search-selected ID, fall back to direct input
        const movieId = selectedMovieId || movieIdDirectInput.value.trim();
        const duration = durationInput.value.trim();

        if (!movieId) {
            prefStatus.style.color = '#ff6b6b';
            prefStatus.textContent = 'Search a movie title or enter a Movie ID';
            return;
        }

        if (!duration) {
            prefStatus.style.color = '#ff6b6b';
            prefStatus.textContent = 'Enter watch duration';
            return;
        }

        if (currentNumericUserId == null) {
            prefStatus.style.color = '#ff6b6b';
            prefStatus.textContent = 'Recommendations not loaded yet — click Refresh first';
            return;
        }

        prefStatus.textContent = 'Submitting…';

        /* eslint-disable @typescript-eslint/naming-convention */
        fetch(`${REC_API_BASE}/api/ingest-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentNumericUserId,
                movie_id: String(movieId),
                watch_duration_seconds: parseInt(duration, 10)
            })
        })
        /* eslint-enable @typescript-eslint/naming-convention */
            .then(r => {
                if (!r.ok) {
                    return r.json().then(j => {
                        throw new Error(j.error || `HTTP ${r.status}`);
                    });
                }
                return r.json();
            })
            .then(() => {
                prefStatus.style.color = '#2ecc71';
                prefStatus.textContent = '✓ Submitted! Refresh to see updated recommendations.';
                movieSearchInput.value = '';
                movieIdDirectInput.value = '';
                selectedMovieId = null;
                selectedMovieLabel.textContent = '';
                durationInput.value = '';
                setTimeout(() => {
                    prefStatus.textContent = '';
                }, 4000);
            })
            .catch(err => {
                prefStatus.style.color = '#ff6b6b';
                prefStatus.textContent = `Error: ${err.message}`;
            });
    }

    // ── Sync Jellyfin watch history → recommendation system ──
    function handleSyncWatchHistory() {
        if (currentNumericUserId == null) {
            status.textContent = 'Load recommendations first before syncing.';
            return;
        }

        const apiClient = ServerConnections.currentApiClient();
        syncBtn.disabled = true;
        syncBar.style.display = 'block';
        syncDetail.textContent = 'Fetching Jellyfin watch history…';
        syncCount.textContent = '';
        syncProgress.style.width = '0%';

        apiClient.getCurrentUser()
            .then(user => {
                const baseParams = {
                    IncludeItemTypes: 'Movie',
                    Recursive: true,
                    Fields: 'UserData,RunTimeTicks,ProductionYear',
                    Limit: 500
                };
                return Promise.all([
                    apiClient.getItems(user.Id, { ...baseParams, Filters: 'IsPlayed' }),
                    apiClient.getItems(user.Id, { ...baseParams, Filters: 'IsResumable' })
                ]);
            })
            .then(([playedResp, resumableResp]) => {
                const seen = new Set();
                const items = [...(playedResp.Items || []), ...(resumableResp.Items || [])]
                    .filter(item => {
                        if (seen.has(item.Id)) return false;
                        seen.add(item.Id);
                        return item.UserData && (
                            item.UserData.Played === true ||
                            item.UserData.PlaybackPositionTicks > 0
                        );
                    });
                if (!items.length) {
                    syncDetail.textContent = 'No watched movies found in Jellyfin library.';
                    syncBtn.disabled = false;
                    return;
                }

                let done = 0;
                let matched = 0;
                const total = items.length;
                syncCount.textContent = `0 / ${total}`;

                // Process one at a time to avoid flooding the API
                function processNext(idx) {
                    if (idx >= total) {
                        syncProgress.style.width = '100%';
                        syncDetail.textContent = `Done — ${matched} / ${total} movies matched and submitted.`;
                        syncCount.textContent = `${matched} matched`;
                        syncBtn.disabled = false;
                        setTimeout(() => {
                            syncBar.style.display = 'none';
                        }, 5000);
                        return;
                    }

                    const item = items[idx];
                    const title = item.Name || '';
                    const year = item.ProductionYear || '';
                    const positionTicks = item.UserData.PlaybackPositionTicks || 0;
                    const durationTicks = positionTicks > 0 ? positionTicks : (item.RunTimeTicks || 0);
                    const watchSec = Math.floor(durationTicks / 10000000);

                    syncDetail.textContent = `Matching: ${title} (${year})`;

                    fetch(`${REC_API_BASE}/api/search?q=${encodeURIComponent(title)}&limit=5`)
                        .then(r => r.json())
                        .then(data => {
                            const results = data.results || [];
                            // Match by title containing the year
                            const hit = results.find(r2 =>
                                year ? r2.title.includes(`(${year})`) : results[0]
                            ) || results[0];

                            if (hit && watchSec > 60) {
                                matched++;
                                /* eslint-disable @typescript-eslint/naming-convention */
                                return fetch(`${REC_API_BASE}/api/ingest-event`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        user_id: currentNumericUserId,
                                        movie_id: String(hit.movie_id),
                                        watch_duration_seconds: watchSec
                                    })
                                /* eslint-enable @typescript-eslint/naming-convention */
                                }).then(r => r.json());
                            }
                        })
                        .catch(err => console.debug('[sync] no match:', err))
                        .finally(() => {
                            done++;
                            syncCount.textContent = `${done} / ${total}`;
                            syncProgress.style.width = `${Math.round((done / total) * 100)}%`;
                            // Small delay to avoid hammering APIs
                            setTimeout(() => processNext(idx + 1), 120);
                        });
                }

                processNext(0);
            })
            .catch(err => {
                syncDetail.textContent = `Error: ${err.message}`;
                syncBtn.disabled = false;
            });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    refreshBtn.addEventListener('click', loadRecommendations);
    modelSelect.addEventListener('change', loadRecommendations);
    topNSelect.addEventListener('change', loadRecommendations);
    adminBtn.addEventListener('click', () => {
        window.location.href = '#/recommend/admin';
    });
    submitPrefBtn.addEventListener('click', handleSubmitPreference);
    syncBtn.addEventListener('click', handleSyncWatchHistory);

    view.addEventListener('viewshow', function () {
        loadCurrentUser()
            .then(loadModelVersions)
            .then(loadRecommendations)
            .catch(err => {
                console.error('Init error:', err);
                status.textContent = `Init failed: ${err.message}`;
            });
    });
}
