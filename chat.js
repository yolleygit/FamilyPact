/**
 * chat.js - 独立出的交流模块 (V3 Redesign)
 */

// 外部依赖 (由 main.js 提供或注入)
let appState = null;
let uiHandlers = {};
let selectedChildId = null; // 当前选中的孩子 ID，用于过滤消息

export function initChat(state, handlers) {
    appState = state;
    uiHandlers = handlers;

    // 初始化逻辑：
    // 家长端：默认进入“公告栏”模式 (selectedChildId = null)
    if (state.currentUser.role === 'parent') {
        selectedChildId = null;
    } else {
        // 孩子端：默认选中第一个家长（虽然孩子同时看两个板子，但私信需要一个默认接收人）
        const parents = state.users?.filter(u => u.role === 'parent') || [];
        if (parents.length > 0) {
            selectedChildId = parents[0].id;
        }
    }
}

export async function fetchMessages(isSilent = false) {
    if (!appState.familyId) return;
    try {
        const res = await fetch(`/api/messages?familyId=${appState.familyId}&userId=${appState.currentUser.id}&role=${appState.currentUser.role}`);
        const data = await res.json();
        if (data.success) {
            const oldMessages = JSON.stringify(appState.messages);
            appState.messages = data.messages;
            if (appState.activeTab === 'F' && oldMessages !== JSON.stringify(appState.messages)) {
                renderChatMessages();
            }
        }
    } catch (e) {
        console.error('Fetch messages error:', e);
    }
}

