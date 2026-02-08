/**
 * 状態管理モジュール
 */
import { DEFAULT_STATE, STORAGE_KEY } from './constants.js';
import * as API from '../infra/api.js';
import * as Sync from '../infra/sync.js';

// 現在の状態
export let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
export let useAPI = false;
export let isAdminMode = false;
export let isDisplayMode = false;

/**
 * 初期化時のモード設定
 * @param {boolean} adminMode 
 */
export function setAdminMode(adminMode) {
    isAdminMode = adminMode;
}

/**
 * 表示モードの設定
 * @param {boolean} displayMode 
 */
export function setDisplayMode(displayMode) {
    isDisplayMode = displayMode;
}

/**
 * 状態を読み込む（API優先、フォールバックでlocalStorage）
 */
export async function loadState() {
    // APIヘルスチェック
    useAPI = await API.checkAPIHealth();

    // APIが利用可能な場合
    if (useAPI) {
        const remoteState = await API.fetchState();
        if (remoteState) {
            state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), remoteState);
            // localStorageにもバックアップ
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return state;
        }
    }
    
    // フォールバック: localStorage
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        } else {
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
    } catch (e) {
        console.error('状態の読み込みに失敗:', e);
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    return state;
}

/**
 * 状態を保存する（API優先、フォールバックでlocalStorage）
 * @param {boolean} skipBroadcast ブロードキャストをスキップするかどうか
 */
export async function saveState(skipBroadcast = false) {
    // 常にlocalStorageにも保存（バックアップ）
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('localStorageへの保存に失敗:', e);
    }
    
    // BroadcastChannelで他のタブにリアルタイム同期
    if (!skipBroadcast) {
        Sync.broadcastState(state, isAdminMode);
    }
    
    // APIが利用可能な場合
    if (useAPI && isAdminMode) {
        await API.postState(state);
    }
}

/**
 * 状態を更新する（外部から強制的にセットする場合など）
 * @param {Object} newState 
 */
export function setState(newState) {
    state = newState;
}

/**
 * リセット
 */
export function resetState() {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
}

/**
 * オブジェクトの深いマージ
 */
export function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}
