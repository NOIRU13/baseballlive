/**
 * API通信モジュール
 */
import { API_BASE_URL } from '../data/constants.js';

/**
 * APIヘルスチェック
 * @returns {Promise<boolean>} APIが利用可能かどうか
 */
export async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, { 
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3秒タイムアウト
        });
        if (response.ok) {
            console.log('✅ APIサーバーに接続しました');
            return true;
        } else {
            throw new Error('API not available');
        }
    } catch (e) {
        console.warn('⚠️ APIサーバーに接続できません。localStorageを使用します。');
        return false;
    }
}

/**
 * 状態の取得
 * @returns {Promise<Object|null>}
 */
export async function fetchState() {
    try {
        const response = await fetch(`${API_BASE_URL}/state`);
        if (response.ok) {
            const data = await response.json();
            return data.state;
        }
    } catch (e) {
        console.warn('APIからの読み込みに失敗:', e);
    }
    return null;
}

/**
 * 状態の保存
 * @param {Object} state 
 */
export async function postState(state) {
    try {
        await fetch(`${API_BASE_URL}/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state })
        });
    } catch (e) {
        console.warn('APIへの保存に失敗:', e);
    }
}
