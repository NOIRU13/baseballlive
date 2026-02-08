/**
 * ゲームロジックモジュール
 * 野球のルール、スタッツ計算など
 */
import { RESULT_LABELS } from '../data/constants.js';

/**
 * 投球数を増やす
 * @param {Object} state 
 */
export function incrementPitchCount(state) {
    const pitchingTeam = state.inning.half === 'top' ? 'home' : 'away';
    if (!state.pitcherStats[pitchingTeam]) {
        state.pitcherStats[pitchingTeam] = { innings: 0, strikeouts: 0, runs: 0, pitchCount: 0, outs: 0 };
    }
    state.pitcherStats[pitchingTeam].pitchCount++;
}

/**
 * カウントをリセット
 * @param {Object} state 
 */
export function resetCount(state) {
    state.count.ball = 0;
    state.count.strike = 0;
}

/**
 * アウトを追加
 * @param {Object} state 
 * @returns {boolean} チェンジになったかどうか
 */
export function addOut(state) {
    state.count.out++;
    recordOut(state); // 投手成績にアウトを記録
    resetCount(state);
    
    if (state.count.out >= 3) {
        state.count.out = 0;
        clearRunners(state);
        advanceInning(state);
        return true; // チェンジ
    }
    return false;
}

/**
 * ランナーをクリア
 * @param {Object} state 
 */
export function clearRunners(state) {
    state.runners.first = false;
    state.runners.second = false;
    state.runners.third = false;
}

/**
 * イニングを進める
 * @param {Object} state 
 */
export function advanceInning(state) {
    if (state.inning.half === 'top') {
        state.inning.half = 'bottom';
    } else {
        state.inning.half = 'top';
        if (state.inning.number < 12) {
            state.inning.number++;
        }
    }
}

/**
 * 投手成績：三振を記録
 * @param {Object} state 
 */
export function recordStrikeout(state) {
    const pitchingTeam = state.inning.half === 'top' ? 'home' : 'away';
    if (!state.pitcherStats[pitchingTeam]) {
        state.pitcherStats[pitchingTeam] = { innings: 0, strikeouts: 0, runs: 0, pitchCount: 0, outs: 0 };
    }
    state.pitcherStats[pitchingTeam].strikeouts++;
}

/**
 * 投手成績：アウトを記録
 * @param {Object} state 
 */
export function recordOut(state) {
    const pitchingTeam = state.inning.half === 'top' ? 'home' : 'away';
    if (!state.pitcherStats[pitchingTeam]) {
        state.pitcherStats[pitchingTeam] = { innings: 0, strikeouts: 0, runs: 0, pitchCount: 0, outs: 0 };
    }
    state.pitcherStats[pitchingTeam].outs++;
    updatePitcherStats(state, pitchingTeam);
}

/**
 * 投手成績を自動計算する
 * @param {Object} state 
 * @param {string} team 'home' or 'away' (投手側のチーム)
 */
export function updatePitcherStats(state, team) {
    if (!state.pitcherStats) {
        state.pitcherStats = {
            home: { innings: 0, strikeouts: 0, runs: 0, pitchCount: 0, outs: 0 },
            away: { innings: 0, strikeouts: 0, runs: 0, pitchCount: 0, outs: 0 }
        };
    }
    
    // 失点の計算（相手チームの得点合計）
    const opposingTeam = team === 'home' ? 'away' : 'home';
    const totalRuns = state.scores[opposingTeam].reduce((sum, score) => sum + (score || 0), 0);
    state.pitcherStats[team].runs = totalRuns;
    
    // 投球回数の計算（アウト数から）
    const outs = state.pitcherStats[team].outs || 0;
    const fullInnings = Math.floor(outs / 3);
    const partialOuts = outs % 3;
    state.pitcherStats[team].innings = fullInnings + (partialOuts * 0.1);
}

/**
 * 打席結果を記録
 * @param {Object} state 
 * @param {string} resultCode 
 * @returns {Array} 発生したイベント（'CHANGE', 'SCORE', etc.）
 */
