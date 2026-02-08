/**
 * 表示更新モジュール
 */
import { RESULT_LABELS, POSITIONS } from '../data/constants.js';
import * as GameLogic from '../logic/game.js';

/**
 * 全ての表示を更新する
 * @param {Object} state 
 * @param {boolean} isAdminMode 
 * @param {boolean} isDisplayMode 
 */
export function updateDisplay(state, isAdminMode, isDisplayMode) {
    updateTeamDisplay(state);
    updateInningDisplay(state);
    updateCountDisplay(state);
    updateRunnerDisplay(state);
    updateScoreDisplay(state);
    updateRHEDisplay(state);
    updateControlPanel(state, isAdminMode);
    updateLineupDisplay(state, isAdminMode); // AdminMode判定内でID切り替えなどは関数内で行う
    updateCurrentBatterDisplay(state, isAdminMode);
    updateBottomStats(state, isDisplayMode);
}

/**
 * チーム名の表示を更新
 */
export function updateTeamDisplay(state) {
    // サイドバー
    setText('sidebar-away-name', state.teams.away);
    setText('sidebar-home-name', state.teams.home);
    // スコアボード（コード）
    setText('score-away-code', state.teams.away);
    setText('score-home-code', state.teams.home);
    // Admin
    const adminAway = document.querySelector('#team-away-display .team-name');
    const adminHome = document.querySelector('#team-home-display .team-name');
    if (adminAway) adminAway.textContent = state.teams.away;
    if (adminHome) adminHome.textContent = state.teams.home;
    // Line Score Table (Bottom)
    setText('team-name-away', state.teams.away);
    setText('team-name-home', state.teams.home);
}

/**
 * イニング表示を更新
 */
export function updateInningDisplay(state) {
    const halfSymbol = state.inning.half === 'top' ? '\u25B2' : '\u25BC';
    const halfText = state.inning.half === 'top' ? '\u8868' : '\u88CF';
    
    setText('inning-half', halfText);
    setText('inning-number', state.inning.number);
    setText('inning-info', state.inning.number + '\u56DE ' + halfText);
}

/**
 * カウント表示を更新
 */
export function updateCountDisplay(state) {
    updateDots('ball-dots', state.count.ball);
    updateDots('strike-dots', state.count.strike);
    updateDots('out-dots', state.count.out);
}

function updateDots(containerId, count) {
    const dots = document.querySelectorAll(`#${containerId} .dot`);
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i < count);
    });
}

/**
 * ランナー表示を更新
 */
export function updateRunnerDisplay(state) {
    // Display Mode (index.html)
    toggleClass('runner-first', 'active', state.runners.first);
    toggleClass('runner-second', 'active', state.runners.second);
    toggleClass('runner-third', 'active', state.runners.third);

    // Admin Mode (admin-simple.html) & Control Panel (admin-control.html)
    // admin-simple.html uses btn-runner-1/2/3
    toggleClass('btn-runner-1', 'active', state.runners.first);
    toggleClass('btn-runner-2', 'active', state.runners.second);
    toggleClass('btn-runner-3', 'active', state.runners.third);
}

/**
 * 得点表示を更新
 */
export function updateScoreDisplay(state) {
    const awayTotal = state.scores.away.reduce((sum, s) => sum + s, 0);
    const homeTotal = state.scores.home.reduce((sum, s) => sum + s, 0);

    // 1-9回
    for (let i = 0; i < 9; i++) {
        const awayScore = state.scores.away[i];
        const homeScore = state.scores.home[i];
        
        let awayText = '';
        let homeText = '';
        
        if ((i + 1) < state.inning.number) {
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
        } else if ((i + 1) === state.inning.number) {
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            if (state.inning.half === 'bottom') {
                homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
            }
        }

        setText('score-away-' + (i + 1), awayText);
        setText('score-home-' + (i + 1), homeText);
    }

    setText('score-away-total', awayTotal);
    setText('score-home-total', homeTotal);
    setText('away-total', awayTotal);
    setText('home-total', homeTotal);

    // RHEのRも更新（ステート同期）
    state.stats.away.r = awayTotal;
    state.stats.home.r = homeTotal;
}

/**
 * R (Run/Score), H (Hit), E (Error) の表示を更新
 */
export function updateRHEDisplay(state) {
    setText('stats-away-h', state.stats.away.h);
    setText('stats-home-h', state.stats.home.h);
    setText('stats-away-e', state.stats.away.e);
    setText('stats-home-e', state.stats.home.e);
}

/**
 * コントロールパネル（Admin）の更新
 */
export function updateControlPanel(state, isAdminMode) {
    if (!isAdminMode) return;

    const team = state.inning.half === 'top' ? 'away' : 'home';
    const teamName = state.teams[team];
    setText('scoring-team-label', teamName + '（攻撃）');

    const inningIndex = state.inning.number - 1;
    if (inningIndex >= 0 && inningIndex < state.scores[team].length) {
        setText('current-inning-score', state.scores[team][inningIndex]);
    }

    // 投手成績入力フィールド
    if (state.pitcherStats) {
        setValue('pitcher-innings-away', state.pitcherStats.away.innings || 0);
        setValue('pitcher-k-away', state.pitcherStats.away.strikeouts || 0);
        setValue('pitcher-runs-away', state.pitcherStats.away.runs || 0);
        setValue('pitcher-innings-home', state.pitcherStats.home.innings || 0);
        setValue('pitcher-k-home', state.pitcherStats.home.strikeouts || 0);
        setValue('pitcher-runs-home', state.pitcherStats.home.runs || 0);
    }
}

