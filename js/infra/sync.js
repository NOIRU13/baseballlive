/**
 * 同期モジュール (BroadcastChannel)
 */
import { CHANNEL_NAME } from '../data/constants.js';

let broadcastChannel = null;

/**
 * BroadcastChannelのセットアップ
 * @param {boolean} isAdminMode 
 * @param {Function} onStateUpdateCallback 状態更新時のコールバック
 * @param {Function} onResultCallback 結果アニメーション時のコールバック
 */
export function setupBroadcastChannel(isAdminMode, onStateUpdateCallback, onResultCallback) {
    try {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

        // 全ページで状態更新を受信（管理ページ間の同期にも必要）
        // BroadcastChannelは自分自身には送信されないためループしない
        broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'STATE_UPDATE') {
                console.log('📡 ブロードキャスト受信: 状態を更新します');
                if (onStateUpdateCallback) {
                    onStateUpdateCallback(event.data.state);
                }
            } else if (event.data && event.data.type === 'SHOW_RESULT') {
                // 結果アニメーションは表示モードのみ
                if (!isAdminMode && onResultCallback) {
                    console.log('📡 結果アニメーション受信:', event.data.result);
                    onResultCallback(event.data.result);
                }
            }
        };
        console.log('✅ BroadcastChannel受信待機中');
    } catch (e) {
        console.warn('⚠️ BroadcastChannel は利用できません:', e);
    }
}

/**
 * 状態変更を他のタブにブロードキャスト
 * @param {Object} state 
 * @param {boolean} isAdminMode 
 */
export function broadcastState(state, isAdminMode) {
    // 管理モードからのみ送信する（一方通行）
    if (broadcastChannel && isAdminMode) {
        try {
            broadcastChannel.postMessage({
                type: 'STATE_UPDATE',
                state: state,
                timestamp: Date.now()
            });
            console.log('📤 状態をブロードキャストしました');
        } catch (e) {
            console.warn('ブロードキャスト失敗:', e);
        }
    }
}

/**
 * 結果イベントをブロードキャスト
 * BroadcastChannelに加え、stateにも埋め込む（API経由のOBS同期用）
 * @param {string} result
 * @param {boolean} isAdminMode
 * @param {Object} state 現在のstate参照（lastResultを書き込むため）
 */
export function broadcastResultEvent(result, isAdminMode, state) {
    // stateにlastResultを埋め込む（APIポーリングで他ブラウザが検出できるように）
    if (state && isAdminMode) {
        state.lastResult = {
            type: result,
            timestamp: Date.now()
        };
    }

    if (broadcastChannel && isAdminMode) {
        broadcastChannel.postMessage({
            type: 'SHOW_RESULT',
            result: result,
            timestamp: Date.now()
        });
    }
}
