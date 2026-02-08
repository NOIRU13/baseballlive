// API設定 (Docker環境では同一オリジンからnginxがプロキシ)
const API_BASE = '/api';

// DOM読み込み完了時
document.addEventListener('DOMContentLoaded', () => {
    loadTeams();
    loadPlayers();
    
    document.getElementById('team-form').addEventListener('submit', handleTeamSubmit);
    document.getElementById('player-form').addEventListener('submit', handlePlayerSubmit);
});

// ==================== チーム管理 ====================

// チーム一覧読み込み
async function loadTeams() {
    try {
        const res = await fetch(`${API_BASE}/teams`);
        const teams = await res.json();
        
        const tbody = document.querySelector('#teams-table tbody');
        tbody.innerHTML = '';
        
        const playerTeamSelect = document.getElementById('player-team-select');
        const filterTeamSelect = document.getElementById('filter-team-select');
        
        // 既存のオプションを保持するかリセットするか
        // フィルタは "全チーム" を残す
        filterTeamSelect.innerHTML = '<option value="">全チーム</option>';
        playerTeamSelect.innerHTML = '';

        teams.forEach(team => {
            // テーブル行追加
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${team.id}</td>
                <td>${team.name}</td>
                <td>${team.short_name}</td>
                <td>
                    <button class="edit-btn" onclick="editTeam(${team.id}, '${team.name}', '${team.short_name}')">編集</button>
                    <button class="danger-btn" onclick="deleteTeam(${team.id})">削除</button>
                </td>
            `;
            tbody.appendChild(tr);

            // セレクトボックスに追加
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            playerTeamSelect.appendChild(option.cloneNode(true));
            filterTeamSelect.appendChild(option);
        });
    } catch (err) {
        console.error('チーム読み込みエラー:', err);
    }
}

// チーム送信処理
async function handleTeamSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('team-id').value;
    const name = document.getElementById('team-name').value;
    const short_name = document.getElementById('team-short-name').value;
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/teams/${id}` : `${API_BASE}/teams`;
    
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, short_name })
        });
        
        if (res.ok) {
            resetTeamForm();
            loadTeams(); // リロード
            // チームが変われば選手リストの表示も更新が必要かも（チーム名表示のため）
            loadPlayers();
        } else {
            alert('保存に失敗しました');
        }
    } catch (err) {
        console.error(err);
        alert('エラーが発生しました');
    }
}

// チーム編集モードへ
window.editTeam = (id, name, shortName) => {
    document.getElementById('team-id').value = id;
    document.getElementById('team-name').value = name;
    document.getElementById('team-short-name').value = shortName;
    document.querySelector('#team-form button[type="submit"]').textContent = '更新';
};

// チームフォームリセット
window.resetTeamForm = () => {
    document.getElementById('team-id').value = '';
    document.getElementById('team-name').value = '';
    document.getElementById('team-short-name').value = '';
    document.querySelector('#team-form button[type="submit"]').textContent = '保存';
};

// チーム削除
window.deleteTeam = async (id) => {
    if (!confirm('本当に削除しますか？ 所属する選手も削除される可能性があります。')) return;
    
    try {
        const res = await fetch(`${API_BASE}/teams/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadTeams();
            loadPlayers();
        } else {
            alert('削除できませんでした');
        }
    } catch (err) {
        alert('エラーが発生しました');
    }
};

// ==================== 選手管理 ====================

// 選手一覧読み込み
async function loadPlayers() {
    try {
        const filterTeamId = document.getElementById('filter-team-select').value;
        let url = `${API_BASE}/players`;
        if (filterTeamId) {
            url += `?team_id=${filterTeamId}`;
        }
        
        const res = await fetch(url);
        const players = await res.json();
        
        const tbody = document.querySelector('#players-table tbody');
        tbody.innerHTML = '';
        
        players.forEach(player => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${player.number || '-'}</td>
                <td>${player.name}</td>
                <td>${player.position || '-'}</td>
                <td>${player.hand || '-'}</td>
                <td>${player.team_name}</td>
                <td>
                    <button class="edit-btn" onclick="editPlayer(${player.id}, ${player.team_id}, '${player.name}', '${player.number || ''}', '${player.position || ''}', '${player.hand || ''}')">編集</button>
                    <button class="danger-btn" onclick="deletePlayer(${player.id})">削除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('選手読み込みエラー:', err);
    }
}

// 選手一覧リロード（フィルタ変更時用）
window.loadPlayers = loadPlayers;

// 選手送信処理
async function handlePlayerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('player-id').value;
    
    const data = {
        team_id: document.getElementById('player-team-select').value,
        name: document.getElementById('player-name').value,
        number: document.getElementById('player-number').value,
        position: document.getElementById('player-position').value,
        hand: document.getElementById('player-hand').value
    };
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/players/${id}` : `${API_BASE}/players`;
    
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            resetPlayerForm();
            loadPlayers();
        } else {
            alert('保存に失敗しました');
        }
    } catch (err) {
        console.error(err);
        alert('エラーが発生しました');
    }
}

