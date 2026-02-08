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
        
        // 管理モード以外（表示モードなど）の場合のみメッセージを受信して反映
        if (!isAdminMode) {
            broadcastChannel.onmessage = (event) => {
                if (event.data && event.data.type === 'STATE_UPDATE') {
                    console.log('📡 ブロードキャスト受信: 状態を更新します');
                    if (onStateUpdateCallback) {
                        onStateUpdateCallback(event.data.state);
                    }
                } else if (event.data && event.data.type === 'SHOW_RESULT') {
                    console.log('📡 結果アニメーション受信:', event.data.result);
                    if (onResultCallback) {
                        onResultCallback(event.data.result);
                    }
                }
            };
            console.log('✅ BroadcastChannel受信待機中（表示モード）');
        } else {
            console.log('✅ BroadcastChannel送信専用（管理モード）');
        }
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
 * @param {string} result 
 * @param {boolean} isAdminMode 
 */
export function broadcastResultEvent(result, isAdminMode) {
    if (broadcastChannel && isAdminMode) {
        broadcastChannel.postMessage({
            type: 'SHOW_RESULT',
            result: result,
            timestamp: Date.now()
        });
    }
}
