import { db } from './firebase-config.js';
import { collection, doc, updateDoc, addDoc, serverTimestamp, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sanitize } from '../profanity-filter.js';

function showToast(message, icon, color) {
    const container = document.getElementById('toast-container');
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        document.body.appendChild(newContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon"><i class="ph ${icon || 'ph-info'}"></i></span><span class="toast-text">${message}</span>`;
    toast.style.borderLeftColor = color || 'var(--accent-color)';
    document.getElementById('toast-container').appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

async function initChatPage() {
    const historyContainer = document.getElementById('chat-page-history');
    const inputField = document.getElementById('chat-page-input');
    const sendBtn = document.getElementById('chat-page-send');
    const urgentCheckbox = document.getElementById('chat-page-urgent');

    if (!historyContainer) return;

    await refreshChatHistory();

    sendBtn.addEventListener('click', async () => {
        const text = sanitize(inputField.value.trim());
        if (!text) return;

        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div class="chat-loader" style="padding:0; gap:2px;"><span style="width:4px;height:4px;background:white;"></span><span style="width:4px;height:4px;background:white;"></span><span style="width:4px;height:4px;background:white;"></span></div>';

        try {
            const docRef = await addDoc(collection(db, "feedback"), {
                message: text,
                urgent: urgentCheckbox.checked,
                status: 'new',
                createdAt: serverTimestamp()
            });
            
            const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
            myMessages.push(docRef.id);
            localStorage.setItem('my_feedback_ids', JSON.stringify(myMessages));
            
            inputField.value = '';
            urgentCheckbox.checked = false;
            showToast("Message sent to staff!", "ph-paper-plane-tilt", "var(--success)");
            
            await refreshChatHistory();
            listenForReplies(docRef.id);
        } catch (e) {
            showToast("Error sending message: " + e.message, "ph-x", "var(--danger)");
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send Message';
        }
    });

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

async function refreshChatHistory() {
    const historyContainer = document.getElementById('chat-page-history');
    if (!historyContainer) return;

    const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
    
    if (myMessages.length === 0) {
        historyContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">
                <i class="ph ph-chat-circle-dots" style="font-size: 3rem; opacity: 0.2; display: block; margin-bottom: 1rem;"></i>
                <p>No messages yet. Send a message to start a conversation with the staff.</p>
            </div>
        `;
        return;
    }

    let allDocs = [];
    for (const id of myMessages) {
        try {
            const docSnap = await getDoc(doc(db, "feedback", id));
            if (docSnap.exists()) {
                allDocs.push({ id, ...docSnap.data() });
                listenForReplies(id);
            }
        } catch (e) { console.error("Error fetching", id, e); }
    }

    allDocs.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));

    let html = '';
    allDocs.forEach(msg => {
        const date = msg.createdAt ? msg.createdAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now';
        const isResolved = msg.status === 'resolved';
        
        html += `
            <div class="chat-thread ${isResolved ? 'solved' : ''}" style="display: flex; flex-direction: column; gap: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem;">
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                    <div class="chat-bubble user">
                        ${msg.message}
                    </div>
                    <span style="font-size: 0.65rem; color: var(--text-secondary);">${date} · You${isResolved ? ' · Solved' : ''}</span>
                    ${msg.status !== 'new' && msg.status !== 'solved' ? `<span class="seen-indicator">Seen</span>` : ''}
                </div>
        `;

        if (msg.reply) {
            html += `
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem;">
                    <div class="chat-bubble staff">
                        ${msg.reply}
                    </div>
                    <span style="font-size: 0.65rem; color: var(--text-secondary);">Staff Reply</span>
                </div>
            `;
        }

        if (msg.replies && Array.isArray(msg.replies)) {
            msg.replies.forEach(reply => {
                const isUser = reply.sender === 'user';
                const replyTime = reply.timestamp ? (reply.timestamp.toDate ? reply.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '';
                
                html += `
                    <div style="display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'}; gap: 0.25rem;">
                        <div class="chat-bubble ${isUser ? 'user' : 'staff'}">
                            ${reply.text}
                        </div>
                        <span style="font-size: 0.65rem; color: var(--text-secondary);">${replyTime ? `${replyTime} · ` : ''}${isUser ? 'You' : 'Staff'}</span>
                    </div>
                `;
            });
        }

        if (!isResolved) {
            html += `
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; max-width: 100%;">
                    <input type="text" class="form-input feedback-reply-input" placeholder="Reply to staff..." style="font-size: 0.85rem; padding: 0.6rem; flex: 1; border-radius: 20px;" data-id="${msg.id}">
                    <button class="send-feedback-reply-btn btn-primary" data-id="${msg.id}" style="padding: 0 1.25rem; min-height: auto; font-size: 0.8rem; border-radius: 20px;">
                        <i class="ph ph-paper-plane-right"></i>
                    </button>
                </div>
            `;
        }

        html += `</div>`;
    });

    historyContainer.innerHTML = html;
    
    document.querySelectorAll('.send-feedback-reply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const input = document.querySelector(`.feedback-reply-input[data-id="${id}"]`);
            const replyText = sanitize(input.value.trim());
            if (!replyText) return;

            btn.disabled = true;
            try {
                const docSnap = await getDoc(doc(db, "feedback", id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const currentReplies = data.replies || [];
                    
                    await updateDoc(doc(db, "feedback", id), {
                        replies: [...currentReplies, {
                            sender: 'user',
                            text: replyText,
                            timestamp: new Date()
                        }]
                    });
                    input.value = '';
                    showToast("Reply sent!");
                    refreshChatHistory();
                }
            } catch (e) {
                showToast("Error: " + e.message, "ph-x", "var(--danger)");
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.feedback-reply-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const id = input.getAttribute('data-id');
                document.querySelector(`.send-feedback-reply-btn[data-id="${id}"]`)?.click();
            }
        });
    });

    setTimeout(() => {
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }, 100);
}

const activeListeners = new Set();
function listenForReplies(messageId) {
    if (activeListeners.has(messageId)) return;
    activeListeners.add(messageId);

    onSnapshot(doc(db, "feedback", messageId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (document.getElementById('chat-page-history')) {
                refreshChatHistory();
            }
            if (data.reply && !localStorage.getItem(`reply_seen_${messageId}`)) {
                showToast(`Staff replied: "${data.reply}"`, "ph-chat-centered-dots", "var(--accent-color)");
                localStorage.setItem(`reply_seen_${messageId}`, 'true');
            }
            if (data.replies && Array.isArray(data.replies)) {
                const lastReply = data.replies[data.replies.length - 1];
                if (lastReply && lastReply.sender === 'admin') {
                    const replyKey = `reply_seen_${messageId}_${data.replies.length - 1}`;
                    if (!localStorage.getItem(replyKey)) {
                        showToast(`Staff replied: "${lastReply.text}"`, "ph-chat-centered-dots", "var(--accent-color)");
                        localStorage.setItem(replyKey, 'true');
                        if (document.getElementById('chat-page-history')) refreshChatHistory();
                    }
                }
            }
        }
    });
}

function listenForStaffStatus() {
    const statusTextEl = document.getElementById('staff-status-text');
    const statusDotEl = document.getElementById('staff-status-dot');

    onSnapshot(doc(db, "settings", "staff_status"), (docSnap) => {
        let status = 'offline';
        if (docSnap.exists()) {
            status = docSnap.data().status;
        }

        // Update all possible chat icons with the status dot
        const chatIcons = document.querySelectorAll('a[href="./chat.html"], a[href="chat.html"], #open-chat-page, #open-staff-chat');
        chatIcons.forEach(btn => {
            btn.style.position = 'relative';
            let dot = btn.querySelector('.status-dot');
            if (!dot) {
                dot = document.createElement('div');
                dot.className = 'status-dot';
                btn.appendChild(dot);
            }
            dot.className = `status-dot ${status}`;
        });
        
        // Update header display if on chat page
        if (statusTextEl && statusDotEl) {
            statusDotEl.className = `status-dot ${status}`;
            const label = status.charAt(0).toUpperCase() + status.slice(1);
            statusTextEl.textContent = `Staff is ${label}`;
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    // ONLY initialize chat page features if we are on the dedicated chat page
    if (document.getElementById('chat-page-history')) {
        initChatPage();
    }

    // Always listen for status for the navigation icon
    listenForStaffStatus();

    const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
    myMessages.forEach(id => listenForReplies(id));
});