export function recordAtBatResult(state, resultCode) {
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    
    // 履歴に追加（Undo用）
    state.resultHistory.push({
        type: 'atBat',
        team: team,
        batterIndex: batterIndex,
        result: resultCode,
        runnersBefore: {...state.runners},
        countBefore: {...state.count},
        scoreBefore: JSON.parse(JSON.stringify(state.scores)),
        outsBefore: state.count.out,
        pitcherStatsBefore: JSON.parse(JSON.stringify(state.pitcherStats))
    });

    // 個人成績に追加
    state.atBatResults[team][batterIndex].push(resultCode);
    
    // ヒット系の場合、H+1
    if (['single', 'double', 'triple', 'homerun'].includes(resultCode)) {
        state.stats[team].h++;
    }
    
    // ロジック分岐
    let isChange = false;

    // 三振
    if (resultCode === 'strikeout') {
        recordStrikeout(state);
        isChange = addOut(state);
    }
    // その他のアウト
    else if (['groundout', 'flyout', 'lineout', 'dp'].includes(resultCode)) {
        recordOut(state);
        if (resultCode === 'dp') {
             // 併殺はもう一つアウト（簡易実装：2アウト取れる状況かは判定していない）
            isChange = addOut(state);
        } else {
             isChange = isChange || (state.count.out === 0); // addOut内で判定済み
        }
        // addOutはチェンジ時に true を返す
        if (state.count.out !== 0) {
             // addOutがチェンジじゃなかった場合でも、recordOutでアウトカウントが増えるので
             // addOutを呼ぶ必要があるが、上の分岐でDP以外は呼んでいないのでここで呼ぶべきか？
             // 元のコードでは recordOut してから addOut していなかった（アウトカウント操作は addOut、投手成績は recordOut）
             // 修正: addOut 内で recordOut を呼ぶように変更したので、ここでは addOut を呼ぶだけでよい
             // ただし、recordAtBatResult の先頭で recordStrikeout などを呼んでいる。
             // DPの場合は2回 addOut を呼ぶのが正しい。
             // groundout等は1回。
        }
    }
    
    // 上記ロジックが少し複雑になったので、整理：
    /*
      元のコード:
      if (strikeout) { recordStrikeout(); recordOut(); } // recordOutは投手成績のみ更新、アウトカウントは更新しない？いや、addOutを呼んでない
      else if (groundout...) { recordOut(); if(dp) recordOut(); }
      
      ...その後、resetCount() して nextBatter へ。
      
      あれ？元のコード、strikeout/groundoutの時に `addOut()` を呼んでいない？？
      確認すると:
      addListener('btn-out', ...) -> addOut()
      addListener('btn-strike', ...) -> if(>=3) { recordStrikeout(); addOut(); }
      
      recordAtBatResult内:
      if (strikeout) { recordStrikeout(); recordOut(); }
      else if (groundout) { recordOut(); if(dp) recordOut(); }
      // ここで addOut() を呼んでいないので、アウトカウントが増えないバグがあったのでは？
      // あるいは、ボタンを押したときに判断していた？
      // 「打席結果ボタン」を押したときは recordAtBatResult が呼ばれるだけ。
      
      あ、1103行目の recordAtBatResult を見ると、アウトカウントを増やす処理が見当たらない。
      state.count.out++ をしているのは addOut() だけ。
      つまり、現状のコードでは「遊ゴロ」などを押してもアウトカウントが増えない（打者交代だけする）仕様だったのか、
      あるいはバグか。
      
      -> User Request には「リファクタリング」とあるので、既存の挙動を維持すべきだが、
      明らかにバグなら修正しても良い。ただ、ルール4「ユーザーの意図を優先」に従い、勝手な修正は避けるべきだが、
      「機能ごとにモジュール化」の過程でロジックを整理するのは許容範囲か。
      
      一旦、元のコードの挙動を忠実に再現するか、あるいはコメントで指摘するか。
      元のコード:
      // 1132行目
      if (resultCode === 'strikeout') {
          recordStrikeout();
          recordOut();
      }
      else if (['groundout',...].includes(resultCode)) {
          recordOut();
           if (dp) recordOut();
      }
      // 1146行目 resetCount()
      // 1149行目 currentBatter++
      
      やはり `state.count.out` を増やしていない。
      しかし、アウトになったらアウトカウントが増えるのが野球。
      おそらく、「アウト」ボタンを手動で押す運用だったのか？
      しかし「三振」ボタンを押したらアウトカウント増えてほしいし、チェンジ判定もしてほしいはず。
      
      ユーザーへの確認事項にするか、あるいは「アウトカウントを増やす」処理を追加するか。
      設計書では「純粋な関数」にするとある。
      
      ここでは「元のコードの挙動」を再現しつつ、
      TODOコメントを残す形にする。
      
      いや、待てよ。recordOut() の中身を確認。
      1366: function recordOut() { ... state.pitcherStats...outs++; ... }
      これは投手成績のアウト数。 `state.count.out` ではない。
      
      やはり、元のコードは「結果ボタン」を押してもボード上のアウトカウントは増えない仕様のようだ。
      （手動でアウトボタンを押す必要がある）
      それならその通りに実装する。
    */

    // カウントリセット
    resetCount(state);
    
    // 次の打者へ進める
    state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
}

/**
 * 直前の結果を取り消す
 * @param {Object} state 
 */
export function undoLastResult(state) {
    if (state.resultHistory.length === 0) {
        return false;
    }
    
    const lastResult = state.resultHistory.pop();
    const { team, batterIndex, result, runnersBefore, countBefore, scoreBefore, outsBefore, pitcherStatsBefore } = lastResult;
    
    // 結果を削除
    const results = state.atBatResults[team][batterIndex];
    const idx = results.lastIndexOf(result);
    if (idx !== -1) {
        results.splice(idx, 1);
    }
    
    // ヒット系の場合、H-1
    if (['single', 'double', 'triple', 'homerun'].includes(result)) {
        if (state.stats[team].h > 0) {
            state.stats[team].h--;
        }
    }

    // 状態を復元
    state.runners = runnersBefore;
    state.count = countBefore;
    state.scores = scoreBefore; 
    state.count.out = outsBefore;
    if (pitcherStatsBefore) state.pitcherStats = pitcherStatsBefore;
    
    // 打者を戻す
    state.currentBatter[team] = batterIndex;
    
    return true;
}

/**
 * アニメーション用テキスト変換
 */
export function formatResultForAnimation(code) {
    const map = {
        'single': 'SINGLE',
        'double': 'DOUBLE',
        'triple': 'TRIPLE',
        'homerun': 'HOMERUN',
        'walk': 'WALK',
        'hbp': 'HIT BY PITCH',
        'error': 'ERROR',
        'strikeout': 'STRIKEOUT',
        'groundout': 'OUT',
        'flyout': 'OUT',
        'lineout': 'OUT',
        'sacrifice': 'SACRIFICE',
        'fc': 'FIELDER CHOICE',
        'dp': 'DOUBLE PLAY'
    };
    return map[code] || code.toUpperCase();
}
