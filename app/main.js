import { categories, COURSES, RULES } from './data.js';

let state = {
    familyId: null,
    currentUser: null, // {id, name, role, avatar}
    selectedChildId: null,
    // Fix: Use local date instead of UTC to avoid incorrect date in AM hours (CST)
    selectedDate: (() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })(),
    activeTab: 'A',
    answers: {},
    usedSlots: 0,
    stars: 0, // 新增：嘉奖星星数量
    bonusReason: "", // 新增：嘉奖寄语
    users: [],
    weeklyData: [],
    lastInteraction: 0
};

// 实时时钟：展示北京时间
function startClock() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        const el = document.getElementById('beijing-time');
        if (el) el.innerText = timeStr;
    }, 1000);
}

const UI = {
    overlay: document.getElementById('auth-overlay'),
    app: document.getElementById('app'),
    userList: document.getElementById('user-list'),
    identitySelector: document.getElementById('identity-selector'),
    loginForm: document.getElementById('login-form'),
    childCarousel: document.getElementById('child-carousel'),
    weekStrip: document.getElementById('week-strip')
};

async function init() {
    loadLocalAuth();
    setupGlobalEvents();
    if (state.familyId && state.currentUser) {
        enterApp();
    }
}

// --- Auth & Identity ---
function loadLocalAuth() {
    const saved = localStorage.getItem('family_pact_auth');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.familyId = parsed.familyId;
        state.currentUser = parsed.currentUser;
        state.users = parsed.users || [];
    }
}

function setupGlobalEvents() {
    document.getElementById('login-btn').onclick = handleLogin;

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTab = btn.dataset.tab;
            renderActiveTab();
        };
    });
}

async function handleLogin() {
    const code = document.getElementById('family-code-input').value;
    if (!code) return showDialog('提醒', '请输入家庭码');

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ familyCode: code })
        });
        const data = await res.json();
        if (data.error) return showDialog('登录失败', data.error);

        state.familyId = data.familyId;
        state.users = data.users;

        UI.loginForm.style.display = 'none';
        UI.identitySelector.style.display = 'block';
        renderUserChoices();
    } catch (e) {
        showDialog('网络错误', '登录失败: ' + e.message);
    }
}

function renderUserChoices() {
    UI.userList.innerHTML = state.users.map(u => `
        <div class="user-item" data-id="${u.id}">
            <span class="avatar">${u.avatar || '👤'}</span>
            <span>${u.name}</span>
        </div>
    `).join('');

    UI.userList.querySelectorAll('.user-item').forEach(item => {
        item.onclick = async () => {
            const uid = item.dataset.id;
            const user = state.users.find(u => String(u.id) === String(uid));

            if (!user) {
                console.error("User not found for uid:", uid, state.users);
                return showDialog('身份异常', '找不到该用户信息，请重试');
            }

            // 数据库返回的可能是 true/false 或 1/0
            const hasPin = Boolean(user.has_pin);

            if (hasPin) {
                showPinPad(user, async (inputPin) => {
                    const res = await fetch('/api/verify-pin', {
                        method: 'POST',
                        body: JSON.stringify({ userId: user.id, pin: inputPin })
                    });
                    const result = await res.json();
                    if (result.success) {
                        state.currentUser = user;
                        // 统一保存
                        localStorage.setItem('family_pact_code', document.getElementById('family-code-input').value || state.familyCode);
                        localStorage.setItem('family_pact_auth', JSON.stringify({
                            familyId: state.familyId,
                            currentUser: user,
                            users: state.users
                        }));
                        enterApp();
                    } else {
                        showDialog('PIN码错误', '请重新输入正确密码');
                        return false;
                    }
                });
            } else {
                state.currentUser = user;
                localStorage.setItem('family_pact_code', document.getElementById('family-code-input').value || state.familyCode);
                localStorage.setItem('family_pact_auth', JSON.stringify({
                    familyId: state.familyId,
                    currentUser: user,
                    users: state.users
                }));
                enterApp();
            }
        };
    });
}

// --- App Core ---
async function enterApp() {
    UI.overlay.style.display = 'none';
    UI.app.style.display = 'flex';

    document.getElementById('user-display-name').innerText = state.currentUser.name;

    if (state.currentUser.role === 'parent') {
        const children = state.users.filter(u => u.role === 'child');
        state.selectedChildId = children[0]?.id;
        renderChildSelector(children);
    } else {
        state.selectedChildId = state.currentUser.id;
    }

    await loadDayData();
    updateBillboard(); // 更新右上角时间看板
    renderActiveTab();

    // 触发登录汇报
    showLoginReport();

    // 启动 5 秒一次的自动实时更新 (轮询)
    setInterval(async () => {
        // 如果 3 秒内有操作，跳过本次轮询以防冲突
        if (Date.now() - state.lastInteraction < 3000) return;

        const oldData = JSON.stringify(state.answers);
        await loadDayData(true); // 后台刷新

        // 只有数据真的变了（别人改了）才刷新 UI
        if (oldData !== JSON.stringify(state.answers)) {
            renderActiveTab();
        }
    }, 5000);
}

