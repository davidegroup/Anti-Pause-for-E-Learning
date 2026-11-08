// ==UserScript==
// @name         教學影片防換頁暫停 (選單控制) 測試
// @namespace    https://github.com/your-github-username
// @version      6.3
// @description  在指定網域盡可能維持影片頁面的可見／焦點狀態；透過 Tampermonkey 選單管理網域。
// @author       ChatGPT
// @license      MIT
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'user_anti_pause_domains';
    const currentHost = window.location.hostname.toLowerCase();

    // ---------- 網域清單與驗證 ----------

    function normalizeDomainList(value) {
        if (!Array.isArray(value)) return [];

        return value
            .filter(item =>
                item &&
                typeof item === 'object' &&
                typeof item.domain === 'string'
            )
            .map(item => ({
                domain: item.domain.trim().toLowerCase().replace(/\.$/, ''),
                enabled: item.enabled === true
            }))
            .filter(item => isValidHostname(item.domain));
    }

    function getDomainList() {
        try {
            return normalizeDomainList(GM_getValue(STORAGE_KEY, []));
        } catch (error) {
            console.error('[Anti-Pause] 讀取網域設定失敗：', error);
            return [];
        }
    }

    function saveDomainList(list) {
        try {
            GM_setValue(STORAGE_KEY, normalizeDomainList(list));
        } catch (error) {
            console.error('[Anti-Pause] 儲存網域設定失敗：', error);
            alert('設定儲存失敗，請確認 Tampermonkey 的儲存權限。');
        }
    }

    function isValidHostname(hostname) {
        if (typeof hostname !== 'string' || !hostname || hostname.length > 253) {
            return false;
        }

        if (hostname === 'localhost') return true;

        const ipv4Parts = hostname.split('.');

        if (
            ipv4Parts.length === 4 &&
            ipv4Parts.every(part =>
                /^\d{1,3}$/.test(part) &&
                Number(part) >= 0 &&
                Number(part) <= 255
            )
        ) {
            return true;
        }

        return hostname.split('.').every(label =>
            label.length >= 1 &&
            label.length <= 63 &&
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
        );
    }

    function parseDomainInput(input) {
        let raw = String(input || '').trim();

        if (!raw) return null;

        if (!/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
            raw = 'https://' + raw;
        }

        try {
            const parsed = new URL(raw);
            const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');

            if (
                !hostname ||
                parsed.username ||
                parsed.password ||
                !isValidHostname(hostname)
            ) {
                return null;
            }

            return hostname;

        } catch (_) {
            return null;
        }
    }

    // 精確匹配主網域及其子網域
    function domainMatches(hostname, domain) {
        return hostname === domain ||
               hostname.endsWith('.' + domain);
    }

    const domains = getDomainList();

    const activeItem = domains.find(item =>
        item.enabled && domainMatches(currentHost, item.domain)
    );

    // ---------- 防暫停核心 ----------

    // 保留 v6.2 原本的防暫停機制
    if (activeItem) {

        console.info(
            '[Anti-Pause] 已啟用：',
            currentHost,
            '（符合網域：',
            activeItem.domain,
            '）'
        );

        // 攔截分頁可見性事件
        try {
            document.addEventListener('visibilitychange', function (event) {
                event.stopImmediatePropagation();
            }, true);

        } catch (error) {
            console.warn(
                '[Anti-Pause] 無法攔截 visibilitychange：',
                error
            );
        }

        // 覆寫 document.hidden
        try {
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                get: function () {
                    return false;
                }
            });

        } catch (error) {
            console.warn(
                '[Anti-Pause] 無法覆寫 document.hidden：',
                error
            );
        }

        // 覆寫 document.visibilityState
        try {
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: function () {
                    return 'visible';
                }
            });

        } catch (error) {
            console.warn(
                '[Anti-Pause] 無法覆寫 document.visibilityState：',
                error
            );
        }

        // 攔截失焦事件
        window.addEventListener('blur', function (event) {

            event.stopImmediatePropagation();

            try {
                window.focus();
            } catch (_) {
                // 忽略瀏覽器拒絕聚焦的情況
            }

        }, true);

        // 攔截焦點事件
        window.addEventListener('focus', function (event) {
            event.stopImmediatePropagation();
        }, true);

        // 覆寫 document.hasFocus
        try {
            Object.defineProperty(document, 'hasFocus', {
                configurable: true,
                value: function () {
                    return true;
                }
            });

        } catch (error) {
            console.warn(
                '[Anti-Pause] 無法覆寫 document.hasFocus：',
                error
            );
        }

        // 保留原版每 10 秒呼叫一次 focus 的機制
        window.setInterval(function () {

            try {
                window.focus();
            } catch (_) {
                // 忽略瀏覽器拒絕聚焦的情況
            }

        }, 10000);
    }

    // ---------- Tampermonkey 選單 ----------

    GM_registerMenuCommand(
        '⚙️ 開啟防暫停設定面板',
        openModal
    );

    function openModal() {

        if (document.getElementById('ap-modal-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'ap-modal-overlay';

        overlay.style.cssText = `
            position:fixed !important;
            inset:0 !important;
            width:100vw !important;
            height:100vh !important;
            background:rgba(0,0,0,.75) !important;
            z-index:2147483647 !important;
            display:flex !important;
            justify-content:center !important;
            align-items:center !important;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;
        `;

        const modal = document.createElement('div');

        modal.style.cssText = `
            background:#1e1e2f !important;
            width:480px !important;
            max-width:90% !important;
            max-height:85vh !important;
            border-radius:14px !important;
            padding:24px !important;
            box-shadow:0 12px 40px rgba(0,0,0,.6) !important;
            display:flex !important;
            flex-direction:column !important;
            color:#e2e8f0 !important;
            overflow:hidden !important;
            box-sizing:border-box !important;
            border:1px solid #2d2d44 !important;
        `;

        // 固定 HTML，不直接插入使用者輸入內容
        modal.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2d2d44;padding-bottom:12px;margin-bottom:16px;">

                <h3 style="margin:0;font-size:18px;color:#f8fafc;font-weight:600;">
                    ⚙️ 影片防暫停腳本設定
                </h3>

                <button
                    type="button"
                    id="ap-close-btn"
                    aria-label="關閉"
                    style="cursor:pointer;background:none;border:0;font-size:22px;color:#94a3b8;font-weight:bold;line-height:1;"
                >
                    &times;
                </button>

            </div>

            <div style="overflow-y:auto;padding-right:4px;flex:1;">

                <div style="background:#252538;border-left:4px solid #3b82f6;padding:12px;font-size:12px;line-height:1.6;margin-bottom:16px;border-radius:0 6px 6px 0;color:#cbd5e1;">

                    <strong>📖 操作說明：</strong>
                    輸入要生效的網域，點擊新增並開啟開關，重新整理網頁即可套用。

                    <br>

                    <span style="color:#f87171;">
                        <strong>⚠️ 免責聲明：</strong>
                        本腳本僅供技術交流與學習使用，不保證對所有網站影片播放器皆有效。瀏覽器仍可能限制背景分頁或最小化視窗的執行。
                    </span>

                </div>

                <div style="margin-bottom:16px;">

                    <label
                        for="ap-domain-input"
                        style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;color:#cbd5e1;"
                    >
                        新增目標網域：
                    </label>

                    <div style="display:flex;gap:8px;">

                        <input
                            type="text"
                            id="ap-domain-input"
                            placeholder="例如: elearn2.fju.edu.tw"
                            style="min-width:0;flex:1;padding:9px 12px;background:#12121a;border:1px solid #3f3f5a;border-radius:8px;color:#fff;font-size:13px;outline:none;"
                        >

                        <button
                            type="button"
                            id="ap-add-btn"
                            style="padding:9px 16px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;"
                        >
                            新增
                        </button>

                    </div>

                    <button
                        type="button"
                        id="ap-quick-add-btn"
                        style="margin-top:8px;background:none;border:none;color:#60a5fa;text-decoration:underline;font-size:12px;cursor:pointer;padding:0;"
                    ></button>

                    <div
                        id="ap-input-error"
                        role="status"
                        style="min-height:16px;margin-top:6px;color:#f87171;font-size:12px;"
                    ></div>

                </div>

                <div>

                    <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;color:#cbd5e1;">
                        已儲存的網域列表：
                    </label>

                    <div
                        id="ap-domain-list"
                        style="max-height:180px;overflow-y:auto;border:1px solid #2d2d44;border-radius:8px;padding:6px;background:#12121a;"
                    ></div>

                </div>

            </div>

            <div style="border-top:1px solid #2d2d44;padding-top:14px;margin-top:16px;text-align:right;">

                <button
                    type="button"
                    id="ap-footer-close"
                    style="padding:7px 18px;background:#475569;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;"
                >
                    關閉
                </button>

            </div>
        `;

        overlay.appendChild(modal);

        (document.body || document.documentElement)
            .appendChild(overlay);

        const input = modal.querySelector('#ap-domain-input');
        const listContainer = modal.querySelector('#ap-domain-list');
        const errorBox = modal.querySelector('#ap-input-error');
        const quickAddButton = modal.querySelector('#ap-quick-add-btn');

        quickAddButton.textContent =
            '+ 一鍵填入當前網站（' + currentHost + '）';

        // ---------- 關閉介面 ----------

        function closeModal() {

            overlay.remove();

            document.removeEventListener(
                'keydown',
                onKeyDown,
                true
            );
        }

        function onKeyDown(event) {

            if (event.key === 'Escape') {
                closeModal();
            }
        }

        modal.querySelector('#ap-close-btn')
            .addEventListener('click', closeModal);

        modal.querySelector('#ap-footer-close')
            .addEventListener('click', closeModal);

        document.addEventListener(
            'keydown',
            onKeyDown,
            true
        );

        // ---------- 一鍵填入當前網域 ----------

        quickAddButton.addEventListener('click', function () {

            input.value = currentHost;

            errorBox.textContent = '';

            input.focus();
        });

        // ---------- 新增網域 ----------

        modal.querySelector('#ap-add-btn')
            .addEventListener('click', addDomain);

        input.addEventListener('keydown', function (event) {

            if (event.key === 'Enter') {
                addDomain();
            }
        });

        function addDomain() {

            const domain = parseDomainInput(input.value);

            if (!domain) {

                errorBox.textContent =
                    '網域格式無效，請輸入正確的網域或網址。';

                return;
            }

            const currentList = getDomainList();

            if (currentList.some(item => item.domain === domain)) {

                errorBox.textContent =
                    '此網域已經存在於清單中。';

                return;
            }

            currentList.push({
                domain: domain,
                enabled: true
            });

            saveDomainList(currentList);

            input.value = '';

            errorBox.textContent = '';

            renderList();
        }

        // ---------- 建立按鈕 ----------

        function makeButton(label, background, color) {

            const button = document.createElement('button');

            button.type = 'button';

            button.textContent = label;

            button.style.cssText = `
                padding:3px 10px;
                font-size:12px;
                border:none;
                border-radius:6px;
                cursor:pointer;
                background:${background};
                color:${color};
                font-weight:500;
            `;

            return button;
        }

        // ---------- 渲染網域清單 ----------

        function renderList() {

            const list = getDomainList();

            listContainer.replaceChildren();

            if (list.length === 0) {

                const empty = document.createElement('div');

                empty.textContent =
                    '尚無任何網域，請在上方新增。';

                empty.style.cssText = `
                    text-align:center;
                    color:#64748b;
                    padding:20px;
                    font-size:13px;
                `;

                listContainer.appendChild(empty);

                return;
            }

            list.forEach(function (item) {

                const row = document.createElement('div');

                row.style.cssText = `
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:8px;
                    padding:8px 10px;
                    border-bottom:1px solid #1e1e2f;
                    font-size:13px;
                `;

                // 使用 textContent，避免 HTML 注入
                const name = document.createElement('span');

                name.style.cssText = `
                    min-width:0;
                    overflow-wrap:anywhere;
                    font-family:monospace;
                    color:${item.enabled ? '#f8fafc' : '#64748b'};
                    text-decoration:${item.enabled ? 'none' : 'line-through'};
                    font-weight:${domainMatches(currentHost, item.domain) ? '600' : 'normal'};
                `;

                name.textContent = item.domain;

                if (domainMatches(currentHost, item.domain)) {

                    const currentTag = document.createElement('span');

                    currentTag.textContent = ' (當前)';

                    currentTag.style.cssText = `
                        color:#34d399;
                        font-size:11px;
                    `;

                    name.appendChild(currentTag);
                }

                const actions = document.createElement('div');

                actions.style.cssText = `
                    display:flex;
                    gap:6px;
                    align-items:center;
                    flex-shrink:0;
                `;

                // ---------- 啟用／停用 ----------

                const toggleButton = makeButton(
                    item.enabled ? '停用' : '開啟',
                    item.enabled ? '#334155' : '#065f46',
                    item.enabled ? '#cbd5e1' : '#a7f3d0'
                );

                toggleButton.addEventListener('click', function () {

                    const latest = getDomainList();

                    const target = latest.find(entry =>
                        entry.domain === item.domain
                    );

                    if (!target) return;

                    target.enabled = !target.enabled;

                    saveDomainList(latest);

                    renderList();
                });

                // ---------- 刪除 ----------

                const deleteButton = makeButton(
                    '刪除',
                    '#7f1d1d',
                    '#fca5a5'
                );

                deleteButton.addEventListener('click', function () {

                    if (!confirm(
                        '確定要移除「' + item.domain + '」嗎？\n' +
                        '移除後該網站將不再套用防暫停功能。'
                    )) {
                        return;
                    }

                    const latest = getDomainList().filter(entry =>
                        entry.domain !== item.domain
                    );

                    saveDomainList(latest);

                    renderList();
                });

                actions.append(
                    toggleButton,
                    deleteButton
                );

                row.append(
                    name,
                    actions
                );

                listContainer.appendChild(row);
            });
        }

        renderList();
    }

})();
