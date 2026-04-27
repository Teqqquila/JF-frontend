import 'elements/emby-select/emby-select';
import 'elements/emby-button/emby-button';

// eslint-disable-next-line sonarjs/no-clear-text-protocols
const REC_API_BASE = 'http://129.114.25.107:30089';

export default function (view) {
    const metricVersion = view.querySelector('.adminMetricVersion');
    const metricMse = view.querySelector('.adminMetricMse');
    const metricHitRate = view.querySelector('.adminMetricHitRate');
    const metricNdcg = view.querySelector('.adminMetricNdcg');
    const trainingBadge = view.querySelector('.adminTrainingBadge');

    const datasetSelect = view.querySelector('.adminDatasetSelect');
    const modelTypeSelect = view.querySelector('.adminModelTypeSelect');
    const retrainBtn = view.querySelector('.adminRetrainBtn');
    const retrainBtn2 = view.querySelector('.adminRetrainBtn2');
    const retrainStatus = view.querySelector('.adminRetrainStatus');

    const logBox = view.querySelector('.adminLogBox');
    const clearLogsBtn = view.querySelector('.adminClearLogsBtn');

    const historyList = view.querySelector('.adminHistoryList');

    const scheduleEnabled = view.querySelector('.adminScheduleEnabled');
    const scheduleEnabledLabel = view.querySelector('.adminScheduleEnabledLabel');
    const scheduleInterval = view.querySelector('.adminScheduleInterval');
    const scheduleTime = view.querySelector('.adminScheduleTime');
    const saveScheduleBtn = view.querySelector('.adminSaveScheduleBtn');
    const scheduleStatus = view.querySelector('.adminScheduleStatus');

    const backBtn = view.querySelector('.adminBackBtn');

    let pollTimer = null;

    backBtn.addEventListener('click', () => {
        window.location.href = '#/recommend';
    });

    function loadStatus() {
        return fetch(`${REC_API_BASE}/api/status`)
            .then(r => r.json())
            .then(data => {
                const m = data.current_model;
                if (m) {
                    metricVersion.textContent = m.run_name || m.data_version || '--';
                    metricMse.textContent = m.metrics.best_val_mse ? m.metrics.best_val_mse.toFixed(4) : '--';
                    metricHitRate.textContent = m.metrics.hit_rate_10 ? (m.metrics.hit_rate_10 * 100).toFixed(1) + '%' : '--';
                    metricNdcg.textContent = m.metrics.ndcg_10 ? m.metrics.ndcg_10.toFixed(4) : '--';
                }
                updateBadge(data.training_status);
            })
            .catch(err => console.warn('[admin] status error:', err));
    }

    function updateBadge(status) {
        const training = status === 'training';
        const isError = status === 'error';
        if (training) {
            trainingBadge.style.background = 'rgba(0,164,220,0.15)';
            trainingBadge.style.color = '#00a4dc';
            trainingBadge.textContent = '● Training…';
        } else if (isError) {
            trainingBadge.style.background = 'rgba(231,76,60,0.15)';
            trainingBadge.style.color = '#e74c3c';
            trainingBadge.textContent = '● Error';
        } else {
            trainingBadge.style.background = 'rgba(46,204,113,0.15)';
            trainingBadge.style.color = '#2ecc71';
            trainingBadge.textContent = '● Ready';
        }
        [retrainBtn, retrainBtn2].forEach(btn => {
            if (!btn) return;
            btn.disabled = training;
        });
    }

    function loadDatasets() {
        return fetch(`${REC_API_BASE}/api/datasets`)
            .then(r => r.json())
            .then(data => {
                const versions = data.versions || [];
                if (!versions.length) {
                    datasetSelect.innerHTML = '<option>No datasets found</option>';
                    return;
                }
                datasetSelect.innerHTML = versions.map(v => {
                    const label = v === 'v0001' ? `${v}  (Full Dataset)` : v;
                    return `<option value="${v}"${v === data.current ? ' selected' : ''}>${label}</option>`;
                }).join('');
            })
            .catch(err => {
                console.warn('[admin] datasets error:', err);
                datasetSelect.innerHTML = '<option>Error loading datasets</option>';
            });
    }

    function doRetrain() {
        const version = datasetSelect.value;
        const baseModel = modelTypeSelect.value;

        if (!version || version.startsWith('No datasets') || version.startsWith('Error')) {
            retrainStatus.style.color = '#ff6b6b';
            retrainStatus.textContent = 'Select a valid dataset version first';
            return;
        }

        retrainStatus.style.color = '';
        retrainStatus.textContent = 'Starting…';
        updateBadge('training');

        const url = `${REC_API_BASE}/api/retrain/${encodeURIComponent(version)}?base_model=${baseModel}`;
        fetch(url, { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    retrainStatus.style.color = '#ff6b6b';
                    retrainStatus.textContent = `Error: ${data.error}`;
                    updateBadge('error');
                } else {
                    retrainStatus.style.color = '#00a4dc';
                    retrainStatus.textContent = data.message || 'Training started';
                    startPollingLogs();
                }
            })
            .catch(err => {
                retrainStatus.style.color = '#ff6b6b';
                retrainStatus.textContent = `Error: ${err.message}`;
                updateBadge('idle');
            });
    }

    retrainBtn.addEventListener('click', doRetrain);
    retrainBtn2.addEventListener('click', doRetrain);

    function loadLogs() {
        return fetch(`${REC_API_BASE}/api/logs`)
            .then(r => r.json())
            .then(data => {
                const logs = data.logs || [];
                if (!logs.length) return;
                logBox.innerHTML = logs.map((line, i) => {
                    let color = 'rgba(255,255,255,0.6)';
                    if (/error|failed/i.test(line)) color = '#e74c3c';
                    else if (/complete|done|success|new best/i.test(line)) color = '#2ecc71';
                    else if (/epoch/i.test(line)) color = '#00a4dc';
                    return `<div style="color:${color}; white-space: pre-wrap; word-break: break-all;">`
                        + `<span style="color:rgba(255,255,255,0.22);">[${String(i).padStart(2, '0')}]</span> `
                        + escHtml(line) + '</div>';
                }).join('');
                logBox.scrollTop = logBox.scrollHeight;

                updateBadge(data.status);
                if (data.status !== 'training') {
                    stopPollingLogs();
                    if (data.status === 'idle') {
                        loadStatus();
                        loadHistory();
                        retrainStatus.style.color = '#2ecc71';
                        retrainStatus.textContent = 'Training completed successfully!';
                    }
                }
            })
            .catch(err => console.warn('[admin] logs error:', err));
    }

    function startPollingLogs() {
        stopPollingLogs();
        loadLogs();
        pollTimer = setInterval(loadLogs, 2000);
    }

    function stopPollingLogs() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    clearLogsBtn.addEventListener('click', () => {
        logBox.innerHTML = '';
    });

    function loadHistory() {
        return fetch(`${REC_API_BASE}/api/history`)
            .then(r => r.json())
            .then(data => {
                const runs = data.runs || [];
                if (!runs.length) {
                    historyList.innerHTML = '<p style="opacity:0.45; font-size:0.9em;">No training runs found.</p>';
                    return;
                }
                historyList.innerHTML = runs.map((r, i) => {
                    const name = escHtml(r.run_name || r.data_version || '--');
                    const dv = escHtml(r.data_version || '--');
                    const time = escHtml(r.start_time || '--');
                    const mse = r.metrics.best_val_mse ? r.metrics.best_val_mse.toFixed(4) : '--';
                    const hr = r.metrics.hit_rate_10 ? (r.metrics.hit_rate_10 * 100).toFixed(1) + '%' : '--';
                    const ndcg = r.metrics.ndcg_10 ? r.metrics.ndcg_10.toFixed(4) : '--';
                    const isLast = i === 0;
                    const mlflowLink = r.mlflow_url ?
                        `<a href="${escHtml(r.mlflow_url)}" target="_blank"
                               style="font-size:0.82em; color:#00a4dc; text-decoration:none; padding:4px 10px; border:1px solid #00a4dc; border-radius:4px;">MLflow ↗</a>` :
                        '';
                    const rollbackBtn = !isLast ?
                        `<button class="adminRollbackBtn"
                                    data-version="${escHtml(r.data_version || r.run_name || '')}"
                                    style="font-size:0.82em; padding:4px 12px; border:1px solid rgba(243,156,18,0.6); border-radius:4px; background:transparent; color:rgba(243,156,18,0.9); cursor:pointer;">
                               Rollback
                           </button>` :
                        '';
                    return `
                        <div style="background: rgba(255,255,255,${isLast ? '0.07' : '0.04'}); border-radius:8px; padding:1.1em 1.3em; margin-bottom:0.9em; border-left: 3px solid ${isLast ? '#00a4dc' : 'transparent'};">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:0.7em;">
                                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                    <span style="font-size:1em; font-weight:700;">${name}</span>
                                    ${isLast ? '<span style="font-size:0.72em; background:rgba(0,164,220,0.2); color:#00a4dc; padding:2px 8px; border-radius:10px;">LATEST</span>' : ''}
                                    <span style="font-size:0.78em; opacity:0.55;">data: ${dv} · ${time}</span>
                                </div>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    ${rollbackBtn}
                                    ${mlflowLink}
                                </div>
                            </div>
                            <div style="display:flex; gap:2em; flex-wrap:wrap; font-size:0.84em;">
                                <div><span style="opacity:0.55;">Val MSE:</span> <strong>${mse}</strong></div>
                                <div><span style="opacity:0.55;">Hit Rate@10:</span> <strong>${hr}</strong></div>
                                <div><span style="opacity:0.55;">NDCG@10:</span> <strong>${ndcg}</strong></div>
                            </div>
                        </div>
                    `;
                }).join('');

                historyList.querySelectorAll('.adminRollbackBtn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const ver = btn.dataset.version;
                        if (window.confirm(`Roll back model to version "${ver}"?`)) {
                            doRollback(ver, btn);
                        }
                    });
                });
            })
            .catch(err => {
                historyList.innerHTML = `<p style="color:#ff6b6b;">Error: ${err.message}</p>`;
            });
    }

    function doRollback(version, btn) {
        btn.disabled = true;
        btn.textContent = 'Rolling back…';
        fetch(`${REC_API_BASE}/api/rollback/${encodeURIComponent(version)}`, { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    alert(`Rollback failed: ${data.error}`);
                    btn.disabled = false;
                    btn.textContent = 'Rollback';
                } else {
                    loadStatus();
                    loadHistory();
                }
            })
            .catch(err => {
                alert(`Rollback error: ${err.message}`);
                btn.disabled = false;
                btn.textContent = 'Rollback';
            });
    }

    scheduleEnabled.addEventListener('change', () => {
        scheduleEnabledLabel.textContent = scheduleEnabled.checked ? 'Enabled' : 'Disabled';
    });

    function loadSchedule() {
        return fetch(`${REC_API_BASE}/api/schedule`)
            .then(r => r.json())
            .then(data => {
                scheduleEnabled.checked = !!data.enabled;
                scheduleEnabledLabel.textContent = data.enabled ? 'Enabled' : 'Disabled';
                if (data.interval) scheduleInterval.value = data.interval;
                if (data.time) scheduleTime.value = data.time;
            })
            .catch(err => console.warn('[admin] schedule error:', err));
    }

    saveScheduleBtn.addEventListener('click', () => {
        scheduleStatus.style.color = '';
        scheduleStatus.textContent = 'Saving…';
        const url = `${REC_API_BASE}/api/schedule`
            + `?enabled=${scheduleEnabled.checked}`
            + `&interval=${scheduleInterval.value}`
            + `&time_utc=${encodeURIComponent(scheduleTime.value)}`;
        fetch(url, { method: 'POST' })
            .then(r => r.json())
            .then(() => {
                scheduleStatus.style.color = '#2ecc71';
                scheduleStatus.textContent = '✓ Saved';
                setTimeout(() => {
                    scheduleStatus.textContent = '';
                }, 3000);
            })
            .catch(err => {
                scheduleStatus.style.color = '#ff6b6b';
                scheduleStatus.textContent = `Error: ${err.message}`;
            });
    });

    function escHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    view.addEventListener('viewshow', function () {
        loadStatus();
        loadDatasets();
        loadHistory();
        loadLogs();
        loadSchedule();
    });

    view.addEventListener('viewhide', function () {
        stopPollingLogs();
    });
}