function renderChildSelector(children) {
    UI.childCarousel.style.display = 'flex';
    UI.childCarousel.innerHTML = children.map(c => `
        <div class="child-chip ${c.id === state.selectedChildId ? 'active' : ''}" data-id="${c.id}">
            ${c.avatar || '👦'} ${c.name}
        </div>
    `).join('');

    UI.childCarousel.querySelectorAll('.child-chip').forEach(chip => {
        chip.onclick = async () => {
            UI.childCarousel.querySelectorAll('.child-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.selectedChildId = chip.dataset.id;
            await loadDayData();
            renderActiveTab();
        };
    });
}

// --- Data Fetching ---
async function loadDayData(isBackground = false) {
    try {
        const res = await fetch(`/api/logs?userId=${state.selectedChildId}&date=${state.selectedDate}`);
        const { data } = await res.json();

        if (data) {
            // 检查星星是否增加了 (用于触发特效)
            const oldStars = state.stars || 0;
            state.answers = data.answers || {};
            state.usedSlots = data.usedSlots || 0;
            state.stars = data.stars || 0;
            state.bonusReason = data.bonusReason || "";

            // 只有孩子端且星星真的增加了才触发
            if (state.currentUser.role === 'child' && state.stars > oldStars) {
                triggerCelebration(state.bonusReason);
            }
        } else if (!isBackground) {
            // 根据日期自动判定该日期的初始状态
            const d = new Date(state.selectedDate);
            const day = d.getDay(); // 0 是周日, 6 是周六
            const isWeekday = (day !== 0 && day !== 6);

            // 初始逻辑：工作日默认包含 103 (练声)
            state.answers = isWeekday ? { 103: false } : {};
            state.usedSlots = 0;
            state.stars = 0;
            state.bonusReason = "";
        }
        updateUI();
    } catch (e) {
        console.error("Sync error:", e);
    }
}

async function syncData() {
    state.lastInteraction = Date.now();
    const { total } = calculateScore();
    await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: state.selectedChildId,
            date: state.selectedDate,
            answers: state.answers,
            score: total,
            usedSlots: state.usedSlots,
            stars: state.stars,
            bonusReason: state.bonusReason
        })
    });
}

// --- Rendering ---
// --- UI Helpers ---
function extractEmojiAndText(str) {
    const emojiMatch = str.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/);
    if (!emojiMatch) return { emoji: '✨', text: str };
    // 移除文本中可能存在的括弧备注，保持标题简洁 (可选)
    let cleanText = str.replace(emojiMatch[0], '').trim();
    return { emoji: emojiMatch[0], text: cleanText };
}

function getBadgeColor(item) {
    if (['penalty', 'reminders'].includes(item.type)) return 'rgba(255, 59, 48, 0.2)'; // 红 (警示)
    if (item.type === 'meals') return 'rgba(255, 159, 10, 0.2)'; // 橙 (生活)
    if (item.required) return 'rgba(255, 214, 10, 0.2)'; // 黄 (必做)
    if (item.score >= 20) return 'rgba(48, 209, 88, 0.2)'; // 绿 (大项)
    return 'rgba(10, 132, 255, 0.2)'; // 蓝 (常规)
}

function renderActiveTab() {
    const container = document.getElementById('active-tab-view');
    const category = categories.find(c => c.id === state.activeTab);

    // 仪表盘在所有页面都可见
    const dashboard = document.querySelector('.floating-dashboard');
    if (dashboard) dashboard.style.display = 'block';
    updateUI();

    // 奖券详情格 (.slots-container) 仅在状态页 'D' 显示
    const slotsPnl = document.getElementById('slots-pnl');
    if (slotsPnl) slotsPnl.style.display = (state.activeTab === 'D') ? 'block' : 'none';

    // 仅在趋势页显示周导航
    UI.weekStrip.style.display = (state.activeTab === 'E') ? 'flex' : 'none';
    if (state.activeTab === 'E') renderWeekStrip();

    if (state.activeTab === 'E') {
        renderWeeklyTab(container);
        return;
    }

    if (state.activeTab === 'D') {
        renderStatusTab(container);
        return;
    }

    let html = `<h2 style="font-size: 22px; margin-bottom: 20px; padding-left: 4px; font-weight: 800; letter-spacing: -0.5px;">${category.name}</h2>`;

    if (state.activeTab === 'C') {
        html += renderCourseHub();
    }
    if (state.activeTab === 'A') {
        html += renderSportHub();
    }

    // 开启一体化面板容器
    html += `<div class="ios-group">`;

    category.items.forEach(item => {
        if (item.id === 18 && state.activeTab === 'A') return; // 在 Hub 中渲染运动项

        const { emoji, text } = extractEmojiAndText(item.text);
        const badgeColor = getBadgeColor(item);
        const requiredClass = item.required ? 'is-required' : '';
        const requiredTag = item.required ? `<span class="required-tag">必做</span>` : '';

        html += `
            <div class="ios-item-wrap" id="item-${item.id}">
                <div class="ios-row ${requiredClass}">
                    <div class="ios-row-left">
                        <div class="ios-icon-badge" style="background: ${badgeColor}">${emoji}</div>
                        <div class="ios-row-content">
                            <span class="ios-row-title">${text}${requiredTag}</span>
                            <span class="ios-row-subtitle">${renderItemMeta(item)}</span>
                        </div>
                    </div>
                    <div class="ios-row-right">
                        ${renderControl(item)}
                    </div>
                </div>
                ${(item.type === 'subtasks' || item.type === 'bonus_subtasks') ? `
                    <div class="subtask-wrapper" style="padding: 0 16px 16px 62px;">
                        ${renderSubtasks(item)}
                    </div>` : ''}
            </div>
        `;
    });

    html += `</div>`; // 关闭一体化面板容器

    container.innerHTML = html;
    category.items.forEach(item => bindItemEvents(item));

    // 绑定 Hub 事件
    if (state.activeTab === 'C') {
        bindCourseHubEvents();
    }
    if (state.activeTab === 'A') {
        bindSportHubEvents();
    }
}

