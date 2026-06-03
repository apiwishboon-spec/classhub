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

const chatHTML = `
    <!-- Floating Feedback Button -->
    <button id="open-feedback" style="position: fixed; bottom: 2rem; right: 2rem; width: 60px; height: 60px; border-radius: 30px; background: var(--accent-color); color: white; border: none; box-shadow: 0 4px 15px rgba(15, 98, 254, 0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; transition: transform 0.2s ease;">
        <img src="chaticon.png" alt="Chat" style="width: 35px; height: 35px; object-fit: contain;">
    </button>

    <div id="feedback-modal" class="modal-overlay">
        <div class="modal-card" style="display: block; max-width: 500px; padding: 1.5rem !important;">
            <h3 style="margin-bottom: 0.5rem !important;"><i class="ph ph-chat-centered-text"></i> Message Teacher</h3>
            <p style="margin-bottom: 1rem !important; font-size: 0.9rem !important;">Send an anonymous message or question to the teacher.</p>
            
            <!-- Message History -->
            <div id="feedback-history" style="max-height: 250px; overflow-y: auto; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem; padding-right: 5px;">
                <!-- Messages will be injected here -->
            </div>

            <div class="admin-form-stack">
                <textarea id="feedback-text" placeholder="Type a new message..." class="form-input" rows="3" style="border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.9rem;"></textarea>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="checkbox" id="feedback-urgent">
                    <label for="feedback-urgent" style="font-size: 0.8rem; color: var(--danger); font-weight: 600;">Mark as Urgent</label>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" id="close-feedback">Cancel</button>
                    <button class="btn-primary" id="send-feedback">Send Message</button>
                </div>
            </div>
        </div>
    </div>
`;

function injectChat() {
    if (document.getElementById('open-feedback')) return;
    const div = document.createElement('div');
    div.innerHTML = chatHTML;
    document.body.appendChild(div);

    const openFeedbackBtn = document.getElementById('open-feedback');
    const closeFeedbackBtn = document.getElementById('close-feedback');
    const sendFeedbackBtn = document.getElementById('send-feedback');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackText = document.getElementById('feedback-text');
    const feedbackUrgent = document.getElementById('feedback-urgent');
    const feedbackHistory = document.getElementById('feedback-history');

    if (openFeedbackBtn) {
        openFeedbackBtn.addEventListener('click', () => {
            feedbackModal.style.display = 'flex';
            feedbackText.value = '';
            feedbackUrgent.checked = false;
            refreshFeedbackHistory();
        });

        // Hover effect
        openFeedbackBtn.addEventListener('mouseenter', () => {
            openFeedbackBtn.style.transform = 'scale(1.1)';
        });
        openFeedbackBtn.addEventListener('mouseleave', () => {
            openFeedbackBtn.style.transform = 'scale(1)';
        });
    }

    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', () => {
            feedbackModal.style.display = 'none';
        });
    }

    if (sendFeedbackBtn) {
        sendFeedbackBtn.addEventListener('click', async () => {
            const text = feedbackText.value.trim();
            if (!text) return;

            sendFeedbackBtn.disabled = true;
            sendFeedbackBtn.textContent = 'Sending...';

            try {
                const docRef = await addDoc(collection(db, "feedback"), {
                    message: text,
                    urgent: feedbackUrgent.checked,
                    status: 'new',
                    createdAt: serverTimestamp()
                });
                
                const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
                myMessages.push(docRef.id);
                localStorage.setItem('my_feedback_ids', JSON.stringify(myMessages));
                listenForReplies(docRef.id);

                showToast("Message sent to teacher!", "ph-paper-plane-tilt", "var(--success)");
                feedbackModal.style.display = 'none';
            } catch (e) {
                showToast("Error sending message: " + e.message, "ph-x", "var(--danger)");
            } finally {
                sendFeedbackBtn.disabled = false;
                sendFeedbackBtn.textContent = 'Send Message';
            }
        });
    }

    // Resume listening for replies
    const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
    myMessages.forEach(id => listenForReplies(id));
}

