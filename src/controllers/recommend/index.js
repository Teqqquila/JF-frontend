import { ServerConnections } from 'lib/jellyfin-apiclient';
import 'elements/emby-select/emby-select';
import 'elements/emby-button/emby-button';

// eslint-disable-next-line sonarjs/no-clear-text-protocols
const REC_API_BASE = 'http://129.114.25.107:30089';

export default function (view) {
    const grid = view.querySelector('.recGrid');
    const status = view.querySelector('.recStatus');
    const userBadge = view.querySelector('.recUserBadge');
    const modelSelect = view.querySelector('.recModelSelect');
    const topNSelect = view.querySelector('.recTopNSelect');
    const refreshBtn = view.querySelector('.recRefreshBtn');
    const adminBtn = view.querySelector('.recAdminBtn');
    const movieIdInput = view.querySelector('.recMovieIdInput');
    const durationInput = view.querySelector('.recDurationInput');
    const submitPrefBtn = view.querySelector('.recSubmitPrefBtn');
    const prefStatus = view.querySelector('.recPrefStatus');

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

            const posterHtml = posterUrl ?
                `<div style="position:relative; width:100%; aspect-ratio: 2/3; background:#111; flex-shrink:0;">
                       <img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}"
                            style="width:100%; height:100%; object-fit: cover; display:block;"
                            onerror="this.parentElement.querySelector('.recPosterFallback').style.display='flex'; this.style.display='none';">
                       <div class="recPosterFallback" style="display:none; position:absolute; inset:0; background:linear-gradient(135deg,#1f2a3f,#0a1421); align-items:center; justify-content:center; font-size:2.4em;">🎬</div>
                   </div>` :
                '<div style="width:100%; aspect-ratio: 2/3; background:linear-gradient(135deg,#1f2a3f,#0a1421); display:flex; align-items:center; justify-content:center; font-size:2.4em; flex-shrink:0;">🎬</div>';

            card.innerHTML = `
                ${posterHtml}
                <div style="padding: 0.75em 0.8em 0.85em; display:flex; flex-direction:column; flex:1;">
                    <div class="recCardTitle" style="font-weight: 600; font-size: 0.92em; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; cursor: pointer; flex:1;">
                        ${escapeHtml(title)}
                    </div>
                    ${genres ? `<div style="font-size: 0.72em; opacity: 0.5; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(genres)}</div>` : ''}
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

    function handleSubmitPreference() {
        prefStatus.style.color = '';
        prefStatus.textContent = '';

        const movieId = movieIdInput.value.trim();
        const duration = durationInput.value.trim();

        if (!movieId || !duration) {
            prefStatus.style.color = '#ff6b6b';
            prefStatus.textContent = 'Fill in both Movie ID and Duration';
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
                movieIdInput.value = '';
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