/**
 * 下部スタッツ・情報バー更新
 */
export function updateBottomStats(state, isDisplayMode) {
    if (!isDisplayMode) return;
    
    const offenseTeam = state.inning.half === 'top' ? 'away' : 'home';
    const defenseTeam = state.inning.half === 'top' ? 'home' : 'away';

    // BATTER
    const batterIndex = state.currentBatter[offenseTeam];
    const batterName = state.lineup[offenseTeam][batterIndex] || '---';
    setText('current-batter-name', batterName);
    setText('batter-name-large', batterName);

    // PITCHER
    let pitcherName = '---';
    const dhPitcherInput = (state.pitcher && state.pitcher[defenseTeam]) ? state.pitcher[defenseTeam] : '';
    
    if (dhPitcherInput && dhPitcherInput.trim() !== '') {
        pitcherName = dhPitcherInput;
    } else {
        let pitcherInLineup = false;
        if (state.positions && state.positions[defenseTeam]) {
            for (let i = 0; i < 9; i++) {
                if (state.positions[defenseTeam][i] === '投') {
                    pitcherName = state.lineup[defenseTeam][i] || '投手';
                    pitcherInLineup = true;
                    break;
                }
            }
        }
        if (!pitcherInLineup) pitcherName = '投手';
    }
    setText('current-pitcher-name', pitcherName);
    setText('pitcher-name-large', pitcherName);

    // 打者の当日成績
    const batterStatsToday = document.getElementById('batter-stats-today');
    if (batterStatsToday) {
        batterStatsToday.innerHTML = '';
        const results = state.atBatResults[offenseTeam][batterIndex] || [];
        results.forEach(code => {
            const label = RESULT_LABELS[code] || code;
            const span = document.createElement('span');
            span.className = 'stat-badge';
            span.textContent = label;
            batterStatsToday.appendChild(span);
        });
    }

    // 投手成績
    GameLogic.updatePitcherStats(state, defenseTeam);
    if (state.pitcherStats && state.pitcherStats[defenseTeam]) {
        const innings = state.pitcherStats[defenseTeam].innings || 0;
        setText('pitcher-innings', innings.toFixed(1));
        setText('pitcher-strikeouts', state.pitcherStats[defenseTeam].strikeouts || 0);
        setText('pitcher-runs', state.pitcherStats[defenseTeam].runs || 0);
    }
}

/**
 * 打順ボードの表示を更新
 */
export function updateLineupDisplay(state, isAdminMode) {
    ['away', 'home'].forEach(team => {
        let container = document.getElementById('lineup-' + team + '-display');
        if (!container) {
             container = document.getElementById(team + '-lineup'); // Admin互換
        }
        if (!container) return;
        
        // AdminModeで入力フィールド生成済みの場合は、別の関数(generateLineupInputs)で処理されているはずだが、
        // Admin画面の左側（表示確認用）などの更新もある。
        // ここでは「表示用」の更新を行う。
        // もし container が input を含むフォームなら上書きしてはいけない。
        // lineup-item クラスを持つ div が直下にあるか、あるいは中身が空なら描画。
        // Check if this container is intended for display (not inputs)
        // Admin page has #lineup-input-home/away for inputs, and #home/away-lineup for display?
        // Let's check admin.html structure.
        // admin.html: <div id="away-lineup" class="lineup-board">...</div>
        // admin.html also has: <div id="lineup-input-away">...</div>
        
        // So #away-lineup is for display.
        
        container.innerHTML = '';
        const currentBatterIndex = state.currentBatter[team];
        const isAttacking = (state.inning.half === 'top' && team === 'away') ||
                            (state.inning.half === 'bottom' && team === 'home');
                         
        for (let i = 0; i < 9; i++) {
            const playerName = state.lineup[team][i] || ((i + 1) + '\u756A');
            const pos = (state.positions && state.positions[team][i]) ? state.positions[team][i] : '';
            const isActive = isAttacking && i === currentBatterIndex;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lineup-item' + (isActive ? ' active' : '');
            
            playerDiv.innerHTML = '<span class="order-num">' + (i + 1) + '</span>' +
                '<span class="player-pos">' + pos + '</span>' +
                '<span class="player-name">' + playerName + '</span>';
            container.appendChild(playerDiv);
        }

        // Pitcher Display
        if (state.pitcher && state.pitcher[team]) {
            const pitcherName = state.pitcher[team];
            if (pitcherName) {
                const pitcherDiv = document.createElement('div');
                pitcherDiv.className = 'lineup-item pitcher-item';
                
                pitcherDiv.innerHTML = '<span class="order-num">P</span>' +
                    '<span class="player-pos">投</span>' +
                    '<span class="player-name">' + pitcherName + '</span>';
                container.appendChild(pitcherDiv);
            }
        }
    });

    // 入力フォームの値も同期（Adminのみ）
    if (isAdminMode) {
        syncLineupInputs(state);
    }
}