async function refreshFeedbackHistory() {
    const feedbackHistory = document.getElementById('feedback-history');
    if (!feedbackHistory) return;
    const myMessages = JSON.parse(localStorage.getItem('my_feedback_ids') || '[]');
    
    if (myMessages.length === 0) {
        feedbackHistory.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center;">No message history yet.</p>';
        return;
    }

    feedbackHistory.innerHTML = '<div class="loader" style="margin: 1rem auto; width: 20px; height: 20px;"></div>';
    
    let html = '';
    const sortedMessages = [];

    for (const id of myMessages) {
        try {
            const docSnap = await getDoc(doc(db, "feedback", id));
            if (docSnap.exists()) {
                sortedMessages.push({ id, ...docSnap.data() });
            }
        } catch (e) { console.error("Error fetching message history", e); }
    }

    sortedMessages.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    sortedMessages.forEach(msg => {
        const date = msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        let conversationHtml = '';
        
        if (msg.reply) {
            conversationHtml += `
                <div style="background: var(--highlight-bg); border-radius: 6px; padding: 0.6rem; border-left: 3px solid var(--accent-color); margin-top: 0.5rem;">
                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--accent-color); margin-bottom: 0.2rem;">TEACHER:</div>
                    <div style="font-size: 0.8rem;">${msg.reply}</div>
                </div>
            `;
        }
        
        if (msg.replies && Array.isArray(msg.replies)) {
            msg.replies.forEach((reply) => {
                const isUser = reply.sender === 'user';
                const replyTime = reply.timestamp ? (reply.timestamp.toDate ? reply.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '';
                conversationHtml += `
                    <div style="background: ${isUser ? 'var(--bg-color)' : 'var(--highlight-bg)'}; border-radius: 6px; padding: 0.6rem; border-left: 3px solid ${isUser ? 'var(--accent-color)' : 'var(--text-secondary)'}; margin-top: 0.5rem;">
                        <div style="font-size: 0.65rem; font-weight: 700; color: ${isUser ? 'var(--accent-color)' : 'var(--text-secondary)'}; margin-bottom: 0.2rem;">
                            ${isUser ? 'YOU' : 'TEACHER'} ${replyTime ? `— ${replyTime}` : ''}
                        </div>
                        <div style="font-size: 0.8rem;">${reply.text}</div>
                    </div>
                `;
            });
        }
        
        html += `
            <div style="background: var(--bg-color); border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-secondary); margin-bottom:0.25rem;">
                    <span>You — ${date}</span>
                    ${msg.status === 'resolved' ? '<span style="color:var(--success);">✔ Solved</span>' : ''}
                </div>
                <div style="font-size:0.85rem; margin-bottom:0.5rem;">${msg.message}</div>
                
                ${conversationHtml ? `
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                        ${conversationHtml}
                    </div>
                ` : ''}
                
                ${conversationHtml ? `
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                        <input type="text" class="form-input feedback-reply-input" placeholder="Reply to teacher..." style="font-size: 0.8rem; padding: 0.4rem; flex: 1;" data-id="${msg.id}">
                        <button class="send-feedback-reply-btn btn-primary" data-id="${msg.id}" style="padding: 0 0.8rem; min-height: auto; font-size: 0.75rem;">Reply</button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    feedbackHistory.innerHTML = html;
    
    document.querySelectorAll('.send-feedback-reply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const input = document.querySelector(`.feedback-reply-input[data-id="${id}"]`);
            const replyText = input.value.trim();
            if (!replyText) return;

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
                    showToast("Reply sent!");
                    refreshFeedbackHistory();
                }
            } catch (e) {
                showToast("Error: " + e.message, "ph-x", "var(--danger)");
            }
        });
    });
}

function listenForReplies(messageId) {
    onSnapshot(doc(db, "feedback", messageId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            if (data.reply && !localStorage.getItem(`reply_seen_${messageId}`)) {
                showToast(`Teacher replied: "${data.reply}"`, "ph-chat-centered-dots", "var(--accent-color)");
                localStorage.setItem(`reply_seen_${messageId}`, 'true');
            }
            
            if (data.replies && Array.isArray(data.replies)) {
                const lastReply = data.replies[data.replies.length - 1];
                if (lastReply && lastReply.sender === 'admin') {
                    const replyKey = `reply_seen_${messageId}_${data.replies.length - 1}`;
                    if (!localStorage.getItem(replyKey)) {
                        showToast(`Teacher replied: "${lastReply.text}"`, "ph-chat-centered-dots", "var(--accent-color)");
                        localStorage.setItem(replyKey, 'true');
                    }
                }
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChat);
} else {
    injectChat();
}