// 選手編集モードへ
window.editPlayer = (id, teamId, name, number, position, hand) => {
    document.getElementById('player-id').value = id;
    document.getElementById('player-team-select').value = teamId;
    document.getElementById('player-name').value = name;
    document.getElementById('player-number').value = number;
    document.getElementById('player-position').value = position;
    document.getElementById('player-hand').value = hand;
    document.querySelector('#player-form button[type="submit"]').textContent = '更新';
    
    // タブ切り替え（もし別のタブにいたら）
    showTab('players');
};

// 選手フォームリセット
window.resetPlayerForm = () => {
    document.getElementById('player-id').value = '';
    document.getElementById('player-name').value = '';
    document.getElementById('player-number').value = '';
    document.getElementById('player-hand').value = '';
    // team_select, positionはそのままにするか、初期値に戻すか。ここではそのまま
    document.querySelector('#player-form button[type="submit"]').textContent = '保存';
};

// 選手削除
window.deletePlayer = async (id) => {
    if (!confirm('本当に削除しますか？')) return;
    
    try {
        const res = await fetch(`${API_BASE}/players/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadPlayers();
        } else {
            alert('削除できませんでした');
        }
    } catch (err) {
        alert('エラーが発生しました');
    }
};
// ==================== 成績管理 ====================

const STATS_API_BASE = '/api';
let currentStatsData = []; // 編集用にデータを保持

// CSVアップロード
async function uploadCsv() {
    const fileInput = document.getElementById('csv-file');
    const typeSelect = document.getElementById('import-type');
    const statusDiv = document.getElementById('upload-status');

    if (!fileInput.files[0]) {
        alert('ファイルを選択してください');
        return;
    }

    const formData = new FormData();
    formData.append('csv', fileInput.files[0]);
    formData.append('type', typeSelect.value);

    statusDiv.textContent = 'アップロード中...';
    statusDiv.style.color = '#fff';

    try {
        const response = await fetch(`${STATS_API_BASE}/import-csv`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
            statusDiv.textContent = `成功: ${data.message}`;
            statusDiv.style.color = '#2ecc71';
            // 該当する成績を表示更新
            if (typeSelect.value === 'batting' || typeSelect.value === 'pitching') {
                switchStatsTab(typeSelect.value);
            }
        } else {
            statusDiv.textContent = `エラー: ${data.error}`;
            statusDiv.style.color = '#e74c3c';
        }
    } catch (error) {
        console.error('Error:', error);
        statusDiv.textContent = `通信エラー: ${error.message}`;
        statusDiv.style.color = '#e74c3c';
    }
}

// CSVエクスポート
function exportCsv(type) {
    if (!type) {
        return;
    }
    window.location.href = `${STATS_API_BASE}/export-csv?type=${type}`;
}

// 成績タブ切り替え
function switchStatsTab(type) {
    // タブボタンのアクティブ化
    document.getElementById('btn-stats-batting').classList.remove('active');
    document.getElementById('btn-stats-pitching').classList.remove('active');
    document.getElementById(`btn-stats-${type}`).classList.add('active');

    // フォームの表示切り替え
    document.getElementById('stats-type').value = type;
    if (type === 'batting') {
        document.getElementById('batting-fields').style.display = 'block';
        document.getElementById('pitching-fields').style.display = 'none';
    } else {
        document.getElementById('batting-fields').style.display = 'none';
        document.getElementById('pitching-fields').style.display = 'block';
    }

    loadStats(type);
}

// 成績用選手リスト読み込み
async function loadPlayersForStats(teamId) {
    const select = document.getElementById('stats-player-select');
    select.innerHTML = '<option value="">読み込み中...</option>';

    if (!teamId) {
        select.innerHTML = '<option value="">（チームを選択してください）</option>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/players?team_id=${teamId}`);
        const players = await res.json();
        
        select.innerHTML = '<option value="">選択してください</option>';
        players.forEach(p => {
             const option = document.createElement('option');
             option.value = p.id;
             option.textContent = `${p.name} (#${p.number || ''})`;
             select.appendChild(option);
        });
    } catch(e) {
        console.error('選手リスト読み込みエラー(Stats)', e);
        select.innerHTML = '<option value="">エラー</option>';
    }
}

// 成績読み込み
async function loadStats(type) {
    try {
        const res = await fetch(`${STATS_API_BASE}/${type}-stats`);
        const stats = await res.json();
        currentStatsData = stats; // グローバル保持
        
        renderStatsTable(stats, type);
    } catch (err) {
        console.error('成績読み込みエラー:', err);
    }
}

