const API_BASE = 'http://localhost:3000/api';

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