export function renderChatTab(container) {
    // 隐藏顶部的孩子切换器 (Lele/Xiaoxiao)
    const carousel = document.getElementById('child-carousel');
    if (carousel) carousel.style.display = 'none';

    // 2. 留言/私信 (Private Messages)
    const isParent = appState.currentUser.role === 'parent';

    // 孩子端进入时，默认选中第一个家长，实现“无感”但“隔离”
    if (!isParent && !selectedChildId) {
        const firstParent = appState.users.find(u => u.role === 'parent');
        if (firstParent) selectedChildId = firstParent.id;
    }

    container.innerHTML = `
        <div class="chat-view apple-style">
            
            <!-- 1. 家庭公告 (Notice Board) -->
            <div class="chat-section notice-board">
                <div class="notice-header">
                    <span class="notice-icon">📢</span>
                    <span class="notice-title">家庭通知栏</span>
                    <span class="notice-badge">全员可见</span>
                    ${appState.currentUser.role === 'parent' ? '<button id="clear-notices-btn" class="clear-btn">🗑️ 清空</button>' : ''}
                </div>
                <div id="notice-list" class="message-stream notice-stream">
                    <!-- 动态加载 -->
                </div>
            </div>

            <!-- 2. 留言/私信 (Private Messages) -->
            <div class="chat-section dm-board">
                <div class="section-title">
                    <span class="icon">💬</span> ${appState.currentUser.role === 'parent' ? '孩子留言' : '悄悄话'}
                    <span class="badge">${appState.currentUser.role === 'parent' ? '私信' : '仅父母可见'}</span>
                    <button id="clear-feedbacks-btn" class="clear-btn">🗑️ 清空</button>
                </div>
                <div id="message-list" class="message-stream">
                    <!-- 动态加载 -->
                </div>
            </div>

            <!-- 底部输入区 -->
            <div class="chat-composer">
                ${renderCapsulePicker()}
                <div class="input-bar">
                    <textarea id="chat-input" placeholder="${appState.currentUser.role === 'parent' ? '发布家庭公告...' : '给爸爸妈妈留言...'}" rows="1"></textarea>
                    <button id="chat-send-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 4L12 20M12 4L5 11M12 4L19 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // 自动高度处理
    const input = document.getElementById('chat-input');
    input.addEventListener('input', () => {
        input.style.height = 'auto'; // Reset 
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    document.getElementById('chat-send-btn').onclick = sendMessage;
    bindPickerEvents();

    fetchMessages();
}

function renderCapsulePicker() {
    // 胶囊选择器：仅在需要定向发送时显示
    // 父母：[全员公告(默认)] [给乐乐] [给笑笑]
    // 孩子：[留言(默认)] [给爸爸] [给妈妈]

    let options = [];
    if (appState.currentUser.role === 'parent') {
        const children = appState.users.filter(u => u.role === 'child');
        options = [
            { id: 'notice', label: '发布公告', icon: '📢', type: 'notice' },
            ...children.map(c => ({ id: c.id, label: c.name, icon: c.avatar || '👶', type: 'feedback' }))
        ];
    } else {
        // 孩子端：只显示爸爸/妈妈选项
        const parents = appState.users.filter(u => u.role === 'parent');
        options = parents.map(p => ({ id: p.id, label: p.name, icon: p.avatar || '👤', type: 'feedback' }));
    }

    return `
        <div class="capsule-picker">
            ${options.map((opt, idx) => {
        // 判断逻辑：
        // 如果是公告选项且 selectedChildId 是 null -> active
        // 如果是私信选项且其 ID 等于 selectedChildId -> active
        const isActive = (opt.type === 'notice' && selectedChildId === null) ||
            (opt.type === 'feedback' && opt.id === selectedChildId);
        return `
                <button class="capsule-btn ${isActive ? 'active' : ''}" 
                        data-id="${opt.id}" 
                        data-type="${opt.type}">
                    <span class="emoji">${opt.icon}</span>
                    <span class="text">${opt.label}</span>
                </button>
                `;
    }).join('')}
        </div>
    `;
}

export function bindChatEvents() {
    // main.js 可能还会调这个，保留空函数或指向新的 bindPickerEvents
    bindPickerEvents();
}

function bindPickerEvents() {
    const picker = document.querySelector('.capsule-picker');
    if (!picker) return;

    picker.querySelectorAll('.capsule-btn').forEach(btn => {
        btn.onclick = () => {
            picker.querySelectorAll('.capsule-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新输入框 placeholder
            const input = document.getElementById('chat-input');
            const type = btn.dataset.type;
            const text = btn.querySelector('.text').innerText;
            const childId = btn.dataset.id;

            if (type === 'notice') {
                input.placeholder = "发布全家可见的公告...";
                selectedChildId = null; // 公告模式不过滤
            } else {
                input.placeholder = `发送给 ${text}...`;
                selectedChildId = childId; // 更新选中的孩子
            }
            // 重新渲染消息列表（过滤）
            renderChatMessages();
        };
    });
}

function renderChatMessages() {
    const noticeBoard = document.querySelector('.notice-board');
    const dmBoard = document.querySelector('.dm-board');
    const noticeList = document.getElementById('notice-list');
    const messageList = document.getElementById('message-list');
    if (!noticeList || !messageList) return;

    const notices = appState.messages.filter(m => m.type === 'notice');
    let feedbacks = appState.messages.filter(m => m.type === 'feedback');

    // 重点：无论是家长还是孩子，只要选中了对象，就只显示与该对象的私聊
    if (selectedChildId) {
        feedbacks = feedbacks.filter(m =>
            m.sender_id === selectedChildId || m.recipient_id === selectedChildId
        );
    }

    // 根据角色和模式切换显示
    const isParent = appState.currentUser.role === 'parent';
    const isNoticeMode = (selectedChildId === null && isParent);

    if (isParent) {
        if (isNoticeMode) {
            // 家长公告模式：只显示公告区，隐藏私信区
            if (noticeBoard) noticeBoard.style.display = 'flex';
            if (dmBoard) dmBoard.style.display = 'none';

            noticeList.innerHTML = notices.length === 0
                ? '<div class="chat-empty">暂无家庭公告</div>'
                : notices.map(renderMessageItem).join('');
        } else {
            // 家长私信模式：只显示私信区，隐藏公告区
            if (noticeBoard) noticeBoard.style.display = 'none';
            if (dmBoard) dmBoard.style.display = 'flex';

            const selectedChild = appState.users.find(u => u.id === selectedChildId);
            const emptyMsg = selectedChild
                ? `<div class="chat-empty">暂无与 ${selectedChild.name} 的对话</div>`
                : '<div class="chat-empty">暂无私密留言</div>';

            messageList.innerHTML = feedbacks.length === 0
                ? emptyMsg
                : feedbacks.map(renderMessageItem).join('');
        }
    } else {
        // 孩子端：同时显示公告区和私信区
        if (noticeBoard) noticeBoard.style.display = 'flex';
        if (dmBoard) dmBoard.style.display = 'flex';

        noticeList.innerHTML = notices.length === 0
            ? '<div class="chat-empty">暂无家庭公告</div>'
            : notices.map(renderMessageItem).join('');

        messageList.innerHTML = feedbacks.length === 0
            ? '<div class="chat-empty">暂无私密留言</div>'
            : feedbacks.map(renderMessageItem).join('');
    }

    // 自动滚动到最新消息
    requestAnimationFrame(() => {
        noticeList.scrollTop = noticeList.scrollHeight;
        messageList.scrollTop = messageList.scrollHeight;
    });

    // 绑定清空按钮事件
    const clearBtn = document.getElementById('clear-notices-btn');
    if (clearBtn) {
        clearBtn.onclick = clearAllNotices;
    }
    const clearFeedbacksBtn = document.getElementById('clear-feedbacks-btn');
    if (clearFeedbacksBtn) {
        clearFeedbacksBtn.onclick = clearAllFeedbacks;
    }
}

function renderMessageItem(msg) {
    const isParent = appState.currentUser.role === 'parent';
    // 公告不区分"我发送的"，统一显示为左侧通告样式
    const isMe = msg.type !== 'notice' && msg.sender_id === appState.currentUser.id;

    const date = new Date(msg.created_at);
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const isToday = new Date().toDateString() === date.toDateString();
    const dateStr = isToday ? '' : `${date.getMonth() + 1}/${date.getDate()} `;
    const cuteTime = `${dateStr}${timeStr} 🕒`;

    // 构建发送者/接收者标签
    let infoTag = '';
    if (msg.type === 'feedback') {
        if (isMe && msg.recipient_id) {
            const recipient = appState.users.find(u => u.id === msg.recipient_id);
            infoTag = `<span class="recipient-tag">→ ${recipient?.name || '未知'}</span>`;
        } else if (!isMe) {
            infoTag = `<span class="sender-tag">${msg.sender_avatar} ${msg.sender_name}</span>`;
        }
    } else if (msg.type === 'notice') {
        // 公告：标注发布者
        infoTag = `<span class="sender-tag">📢 ${msg.sender_name}</span>`;
    }

    return `
        <div class="message-item apple-msg ${isMe ? 'is-me' : ''}" data-msg-id="${msg.id}">
            ${!isMe ? `<div class="message-avatar sm">${msg.sender_avatar}</div>` : ''}
            <div class="message-body">
                <div class="message-bubble">${msg.content}
                    ${isParent ? `<button class="delete-msg-inner-btn" onclick="event.stopPropagation(); deleteSingleMessage('${msg.id}')">✕</button>` : ''}
                </div>
                <div class="message-info">${infoTag} ${cuteTime}</div>
            </div>
            ${isMe ? `<div class="message-avatar sm">${msg.sender_avatar}</div>` : ''}
        </div>
    `;
}

// 删除单条消息
window.deleteSingleMessage = async (msgId) => {
    if (!confirm('确定要删除这条消息吗？')) return;
    try {
        const res = await fetch(`/api/messages?familyId=${appState.familyId}&messageId=${msgId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            await fetchMessages();
        } else {
            uiHandlers.showDialog('删除失败', '请稍后重试');
        }
    } catch (e) {
        uiHandlers.showDialog('删除失败', '服务器忙');
    }
};

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    // 获取当前选中的发送对象
    const activeBtn = document.querySelector('.capsule-btn.active');
    let type = 'feedback';
    let recipientId = null;

    if (activeBtn) {
        type = activeBtn.dataset.type;
        const rawId = activeBtn.dataset.id;
        // 如果是 'notice', recipientId 为 null
        // 如果是 'all_parents', recipientId 为 null (或根据后端逻辑处理)
        if (type === 'feedback' && rawId !== 'all_parents') {
            recipientId = rawId;
        }
    }

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;

    try {
        const res = await fetch('/api/messages', {
            method: 'POST',
            body: JSON.stringify({
                familyId: appState.familyId,
                senderId: appState.currentUser.id,
                content: content,
                type: type, // 'notice' or 'feedback'
                recipientId: recipientId
            })
        });

        if (res.ok) {
            input.value = '';
            input.style.height = 'auto';
            input.placeholder = (type === 'notice') ? "发布全家可见的公告..." : `发送给 ${activeBtn.innerText}...`;
            await fetchMessages();
        } else {
            uiHandlers.showDialog('发送失败', '请检查网络连接');
        }
    } catch (e) {
        uiHandlers.showDialog('发送失败', '服务器忙，请重试');
    } finally {
        btn.disabled = false;
    }
}