// 成績テーブル描画
function renderStatsTable(stats, type) {
    const table = document.getElementById('stats-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">データがありません</td></tr>';
        return;
    }
    
    // ヘッダー生成
    const trHead = document.createElement('tr');
    
    // 共通カラム
    const headers = [
        { key: 'season', label: '年度' },
        { key: 'team_name', label: 'チーム' },
        { key: 'player_name', label: '選手名' }
    ];
    
    if (type === 'batting') {
        headers.push(
            { key: 'batting_average', label: '打率' },
            { key: 'games', label: '試合' },
            { key: 'at_bats', label: '打数' },
            { key: 'hits', label: '安打' },
            { key: 'home_runs', label: '本塁打' },
            { key: 'rbis', label: '打点' },
            { key: 'ops', label: 'OPS' }
        );
    } else {
        headers.push(
            { key: 'era', label: '防御率' },
            { key: 'games', label: '登板' },
            { key: 'wins', label: '勝利' },
            { key: 'losses', label: '敗北' },
            { key: 'saves', label: 'セーブ' },
            { key: 'innings_pitched', label: '回' },
            { key: 'strikeouts', label: '奪三振' }
        );
    }
    
    // 操作カラム
    headers.push({ key: 'action', label: '操作' });

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    
    // ボディ生成
    stats.forEach((row, index) => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            if (h.key === 'action') {
                td.innerHTML = `
                    <button class="edit-btn" onclick="editStats(${index})">編集</button>
                    <button class="danger-btn" onclick="deleteStats(${row.stat_id}, '${type}')">削除</button>
                `;
            } else {
                let val = row[h.key];
                if (val === null) val = '-';
                td.textContent = val;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// 成績編集モード (index: currentStatsDataのインデックス)
window.editStats = async (index) => {
    const data = currentStatsData[index];
    if (!data) return;

    // フォームに値をセット
    document.getElementById('stats-id').value = data.stat_id;
    document.getElementById('stats-season').value = data.season;

    // チームをセットして選手リスト読み込み
    const teamSelect = document.getElementById('stats-form-team-select');
    if (data.team_id) {
        teamSelect.value = data.team_id;
        await loadPlayersForStats(data.team_id);
        document.getElementById('stats-player-select').value = data.player_id;
    } else {
        // team_idがない場合のフォールバック（全読み込みなどはしないのでエラーになるかも）
        console.warn('team_id not found in stats data');
    }

    const type = document.getElementById('stats-type').value;

    if (type === 'batting') {
        document.getElementById('stats-batting-average').value = data.batting_average;
        document.getElementById('stats-games-b').value = data.games;
        document.getElementById('stats-at-bats').value = data.at_bats;
        document.getElementById('stats-hits').value = data.hits;
        document.getElementById('stats-home-runs').value = data.home_runs;
        document.getElementById('stats-rbis').value = data.rbis;
        document.getElementById('stats-ops').value = data.ops;
    } else {
        document.getElementById('stats-era').value = data.era;
        document.getElementById('stats-games-p').value = data.games;
        document.getElementById('stats-wins').value = data.wins;
        document.getElementById('stats-losses').value = data.losses;
        document.getElementById('stats-saves').value = data.saves;
        document.getElementById('stats-innings').value = data.innings_pitched;
        document.getElementById('stats-strikeouts').value = data.strikeouts;
    }

    document.querySelector('#stats-form button[type="submit"]').textContent = '更新';
    
    // フォームへスクロール
    document.getElementById('stats-form').scrollIntoView({ behavior: 'smooth' });
};

// 成績フォームリセット
window.resetStatsForm = () => {
    document.getElementById('stats-id').value = '';
    
    document.getElementById('stats-form-team-select').value = '';
    document.getElementById('stats-player-select').innerHTML = '<option value="">（チームを選択してください）</option>';

    // 各フィールドクリア
    const inputs = document.querySelectorAll('#stats-form input:not([type="hidden"]):not(#stats-season)');
    inputs.forEach(input => input.value = '');
    
    document.querySelector('#stats-form button[type="submit"]').textContent = '保存';
};

// 成績送信処理
async function handleStatsSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('stats-id').value;
    const type = document.getElementById('stats-type').value; // batting or pitching

    const data = {
        player_id: document.getElementById('stats-player-select').value,
        season: document.getElementById('stats-season').value
    };

    if (type === 'batting') {
        data.batting_average = document.getElementById('stats-batting-average').value;
        data.games = document.getElementById('stats-games-b').value;
        data.at_bats = document.getElementById('stats-at-bats').value;
        data.hits = document.getElementById('stats-hits').value;
        data.home_runs = document.getElementById('stats-home-runs').value;
        data.rbis = document.getElementById('stats-rbis').value;
        data.ops = document.getElementById('stats-ops').value;
    } else {
        data.era = document.getElementById('stats-era').value;
        data.games = document.getElementById('stats-games-p').value;
        data.wins = document.getElementById('stats-wins').value;
        data.losses = document.getElementById('stats-losses').value;
        data.saves = document.getElementById('stats-saves').value;
        data.innings_pitched = document.getElementById('stats-innings').value;
        data.strikeouts = document.getElementById('stats-strikeouts').value;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${STATS_API_BASE}/${type}-stats/${id}` : `${STATS_API_BASE}/${type}-stats`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            resetStatsForm();
            loadStats(type);
        } else {
            const errJson = await res.json();
            alert('保存に失敗しました: ' + (errJson.error || '不明なエラー'));
        }
    } catch (err) {
        console.error(err);
        alert('エラーが発生しました');
    }
}

// 成績削除処理
window.deleteStats = async (id, type) => {
    if (!confirm('本当に削除しますか？')) return;

    try {
        const res = await fetch(`${STATS_API_BASE}/${type}-stats/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadStats(type);
        } else {
            alert('削除できませんでした');
        }
    } catch (err) {
        alert('エラーが発生しました');
    }
}


// 成績用チームリスト読み込み
async function loadStatsTeams() {
    try {
        const res = await fetch(`${API_BASE}/teams`);
        const teams = await res.json();
        
        // チーム別リセット用のセレクトボックス
        const selectFilter = document.getElementById('stats-team-filter');
        selectFilter.innerHTML = '<option value="">（選択してください）</option>';

        // マニュアル登録・編集用のセレクトボックス
        const selectForm = document.getElementById('stats-form-team-select');
        selectForm.innerHTML = '<option value="">（チームを選択してください）</option>';
        
        teams.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            
            selectFilter.appendChild(option.cloneNode(true));
            selectForm.appendChild(option);
        });

        // 変更イベント (リセットボタン)
        selectFilter.addEventListener('change', (e) => {
            const btn = document.getElementById('btn-reset-team-stats');
            btn.disabled = !e.target.value;
            // 将来的にフィルタリングを入れるならここで loadStats を呼ぶ
        });
    } catch(e) {
        console.error('チームリスト読み込みエラー(Stats)', e);
    }
}

