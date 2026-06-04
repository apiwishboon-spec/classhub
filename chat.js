import { db } from './firebase-config.js';
import { collection, doc, updateDoc, addDoc, serverTimestamp, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

function injectFloatingButton() {
    if (document.getElementById('open-chat-page')) return;
    // Don't inject on chat.html itself
    if (window.location.pathname.includes('chat.html')) return;

    const btn = document.createElement('a');
    btn.id = 'open-chat-page';
    btn.href = 'chat.html';
    btn.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; width: 60px; height: 60px; border-radius: 30px; background: var(--accent-color); color: white; border: none; box-shadow: 0 4px 15px rgba(15, 98, 254, 0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; transition: transform 0.2s ease;';
    btn.innerHTML = `<img src="chaticon.png" alt="Chat" style="width: 35px; height: 35px; object-fit: contain;">`;
    
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    
    document.body.appendChild(btn);
}

async function initChatPage() {
    const historyContainer = document.getElementById('chat-page-history');
    const inputField = document.getElementById('chat-page-input');
    const sendBtn = document.getElementById('chat-page-send');
    const urgentCheckbox = document.getElementById('chat-page-urgent');

    if (!historyContainer) return;

    // Load initial history
    await refreshChatHistory();

    // Setup Send Message
    sendBtn.addEventListener('click', async () => {
        const text = inputField.value.trim();
        if (!text) return;

        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';

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
            inputField.style.height = 'auto'; // Reset height
            urgentCheckbox.checked = false;
            
            // Re-render and listen
            await refreshChatHistory();
            listenForReplies(docRef.id);
        } catch (e) {
            showToast("Error sending message: " + e.message, "ph-x", "var(--danger)");
        } finally {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }
    });

    // Auto-resize textarea
    inputField.addEventListener('input', () => {
        inputField.style.height = 'auto';
        inputField.style.height = (inputField.scrollHeight) + 'px';
    });

    // Enter to send
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
                listenForReplies(id); // Ensure we are listening for everything in history
            }
        } catch (e) { console.error("Error fetching", id, e); }
    }

    // Sort by creation date
    allDocs.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));

    let html = '';
    allDocs.forEach(msg => {
        const date = msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        // Initial Message (Student)
        html += `
            <div class="chat-thread">
                <div class="chat-bubble user">${msg.message}</div>
                <div class="chat-time">${date}</div>
        `;

        // Old Single Reply (Backward Compatibility)
        if (msg.reply) {
            html += `
                <div class="chat-bubble staff">${msg.reply}</div>
                <div class="chat-time" style="color:rgba(0,0,0,0.5); align-self:flex-start;">Staff</div>
            `;
        }

        // Threaded Replies
        if (msg.replies && Array.isArray(msg.replies)) {
            msg.replies.forEach(reply => {
                const isUser = reply.sender === 'user';
                const replyTime = reply.timestamp ? (reply.timestamp.toDate ? reply.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '';
                
                html += `
                    <div class="chat-bubble ${isUser ? 'user' : 'staff'}">${reply.text}</div>
                    <div class="chat-time" style="${!isUser ? 'color:rgba(0,0,0,0.5); align-self:flex-start;' : ''}">${replyTime}</div>
                `;
            });
        }

        html += `</div>`;
    });

    historyContainer.innerHTML = html;
    
    // Setup Reply Buttons
    document.querySelectorAll('.send-feedback-reply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const input = document.querySelector(`.feedback-reply-input[data-id="${id}"]`);
            const replyText = input.value.trim();
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

    // Enter to reply in thread
    document.querySelectorAll('.feedback-reply-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const id = input.getAttribute('data-id');
                document.querySelector(`.send-feedback-reply-btn[data-id="${id}"]`)?.click();
            }
        });
    });

    // Scroll to bottom
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
            
            // If on chat page, refresh history to show new replies immediately
            if (document.getElementById('chat-page-history')) {
                refreshChatHistory();
            }

            // Notification logic
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

document.addEventListener('DOMContentLoaded', () => {
    injectFloatingButton();
    if (document.getElementById('chat-page-history')) {
        initChatPage();
    }
    
    // Resume listening for all previous messages
    const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
    myMessages.forEach(id => listenForReplies(id));
});
