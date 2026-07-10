/*
 * ==UserScript==
 * @name         Discord Orbs Farmer v8.2
 * @namespace    https://github.com/KorsDubStudio/discord-orbs-farmer
 * @version      8.2
 * @description  Исправлено определение квестов. Теперь видит твои активные квесты в разделе «Начатые».
 * @author       KDStudio
 * @match        https://discord.com/*
 * @grant        none
 * @run-at       document-idle
 * ==/UserScript==
 */

/**
 * Discord Orbs Farmer v8.2
 * ПРОСТОЕ МЕНЮ + исправленное определение квестов
 */

(async () => {
    "use strict";

    // ================== CONFIG ==================
    const CONFIG = {
        level: 2,
        autoEnroll: true,
        autoClaim: false,
        videoSpeed: 4.0,
        pauseRange: [45, 120],
        disablePauses: false,
        notifications: true
    };

    function loadConfig() {
        try {
            const saved = localStorage.getItem('disorbsfarm_config_v8');
            if (saved) Object.assign(CONFIG, JSON.parse(saved));
        } catch {}
    }
    function saveConfig() {
        try { localStorage.setItem('disorbsfarm_config_v8', JSON.stringify(CONFIG)); } catch {}
    }

    function setLevel(lvl) {
        CONFIG.level = lvl;
        if (lvl === 1) { CONFIG.videoSpeed = 8.0; CONFIG.pauseRange = [8, 18]; }
        else if (lvl === 2) { CONFIG.videoSpeed = 4.0; CONFIG.pauseRange = [45, 120]; }
        else { CONFIG.videoSpeed = 2.2; CONFIG.pauseRange = [120, 300]; }
        saveConfig();
    }

    loadConfig();
    setLevel(CONFIG.level);

    // ================== HELPERS ==================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.random() * (max - min) + min;

    function sound(freq = 850, time = 160) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = freq; g.gain.value = 0.25;
            o.connect(g); g.connect(ctx.destination); o.start();
            setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); setTimeout(() => o.stop(), 30); }, time);
        } catch {}
    }

    function notify(title, msg) {
        if (!CONFIG.notifications) return;
        try {
            if (Notification.permission === "granted") new Notification(title, { body: msg });
            else if (Notification.permission !== "denied") Notification.requestPermission().then(p => p === "granted" && new Notification(title, { body: msg }));
        } catch {}
        sound(720, 200);
    }

    const print = (text, type = "info") => {
        const color = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" }[type] || "#0A84FF";
        console.log(`%c[DisOrbsFarm v8.2] ${text}`, `color:${color}; font-weight:600`);
    };

    // ================== DISCORD MODULES ==================
    let wp;
    try {
        wp = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch { print("Не удалось загрузить Discord. Открой discord.com/app", "error"); return; }

    const getMod = fn => {
        for (const m of Object.values(wp.c)) {
            const e = m?.exports;
            if (!e) continue;
            for (const v of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) if (v && fn(v)) return v;
        }
        return null;
    };

    const Quests = getMod(m => m.getQuest && m.quests) || Object.values(wp.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    const API = getMod(m => m.post && m.get) || Object.values(wp.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!Quests || !API) { print("Модули Discord не загружены", "error"); return; }

    // ================== STATE ==================
    let list = [];
    let running = false;
    let stopped = false;

    function loadQuests() {
        list = [];
        let raw = [];
        try { 
            raw = Quests.quests instanceof Map ? [...Quests.quests.values()] : Object.values(Quests.quests || {}); 
        } catch {}

        raw.forEach(q => {
            try {
                const userStatus = q.userStatus || {};
                if (userStatus.completedAt) return; // пропускаем полностью завершённые

                // Ищем конфиг задач в разных возможных местах (Discord иногда меняет структуру)
                let tasks = null;
                const cfg = q.config || {};
                if (cfg.taskConfig?.tasks) tasks = cfg.taskConfig.tasks;
                else if (cfg.taskConfigV2?.tasks) tasks = cfg.taskConfigV2.tasks;
                else if (cfg.tasks) tasks = cfg.tasks;

                if (!tasks || typeof tasks !== 'object') return;

                // Берём все задачи с целью (target)
                const taskKeys = Object.keys(tasks).filter(k => tasks[k] && tasks[k].target > 0);
                if (taskKeys.length === 0) return;

                // Предпочитаем видео/просмотр, потом любое
                let typeKey = taskKeys.find(t => 
                    t.toUpperCase().includes("VIDEO") || 
                    t.toUpperCase().includes("WATCH") || 
                    t === "PLAY_ON_DESKTOP"
                );
                if (!typeKey) typeKey = taskKeys[0]; // берём первую доступную

                const task = tasks[typeKey];

                list.push({
                    id: q.id,
                    name: q.config?.messages?.questName || 
                          q.config?.application?.name || 
                          q.config?.name || 
                          "Quest",
                    needed: task.target || 0,
                    done: (userStatus.progress && userStatus.progress[typeKey] && userStatus.progress[typeKey].value) || 0,
                    video: typeKey.toUpperCase().includes("VIDEO") || typeKey.toUpperCase().includes("WATCH"),
                    game: typeKey === "PLAY_ON_DESKTOP",
                    enrolled: !!userStatus.enrolledAt
                });
            } catch (e) {
                // тихо пропускаем проблемные квесты
            }
        });

        // Сортируем: сначала видео, потом с прогрессом, потом остальные
        list.sort((a, b) => {
            if (a.video !== b.video) return b.video ? 1 : -1;
            if (b.enrolled !== a.enrolled) return b.enrolled ? 1 : -1;
            return (b.done / b.needed) - (a.done / a.needed);
        });
    }

    // ================== ACTIONS ==================
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.autoEnroll) return false;
        for (const loc of [0, 1, 2, 11, 13]) {
            try {
                const r = await API.post({ url: `/quests/${q.id}/enroll`, body: { location: loc } });
                if (r?.body) { q.enrolled = true; await sleep(700); return true; }
            } catch {}
            await sleep(220);
        }
        return false;
    }

    async function claimQuest(q) {
        if (!CONFIG.autoClaim) return;
        try { await API.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 0 } }); } catch {}
    }

    async function doVideo(q) {
        let done = q.done;
        const total = q.needed;
        while (done < total && !stopped) {
            const step = CONFIG.videoSpeed + rand(-0.35, 0.65);
            await sleep(1250 + rand(0, 400));
            try {
                await API.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: done + step } });
                done += step; q.done = done;
                updateMainProgress(Math.floor((done / total) * 100));
            } catch (e) {
                if (String(e).includes("429") || String(e).includes("captcha")) {
                    print("Защита Discord. Пауза...", "warn");
                    await sleep(rand(280000, 520000)); break;
                }
            }
        }
        if (done >= total) await claimQuest(q);
    }

    async function doGame(q) {
        await sleep(Math.min(q.needed * 800, 180000));
        await claimQuest(q);
    }

    // ================== SIMPLE MENU UI ==================
    let ui = null;
    let mini = null;

    function buildSimpleMenu() {
        if (ui) ui.remove();

        ui = document.createElement("div");
        ui.style.cssText = `position:fixed; top:75px; right:20px; z-index:999999; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;

        ui.innerHTML = `
            <div style="width:295px; background:rgba(20,20,22,0.97); backdrop-filter:blur(40px); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:16px 18px; color:#F5F5F7; box-shadow:0 25px 70px rgba(0,0,0,0.65);">
                
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
                    <div style="display:flex; align-items:center; gap:9px;">
                        <div style="width:28px;height:28px;background:linear-gradient(135deg,#5E5CE6,#0A84FF);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(94,92,230,0.4);">👓</div>
                        <div>
                            <div style="font-weight:800;font-size:17px;letter-spacing:-0.3px;">DisOrbsFarm</div>
                            <div style="font-size:9.5px;color:#8E8E93;margin-top:-1px;">v8.2 • Простое меню</div>
                        </div>
                    </div>
                    <button id="df-close" style="width:26px;height:26px;background:rgba(255,69,58,0.12);color:#FF453A;border:none;border-radius:50%;font-size:14px;font-weight:700;cursor:pointer;">✕</button>
                </div>

                <!-- Status -->
                <div id="df-status" style="font-size:12.5px;color:#8E8E93;margin-bottom:8px;min-height:18px;">Готов к фарму</div>

                <!-- Progress bar -->
                <div style="background:rgba(255,255,255,0.07);border-radius:999px;height:5px;margin-bottom:14px;overflow:hidden;">
                    <div id="df-progress" style="background:linear-gradient(90deg,#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .35s;border-radius:999px;"></div>
                </div>

                <!-- Main buttons -->
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <button id="df-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:12px;padding:14px 0;font-weight:800;font-size:15.5px;cursor:pointer;box-shadow:0 4px 16px rgba(10,132,255,0.35);transition:all .2s;">СТАРТ ФАРМА</button>
                    <button id="df-stop" style="flex:1;background:rgba(255,69,58,0.15);color:#FF453A;border:1px solid rgba(255,69,58,0.3);border-radius:12px;padding:14px 0;font-weight:800;font-size:15.5px;cursor:pointer;display:none;transition:all .2s;">СТОП</button>
                </div>

                <!-- Quick toolbar -->
                <div style="display:flex; gap:6px; align-items:center;">
                    <button id="df-refresh" style="flex:1; padding:8px 0; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:9px; color:#F5F5F7; font-size:12px; font-weight:600; cursor:pointer;">🔄 Обновить</button>
                    <button id="df-settings" style="flex:1; padding:8px 0; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:9px; color:#F5F5F7; font-size:12px; font-weight:600; cursor:pointer;">⚙ Настройки</button>
                    <button id="df-mini" style="padding:8px 10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:9px; color:#F5F5F7; font-size:13px; cursor:pointer;">−</button>
                </div>

                <!-- Settings panel -->
                <div id="df-settings-panel" style="display:none; margin-top:12px; padding:12px; background:rgba(15,15,17,0.98); border-radius:11px; border:1px solid rgba(255,255,255,0.06); font-size:13px;">
                    <div style="margin-bottom:8px;">
                        <div style="color:#8E8E93; font-size:11px; margin-bottom:3px;">Уровень</div>
                        <select id="df-level" style="width:100%; padding:6px 8px; border-radius:7px; background:#2b2d31; color:#fff; border:1px solid #3f4147; font-size:13px;">
                            <option value="1">⚡ Быстрый</option>
                            <option value="2" selected>⚖ Баланс</option>
                            <option value="3">🛡 Безопасный</option>
                        </select>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:5px; font-size:13px;">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="df-enroll" checked style="accent-color:#0A84FF"> Автопринятие</label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="df-claim" style="accent-color:#0A84FF"> Автоклейм <span style="color:#FF453A;font-size:10px;">(риск)</span></label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="df-nopause" style="accent-color:#0A84FF"> Без пауз <span style="color:#FF9F0A;font-size:10px;">(риск)</span></label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="df-notify" checked style="accent-color:#0A84FF"> Уведомления</label>
                    </div>

                    <div style="margin-top:9px;">
                        <div style="color:#8E8E93; font-size:11px; margin-bottom:2px;">Скорость видео</div>
                        <input type="range" id="df-speed" min="1.5" max="11" step="0.3" value="4" style="width:100%; accent-color:#5E5CE6;">
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:#8E8E93;margin-top:1px;"><span>1.5x</span><span id="df-spval" style="font-weight:600;color:#fff;">4.0</span><span>11x</span></div>
                    </div>
                </div>

                <div style="margin-top:10px; text-align:center; font-size:8.5px; color:#555; opacity:0.7;">KDStudio • 2026</div>
            </div>
        `;

        document.body.appendChild(ui);

        setupSimpleListeners();
    }

    function setupSimpleListeners() {
        const startBtn = ui.querySelector("#df-start");
        const stopBtn = ui.querySelector("#df-stop");
        const statusEl = ui.querySelector("#df-status");
        const progressBar = ui.querySelector("#df-progress");
        const settingsPanel = ui.querySelector("#df-settings-panel");
        const settingsBtn = ui.querySelector("#df-settings");
        const refreshBtn = ui.querySelector("#df-refresh");
        const miniBtn = ui.querySelector("#df-mini");
        const closeBtn = ui.querySelector("#df-close");
        const levelSel = ui.querySelector("#df-level");
        const speedSlider = ui.querySelector("#df-speed");
        const speedVal = ui.querySelector("#df-spval");

        startBtn.onclick = startFarming;
        stopBtn.onclick = () => { stopped = true; running = false; statusEl.textContent = "Остановлено"; stopBtn.style.display = "none"; startBtn.style.display = "block"; };

        refreshBtn.onclick = () => {
            loadQuests();
            statusEl.textContent = list.length > 0 
                ? `Обновлено • ${list.length} квестов` 
                : "Квесты не найдены (попробуй обновить страницу Discord)";
            print(`Квесты обновлены: ${list.length}`, "info");
        };

        let settingsOpen = false;
        settingsBtn.onclick = () => {
            settingsOpen = !settingsOpen;
            settingsPanel.style.display = settingsOpen ? "block" : "none";
        };

        miniBtn.onclick = minimizeToMini;
        closeBtn.onclick = () => { ui.remove(); if (mini) mini.remove(); };

        levelSel.value = CONFIG.level;
        levelSel.onchange = e => { setLevel(parseInt(e.target.value)); };

        ui.querySelector("#df-enroll").checked = CONFIG.autoEnroll;
        ui.querySelector("#df-enroll").onchange = e => { CONFIG.autoEnroll = e.target.checked; saveConfig(); };
        ui.querySelector("#df-claim").checked = CONFIG.autoClaim;
        ui.querySelector("#df-claim").onchange = e => { CONFIG.autoClaim = e.target.checked; saveConfig(); };
        ui.querySelector("#df-nopause").checked = CONFIG.disablePauses;
        ui.querySelector("#df-nopause").onchange = e => { CONFIG.disablePauses = e.target.checked; saveConfig(); };
        ui.querySelector("#df-notify").checked = CONFIG.notifications;
        ui.querySelector("#df-notify").onchange = e => { CONFIG.notifications = e.target.checked; saveConfig(); };

        speedSlider.value = CONFIG.videoSpeed;
        speedVal.textContent = CONFIG.videoSpeed.toFixed(1);
        speedSlider.oninput = () => {
            CONFIG.videoSpeed = parseFloat(speedSlider.value);
            speedVal.textContent = CONFIG.videoSpeed.toFixed(1);
            saveConfig();
        };

        loadQuests();
        statusEl.textContent = list.length > 0 
            ? `Готов • ${list.length} квестов` 
            : "Нет квестов (обнови страницу Discord)";
    }

    function updateMainProgress(pct) {
        const bar = ui?.querySelector("#df-progress");
        if (bar) bar.style.width = pct + "%";
    }

    function minimizeToMini() {
        if (!ui) return;
        ui.style.display = "none";
        if (!mini) {
            mini = document.createElement("div");
            mini.style.cssText = "position:fixed;top:22px;right:22px;background:rgba(20,20,22,0.96);backdrop-filter:blur(25px);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:6px 14px;display:flex;align-items:center;gap:8px;z-index:999999;box-shadow:0 8px 25px rgba(0,0,0,0.4);";
            mini.innerHTML = `
                <div style="display:flex;align-items:center;gap:7px;">
                    <div style="width:20px;height:20px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;">👓</div>
                    <div style="font-weight:700;font-size:12.5px;">DisOrbsFarm</div>
                </div>
                <button style="background:#0A84FF;color:white;border:none;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;">Открыть</button>
            `;
            document.body.appendChild(mini);
            mini.querySelector("button").onclick = () => {
                mini.remove(); mini = null;
                ui.style.display = "block";
            };
        }
    }

    // ================== FARMING LOGIC ==================
    async function startFarming() {
        if (running) return;
        running = true;
        stopped = false;

        const startBtn = ui.querySelector("#df-start");
        const stopBtn = ui.querySelector("#df-stop");
        const statusEl = ui.querySelector("#df-status");
        const progressBar = ui.querySelector("#df-progress");

        startBtn.style.display = "none";
        stopBtn.style.display = "block";
        progressBar.style.width = "0%";

        loadQuests();

        if (!list.length) {
            statusEl.textContent = "Нет квестов. Попробуй обновить Discord (F5) или проверь раздел 'Начатые'";
            startBtn.style.display = "block";
            stopBtn.style.display = "none";
            running = false;
            return;
        }

        const toRun = list.slice(0, 6);
        statusEl.textContent = `Фарм ${toRun.length} квестов...`;

        for (let i = 0; i < toRun.length && !stopped; i++) {
            const q = toRun[i];
            statusEl.textContent = `${i+1}/${toRun.length}: ${q.name.slice(0, 30)}`;

            const ok = await enrollQuest(q);
            if (!ok && !q.enrolled) continue;

            try {
                if (q.video) await doVideo(q);
                else if (q.game) await doGame(q);
            } catch (e) {
                print("Ошибка: " + e.message, "error");
            }

            if (!CONFIG.disablePauses && i < toRun.length - 1 && !stopped) {
                const p = rand(...CONFIG.pauseRange);
                for (let s = Math.floor(p); s > 0 && !stopped; s--) {
                    statusEl.textContent = `Пауза ${s}с`;
                    await sleep(1000);
                }
            }
        }

        running = false;
        startBtn.style.display = "block";
        stopBtn.style.display = "none";
        statusEl.textContent = stopped ? "Остановлено" : "Готово!";
        progressBar.style.width = "100%";

        notify("DisOrbsFarm v8.2", `Фарм завершён (${toRun.length} квестов)`);
        print("Фарм завершён", "success");
    }

    // ================== START ==================
    buildSimpleMenu();
    print("DisOrbsFarm v8.2 — исправлено определение квестов", "success");
    notify("DisOrbsFarm", "v8.2 загружен");

    window.closeOrbsFarmer = () => { if (ui) ui.remove(); if (mini) mini.remove(); };
})();