// チーム成績一括削除
// バッティング・投手成績の両方を削除するか、選択式にするか。
// 要望は「チームの成績をオールリセット」なので、両方消すのが自然。
window.resetTeamStats = async () => {
    const teamId = document.getElementById('stats-team-filter').value;
    if (!teamId) return;

    if (!confirm('【警告】\n選択したチームの成績データ（打撃・投手すべて）を完全に削除します。\n本当によろしいですか？')) {
        return;
    }

    try {
        // 打撃成績削除
        const resBat = await fetch(`${STATS_API_BASE}/batting-stats?team_id=${teamId}`, { method: 'DELETE' });
        // 投手成績削除
        const resPitch = await fetch(`${STATS_API_BASE}/pitching-stats?team_id=${teamId}`, { method: 'DELETE' });

        if (resBat.ok && resPitch.ok) {
            alert('成績データを削除しました。');
            // 表示更新（現在表示中のタブの再読み込み）
            const currentType = document.getElementById('stats-type').value;
            loadStats(currentType);
        } else {
            alert('一部の削除に失敗しました。');
        }
    } catch (err) {
        console.error(err);
        alert('エラーが発生しました');
    }
};

// グローバルスコープに公開
window.uploadCsv = uploadCsv;
window.exportCsv = exportCsv;
window.loadStats = loadStats;
window.switchStatsTab = switchStatsTab;
window.resetTeamStats = resetTeamStats;

// DB管理タブ内でのサブタブ切り替え (Teams/Players/Stats)
window.showDbTab = function(tabName) {
    // DBタブ内のコンテンツのみを対象にする
    const dbContainer = document.getElementById('tab-db');
    if (!dbContainer) return;

    dbContainer.querySelectorAll('.db-tab-content').forEach(el => el.classList.remove('active'));
    dbContainer.querySelectorAll('.db-tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetContent = document.getElementById(tabName + '-tab');
    if (targetContent) targetContent.classList.add('active');
    
    // ボタンのアクティブ化（簡易判定）
    if(tabName === 'teams') document.querySelector('.db-tab-btn[onclick*="teams"]').classList.add('active');
    if(tabName === 'players') document.querySelector('.db-tab-btn[onclick*="players"]').classList.add('active');
    if(tabName === 'stats') {
        document.querySelector('.db-tab-btn[onclick*="stats"]').classList.add('active');
        switchStatsTab('batting');
    }
};

// DOM読み込み完了時の追加処理
document.addEventListener('DOMContentLoaded', () => {
    loadPlayersForStats();
    loadStatsTeams(); // 追加
    const statsForm = document.getElementById('stats-form');
    if (statsForm) statsForm.addEventListener('submit', handleStatsSubmit);
});