function renderSportHub() {
    const item = categories.find(c => c.id === 'A').items.find(i => i.id === 18);
    const val = state.answers[item.id] || 0;
    const colorClass = 'is-blue';
    let dots = '';
    for (let i = 1; i <= 5; i++) {
        dots += `<div class="ios-dot ${i <= val ? 'active ' + colorClass : ''}" data-idx="${i}" style="width: 28px; height: 28px;"></div>`;
    }

    return `
        <div class="sport-hub" style="background: linear-gradient(135deg, rgba(10, 132, 255, 0.15) 0%, rgba(10, 132, 255, 0.05) 100%); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 20px; padding: 16px; margin-bottom: 24px; border: 0.5px solid rgba(10, 132, 255, 0.3); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.1; filter: grayscale(1);">🏃</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:16px; font-weight:800; color:white;">运动小健将 🏃 <span class="required-tag">必做</span></span>
                    <span style="font-size:12px; color:var(--ios-blue); font-weight:700;">坚持 30 分钟 / 组项</span>
                </div>
                <div style="background: rgba(10, 132, 255, 0.2); padding: 4px 10px; border-radius: 10px; font-size: 14px; font-weight: 800; color: var(--ios-blue);">
                    +${val === 0 ? 20 : 20 + (val - 1) * 15} PTS
                </div>
            </div>
            <div class="ios-dots" style="justify-content: space-between; padding: 0 4px;">
                ${dots}
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600;">起步奖励 20 分，进阶每组 15 分</span>
                <span style="font-size: 11px; color: var(--ios-blue); font-weight: 700;">${val}/5 组</span>
            </div>
        </div>
    `;
}

function bindSportHubEvents() {
    const hub = document.querySelector('.sport-hub');
    if (!hub) return;
    const item = categories.find(c => c.id === 'A').items.find(i => i.id === 18);

    hub.querySelectorAll('.ios-dot').forEach(dot => {
        dot.onclick = async (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const current = state.answers[item.id] || 0;

            if (!checkEditPermission(item.id, 'set-dots', idx)) return;

            if (state.currentUser.role === 'parent' && current === idx) {
                state.answers[item.id] = idx - 1;
            } else {
                state.answers[item.id] = idx;
            }

            updateUI();
            await syncData();
            renderActiveTab();
        };
    });
}