// 清空所有公告
async function clearAllNotices() {
    if (!confirm('确定要清空所有公告吗？此操作不可撤销。')) return;

    try {
        const res = await fetch(`/api/messages?familyId=${appState.familyId}&type=notice`, {
            method: 'DELETE'
        });
        if (res.ok) {
            await fetchMessages();
        } else {
            uiHandlers.showDialog('清空失败', '请稍后重试');
        }
    } catch (e) {
        uiHandlers.showDialog('清空失败', '服务器忙');
    }
}

// 清空私信（家长按选中孩子，孩子按自己）
async function clearAllFeedbacks() {
    const isParent = appState.currentUser.role === 'parent';

    if (isParent) {
        // 家长：需要选中孩子
        if (!selectedChildId) {
            uiHandlers.showDialog('提示', '请先选择一个孩子');
            return;
        }
        const child = appState.users.find(u => u.id === selectedChildId);
        const childName = child?.name || '该孩子';
        if (!confirm(`确定要清空与 ${childName} 的所有对话吗？此操作不可撤销。`)) return;

        try {
            const res = await fetch(`/api/messages?familyId=${appState.familyId}&type=feedback&childId=${selectedChildId}&userId=${appState.currentUser.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchMessages();
            } else {
                const data = await res.json();
                uiHandlers.showDialog('清空失败', data.error || '请稍后重试');
            }
        } catch (e) {
            uiHandlers.showDialog('清空失败', '服务器忙');
        }
    } else {
        // 孩子：清空与当前选中家长的所有私信
        if (!selectedChildId) {
            uiHandlers.showDialog('提示', '请先选择一位家长');
            return;
        }
        const parent = appState.users.find(u => u.id === selectedChildId);
        const parentName = parent?.name || '家长';
        if (!confirm(`确定要清空与 ${parentName} 的所有悄悄话吗？此操作不可撤销。`)) return;

        try {
            const res = await fetch(`/api/messages?familyId=${appState.familyId}&type=feedback&childId=${selectedChildId}&userId=${appState.currentUser.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchMessages();
            } else {
                const data = await res.json();
                uiHandlers.showDialog('清空失败', data.error || '请稍后重试');
            }
        } catch (e) {
            uiHandlers.showDialog('清空失败', '服务器忙');
        }
    }
}
