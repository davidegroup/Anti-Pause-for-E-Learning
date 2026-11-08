// ==UserScript==
// @name         教學影片防換頁暫停 (選單控制）
// @namespace    https://github.com/your-github-username
// @version      6.2
// @description  強制保持分頁活躍，防止影片因切頁或失焦而暫停。透過 Tampermonkey 選單開啟管理介面，預設無任何生效網域。
// @author       ChatGPT, Gemini
// @license      MIT
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. 取得與儲存網域清單
    function getDomainList() {
        return GM_getValue('user_anti_pause_domains', []);
    }

    function saveDomainList(list) {
        GM_setValue('user_anti_pause_domains', list);
    }

    const currentHost = window.location.hostname;
    let domains = getDomainList();

    // 判斷當前網域是否符合且已啟用
    const activeItem = domains.find(item => item.enabled && currentHost.includes(item.domain));

    // 2. 核心防暫停邏輯 (僅在匹配且啟用的網域下執行)
    if (activeItem) {
        console.log('[Anti-Pause Engine] 已在啟用網域啟動防暫停機制：' + currentHost);

        document.addEventListener('visibilitychange', function(e) {
            e.stopImmediatePropagation();
        }, true);
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

        window.addEventListener('blur', function(e) {
            e.stopImmediatePropagation();
            window.focus();
        }, true);

        window.addEventListener('focus', function(e) {
            e.stopImmediatePropagation();
        }, true);

        Object.defineProperty(document, 'hasFocus', {
            value: function() { return true; },
            configurable: true
        });

        setInterval(() => {
            window.focus();
        }, 10000);
    }

    // 3. 註冊 Tampermonkey 擴充功能選單（點擊猴子圖示即可開啟）
    GM_registerMenuCommand("⚙️ 開啟防暫停設定面板", openModal);

    // 4. 高質感暗色系設定面板 UI
    function openModal() {
        if (document.getElementById('ap-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ap-modal-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            background: rgba(0, 0, 0, 0.75) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1e1e2f !important;
            width: 480px !important;
            max-width: 90% !important;
            max-height: 85vh !important;
            border-radius: 14px !important;
            padding: 24px !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6) !important;
            display: flex !important;
            flex-direction: column !important;
            color: #e2e8f0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border: 1px solid #2d2d44 !important;
        `;

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #2d2d44; padding-bottom:12px; margin-bottom:16px;">
                <h3 style="margin:0; font-size:18px; color:#f8fafc; font-weight:600;">⚙️ 影片防暫停腳本設定</h3>
                <span id="ap-close-btn" style="cursor:pointer; font-size:22px; color:#94a3b8; font-weight:bold; line-height:1; transition:color 0.2s;">&times;</span>
            </div>

            <div style="overflow-y:auto; padding-right:4px; flex:1;">
                <div style="background:#252538; border-left:4px solid #3b82f6; padding:12px; font-size:12px; line-height:1.6; margin-bottom:16px; border-radius:0 6px 6px 0; color:#cbd5e1;">
                    <strong>📖 操作說明：</strong>在下方填入要生效的網域（如學校數位平台），點擊新增並開啟開關，重新整理網頁即可生效。<br>
                    <span style="color:#f87171;"><strong>⚠️ 免責聲明：</strong>本腳本僅供技術交流與學習使用，不保證對所有網站影片播放器皆有效，使用者需自行承擔相關風險。</span>
                </div>

                <div style="margin-bottom:16px;">
                    <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px; color:#cbd5e1;">新增目標網域：</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="ap-domain-input" placeholder="例如: elearn2.fju.edu.tw" style="flex:1; padding:9px 12px; background:#12121a; border:1px solid #3f3f5a; border-radius:8px; color:#fff; font-size:13px; outline:none;">
                        <button id="ap-add-btn" style="padding:9px 16px; background:#10b981; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;">新增</button>
                    </div>
                    <button id="ap-quick-add-btn" style="margin-top:8px; background:none; border:none; color:#60a5fa; text-decoration:underline; font-size:12px; cursor:pointer; padding:0;">
                        + 一鍵填入當前網站 (${currentHost})
                    </button>
                </div>

                <div>
                    <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px; color:#cbd5e1;">已儲存的網域列表：</label>
                    <div id="ap-domain-list" style="max-height:180px; overflow-y:auto; border:1px solid #2d2d44; border-radius:8px; padding:6px; background:#12121a;">
                    </div>
                </div>
            </div>

            <div style="border-top:1px solid #2d2d44; padding-top:14px; margin-top:16px; text-align:right;">
                <button id="ap-footer-close" style="padding:7px 18px; background:#475569; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:500;">關閉</button>
            </div>
        `;

        overlay.appendChild(modal);
        (document.body || document.documentElement).appendChild(overlay);

        document.getElementById('ap-close-btn').onclick = () => overlay.remove();
        document.getElementById('ap-footer-close').onclick = () => overlay.remove();
        document.getElementById('ap-quick-add-btn').onclick = () => {
            document.getElementById('ap-domain-input').value = currentHost;
        };

        document.getElementById('ap-add-btn').onclick = () => {
            const input = document.getElementById('ap-domain-input');
            let val = input.value.trim().toLowerCase();
            val = val.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

            if (!val) {
                alert('請先輸入有效的網域！');
                return;
            }

            let currentList = getDomainList();
            if (currentList.some(item => item.domain === val)) {
                alert('該網域已經在清單中！');
                return;
            }

            currentList.push({ domain: val, enabled: true });
            saveDomainList(currentList);
            input.value = '';
            renderList();
        };

        function renderList() {
            const container = document.getElementById('ap-domain-list');
            const list = getDomainList();

            if (list.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px; font-size:13px;">尚無任何網域，請在上方新增。</div>`;
                return;
            }

            container.innerHTML = '';
            list.forEach((item, index) => {
                const row = document.createElement('div');
                row.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    border-bottom: 1px solid #1e1e2f;
                    font-size: 13px;
                `;

                row.innerHTML = `
                    <span style="font-family:monospace; color:${item.enabled ? '#f8fafc' : '#64748b'}; text-decoration:${item.enabled ? 'none' : 'line-through'}; font-weight:${currentHost.includes(item.domain) ? '600' : 'normal'};">
                        ${item.domain} ${currentHost.includes(item.domain) ? '<span style="color:#34d399; font-size:11px;">(當前)</span>' : ''}
                    </span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="ap-toggle-btn" style="padding:3px 10px; font-size:12px; border:none; border-radius:6px; cursor:pointer; background:${item.enabled ? '#334155' : '#065f46'}; color:${item.enabled ? '#cbd5e1' : '#a7f3d0'}; font-weight:500;">
                            ${item.enabled ? '停用' : '開啟'}
                        </button>
                        <button class="ap-delete-btn" style="padding:3px 10px; font-size:12px; border:none; border-radius:6px; cursor:pointer; background:#7f1d1d; color:#fca5a5; font-weight:500;">
                            刪除
                        </button>
                    </div>
                `;

                row.querySelector('.ap-toggle-btn').onclick = () => {
                    list[index].enabled = !list[index].enabled;
                    saveDomainList(list);
                    renderList();
                };

                row.querySelector('.ap-delete-btn').onclick = () => {
                    const confirmDelete = confirm(`⚠️ 警告：確定要移除「${item.domain}」嗎？\n移除後該網站將不再享有防暫停功能。`);
                    if (confirmDelete) {
                        list.splice(index, 1);
                        saveDomainList(list);
                        renderList();
                    }
                };

                container.appendChild(row);
            });
        }

        renderList();
    }
})();