function renderCourseHub() {
    return `
        <div class="course-hub" style="margin-bottom: 24px;">
            <div style="padding: 0 4px 10px;">
                <span style="font-size:12px; font-weight:700; color:var(--ios-gray); text-transform: uppercase; letter-spacing: 0.5px;">🎓 课外小课程</span>
            </div>
            <div class="course-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                ${COURSES.map(c => {
        const active = !!state.answers[c.id];
        return `
                        <div class="course-card" style="background: rgba(44, 44, 46, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 16px; padding: 12px 10px; border: 0.5px solid ${active ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255,255,255,0.1)'}; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; transition: all 0.3s ease;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-size: 13px; font-weight: 700; color: white; white-space: nowrap;">${c.text}</span>
                                <span style="font-size: 10px; color: ${active ? 'var(--ios-green)' : 'var(--ios-gray)'}; font-weight: 700;">+${c.score} PTS</span>
                            </div>
                            <label class="toggle" style="transform: scale(0.85);">
                                <input type="checkbox" class="course-toggle-input" data-id="${c.id}" ${active ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

function bindCourseHubEvents() {
    const hub = document.querySelector('.course-hub');
    if (!hub) return;
    hub.querySelectorAll('.course-toggle-input').forEach(input => {
        input.onchange = async (e) => {
            const cid = parseInt(input.dataset.id);
            const isChecked = e.target.checked;

            if (state.currentUser.role !== 'parent' && !isChecked) {
                e.target.checked = true; // 复原
                return showDialog("落子无悔", "课程已打卡完成，如需撤销请找爸爸妈妈。");
            }

            state.answers[cid] = isChecked;
            updateUI();
            await syncData();
            // 重新渲染当前 Tab 以更新列表中的状态（如 PTS 颜色）
            renderActiveTab();
        };
    });
}

function renderStatusTab(container) {
    const { total, requiredDone } = calculateScore();
    const items = categories.find(c => c.id === 'D').items;

    container.innerHTML = `
        <div class="status-grid">
            <div class="stat-box">
                <p>必做项</p>
                <p style="color: ${requiredDone ? 'var(--ios-green)' : 'var(--ios-red)'}">
                    ${requiredDone ? '✅ 已完' : '❌ 未完'}
                </p>
            </div>
            <div class="stat-box">
                <p>家庭角色</p>
                <p style="color: var(--ios-blue)">${state.currentUser.role === 'parent' ? '管理者' : '执行者'}</p>
            </div>
        </div>
        ${items.map(item => `
            <div class="item-card ${item.required ? 'is-required' : ''}" id="item-${item.id}">
                <div class="item-info">
                    <span class="item-text">${item.text}</span>
                    <span class="item-meta">${renderItemMeta(item)}</span>
                </div>
                <div class="item-action">${renderControl(item)}</div>
            </div>
        `).join('')}
        <div class="ios-settings-list">
            <button class="ios-setting-item" id="pin-btn">
                <span>设置 / 修改 PIN 码</span>
                <span class="arrow">更多 〉</span>
            </button>
            <button class="ios-setting-item" id="family-code-btn">
                <span>家庭码: ${localStorage.getItem('family_pact_code') || '---'}</span>
            </button>
        </div>

        <div class="ios-settings-list" id="admin-tools" style="${state.currentUser.role === 'parent' ? '' : 'display:none'}">
            <button class="ios-setting-item bonus-star-btn" id="bonus-star-btn">
                <span>✨ 授予特别嘉奖 (星星)</span>
                <span class="arrow">${state.stars > 0 ? `已发 ${state.stars} 颗 ` : ''}嘉奖 〉</span>
            </button>
            <button class="ios-setting-item destructive" id="reset-day-btn">
                <span>清理：当日积分重置</span>
                <span class="arrow">⚠️</span>
            </button>
        </div>

        <div class="ios-settings-list">
            <button class="ios-setting-item destructive" id="logout-btn">退出登录</button>
        </div>
    `;
    items.forEach(item => bindItemEvents(item));

    if (state.currentUser.role === 'parent') {
        document.getElementById('bonus-star-btn').onclick = () => {
            const modal = document.getElementById('reward-modal');
            const input = document.getElementById('reward-input');
            input.value = "";
            modal.style.display = 'flex';

            document.getElementById('reward-cancel').onclick = () => modal.style.display = 'none';
            document.getElementById('reward-confirm').onclick = async () => {
                const msg = input.value.trim();
                if (!msg) return showDialog("提醒", "请输入嘉奖寄语");

                state.stars = (state.stars || 0) + 1;
                state.bonusReason = msg;
                modal.style.display = 'none';

                updateUI();
                await syncData();
                showToast("星星已授予！✨");
            };
        };
        document.getElementById('reset-day-btn').onclick = () => {
            showDialog('重置记录', `确定要将今日记录恢复到初始状态吗？`, async () => {
                // 恢复机制：根据日期判定是否有课
                const d = new Date(state.selectedDate);
                const day = d.getDay();
                const isWeekday = (day !== 0 && day !== 6);

                // 核心：学习 Tab 初始逻辑，工作日默认可选练声
                state.answers = isWeekday ? { 103: false } : {};

                updateUI();
                await syncData();
                renderActiveTab();
                showToast("已恢复至当日初始状态 🧹");
            }, true, true);
        };
    }

    document.getElementById('pin-btn').onclick = () => {
        showEditModal("设置 4 位 PIN (数字)", "", async (newPin) => {
            const pinStr = String(newPin);
            if (pinStr.length !== 4 || isNaN(pinStr)) return showDialog('格式错误', '请输入正好 4 位数字密码');

            const res = await fetch('/api/set-pin', {
                method: 'POST',
                body: JSON.stringify({ userId: state.currentUser.id, pin: pinStr })
            });
            const result = await res.json();
            if (result.success) {
                showDialog('设置成功', 'PIN 码已更新，再次切换身份时生效');
                state.currentUser.has_pin = true;
            }
        });
    };

    document.getElementById('logout-btn').onclick = () => {
        showDialog('退出登录', '确定要退出当前家庭并重新登录吗？', () => {
            localStorage.clear();
            location.reload();
        }, true, true); // 开启确认模式 + 加红色警告
    };
}
async function renderWeeklyTab(container) {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    try {
        const res = await fetch(`/api/week?userId=${state.selectedChildId}&start=${startStr}&end=${endStr}`);
        const { logs } = await res.json();

        const maxScore = 220;
        let avg = 0;
        if (logs.length > 0) {
            avg = Math.round(logs.reduce((acc, curr) => acc + curr.totalScore, 0) / logs.length);
        }

        container.innerHTML = `
            <h2 style="font-size: 22px; margin-bottom: 20px;">周趋势分析</h2>
            
            <div class="weekly-summary" style="background: var(--ios-card); padding: 20px; border-radius: 20px; margin-bottom: 24px; text-align: center;">
                <p style="color: var(--ios-gray); font-size: 14px;">本周平均分</p>
                <h3 style="font-size: 36px; margin: 8px 0; color: var(--ios-blue);">${avg} <span style="font-size: 14px; color: var(--ios-gray);">PTS</span></h3>
                <p style="font-size: 12px; color: var(--ios-green);">较上周提升 12%</p>
            </div>

            <div class="chart-container" style="background: var(--ios-card); padding: 20px; border-radius: 20px; height: 180px; display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px;">
                ${logs.map(l => {
            const height = Math.max(10, (l.totalScore / maxScore) * 100);
            const isToday = l.date === today.toISOString().split('T')[0];
            return `
                        <div class="chart-bar-group" style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1;">
                            <div class="chart-num" style="font-size: 10px; color: var(--ios-gray);">${l.totalScore}</div>
                            <div class="chart-bar" style="width: 12px; height: ${height}px; background: ${isToday ? 'var(--ios-blue)' : 'rgba(10, 132, 255, 0.3)'}; border-radius: 6px; position: relative;">
                                ${l.totalScore >= 140 ? '<div style="position:absolute; top:-4px; right:-4px; width:6px; height:6px; background:var(--ios-green); border-radius:50%;"></div>' : ''}
                            </div>
                            <div class="chart-label" style="font-size: 10px; color: var(--ios-gray);">${l.date.split('-')[2]}日</div>
                        </div>
                    `;
        }).join('')}
            </div>

            <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--ios-gray);">每日得分明细</h3>
            <div class="logs-list">
                ${logs.reverse().map(l => `
                    <div class="log-row" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--ios-card); border-radius: 14px; margin-bottom: 8px;">
                        <div>
                            <span style="font-weight: 700;">${l.date}</span>
                            <span style="font-size: 12px; color: var(--ios-gray); margin-left: 8px;">${l.totalScore >= 140 ? '✅ 达标' : '❌ 未达标'}</span>
                        </div>
                        <div style="font-weight: 800; color: ${l.totalScore >= 140 ? 'var(--ios-green)' : 'var(--ios-red)'}">${l.totalScore} PTS</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p>加载趋势失败: ${e.message}</p>`;
    }
}
async function renderWeekStrip() {
    // 获取本周日期 (简单实现：取今日前后各3天)
    const days = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        days.push({
            date: d.toISOString().split('T')[0],
            dow: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
            dom: d.getDate()
        });
    }

    UI.weekStrip.innerHTML = days.map(d => `
        <div class="day-pill ${d.date === state.selectedDate ? 'active' : ''}" data-date="${d.date}">
            <span class="dow">${d.dow}</span>
            <span class="dom">${d.dom}</span>
        </div>
    `).join('');

    UI.weekStrip.querySelectorAll('.day-pill').forEach(pill => {
        pill.onclick = async () => {
            state.selectedDate = pill.dataset.date;
            document.getElementById('current-date').innerText = state.selectedDate;
            await loadDayData();
            renderActiveTab();
        };
    });
}

// --- Shared Components (Subtasks, Controls, Events) ---
function renderItemMeta(item) {
    const val = state.answers[item.id];

    // 1. 守分型 (Initial-Point Penalty)
    if (item.type === 'meals') {
        const current = item.score - (val || 0) * 5;
        const color = current < item.score ? 'var(--ios-red)' : 'var(--ios-green)';
        return `剩 <b style="color:${color}">${current}</b> 分 (初始 ${item.score})`;
    }
    if (item.type === 'reminders') {
        const c = val || 0;
        const deduction = (c === 1 ? 5 : c === 2 ? 10 : c > 2 ? 10 + (c - 2) * 5 : 0);
        const current = item.score - deduction;
        const color = current < item.score ? 'var(--ios-red)' : 'var(--ios-green)';
        return `剩 <b style="color:${color}">${current}</b> 分 (初始 ${item.score})`;
    }

    // 2. 惩罚型 (Accumulative Penalty)
    if (item.type === 'penalty') {
        const deducted = (val || 0) * item.score;
        return deducted > 0 ? `<span style="color:var(--ios-red)">已扣分：-${deducted}</span>` : `做错扣：-${item.score} / 次`;
    }

    // 3. 通用加分类 (Positive Tasks)
    if (item.type === 'check' || item.type === 'class') {
        return val ? `<span style="color:var(--ios-green)">已加分：+${item.score}</span>` : `完成后：+${item.score} 分`;
    }
    if (item.type === 'subtasks' || item.type === 'bonus_subtasks') {
        const count = (val || []).length;
        const earned = count * 5;
        const max = item.max || (item.subtasks.length * 5);
        return `已得 <b style="color:var(--ios-green)">${earned}</b> / 最高 ${max}`;
    }
    if (item.type === 'exercise') {
        const c = val || 0;
        const earned = c > 0 ? (20 + (c - 1) * 15) : 0;
        return c > 0 ? `已赢取：<b style="color:var(--ios-green)">${earned}</b> 分` : `完成后：+20 分`;
    }
    if (item.type === 'dots') {
        const count = val || 0;
        const earned = count * item.score;
        return earned > 0 ? `已赢取：<b style="color:var(--ios-green)">${earned}</b> 分` : `每点：+${item.score} 分`;
    }

    return `${item.score} 分`;
}

function renderSubtasks(item) {
    const val = state.answers[item.id] || [];
    return `<div class="sub-row">${item.subtasks.map((st, idx) => `
        <div class="chip ${val.includes(idx) ? 'active' : ''}" data-idx="${idx}">${st}</div>
    `).join('')}</div>`;
}

function renderControl(item) {
    const val = state.answers[item.id];
    if (item.type === 'check' || item.type === 'class') return `<div class="ios-check ${val ? 'checked' : ''}"></div>`;
    if (item.type === 'reminders' || item.type === 'penalty') {
        const isWarning = (val > 0) ? 'is-warning' : '';
        return `<div class="ios-counter"><button class="c-btn minus">−</button><span class="c-val ${isWarning}">${val || 0}</span><button class="c-btn plus">+</button></div>`;
    }

    if (item.type === 'exercise' || item.type === 'dots' || item.type === 'meals') {
        const count = item.type === 'meals' ? 3 : (item.count || 5);
        const colorClass = item.type === 'meals' ? 'is-red' : 'is-blue';
        let dots = '';
        for (let i = 1; i <= count; i++) {
            dots += `<div class="ios-dot ${i <= (val || 0) ? 'active ' + colorClass : ''}" data-idx="${i}"></div>`;
        }
        return `<div class="ios-dots">${dots}</div>`;
    }
    return '';
}

// --- 权限判定助手 (单向铁律 V2.5 幽默版) ---
function checkEditPermission(itemId, action, newVal = null) {
    if (!state.currentUser || state.currentUser.role === 'parent') return true;

    // 1. 日期锁定 (不能改今天之前的)
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (state.selectedDate < today) {
        showDialog("历史锁定", "🔒 历史记录已锁定，如需修改请找爸爸妈妈。");
        return false;
    }

    const funnySuffix = [
        " 😂", " 😁", " 🤪", " 🫣", " 🤠", " 🤡",
        "\n\n“床前明月光，作业写得慌。”",
        "\n\n“春眠不觉晓，处处蚊子咬。”",
        "\n\n“少壮不努力，长大没KFC。”",
        "\n\n“天生我材必有用，哪怕只是去蹦迪。”",
        "\n\n“只要我不尴尬，尴尬的就是别人。”",
        "\n\n“落子无悔真君子，反悔你就没零食。”",
        "\n\n“白日依山尽，积分快用尽。”"
    ];
    const getRandomSuffix = () => funnySuffix[Math.floor(Math.random() * funnySuffix.length)];
    const baseMsg = "🚫 落子无悔！此项已填好，不能再修改了。";

    const oldVal = state.answers[itemId];

    // 2. 类型化单向逻辑
    if (action === 'toggle-check') {
        if (oldVal === true) {
            showDialog("落子无悔", baseMsg + getRandomSuffix());
            return false;
        }
    } else if (action === 'decrease') {
        showDialog("只能增加", baseMsg + getRandomSuffix());
        return false;
    } else if (action === 'set-dots') {
        const currentProgress = oldVal || 0;
        // 核心变更：只能增加 1，不能跨级，不能减少
        if (newVal !== currentProgress + 1) {
            const extra = newVal <= currentProgress ? "不能倒退哦！" : "不能跳级，要一步一个脚印！";
            showDialog("操作受限", `🚫 ${extra}` + getRandomSuffix());
            return false;
        }
    } else if (action === 'toggle-chip') {
        if (Array.isArray(oldVal) && oldVal.includes(newVal)) {
            showDialog("锁定项", baseMsg + getRandomSuffix());
            return false;
        }
    } else if (action === 'edit-num') {
        if (newVal <= (oldVal || 0)) {
            showDialog("只能填更大", baseMsg + getRandomSuffix());
            return false;
        }
    }

    return true;
}

function bindItemEvents(item) {
    const el = document.getElementById(`item-${item.id}`);
    if (!el) return;

    const update = () => { updateUI(); syncData(); renderActiveTab(); };

    if (item.type === 'check' || item.type === 'class') {
        el.onclick = () => {
            if (!checkEditPermission(item.id, 'toggle-check')) return;
            state.answers[item.id] = !state.answers[item.id];
            update();
        };
    }
    if (item.type === 'reminders' || item.type === 'penalty') {
        el.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            if (!checkEditPermission(item.id, 'decrease')) return;
            state.answers[item.id] = Math.max(0, (state.answers[item.id] || 0) - 1);
            update();
        };
        el.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
            // 增加操作不拦截（如果是大人或者正常范围内）
            state.answers[item.id] = (state.answers[item.id] || 0) + 1;
            update();
        };

        const valEl = el.querySelector('.c-val');
        if (valEl) {
            valEl.ondblclick = (e) => {
                e.stopPropagation();
                showEditModal(item.text, state.answers[item.id] || 0, (newValStr) => {
                    const num = parseInt(newValStr);
                    if (!isNaN(num)) {
                        if (!checkEditPermission(item.id, 'edit-num', num)) return;
                        state.answers[item.id] = Math.max(0, num);
                        update();
                    }
                });
            };
        }
    }
    if (item.type === 'exercise' || item.type === 'meals' || item.type === 'dots') {
        el.querySelectorAll('.ios-dot').forEach(dot => {
            dot.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.idx);
                const current = state.answers[item.id] || 0;

                // 权限检查
                if (!checkEditPermission(item.id, 'set-dots', idx)) return;

                // 家长特权：如果点击的是当前已达到的最高点，则视为“反选/撤销”
                if (state.currentUser.role === 'parent' && current === idx) {
                    state.answers[item.id] = idx - 1;
                } else {
                    state.answers[item.id] = idx;
                }
                update();
            };
        });
    }
    if (item.type === 'subtasks' || item.type === 'bonus_subtasks') {
        el.querySelectorAll('.chip').forEach(chip => {
            chip.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.idx);
                if (!checkEditPermission(item.id, 'toggle-chip', idx)) return;
                let current = state.answers[item.id] || [];
                if (current.includes(idx)) {
                    state.answers[item.id] = current.filter(i => i !== idx);
                } else {
                    state.answers[item.id] = [...current, idx];
                }
                update();
            };
        });
    }
}

// --- Calculations ---
function calculateScore() {
    let total = 0;
    let requiredDone = true;

    categories.forEach(cat => {
        cat.items.forEach(item => {
            const val = state.answers[item.id];

            if (item.type === 'meals') {
                total += item.score;
                total -= (val || 0) * 5;
            }
            if (item.type === 'reminders') {
                total += item.score;
                const c = val || 0;
                total -= (c === 1 ? 5 : c === 2 ? 10 : c > 2 ? 10 + (c - 2) * 5 : 0);
            }
            if (item.type === 'check' || item.type === 'class') {
                if (val) total += item.score;
                if (item.required && !val) requiredDone = false;
            }
            if (item.type === 'subtasks' || item.type === 'bonus_subtasks') {
                const count = (val || []).length;
                total += count * 5;
                if (item.id === 7 && item.required && count < 1) requiredDone = false;
            }
            if (item.type === 'exercise') {
                const c = val || 0;
                if (c > 0) total += 20 + (c - 1) * 15;
                else if (item.required) requiredDone = false;
            }
            if (item.type === 'dots') {
                total += (val || 0) * item.score;
            }
        });
    });

    // 核心：计算新课程积分 (ID 101, 102, 103)
    const COURSES = [
        { id: 101, score: 20 },
        { id: 102, score: 15 },
        { id: 103, score: 15 }
    ];
    COURSES.forEach(c => {
        if (state.answers[c.id]) total += c.score;
    });

    total += (state.stars || 0) * 10;
    return { total, requiredDone };
}

function updateUI() {
    const { total, requiredDone } = calculateScore();
    document.getElementById('total-score').innerText = total;
    const badge = document.getElementById('unlock-badge');
    const timeText = document.getElementById('time-text');
    const progress = document.getElementById('score-progress');
    const targetEl = document.getElementById('target-score');

    const starDisplay = document.getElementById('stars-count-display');
    if (starDisplay) {
        starDisplay.innerText = state.stars > 0 ? `✨ x${state.stars}` : '';
    }

    const basePoints = 140;
    const pointsPerSlot = 20;

    const earnedSlots = (total >= basePoints && requiredDone)
        ? 1 + Math.floor((total - basePoints) / pointsPerSlot)
        : 0;

    const totalSlots = Math.max(earnedSlots, state.usedSlots);

    let nextThreshold = basePoints;
    const currentMaxIdx = Math.max(earnedSlots, state.usedSlots);
    if (currentMaxIdx > 0) {
        nextThreshold = basePoints + currentMaxIdx * pointsPerSlot;
    }

    targetEl.innerText = nextThreshold;
    progress.style.width = `${Math.min(100, (total / nextThreshold) * 100)}%`;

    if (requiredDone && total >= basePoints) {
        badge.innerText = '🔓 已解锁'; badge.className = 'badge unlocked';
        timeText.innerText = `${totalSlots * 30} min`;
    } else {
        badge.innerText = '🔒 未达成'; badge.className = 'badge locked';
        timeText.innerText = !requiredDone ? '必做项未完' : '积分不足';
    }

    // 传递完整参数给时间券渲染函数
    // - totalSlots: 已获得的时间券数量
    // - pointsToNext: 距离下一个时间券还差多少分
    // - requiredDone: 必做项是否全部完成
    // - total: 当前总分数 (用于判断分数是否已达到基础要求)
    // - basePoints: 基础分数要求 (140分)
    renderSlotsGrid(totalSlots, nextThreshold - total, requiredDone, total, basePoints);
}

/**
 * 渲染娱乐时间券网格
 * @param {number} totalSlots - 已获得的时间券总数 (包括已使用的)
 * @param {number} pointsToNext - 距离下一个时间券的积分差
 * @param {boolean} requiredDone - 必做项是否全部完成
 * @param {number} currentTotal - 当前总积分
 * @param {number} basePoints - 基础分数要求 (默认140)
 * 
 * Bug修复说明:
 * - 之前只传递 pointsToNext,当分数超过基础要求但必做项未完成时,会错误显示"还差 xx 分"
 * - 现在通过传递 currentTotal 和 basePoints,能准确区分"分数不够"和"必做项未完成"两种情况
 */
function renderSlotsGrid(totalSlots, pointsToNext, requiredDone, currentTotal, basePoints) {
    const dashboard = document.querySelector('.floating-dashboard');
    // 检查或创建容器
    let container = document.getElementById('slots-pnl');
    if (!container) {
        container = document.createElement('div');
        container.id = 'slots-pnl';
        container.className = 'slots-container';
        dashboard.appendChild(container);
    }

    const availableCount = totalSlots - state.usedSlots;
    // 🔍 布局修复：只要总获得的券数超过 4 个（第一排容量），或者可用券数即将满一排，就展示两排 (8个)
    const maxDisplay = (totalSlots > 4 || availableCount >= 4) ? 8 : 4;
    let html = `
        <div class="slots-header">
            <span class="slots-title">娱乐时间券 (30min/张)</span>
            <span style="font-size:11px; color:#30d158; font-weight:700">可用: ${Math.max(0, totalSlots - state.usedSlots)}</span>
        </div>
        <div class="slots-grid">
    `;

    for (let i = 1; i <= maxDisplay; i++) {
        let statusClass = 'locked';
        let statusText = '需解锁';
        let icon = '🔒';

        if (i <= totalSlots) {
            if (i <= state.usedSlots) {
                statusClass = 'used';
                statusText = '已消耗';
                icon = '✅';
            } else {
                statusClass = 'available';
                statusText = '点我核销';
                icon = '🎫';
            }
        } else if (i === totalSlots + 1) {
            // 🔍 关键 Bug 修复点: 区分两种"未解锁"情况
            // 
            // 场景1: 分数已达标 (如 155分 >= 140), 但必做项未完成
            //   → 显示: "完成必做项" (提示用户真正的阻塞原因)
            // 
            // 场景2: 分数未达标 (如 120分 < 140)
            //   → 显示: "还差 20 分" (提示用户需要继续积分)
            // 
            // 之前的Bug: 只用 pointsToNext 判断,当场景1时会显示"还差-15分"(取绝对值后变成"还差15分")
            // 修复后: 通过 currentTotal >= basePoints 准确区分两种场景
            if (currentTotal >= basePoints && requiredDone === false) {
                // 分数已达标,只是必做项未完成
                statusText = '完成必做项';
            } else {
                // 分数真的不够
                statusText = `还差 ${Math.abs(pointsToNext)} 分`;
            }
        }

        html += `
            <div class="time-slot ${statusClass}" data-idx="${i}">
                <span class="slot-time">${statusClass === 'locked' ? icon : '30'}</span>
                <span class="slot-status">${statusClass === 'locked' ? statusText : (statusClass === 'available' ? '使用' : statusText)}</span>
            </div>
        `;
    }

    html += `</div>`;
    if (totalSlots > 0 && pointsToNext > 0) {
        // 优先检查必做项状态，避免误导用户
        if (requiredDone === false) {
            html += `<div class="next-unlock-hint">⚠️ 请先完成必做项才能解锁更多时间</div>`;
        } else {
            html += `<div class="next-unlock-hint">🚀 再得 ${pointsToNext} 积分解锁下一个 30min</div>`;
        }
    }
    container.innerHTML = html;

    // 绑定点击交互 (仅家长可操作)
    container.querySelectorAll('.time-slot').forEach(slot => {
        const idx = parseInt(slot.dataset.idx);

        slot.onclick = () => {
            const isParent = state.currentUser.role === 'parent';

            if (slot.classList.contains('available')) {
                // 核销操作：家长和孩子都可以执行
                showDialog("核销确认", `确认要消费这张 30min 娱乐券吗？`, async () => {
                    state.usedSlots = idx;
                    updateUI();
                    await syncData();
                    showToast("核销成功！快去玩吧 🎮");
                }, true, true);
            } else if (slot.classList.contains('used')) {
                // 反核销（恢复可用）：仅限家长执行
                if (!isParent) {
                    return showDialog("需要权限", "只有爸爸妈妈可以恢复已使用的奖券哦！");
                }
                showDialog("恢复可用", `确认要将这张券恢复为“可用”状态吗？`, async () => {
                    state.usedSlots = idx - 1;
                    updateUI();
                    await syncData();
                    showToast("已恢复为可用状态 🔓");
                }, true, true);
            }
        };
    });
}

function showToast(msg) {
    const t = document.getElementById('toast') || document.getElementById('ios-notification');
    if (!t) return;

    if (t.id === 'ios-notification') {
        const title = document.getElementById('banner-title');
        const desc = document.getElementById('banner-desc');
        if (title) title.innerText = "提示";
        if (desc) desc.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    } else {
        t.innerText = msg; t.className = 'toast show';
        setTimeout(() => t.className = 'toast', 3000);
    }
}

function updateBillboard() {
    try {
        const d = new Date();
        // 1. 公历年月日：2026年1月30日
        const solarStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

        // 2. 农历日期 · 星期：腊月十二 · 星期五
        const dow = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];

        const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
            month: 'long',
            day: 'numeric'
        });
        const lunarParts = lunarFormatter.formatToParts(d);
        const lMonth = lunarParts.find(p => p.type === 'month').value;
        const lDayNum = parseInt(lunarParts.find(p => p.type === 'day').value);

        // 简易农历日期转换
        const days = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
            "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
            "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
        const lDay = days[lDayNum] || lDayNum;
        const lunarStr = `${lMonth}${lDay}`;

        const solarEl = document.getElementById('solar-text');
        const lunarEl = document.getElementById('lunar-text');

        if (solarEl) solarEl.innerText = solarStr;
        if (lunarEl) lunarEl.innerText = `${lunarStr} · ${dow}`;
    } catch (e) {
        console.error("Billboard update failed:", e);
    }
}

init();
startClock();

function showEditModal(title, currentVal, callback) {
    const modal = document.getElementById('edit-modal');
    const display = document.getElementById('modal-input-display');
    const desc = document.getElementById('modal-desc');

    desc.innerText = `正在修改: ${title}`;
    let currentInput = String(currentVal || "");
    display.innerText = currentInput || "0";
    modal.style.display = 'flex';

    const updateDisplay = () => {
        display.innerText = currentInput || "0";
    };

    // 清除并重新绑定按键
    const keys = modal.querySelectorAll('.key:not(.empty)');
    keys.forEach(key => {
        const newKey = key.cloneNode(true);
        key.parentNode.replaceChild(newKey, key);
        newKey.onclick = () => {
            if (newKey.classList.contains('delete')) {
                currentInput = currentInput.slice(0, -1);
            } else {
                if (currentInput.length < 4) { // 限制长度
                    currentInput += newKey.innerText;
                }
            }
            updateDisplay();
        };
    });

    const close = () => { modal.style.display = 'none'; };
    document.getElementById('modal-cancel').onclick = close;
    document.getElementById('modal-confirm').onclick = () => {
        if (currentInput !== "") callback(currentInput);
        close();
    };
}

function showDialog(title, msg, onConfirm = null, isConfirm = false, isDestructive = false) {
    const modal = document.getElementById('dialog-modal');
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-msg').innerText = msg;
    const confirmBtn = document.getElementById('dialog-confirm');
    const cancelBtn = document.getElementById('dialog-cancel');

    modal.style.display = 'flex';
    cancelBtn.style.display = isConfirm ? 'block' : 'none';

    // 如果是危险操作，按钮变红色
    confirmBtn.classList.toggle('destructive', isDestructive);

    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 1. 如果不是确认模式，3秒后自动消失，且不选再点确定
    if (!isConfirm) {
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        }, 3000);
    }
}

// --- PIN Pad Logic ---
function showPinPad(user, callback) {
    const overlay = document.getElementById('pin-overlay');
    const dots = overlay.querySelectorAll('.dot');
    const avatar = document.getElementById('pin-user-avatar');
    const name = document.getElementById('pin-user-name');

    avatar.innerText = user.avatar || '👤';
    name.innerText = user.name;
    overlay.style.display = 'flex';

    let currentInput = "";
    const updateDots = () => {
        dots.forEach((dot, i) => dot.classList.toggle('filled', i < currentInput.length));
    };

    // 清除并重新绑定按键
    const keys = overlay.querySelectorAll('.key:not(.empty)');
    keys.forEach(key => {
        key.replaceWith(key.cloneNode(true)); // 彻底清除旧监听器
    });

    const newKeys = overlay.querySelectorAll('.key:not(.empty)');
    newKeys.forEach(key => {
        key.onclick = async () => {
            if (key.classList.contains('delete')) {
                currentInput = currentInput.slice(0, -1);
            } else {
                currentInput += key.innerText;
            }
            updateDots();

            if (currentInput.length === 4) {
                const success = await callback(currentInput);
                if (success === false) {
                    currentInput = "";
                    updateDots();
                } else {
                    overlay.style.display = 'none';
                }
            }
        };
    });

    document.getElementById('pin-cancel').onclick = () => {
        overlay.style.display = 'none';
    };
}

async function showLoginReport() {
    const { total } = calculateScore();
    try {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            body: JSON.stringify({
                userId: state.currentUser.id,
                score: total,
                role: state.currentUser.role,
                familyId: state.familyId
            })
        });

        const data = await res.json();

        if (data.success) {
            const banner = document.getElementById('ios-notification');
            const title = document.getElementById('banner-title');
            const desc = document.getElementById('banner-desc');

            title.innerText = data.title;
            desc.innerText = data.desc;

            setTimeout(() => {
                banner.classList.add('show');
            }, 500);

            setTimeout(() => banner.classList.remove('show'), 3000);
        }
    } catch (e) {
        console.error("Login report failed:", e);
    }
}

// --- 嘉奖特效系统 ---
function triggerCelebration(msg) {
    const overlay = document.getElementById('celebration-overlay');
    const msgEl = document.getElementById('celebration-msg');

    msgEl.innerText = msg || "爸爸妈妈觉得你表现得太棒了，特发此星！";
    overlay.style.display = 'flex';

    // 触发粒子爆发
    createStarBlast();

    document.getElementById('celebration-close').onclick = () => {
        overlay.style.display = 'none';
    };
}

function createStarBlast() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 60;
    const colors = ['#ffcc00', '#ffffff', '#ffdb58', '#ffd700'];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            size: Math.random() * 8 + 4,
            speedX: (Math.random() - 0.5) * 15,
            speedY: (Math.random() - 0.5) * 15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1,
            gravity: 0.2
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (p.opacity > 0) {
                p.x += p.speedX;
                p.y += p.speedY;
                p.speedY += p.gravity;
                p.opacity -= 0.01;

                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.beginPath();
                // 绘制五角星或小圆点
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                active = true;
            }
        });

        if (active) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
}