/**
 * Admin入力フォームの値を同期
 */
function syncLineupInputs(state) {
    ['away', 'home'].forEach(team => {
        for (let i = 0; i < 9; i++) {
            const nameInput = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${i}"]`);
            if (nameInput && document.activeElement !== nameInput) {
                nameInput.value = state.lineup[team][i] || '';
            }
            const posSelect = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${i}"]`);
            if (posSelect && document.activeElement !== posSelect) {
                 if (state.positions && state.positions[team][i]) {
                    posSelect.value = state.positions[team][i];
                 }
            }
        }
        // Pitcher
        const pInput = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
        if (pInput && document.activeElement !== pInput) {
            pInput.value = state.pitcher ? (state.pitcher[team] || '') : '';
        }
    });
}

/**
 * 現在の打者情報を更新 (Admin用)
 */
export function updateCurrentBatterDisplay(state, isAdminMode) {
    if (!isAdminMode) return;
    
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    const batterName = state.lineup[team][batterIndex] || '---';
    
    // Adminのcontrol-panelにあるもの
    setText('current-batter-name', batterName); // 注意: BottomStatsでも同じIDを使っている場合があるが、updateCurrentBatterDisplayはAdmin用として機能させる
    setText('current-batter-order', batterIndex + 1);
}

/**
 * 結果アニメーション表示
 */
export function showResultAnimation(resultCode) {
    const overlay = document.getElementById('result-overlay');
    const textEl = document.getElementById('result-text');
    if (!overlay || !textEl) return;
    
    const text = GameLogic.formatResultForAnimation(resultCode);
    textEl.textContent = text;
    
    textEl.className = 'result-text';
    void textEl.offsetWidth; // Force Reflow
    
    if (['single', 'double', 'triple'].includes(resultCode)) {
        textEl.classList.add('res-hit');
    } else if (resultCode === 'homerun') {
        textEl.classList.add('res-homerun');
    } else if (['strikeout', 'groundout', 'flyout', 'lineout', 'dp'].includes(resultCode)) {
        textEl.classList.add('res-out');
    }
    
    overlay.classList.add('active');
    textEl.classList.add('result-animate');
    
    setTimeout(() => {
        textEl.classList.remove('result-animate');
        overlay.classList.remove('active');
    }, 4500);
}

/**
 * 打順入力フォームを生成（Admin初期化時）
 */
export function generateLineupInputs(state) {
    ['away', 'home'].forEach(team => {
        const container = document.getElementById(`lineup-input-${team}`);
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const row = document.createElement('div');
            row.className = 'lineup-item';
            
            const num = document.createElement('span');
            num.className = 'lineup-number';
            num.textContent = (i + 1);
            row.appendChild(num);
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'lineup-input-name';
            nameInput.dataset.team = team;
            nameInput.dataset.order = i;
            nameInput.value = state.lineup[team][i] || '';
            nameInput.placeholder = '選手名';
            row.appendChild(nameInput);
            
            const posSelect = document.createElement('select');
            posSelect.className = 'lineup-input-pos';
            posSelect.dataset.team = team;
            posSelect.dataset.order = i;
            
            POSITIONS.forEach(pos => {
                const opt = document.createElement('option');
                opt.value = pos;
                opt.textContent = pos;
                if (state.positions && state.positions[team][i] === pos) {
                    opt.selected = true;
                }
                posSelect.appendChild(opt);
            });
            row.appendChild(posSelect);
            
            container.appendChild(row);
        }

        // Pitcher (DH)
        const pRow = document.createElement('div');
        pRow.className = 'lineup-item pitcher-row';
        pRow.style.marginTop = '10px';
        pRow.style.paddingTop = '10px';
        pRow.style.borderTop = '1px dashed rgba(255, 215, 0, 0.3)';
        
        const pLabel = document.createElement('span');
        pLabel.className = 'lineup-number';
        pLabel.textContent = 'P';
        pLabel.style.fontWeight = 'bold';
        pLabel.style.color = '#e74c3c';
        pRow.appendChild(pLabel);
        
        const pInput = document.createElement('input');
        pInput.type = 'text';
        pInput.className = 'lineup-input-pitcher';
        pInput.dataset.team = team;
        pInput.value = state.pitcher ? (state.pitcher[team] || '') : '';
        pInput.placeholder = '投手名（DH制・先発）';
        pRow.appendChild(pInput);
        
        const pPos = document.createElement('span');
        pPos.className = 'lineup-pos-fixed';
        pPos.textContent = '投';
        pPos.style.display = 'inline-block';
        pPos.style.width = '55px';
        pPos.style.textAlign = 'center';
        pPos.style.fontSize = '11px';
        pPos.style.color = '#ffd700';
        pRow.appendChild(pPos);
        
        container.appendChild(pRow);
    });
}

// Helper Functions
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function toggleClass(id, className, condition) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, condition);
}
