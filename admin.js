import { db, auth, firebaseConfig, imgbbApiKey } from './firebase-config.js';
import { sanitize } from './profanity-filter.js';

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    getAuth,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, getDoc, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit, onSnapshot, updateDoc, increment, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// Helper functions
async function uploadToImgBB(file) {
    if (!file) return null;
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error.message);
        }
    } catch (error) {
        console.error("ImgBB upload failed:", error);
        showToast("Image upload failed: " + error.message, "ph-x", "var(--danger)");
        return null;
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (savedTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        applySunsetTheme();
    }
}

function applySunsetTheme() {
    const hour = new Date().getHours();
    if (hour < 6 || hour > 18) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

async function setStaffStatus(status) {
    try {
        await setDoc(doc(db, "settings", "staff_status"), { 
            status,
            updatedBy: auth.currentUser ? auth.currentUser.email : 'system',
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) { console.error("Status update failed:", e); }
}

async function checkEmailLinkSignIn() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }
        try {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            showToast("Logged in with email link!");
        } catch (error) {
            showToast("Error logging in: " + error.message, "ph-x", "var(--danger)");
        }
    }
}

// DOM Elements
const loginContainer = document.getElementById('login-container');
console.log("admin.js: Module loading...");
const adminContainer = document.getElementById('admin-container');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const loginSuccess = document.getElementById('login-success');
const logoutBtn = document.getElementById('logout-btn');
const userRoleBadge = document.getElementById('user-role-badge');
const manageUsersSection = document.getElementById('manage-users-section');
const manageScheduleSection = document.getElementById('manage-schedule-section');
const addAnnouncementSection = document.getElementById('add-announcement-section');
const addHomeworkSection = document.getElementById('add-homework-section');
const manageAnnouncementsSection = document.getElementById('manage-announcements-section');
const manageHomeworkSection = document.getElementById('manage-homework-section');
const manageClassBannerSection = document.getElementById('manage-class-banner-section');
const systemSettingsSection = document.getElementById('system-settings-section');
const auditLogSection = document.getElementById('audit-log-section');
const bugReportsSection = document.getElementById('bug-reports-section');
const bugReportsList = document.getElementById('bug-reports-list');
const bugCountBadge = document.getElementById('bug-count-badge');
const feedbackInboxSection = document.getElementById('feedback-inbox-section');
const managePollsSection = document.getElementById('manage-polls-section');
const createPollBtn = document.getElementById('create-poll-btn');
const pollQuestionInput = document.getElementById('poll-question');
const pollOptionsInput = document.getElementById('poll-options');
const activePollsList = document.getElementById('active-polls-list');
const cleanupToggle = document.getElementById('cleanup-toggle');

const addFeatureSection = document.getElementById('add-feature-section');
const manageFeaturesSection = document.getElementById('manage-features-section');

let pollListener = null;
let feedbackListener = null;
let annListener = null;
let hwListener = null;
let userListener = null;
let bugListener = null;
let systemStatesListener = null;
let bannerListener = null;
let featListener = null;

async function performSystemCleanup() {
    const settingsSnap = await getDoc(doc(db, "settings", "maintenance"));
    if (settingsSnap.exists() && settingsSnap.data().cleanupEnabled === false) return;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let deletedCount = 0;

    try {
        const feedbackSnap = await getDocs(query(collection(db, "feedback"), where("status", "==", "resolved")));
        for (const d of feedbackSnap.docs) {
            const data = d.data();
            if (data.resolvedAt && data.resolvedAt.toDate() < oneMonthAgo) {
                await deleteDoc(d.ref);
                deletedCount++;
            }
        }

        const pollsSnap = await getDocs(query(collection(db, "polls"), where("isOpen", "==", false)));
        for (const d of pollsSnap.docs) {
            if (d.data().createdAt && d.data().createdAt.toDate() < oneWeekAgo) {
                await deleteDoc(d.ref);
                deletedCount++;
            }
        }
    } catch (e) { console.error("Cleanup error:", e); }

    if (deletedCount > 0) logAction("System Cleanup", `Deleted ${deletedCount} old items.`);
}
function showToast(message, icon, color) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon"><i class="ph ${icon || 'ph-info'}"></i></span><span class="toast-text">${message}</span>`;
    toast.style.borderLeftColor = color || 'var(--accent-color)';
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// Custom Confirm Dialog
function customConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('confirm-modal-card');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-msg');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        titleEl.textContent = title;
        msgEl.textContent = message;

        // Hide other modals first
        document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');

        modal.style.display = 'block';
        overlay.style.display = 'flex';

        const cleanup = () => {
            overlay.style.display = 'none';
            modal.style.display = 'none';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        okBtn.onclick = () => { cleanup(); resolve(true); };
        cancelBtn.onclick = () => { cleanup(); resolve(false); };
    });
}

function openModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    document.getElementById(modalId).style.display = 'block';
    overlay.style.display = 'flex';
}

function closeModal() {
    // Hide standard modal overlay
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.style.display = 'none';

    // Hide staff chat overlay
    const staffOverlay = document.getElementById('staff-chat-overlay');
    if (staffOverlay) {
        staffOverlay.style.display = 'none';
        const modal = staffOverlay.querySelector('.modal-card');
        if (modal) modal.style.display = 'none';
    }

    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
}

// Global modal close listeners
document.addEventListener('click', (e) => {
    // Also handle clicks on the close button icon (i) within the close button
    const closeBtn = e.target.closest('.close-modal');
    if (closeBtn || e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

// Modal Open Listeners
// document.getElementById('open-ann-modal').addEventListener('click', () => openModal('ann-modal-card'));
// document.getElementById('open-hw-modal').addEventListener('click', () => openModal('hw-modal-card'));
// document.getElementById('open-sched-modal').addEventListener('click', () => openModal('sched-modal-card'));

// Email Link Elements
const emailLinkInput = document.getElementById('email-link-input');
const sendLinkBtn = document.getElementById('send-link-btn');

let currentUserRole = 'teacher';
let currentUserName = '';
let currentUserPhoto = '';

// Load Polls (real-time)
function loadPolls() {
    if (pollListener) { pollListener(); pollListener = null; }

    const list = document.getElementById('active-polls-list');

    pollListener = onSnapshot(query(collection(db, "polls"), orderBy("createdAt", "desc")), (snap) => {
        if (snap.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No active polls.</p>';
            return;
        }

        let html = '';
        snap.forEach(d => {
            const data = d.data();
            const totalVotes = Object.values(data.votes || {}).reduce((a, b) => a + b, 0);
            const isOpen = data.isOpen !== false; // Default to true

            html += `
                <div class="admin-sched-card" style="border-left: 4px solid ${isOpen ? 'var(--accent-color)' : 'var(--text-secondary)'};">
                    <div class="admin-sched-card-header">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:700;">${data.question}</span>
                            <span style="font-size:0.7rem; color:var(--text-secondary);">${isOpen ? '🟢 OPEN' : '🔴 CLOSED'} — Total Votes: ${totalVotes}</span>
                        </div>
                        <div class="admin-sched-card-actions">
                            <button class="toggle-poll-btn admin-btn-icon" data-id="${d.id}" data-open="${isOpen}" title="${isOpen ? 'Close Poll' : 'Open Poll'}">
                                <i class="ph ${isOpen ? 'ph-lock-open' : 'ph-lock'}"></i>
                            </button>
                            <button class="qr-full-btn admin-btn-icon" data-id="${d.id}" data-question="${data.question.replace(/"/g, '&quot;')}" style="color:var(--accent-color);"><i class="ph ph-corners-out"></i></button>
                            <button class="remove-poll-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; align-items:center; margin-top:0.5rem; flex-wrap:wrap;">
                        <div id="qr-${d.id}" style="background:white; padding:5px; border-radius:4px; opacity: ${isOpen ? 1 : 0.3};"></div>
                        <div style="flex:1;">
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">LIVE RESULTS (Hidden from students while open):</div>
                            ${Object.entries(data.votes || {}).map(([opt, count]) => `
                                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;">
                                    <span>${opt}</span>
                                    <span style="font-weight:700;">${count}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        // Generate QRs
        snap.forEach(d => {
            const isOpen = d.data().isOpen !== false;
            const pollUrl = `${window.location.origin}/vote.html?pollId=${d.id}`;
            new QRCode(document.getElementById(`qr-${d.id}`), {
                text: pollUrl,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        });

        document.querySelectorAll('.toggle-poll-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const currentState = btn.getAttribute('data-open') === 'true';
                try {
                    await updateDoc(doc(db, "polls", id), {
                        isOpen: !currentState
                    });
                    showToast(`Poll ${!currentState ? 'Opened' : 'Closed'} successfully!`);
                    logAction("Toggle Poll", `ID: ${id}, State: ${!currentState ? 'Open' : 'Closed'}`);
                } catch (e) {
                    showToast("Error: " + e.message, "ph-x", "var(--danger)");
                }
            });
        });

        document.querySelectorAll('.qr-full-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                const question = btn.getAttribute('data-question');
                const pollUrl = `${window.location.origin}/vote.html?pollId=${id}`;

                document.getElementById('qr-modal-question').textContent = question;
                const container = document.getElementById('qr-modal-container');
                container.innerHTML = ''; // Clear previous

                new QRCode(container, {
                    text: pollUrl,
                    width: 300,
                    height: 300,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                openModal('qr-modal-card');
            });
        });

        document.querySelectorAll('.remove-poll-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (await customConfirm("Confirm Action", "Delete this poll and all its data?")) {
                    const id = e.target.closest('.remove-poll-btn').getAttribute('data-id');
                    await deleteDoc(doc(db, "polls", id));
                    logAction("Delete Poll", `ID: ${id}`);
                }
            });
        });
    });
}
// Load Feedback (real-time)
async function loadFeedback() {
    if (feedbackListener) { feedbackListener(); feedbackListener = null; }

    const list = document.getElementById('feedback-list-admin');

    feedbackListener = onSnapshot(query(collection(db, "feedback"), orderBy("createdAt", "desc")), (snap) => {
        if (snap.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No new messages.</p>';
            return;
        }

        let html = '';
        snap.forEach(d => {
            const data = d.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'Just now';
            const isResolved = data.status === 'resolved';

            if (isResolved) return; // Hide resolved from inbox

            // Mark as 'seen' if currently 'new'
            if (data.status === 'new') {
                updateDoc(doc(db, "feedback", d.id), { status: 'seen' });
            }

            // Build conversation thread
            let conversationHtml = '';

            // Add old single reply
            if (data.reply) {
                conversationHtml += `
                    <div style="background: var(--bg-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; border-left: 3px solid var(--accent-color);">
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--accent-color); margin-bottom: 0.25rem;">STAFF (Admin)</div>
                        <div style="font-size: 0.85rem;">${data.reply}</div>
                    </div>
                `;
            }

            // Add threaded replies
            if (data.replies && Array.isArray(data.replies)) {
                data.replies.forEach((reply) => {
                    const isUser = reply.sender === 'user';
                    const replyTime = reply.timestamp ? (reply.timestamp.toDate ? reply.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '';
                    conversationHtml += `
                        <div style="background: ${isUser ? 'var(--highlight-bg)' : 'var(--bg-color)'}; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; border-left: 3px solid ${isUser ? 'var(--accent-color)' : 'var(--text-secondary)'};">
                            <div style="font-size: 0.65rem; font-weight: 700; color: ${isUser ? 'var(--accent-color)' : 'var(--text-secondary)'}; margin-bottom: 0.25rem;">
                                ${isUser ? 'STUDENT' : 'STAFF'} ${replyTime ? `— ${replyTime}` : ''}
                            </div>
                            <div style="font-size: 0.85rem;">${reply.text}</div>
                        </div>
                    `;
                });
            }

            html += `
                <div class="admin-sched-card" style="border-left: 4px solid ${data.urgent ? 'var(--danger)' : (data.type === 'suggestion' ? 'var(--warning)' : 'var(--accent-color)')};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <span style="font-size:0.7rem; color:var(--text-secondary);">${date}</span>
                        <div style="display: flex; gap: 0.5rem;">
                            ${data.type === 'suggestion' ? '<span style="color:var(--warning); font-size:0.7rem; font-weight:700;">💡 SUGGESTION</span>' : ''}
                            ${data.urgent ? '<span style="color:var(--danger); font-size:0.7rem; font-weight:700;">🚨 URGENT</span>' : ''}
                        </div>
                    </div>
                    <div style="font-size:0.9rem; margin-bottom:1rem; white-space:pre-wrap;">${data.message}</div>
                    ${conversationHtml ? `<div style="margin-bottom: 1rem; padding: 0.5rem; background: var(--highlight-bg); border-radius: 8px;"><div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem;">CONVERSATION:</div>${conversationHtml}</div>` : ''}
                    
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <input type="text" class="form-input reply-input" placeholder="Type a reply..." style="font-size: 0.85rem; padding: 0.5rem; flex: 1;" data-id="${d.id}">
                        <button class="send-reply-btn btn-primary" data-id="${d.id}" style="padding: 0 1rem; min-height: auto; font-size: 0.8rem;">Reply</button>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button class="resolve-feedback-btn btn-secondary" data-id="${d.id}" style="padding:0.4rem 0.8rem; font-size:0.8rem; min-height:auto;">
                            <i class="ph ph-check"></i> Mark as Solved
                        </button>
                        <button class="remove-feedback-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html || '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No new messages.</p>';

        // Attach listeners (Reply, Resolve, Remove)
        document.querySelectorAll('.reply-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const id = input.getAttribute('data-id');
                    document.querySelector(`.send-reply-btn[data-id="${id}"]`)?.click();
                }
            });
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = (input.scrollHeight) + 'px';
            });
        });

        document.querySelectorAll('.send-reply-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const input = document.querySelector(`.reply-input[data-id="${id}"]`);
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
                                sender: 'admin', 
                                senderName: currentUserName || 'Staff',
                                senderPhoto: currentUserPhoto,
                                text: replyText, 
                                timestamp: new Date() 
                            }],
                            status: 'replied'
                        });
                        showToast("Reply sent");
                        logAction("Admin Reply", `To: ${id}`);
                    }
                } catch (e) {
                    showToast("Error: " + e.message);
                    btn.disabled = false;
                }
            });
        });

        document.querySelectorAll('.resolve-feedback-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await customConfirm("Confirm Action", "Mark as solved?")) {
                    const id = btn.getAttribute('data-id');
                    await updateDoc(doc(db, "feedback", id), { status: 'resolved', resolvedAt: serverTimestamp() });
                    showToast("Marked as solved.");
                    logAction("Resolve Feedback", `ID: ${id}`);
                }
            });
        });

        document.querySelectorAll('.remove-feedback-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await customConfirm("Confirm Action", "Permanently delete this message?")) {
                    const id = btn.getAttribute('data-id');
                    await deleteDoc(doc(db, "feedback", id));
                    showToast("Message deleted.");
                    logAction("Delete Feedback", `ID: ${id}`);
                }
            });
        });
    });
}

onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed, user:", user ? user.email : "logged out");
    if (user) {
        // Logged in
        if (loginContainer) loginContainer.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'block';

        // Set status to online
        setStaffStatus('online');

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            const lastLoginTs = serverTimestamp();

            if (userDoc.exists()) {
                // Clear any existing revocation flag upon a fresh login
                await updateDoc(userDocRef, {
                    sessionRevoked: false,
                    lastLogin: lastLoginTs,
                    email: user.email // Ensure email is synced
                });
            } else {
                // First-time user setup
                const usersSnap = await getDocs(collection(db, "users"));
                currentUserRole = usersSnap.empty ? 'admin' : 'teacher';

                await setDoc(userDocRef, {
                    role: currentUserRole,
                    email: user.email,
                    lastLogin: lastLoginTs,
                    sessionRevoked: false
                });
            }

            // Start the real-time listener for this user
            if (userListener) userListener();
            userListener = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.sessionRevoked) {
                        if (userListener) { userListener(); userListener = null; }
                        await signOut(auth);
                        window.location.reload();
                        return;
                    }
                    if (data.disabled) {
                        await signOut(auth);
                        showToast("This account has been disabled.", "ph-prohibit", "var(--danger)");
                        return;
                    }
                    currentUserRole = (data.role || 'teacher').toLowerCase().trim();
                    currentUserName = data.displayName || '';
                    currentUserPhoto = data.photoURL || '';
                    
                    const greetingEl = document.getElementById('greeting-text');
                    if (greetingEl) greetingEl.textContent = `Hello, ${currentUserName || 'Staff'}!`;
                    
                    const displayRole = currentUserRole === 'ta' ? 'TA' : currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1);
                    userRoleBadge.textContent = `Role: ${displayRole}`;

                    // Update My Profile UI
                    const myNameInput = document.getElementById('my-real-name');
                    const myPicImg = document.getElementById('my-profile-pic');
                    if (myNameInput) myNameInput.value = data.displayName || '';
                    if (myPicImg && data.photoURL) myPicImg.src = data.photoURL;

                    syncAdminSystemStates();
                    updateAdminSectionsVisibility();
                }
            });

        } catch (error) {
            console.error("Auth state processing failed:", error);
        }
    } else {
        // Logged out
        if (userListener) { userListener(); userListener = null; }
        if (loginContainer) loginContainer.style.display = 'block';
        if (adminContainer) adminContainer.style.display = 'none';
        checkEmailLinkSignIn();
        // Clear other listeners...
        if (systemStatesListener) { systemStatesListener(); systemStatesListener = null; }
        if (annListener) { annListener(); annListener = null; }
        if (hwListener) { hwListener(); hwListener = null; }
        if (pollListener) { pollListener(); pollListener = null; }
        if (feedbackListener) { feedbackListener(); feedbackListener = null; }
        if (bannerListener) { bannerListener(); bannerListener = null; }
        if (featListener) { featListener(); featListener = null; }
    }
});

function updateAdminSectionsVisibility() {
    const statusToggle = document.getElementById('staff-status-toggle');

    // Safety check for critical DOM elements
    if (!manageUsersSection || !manageScheduleSection || !addAnnouncementSection || !feedbackInboxSection) {
        console.warn("Admin sections not fully loaded in DOM.");
        return;
    }

    if (currentUserRole === 'admin') {
        manageUsersSection.style.display = 'block';
        manageScheduleSection.style.display = 'block';
        addAnnouncementSection.style.display = 'block';
        addHomeworkSection.style.display = 'block';
        manageAnnouncementsSection.style.display = 'block';
        manageHomeworkSection.style.display = 'block';
        addFeatureSection.style.display = 'block';
        manageFeaturesSection.style.display = 'block';
        managePollsSection.style.display = 'block';
        systemSettingsSection.style.display = 'block';
        auditLogSection.style.display = 'block';
        bugReportsSection.style.display = 'block';
        feedbackInboxSection.style.display = 'block';
        if (manageClassBannerSection) manageClassBannerSection.style.display = 'block';

        loadUsers();
        loadSchedule();
        loadAnnouncements();
        loadFeatures();
        loadHomework();
        loadPolls();
        loadFeedback();
        loadSettings();
        loadAuditLog();
        loadBugReports();
        loadBannerManagement();
        performSystemCleanup();

        // Admins can change status
        if (statusToggle) {
            statusToggle.disabled = false;
            syncStatusToggle();
        }
    } else if (currentUserRole === 'teacher') {
        manageUsersSection.style.display = 'none';
        manageScheduleSection.style.display = 'none';
        addAnnouncementSection.style.display = 'block';
        addHomeworkSection.style.display = 'block';
        manageAnnouncementsSection.style.display = 'block';
        manageHomeworkSection.style.display = 'block';
        addFeatureSection.style.display = 'none';
        manageFeaturesSection.style.display = 'none';
        managePollsSection.style.display = 'block';
        feedbackInboxSection.style.display = 'block';
        if (manageClassBannerSection) manageClassBannerSection.style.display = 'block';

        loadAnnouncements();
        loadHomework();
        loadPolls();
        loadFeedback();
        loadBannerManagement();
        performSystemCleanup();

        // Teachers can change status
        if (statusToggle) {
            statusToggle.disabled = false;
            syncStatusToggle();
        }
    } else if (currentUserRole === 'ta') {
        // TAs can ONLY manage homework
        manageUsersSection.style.display = 'none';
        manageScheduleSection.style.display = 'none';
        addAnnouncementSection.style.display = 'none';
        addHomeworkSection.style.display = 'block';
        manageAnnouncementsSection.style.display = 'none';
        manageHomeworkSection.style.display = 'block';
        addFeatureSection.style.display = 'none';
        manageFeaturesSection.style.display = 'none';
        managePollsSection.style.display = 'none';
        systemSettingsSection.style.display = 'none';
        auditLogSection.style.display = 'none';
        bugReportsSection.style.display = 'none';
        feedbackInboxSection.style.display = 'none';
        if (manageClassBannerSection) manageClassBannerSection.style.display = 'none';

        loadHomework();

        // TAs CANNOT change status
        if (statusToggle) statusToggle.disabled = true;
    }
}

function syncStatusToggle() {
    const statusToggle = document.getElementById('staff-status-toggle');
    if (!statusToggle) return;
    onSnapshot(doc(db, "settings", "staff_status"), (snap) => {
        if (snap.exists()) statusToggle.value = snap.data().status;
    });
    statusToggle.onchange = () => setStaffStatus(statusToggle.value);
}

// Update Profile
const updateProfileBtn = document.getElementById('update-profile-btn');
if (updateProfileBtn) {
    updateProfileBtn.addEventListener('click', async () => {
        const name = document.getElementById('my-real-name').value.trim();
        const picFile = document.getElementById('my-profile-pic-input').files[0];

        if (!name) return showToast("Real Name is required", "ph-warning", "var(--warning)");

        updateProfileBtn.disabled = true;
        updateProfileBtn.textContent = 'Updating...';

        try {
            let photoURL = null;
            if (picFile) {
                updateProfileBtn.textContent = 'Uploading Pic...';
                photoURL = await uploadToImgBB(picFile);
            }

            const userRef = doc(db, "users", auth.currentUser.uid);
            const updates = { displayName: name };
            if (photoURL) updates.photoURL = photoURL;

            await updateDoc(userRef, updates);
            showToast("Profile updated successfully!", "ph-check", "var(--success)");
            closeModal();
            document.getElementById('my-profile-pic-input').value = '';
        } catch (e) {
            showToast("Error updating profile: " + e.message, "ph-x", "var(--danger)");
        } finally {
            updateProfileBtn.disabled = false;
            updateProfileBtn.textContent = 'Update Profile';
        }
    });
}

// Password Login
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        loginError.style.display = 'none';
        loginSuccess.style.display = 'none';
        const email = emailInput.value.trim();
        const pass = passInput.value.trim();

        if (!email || !pass) {
            loginError.textContent = 'Please enter email and password.';
            loginError.style.display = 'block';
            return;
        }

        loginBtn.textContent = 'Logging in...';
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            loginBtn.textContent = 'Login with Password';
        }
    });
}

// Email Link Login
if (sendLinkBtn) {
    sendLinkBtn.addEventListener('click', async () => {
        loginError.style.display = 'none';
        loginSuccess.style.display = 'none';
        const email = emailLinkInput.value.trim();

        if (!email) {
            loginError.textContent = 'Please enter your email.';
            loginError.style.display = 'block';
            return;
        }

        const actionCodeSettings = {
            url: window.location.href, // Redirect back to this page
            handleCodeInApp: true
        };

        sendLinkBtn.textContent = 'Sending...';
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
            loginSuccess.textContent = 'Login link sent! Please check your email.';
            loginSuccess.style.display = 'block';
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            sendLinkBtn.textContent = 'Send Login Link';
        }
    });
}

// Logout
logoutBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            try {
                const userRef = doc(db, "users", auth.currentUser.uid);
                // Trigger cross-device logout
                await updateDoc(userRef, { sessionRevoked: true });
                // Set status to offline
                await setStaffStatus('offline');
            } catch (e) {
                console.error("Session sync failed:", e);
            }
        }
        await signOut(auth);
        window.location.reload();
    });

    // Forgot Password
    document.getElementById('forgot-pass-link').addEventListener('click', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        loginSuccess.style.display = 'none';

        const email = emailInput.value.trim();
        if (!email) {
            loginError.textContent = 'Please enter your email address first.';
            loginError.style.display = 'block';
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            loginSuccess.textContent = 'Password reset email sent! Check your inbox.';
            loginSuccess.style.display = 'block';
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        }
    });
    // Homework Quick Add Parser
    document.getElementById('hw-quick-add').addEventListener('input', (e) => {
        const text = e.target.value.trim();
        if (!text) return;

        // Pattern: "Subject: Task due Date" or "Subject: Task"
        const regex = /^([^:]+):\s*(.+?)(?:\s+due\s+(.+))?$/i;
        const match = text.match(regex);

        if (match) {
            document.getElementById('hw-subject').value = match[1].trim();
            document.getElementById('hw-task').value = match[2].trim();
            if (match[3]) {
                const dueStr = match[3].trim().toLowerCase();
                const dueInput = document.getElementById('hw-due');

                // Try to set date input if it's a date string
                if (/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) {
                    dueInput.value = dueStr;
                } else if (dueStr === 'tomorrow') {
                    const tom = new Date();
                    tom.setDate(tom.getDate() + 1);
                    dueInput.value = tom.toISOString().split('T')[0];
                } else if (dueStr === 'today') {
                    dueInput.value = new Date().toISOString().split('T')[0];
                }
            }
        }
    });

    // Add Announcement
    document.getElementById('add-ann-btn').addEventListener('click', async () => {
        if (currentUserRole === 'ta') return showToast("Unauthorized. TAs can only post homework.");

        const title = sanitize(document.getElementById('ann-title').value.trim());
        const message = sanitize(document.getElementById('ann-message').value.trim());
        const author = sanitize(document.getElementById('ann-author').value.trim());

        if (!title || !message) return showToast("Title and Message required");

        const btn = document.getElementById('add-ann-btn');
        btn.textContent = 'Posting...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "announcements"), {
                title, message, author,
                posterName: auth.currentUser.email.split('@')[0],
                posterEmail: auth.currentUser.email,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                timestamp: new Date()
            });
            showToast("Announcement added!");
            logAction("Add Announcement", `Title: ${title}`);
            document.getElementById('ann-title').value = '';
            document.getElementById('ann-message').value = '';
            document.getElementById('ann-author').value = '';
            // onSnapshot listener auto-refreshes the list
        } catch (error) {
            showToast("Error: " + error.message);
        } finally {
            btn.textContent = 'Post Announcement';
            btn.disabled = false;
        }
    });

    // Add Feature Update
    document.getElementById('add-feat-btn').addEventListener('click', async () => {
        const title = sanitize(document.getElementById('feat-title').value.trim());
        const description = sanitize(document.getElementById('feat-description').value.trim());
        const version = sanitize(document.getElementById('feat-version').value.trim());

        if (!title || !description) return showToast("Title and Description required");

        const btn = document.getElementById('add-feat-btn');
        btn.textContent = 'Posting...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "feature_updates"), {
                title, description, version,
                posterName: auth.currentUser.email.split('@')[0],
                posterEmail: auth.currentUser.email,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                timestamp: new Date()
            });
            showToast("Feature update posted!");
            logAction("Add Feature Update", `Title: ${title}${version ? ' (' + version + ')' : ''}`);
            document.getElementById('feat-title').value = '';
            document.getElementById('feat-description').value = '';
            document.getElementById('feat-version').value = '';
        } catch (error) {
            showToast("Error: " + error.message);
        } finally {
            btn.textContent = 'Post Feature Update';
            btn.disabled = false;
        }
    });

    // Add Homework
    document.getElementById('add-hw-btn').addEventListener('click', async () => {
        const subject = sanitize(document.getElementById('hw-subject').value.trim());
        const task = sanitize(document.getElementById('hw-task').value.trim());
        const due = document.getElementById('hw-due').value.trim();

        if (!subject || !task) return showToast("Subject and Task required");

        const btn = document.getElementById('add-hw-btn');
        btn.textContent = 'Posting...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "homework"), {
                subject, homework: task, due,
                posterName: auth.currentUser.email.split('@')[0],
                posterEmail: auth.currentUser.email,
                timestamp: new Date()
            });
            showToast("Homework added!");
            logAction("Add Homework", `Subject: ${subject}, Task: ${task}`);
            document.getElementById('hw-quick-add').value = '';
            document.getElementById('hw-subject').value = '';
            document.getElementById('hw-task').value = '';
            document.getElementById('hw-due').value = '';
            // onSnapshot listener auto-refreshes the list
        } catch (error) {
            showToast("Error: " + error.message);
        } finally {
            btn.textContent = 'Post Homework';
            btn.disabled = false;
        }
    });

    // Add User (Admin Only)
    document.getElementById('add-user-btn').addEventListener('click', async () => {
        if (currentUserRole !== 'admin') return showToast("Unauthorized");

        const email = document.getElementById('new-user-email').value.trim();
        const name = document.getElementById('new-user-name').value.trim();
        const pass = document.getElementById('new-user-pass').value.trim();
        const role = document.getElementById('new-user-role').value;
        const picFile = document.getElementById('new-user-pic').files[0];

        if (!email || !pass || !name) return showToast("Email, Name and Password required");

        const btn = document.getElementById('add-user-btn');
        btn.textContent = 'Adding...';
        btn.disabled = true;

        try {
            let photoURL = null;
            if (picFile) {
                btn.textContent = 'Uploading Pic...';
                photoURL = await uploadToImgBB(picFile);
            }

            // Use a secondary app instance to create a user without logging out the current admin
            const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
            const newUser = userCredential.user;

            // Add to users collection in Firestore (using main app db)
            await setDoc(doc(db, "users", newUser.uid), {
                email: email,
                displayName: name,
                photoURL: photoURL,
                role: role
            });

            // Sign out and delete the secondary app instance
            await signOut(secondaryAuth);

            showToast(`User ${email} added successfully as ${role}!`);
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-pass').value = '';
            document.getElementById('new-user-pic').value = '';
            loadUsers();
        } catch (error) {
            showToast("Error adding user: " + error.message);
        } finally {
            btn.textContent = 'Add User';
            btn.disabled = false;
        }
    });

    // Add Schedule (Admin Only)
    document.getElementById('add-sched-btn').addEventListener('click', async () => {
        if (currentUserRole !== 'admin') return showToast("Unauthorized");

        const time = document.getElementById('sched-time').value.trim();
        const monday = document.getElementById('sched-mon').value.trim();
        const tuesday = document.getElementById('sched-tue').value.trim();
        const wednesday = document.getElementById('sched-wed').value.trim();
        const thursday = document.getElementById('sched-thu').value.trim();
        const friday = document.getElementById('sched-fri').value.trim();

        if (!time) return showToast("Time is required");

        const btn = document.getElementById('add-sched-btn');
        btn.textContent = 'Adding...';
        btn.disabled = true;

        try {
            await setDoc(doc(db, "schedule", time), {
                time, monday, tuesday, wednesday, thursday, friday
            });
            showToast("Schedule added/updated!");
            document.getElementById('sched-time').value = '';
            document.getElementById('sched-mon').value = '';
            document.getElementById('sched-tue').value = '';
            document.getElementById('sched-wed').value = '';
            document.getElementById('sched-thu').value = '';
            document.getElementById('sched-fri').value = '';
            loadSchedule();
        } catch (error) {
            showToast("Error adding schedule: " + error.message);
        } finally {
            btn.textContent = 'Add Time Slot';
            btn.disabled = false;
        }
    });

    // Format date for display
    function formatDate(val) {
        if (!val) return 'Never';
        // Handle Firestore Timestamp
        if (val && typeof val.toDate === 'function') {
            return val.toDate().toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
        // Handle string or Date object
        return val.toString();
    }

    // Load Users
    async function loadUsers() {
        if (currentUserRole !== 'admin') return;

        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '<div class="loading-placeholder"><div class="loader"></div><p>Loading users...</p></div>';

        try {
            const snap = await getDocs(collection(db, "users"));
            const isMobile = window.innerWidth <= 768;
            let html = '';

            if (isMobile) {
                html = `<div class="admin-sched-cards">`;
                snap.forEach(doc => {
                    const data = doc.data();
                    const listRole = data.role === 'ta' ? 'TA' : (data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : 'Unknown');
                    const statusBadge = data.disabled ? '<span class="time-badge" style="background:var(--danger);color:white;">Disabled</span>' : '';
                    const avatar = data.photoURL || 'logo.png';

                    html += `
                    <div class="admin-sched-card" id="user-card-${doc.id}">
                        <div class="admin-sched-card-header">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-weight:600;font-size:0.85rem;word-break:break-all;">${data.displayName || 'No Name'}</span>
                                    <span style="font-size:0.7rem; color:var(--text-secondary);">${data.email}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.25rem;">
                                <button class="see-info-btn admin-btn-icon" data-uid="${doc.id}" title="See Info"><i class="ph ph-info"></i></button>
                                <button class="remove-user-btn admin-btn-danger admin-btn-icon" data-uid="${doc.id}" title="Remove"><i class="ph ph-trash"></i></button>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                            <span class="time-badge" style="font-size:0.7rem;">${listRole}</span>
                            ${statusBadge}
                        </div>
                        
                        <!-- Info Panel -->
                        <div id="info-panel-${doc.id}" class="user-info-panel">
                            <div class="user-info-row">
                                <span class="user-info-label">Last Login:</span>
                                <span class="user-info-val">${formatDate(data.lastLogin)}</span>
                            </div>
                            <div class="user-info-row" style="margin-top:0.5rem;">
                                <span class="user-info-label" style="color:var(--accent-color);">Private Admin Notes:</span>
                                <div style="display:flex; gap:0.4rem; margin-top:0.25rem;">
                                    <input type="text" id="admin-note-${doc.id}" class="form-input" style="font-size:0.75rem; padding:0.3rem;" value="${data.adminNote || ''}" placeholder="e.g. Likes to yap">
                                    <button class="save-note-btn admin-btn-icon" data-uid="${doc.id}" style="background:var(--accent-color); color:white; border:none;"><i class="ph ph-floppy-disk"></i></button>
                                </div>
                            </div>
                            <div class="user-info-row" style="margin-top:0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                <span class="user-info-label">Edit Profile:</span>
                                <input type="text" id="edit-name-${doc.id}" class="form-input" style="font-size:0.75rem; padding:0.3rem; margin-top:0.25rem;" value="${data.displayName || ''}" placeholder="Real Name">
                                <input type="file" id="edit-pic-${doc.id}" class="form-input" style="font-size:0.75rem; padding:0.3rem; margin-top:0.25rem;" accept="image/*">
                                <button class="save-user-edit-btn btn-primary btn-full" data-uid="${doc.id}" style="margin-top:0.5rem; font-size:0.75rem; padding:0.5rem;">Save Changes</button>
                            </div>
                            <div class="user-actions-grid">
                                <button class="user-action-btn reset-pass-btn" data-email="${data.email}">
                                    <i class="ph ph-key"></i> Reset Pass
                                </button>
                                <button class="user-action-btn disable-user-btn" data-uid="${doc.id}" data-email="${data.email}" data-status="${data.disabled || false}">
                                    <i class="ph ${data.disabled ? 'ph-user-plus' : 'ph-user-minus'}"></i> ${data.disabled ? 'Enable' : 'Disable'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;

                snap.forEach(doc => {
                    const data = doc.data();
                    const listRole = data.role === 'ta' ? 'TA' : (data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : 'Unknown');
                    const statusBadge = data.disabled ? '<span class="time-badge" style="background:var(--danger);color:white;">Disabled</span>' : '<span class="time-badge" style="background:var(--success);color:white;">Active</span>';
                    const avatar = data.photoURL || 'logo.png';

                    html += `
                <tr id="user-row-${doc.id}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 600;">${data.displayName || 'No Name'}</span>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">${data.email}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="time-badge">${listRole}</span></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="see-info-btn admin-btn-icon" data-uid="${doc.id}"><i class="ph ph-info"></i> Info</button>
                        <button class="remove-user-btn admin-btn-danger" data-uid="${doc.id}"><i class="ph ph-trash"></i> Remove</button>
                    </td>
                </tr>
                <tr id="info-row-${doc.id}" style="display:none;">
                    <td colspan="4">
                        <div id="info-panel-${doc.id}" class="user-info-panel" style="margin: 0 1rem 1rem 1rem;">
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                                <div>
                                    <div class="user-info-row">
                                        <span class="user-info-label">Last Login:</span>
                                        <span class="user-info-val">${formatDate(data.lastLogin)}</span>
                                    </div>
                                    <div class="user-info-row">
                                        <span class="user-info-label">User ID:</span>
                                        <span class="user-info-val" style="font-size:0.7rem; opacity:0.7;">${doc.id}</span>
                                    </div>
                                </div>
                                <div>
                                    <div class="user-info-label" style="margin-bottom:0.5rem;">Edit Profile</div>
                                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                        <input type="text" id="edit-name-${doc.id}" class="form-input" style="font-size:0.8rem;" value="${data.displayName || ''}" placeholder="Real Name">
                                        <div style="display:flex; flex-direction:column; gap:0.2rem;">
                                            <label style="font-size:0.65rem; color:var(--text-secondary);">Change Profile Pic</label>
                                            <input type="file" id="edit-pic-${doc.id}" class="form-input" style="font-size:0.8rem;" accept="image/*">
                                        </div>
                                        <button class="save-user-edit-btn btn-primary" data-uid="${doc.id}" style="font-size:0.8rem; padding:0.5rem;">Save Changes</button>
                                    </div>
                                </div>
                                <div class="user-actions-grid" style="margin-top:0;">
                                    <button class="user-action-btn reset-pass-btn" data-email="${data.email}">
                                        <i class="ph ph-key"></i> Send Password Reset Email
                                    </button>
                                    <button class="user-action-btn disable-user-btn" data-uid="${doc.id}" data-email="${data.email}" data-status="${data.disabled || false}">
                                        <i class="ph ${data.disabled ? 'ph-user-plus' : 'ph-user-minus'}"></i> ${data.disabled ? 'Enable Account' : 'Disable Account'}
                                    </button>
                                    <button class="user-action-btn btn-danger-alt remove-user-btn" data-uid="${doc.id}">
                                        <i class="ph ph-trash"></i> Delete from Database
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
                `;
                });
                html += '</tbody></table>';
            }
            usersList.innerHTML = html;

            // Event Listeners
            document.querySelectorAll('.see-info-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.getAttribute('data-uid');
                    toggleUserInfo(uid);
                });
            });

            document.querySelectorAll('.remove-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.getAttribute('data-uid');
                    removeUser(uid);
                });
            });

            document.querySelectorAll('.reset-pass-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const email = btn.getAttribute('data-email');
                    resetUserPassword(email);
                });
            });

            document.querySelectorAll('.disable-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.getAttribute('data-uid');
                    const email = btn.getAttribute('data-email');
                    const currentStatus = btn.getAttribute('data-status') === 'true';
                    toggleUserStatus(uid, email, currentStatus);
                });
            });

            document.querySelectorAll('.save-note-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uid = btn.getAttribute('data-uid');
                    const noteVal = document.getElementById(`admin-note-${uid}`)?.value.trim() || '';
                    try {
                        await setDoc(doc(db, "users", uid), { adminNote: noteVal }, { merge: true });
                        showToast("Note saved!", "ph-floppy-disk", "var(--success)");
                    } catch (e) {
                        showToast("Error saving note: " + e.message, "ph-x-circle", "var(--danger)");
                    }
                });
            });

            document.querySelectorAll('.save-user-edit-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uid = btn.getAttribute('data-uid');
                    const nameVal = document.getElementById(`edit-name-${uid}`)?.value.trim();
                    const picFile = document.getElementById(`edit-pic-${uid}`)?.files[0];

                    if (!nameVal) return showToast("Name is required", "ph-warning", "var(--warning)");

                    btn.disabled = true;
                    const originalText = btn.textContent;
                    btn.textContent = 'Updating...';

                    try {
                        const updates = { displayName: nameVal };
                        if (picFile) {
                            btn.textContent = 'Uploading Pic...';
                            const photoURL = await uploadToImgBB(picFile);
                            if (photoURL) updates.photoURL = photoURL;
                        }

                        await setDoc(doc(db, "users", uid), updates, { merge: true });
                        showToast("User profile updated!");
                        loadUsers();
                    } catch (e) {
                        showToast("Error updating user: " + e.message, "ph-x", "var(--danger)");
                    } finally {
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                });
            });

        } catch (error) {
            usersList.innerHTML = `<p style="color:var(--danger)">Error loading users: ${error.message}</p>`;
        }
    }

    // Toggle User Info Panel
    function toggleUserInfo(uid) {
        const panel = document.getElementById(`info-panel-${uid}`);
        const infoRow = document.getElementById(`info-row-${uid}`); // For desktop table

        if (panel) {
            const isHidden = panel.style.display === 'none' || panel.style.display === '';
            panel.style.display = isHidden ? 'block' : 'none';
            if (infoRow) infoRow.style.display = isHidden ? 'table-row' : 'none';
        }
    }

    // Reset User Password
    async function resetUserPassword(email) {
        if (await customConfirm("Reset Password", `Send a password reset email to ${email}?`)) {
            try {
                await sendPasswordResetEmail(auth, email);
                showToast(`Password reset email sent to ${email}`);
            } catch (error) {
                showToast("Error: " + error.message);
            }
        }
    }

    // Toggle User Status (Disable/Enable)
    async function toggleUserStatus(uid, email, isCurrentlyDisabled) {
        const action = isCurrentlyDisabled ? "Enable" : "Disable";
        if (await customConfirm(`${action} Account`, `Are you sure you want to ${action.toLowerCase()} access for ${email}?`)) {
            try {
                await setDoc(doc(db, "users", uid), { disabled: !isCurrentlyDisabled }, { merge: true });
                showToast(`Account ${email} ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`);
                loadUsers();
            } catch (error) {
                showToast("Error: " + error.message);
            }
        }
    }

    // Remove User Function
    async function removeUser(uid) {
        if (currentUserRole !== 'admin') return;

        if (await customConfirm("Confirm Deletion", "Remove this user's data from the database? (Note: This will not delete the Authentication account, only their permissions and role.)")) {
            try {
                await deleteDoc(doc(db, "users", uid));
                showToast("User role and data removed.");
                loadUsers();
            } catch (error) {
                showToast("Error removing user: " + error.message);
            }
        }
    }

    // Load Schedule
    async function loadSchedule() {
        if (currentUserRole === 'ta') return;

        const schedList = document.getElementById('schedule-list');
        schedList.innerHTML = '<div class="loading-placeholder"><div class="loader"></div><p>Loading schedule...</p></div>';

        try {
            const snap = await getDocs(collection(db, "schedule"));
            let scheduleData = snap.docs.map(doc => {
                const data = doc.data();
                data.id = doc.id;
                return data;
            });

            // Sort by time
            scheduleData.sort((a, b) => {
                const timeA = a.time.split('-')[0].trim();
                const timeB = b.time.split('-')[0].trim();
                const [hA, mA] = timeA.split(/[:.]/).map(Number);
                const [hB, mB] = timeB.split(/[:.]/).map(Number);
                return (hA * 60 + (mA || 0)) - (hB * 60 + (mB || 0));
            });

            const isMobile = window.innerWidth <= 768;

            let html = '';
            if (isMobile) {
                // Mobile: Render as cards
                html = `<div class="admin-sched-cards">`;
                scheduleData.forEach(data => {
                    const days = [
                        { key: 'monday', label: 'Mon', val: data.monday || '' },
                        { key: 'tuesday', label: 'Tue', val: data.tuesday || '' },
                        { key: 'wednesday', label: 'Wed', val: data.wednesday || '' },
                        { key: 'thursday', label: 'Thu', val: data.thursday || '' },
                        { key: 'friday', label: 'Fri', val: data.friday || '' },
                    ];
                    const dayBars = days.map(d => `<span class="sched-day-bar"><span class="sched-day-label">${d.label}</span><span class="sched-day-val">${d.val || '—'}</span></span>`).join('');
                    html += `
                    <div class="admin-sched-card" data-id="${data.id}">
                        <div class="admin-sched-card-header">
                            <span class="admin-sched-time">${data.time}</span>
                            <div class="admin-sched-card-actions">
                                <button class="edit-sched-btn admin-btn-icon" data-id="${data.id}"><i class="ph ph-note-pencil"></i></button>
                                <button class="remove-sched-btn admin-btn-danger admin-btn-icon" data-id="${data.id}"><i class="ph ph-trash"></i></button>
                            </div>
                        </div>
                        <div class="admin-sched-day-row">${dayBars}</div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                // Desktop: Render as table
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Mon</th>
                        <th>Tue</th>
                        <th>Wed</th>
                        <th>Thu</th>
                        <th>Fri</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;

                scheduleData.forEach(data => {
                    html += `
                <tr>
                    <td class="time-col">${data.time}</td>
                    <td>${data.monday || ''}</td>
                    <td>${data.tuesday || ''}</td>
                    <td>${data.wednesday || ''}</td>
                    <td>${data.thursday || ''}</td>
                    <td>${data.friday || ''}</td>
                    <td class="admin-action-cell">
                        <button class="edit-sched-btn admin-btn-icon" data-id="${data.id}"><i class="ph ph-note-pencil"></i> Edit</button>
                        <button class="remove-sched-btn admin-btn-danger admin-btn-icon" data-id="${data.id}"><i class="ph ph-trash"></i> Remove</button>
                    </td>
                </tr>`;
                });
                html += '</tbody></table>';
            }
            schedList.innerHTML = html;

            document.querySelectorAll('.remove-sched-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('.remove-sched-btn').getAttribute('data-id');
                    removeSchedule(id);
                });
            });

            document.querySelectorAll('.edit-sched-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.closest('.edit-sched-btn').getAttribute('data-id');
                    const docSnap = await getDoc(doc(db, "schedule", id));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        document.getElementById('sched-id').value = id;
                        document.getElementById('sched-time').value = data.time;
                        document.getElementById('sched-mon').value = data.monday || '';
                        document.getElementById('sched-tue').value = data.tuesday || '';
                        document.getElementById('sched-wed').value = data.wednesday || '';
                        document.getElementById('sched-thu').value = data.thursday || '';
                        document.getElementById('sched-fri').value = data.friday || '';
                        openModal('sched-modal-card');
                    }
                });
            });

        } catch (error) {
            schedList.innerHTML = `<p style="color:var(--danger)">Error loading schedule: ${error.message}</p>`;
        }
    }

    // Load Banner Management (real-time)
    function loadBannerManagement() {
        if (currentUserRole === 'ta') return;
        if (bannerListener) { bannerListener(); bannerListener = null; }

        const list = document.getElementById('banner-list-admin');
        if (!list) return;
        list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';

        bannerListener = onSnapshot(query(collection(db, "banners"), orderBy("createdAt", "desc")), (snap) => {
            const isMobile = window.innerWidth <= 768;
            let html = '';

            if (snap.empty) {
                list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 1.5rem 0;">No banners uploaded yet.</p>';
                return;
            }

            if (isMobile) {
                html = `<div class="admin-sched-cards">`;
                snap.forEach(d => {
                    const data = d.data();
                    const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'Just now';
                    html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;">${data.postedBy ? 'Posted by ' + data.postedBy : 'Caption: ' + (data.caption || 'None')}</span>
                            <button class="remove-banner-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                        </div>
                        <div style="margin-top: 0.5rem; text-align: center;">
                            <img src="${data.url}" alt="Banner" style="max-width: 100%; max-height: 100px; object-fit: cover; border-radius: 4px;">
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.25rem;">
                            ${data.postedBy ? 'Caption: ' + (data.caption || 'None') + ' &middot; ' : ''}Date: ${dateStr}
                        </div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Caption</th>
                        <th>Posted By</th>
                        <th>Upload Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;
                snap.forEach(d => {
                    const data = d.data();
                    const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'Just now';
                    html += `
                <tr>
                    <td>
                        <a href="${data.url}" target="_blank">
                            <img src="${data.url}" alt="Banner Thumbnail" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);">
                        </a>
                    </td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.caption || 'None'}</td>
                    <td>${data.postedBy || '—'}</td>
                    <td>${dateStr}</td>
                    <td>
                        <button class="remove-banner-btn admin-btn-danger" data-id="${d.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
                });
                html += '</tbody></table>';
            }

            list.innerHTML = html;

            document.querySelectorAll('.remove-banner-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await customConfirm("Confirm Action", "Delete this class banner?")) {
                        const id = e.target.closest('.remove-banner-btn').getAttribute('data-id');
                        try {
                            await deleteDoc(doc(db, "banners", id));
                            logAction("Delete Banner", `ID: ${id}`);
                            showToast("Banner deleted successfully!", "ph-check", "var(--success)");
                        } catch (err) {
                            showToast("Error deleting banner: " + err.message, "ph-x", "var(--danger)");
                        }
                    }
                });
            });
        }, (error) => {
            list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
        });
    }

    // Load Announcements (real-time)
    function loadAnnouncements() {
        if (currentUserRole === 'ta') return;
        if (annListener) { annListener(); annListener = null; }

        const list = document.getElementById('announcements-list-admin');
        list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';

        annListener = onSnapshot(collection(db, "announcements"), (snap) => {
            const isMobile = window.innerWidth <= 768;
            let html = '';

            if (isMobile) {
                html = `<div class="admin-sched-cards">`;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;">${data.title}</span>
                            <button class="remove-ann-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.25rem;">
                            ${data.author || ''} · ${data.date || ''}
                        </div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                <tr>
                    <td>${data.title}</td>
                    <td>${data.author}</td>
                    <td>${data.date}</td>
                    <td>
                        <button class="remove-ann-btn admin-btn-danger" data-id="${d.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
                });
                html += '</tbody></table>';
            }
            list.innerHTML = html;

            document.querySelectorAll('.remove-ann-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await customConfirm("Confirm Action", "Delete this announcement?")) {
                        const id = e.target.closest('.remove-ann-btn').getAttribute('data-id');
                        await deleteDoc(doc(db, "announcements", id));
                        logAction("Delete Announcement", `ID: ${id}`);
                        // onSnapshot auto-refreshes the list
                    }
                });
            });
        }, (error) => {
            list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
        });
    }

    // Load Feature Updates (real-time)
    function loadFeatures() {
        if (currentUserRole === 'ta') return;
        if (featListener) { featListener(); featListener = null; }

        const list = document.getElementById('features-list-admin');
        list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';

        featListener = onSnapshot(collection(db, "feature_updates"), (snap) => {
            const isMobile = window.innerWidth <= 768;
            let html = '';

            if (isMobile) {
                html = `<div class="admin-sched-cards">`;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <div style="display:flex;flex-direction:column;">
                                <span style="font-weight:600;font-size:0.85rem;">${data.title}</span>
                                ${data.version ? `<span class="time-badge" style="font-size:0.65rem;width:fit-content;">${data.version}</span>` : ''}
                            </div>
                            <button class="remove-feat-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.25rem;">
                            ${data.description} · ${data.date || ''}
                        </div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Version</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                <tr>
                    <td style="font-weight:600;">${data.title}</td>
                    <td style="max-width:300px;white-space:normal;">${data.description}</td>
                    <td>${data.version ? `<span class="time-badge">${data.version}</span>` : '—'}</td>
                    <td>${data.date || ''}</td>
                    <td>
                        <button class="remove-feat-btn admin-btn-danger" data-id="${d.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
                });
                html += '</tbody></table>';
            }
            list.innerHTML = html;

            document.querySelectorAll('.remove-feat-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await customConfirm("Confirm Action", "Delete this feature update?")) {
                        const id = e.target.closest('.remove-feat-btn').getAttribute('data-id');
                        await deleteDoc(doc(db, "feature_updates", id));
                        logAction("Delete Feature Update", `ID: ${id}`);
                    }
                });
            });
        }, (error) => {
            list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
        });
    }

    // Load Homework (real-time)
    function loadHomework() {
        if (hwListener) { hwListener(); hwListener = null; }

        const list = document.getElementById('homework-list-admin');
        list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';

        hwListener = onSnapshot(collection(db, "homework"), (snap) => {
            const isMobile = window.innerWidth <= 768;
            let html = '';

            if (isMobile) {
                html = `<div class="admin-sched-cards">`;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;">${data.subject}</span>
                            <button class="remove-hw-btn admin-btn-danger admin-btn-icon" data-id="${d.id}"><i class="ph ph-trash"></i></button>
                        </div>
                        <div style="font-size:0.85rem;margin:0.25rem 0;">${data.homework}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary);">Due: ${data.due || ''}</div>
                    </div>
                `;
                });
                html += `</div>`;
            } else {
                html = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Task</th>
                        <th>Due</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
            `;
                snap.forEach(d => {
                    const data = d.data();
                    html += `
                <tr>
                    <td>${data.subject}</td>
                    <td>${data.homework}</td>
                    <td>${data.due}</td>
                    <td>
                        <button class="remove-hw-btn admin-btn-danger" data-id="${d.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
                });
                html += '</tbody></table>';
            }
            list.innerHTML = html;

            document.querySelectorAll('.remove-hw-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await customConfirm("Confirm Action", "Delete this homework?")) {
                        const id = e.target.closest('.remove-hw-btn').getAttribute('data-id');
                        await deleteDoc(doc(db, "homework", id));
                        logAction("Delete Homework", `ID: ${id}`);
                        // onSnapshot auto-refreshes the list
                    }
                });
            });
        }, (error) => {
            list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
        });
    }

    // Remove Schedule Function
    async function removeSchedule(id) {
        if (currentUserRole !== 'admin') return;

        if (await customConfirm("Confirm Action", "Remove this time slot from the schedule?")) {
            try {
                await deleteDoc(doc(db, "schedule", id));
                showToast("Time slot removed.");
                logAction("Delete Schedule", `Deleted slot: ${id}`);
                loadSchedule();
            } catch (error) {
                showToast("Error removing schedule: " + error.message);
            }
        }
    }

    // Secret Admin Functions: Audit Log & God Mode
    async function logAction(action, details) {
        try {
            await addDoc(collection(db, "audit_log"), {
                user: auth.currentUser.email,
                role: currentUserRole,
                action,
                details,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error("Audit log failed", e);
        }
    }

    async function loadSettings() {
        const docRef = doc(db, "settings", "maintenance");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();

            // 1. Maintenance Mode
            const maintenanceBtn = document.getElementById('maintenance-toggle');
            if (data.enabled) {
                maintenanceBtn.textContent = 'ON';
                maintenanceBtn.className = 'btn-danger';
            } else {
                maintenanceBtn.textContent = 'OFF';
                maintenanceBtn.className = 'btn-secondary';
            }

            // 2. Developer Lockout Mode
            const lockoutBtn = document.getElementById('lockout-toggle');
            if (data.lockoutEnabled) {
                lockoutBtn.textContent = 'ON';
                lockoutBtn.className = 'btn-danger';
            } else {
                lockoutBtn.textContent = 'OFF';
                lockoutBtn.className = 'btn-secondary';
            }

            const passcodeField = document.getElementById('lockout-passcode-input');
            if (data.lockoutPasscode) {
                passcodeField.value = data.lockoutPasscode;
            }

            const bannerBtn = document.getElementById('banner-toggle');
            if (data.bannerEnabled) {
                bannerBtn.textContent = 'ON';
                bannerBtn.className = 'btn-danger';
            } else {
                bannerBtn.textContent = 'OFF';
                bannerBtn.className = 'btn-secondary';
            }

            // 4. Smart Cleanup
            const cleanupBtn = document.getElementById('cleanup-toggle');
            if (data.cleanupEnabled !== false) {
                cleanupBtn.textContent = 'ON';
                cleanupBtn.className = 'btn-primary';
            } else {
                cleanupBtn.textContent = 'OFF';
                cleanupBtn.className = 'btn-secondary';
            }

            // 5. Announcement Archive
            const archiveBtn = document.getElementById('archive-toggle');
            if (archiveBtn) {
                if (data.archiveEnabled) {
                    archiveBtn.textContent = 'ON';
                    archiveBtn.className = 'btn-primary';
                } else {
                    archiveBtn.textContent = 'OFF';
                    archiveBtn.className = 'btn-secondary';
                }
            }

            const archiveDaysInput = document.getElementById('archive-days-input');
            if (archiveDaysInput && data.archiveDays) {
                archiveDaysInput.value = data.archiveDays;
            }

            const bannerText = document.getElementById('banner-text-input');
            if (data.bannerText) {
                bannerText.value = data.bannerText;
            }

            const bannerTypeSelect = document.getElementById('banner-type-select');
            if (data.bannerType) {
                bannerTypeSelect.value = data.bannerType;
            }

            // 6. Class Banner Visibility
            const classBannerVisibleBtn = document.getElementById('class-banner-visible-toggle');
            if (classBannerVisibleBtn) {
                if (data.showClassBanner !== false) {
                    classBannerVisibleBtn.textContent = 'ON';
                    classBannerVisibleBtn.className = 'btn-primary';
                } else {
                    classBannerVisibleBtn.textContent = 'OFF';
                    classBannerVisibleBtn.className = 'btn-secondary';
                }
            }

            // 7. Class Banner Payment Requirement
            const classBannerPaymentBtn = document.getElementById('class-banner-payment-toggle');
            if (classBannerPaymentBtn) {
                if (data.classBannerPaymentRequired !== false) {
                    classBannerPaymentBtn.textContent = 'ON';
                    classBannerPaymentBtn.className = 'btn-primary';
                } else {
                    classBannerPaymentBtn.textContent = 'OFF';
                    classBannerPaymentBtn.className = 'btn-secondary';
                }
            }
        }
    }

    // Cleanup Toggle
    document.getElementById('cleanup-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('cleanup-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                cleanupEnabled: newState
            }, { merge: true });
            showToast(`Auto-Cleanup turned ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Maintenance Toggle
    document.getElementById('maintenance-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('maintenance-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                enabled: newState,
                updatedBy: auth.currentUser.email,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast(`Maintenance Mode turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Maintenance", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Class Banner Visible Toggle
    document.getElementById('class-banner-visible-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('class-banner-visible-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                showClassBanner: newState
            }, { merge: true });
            showToast(`Class Banner visibility turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Class Banner Visibility", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Class Banner Payment Toggle
    document.getElementById('class-banner-payment-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('class-banner-payment-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                classBannerPaymentRequired: newState
            }, { merge: true });
            showToast(`Class Banner payment requirement turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Class Banner Payment Requirement", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Create Poll
    document.getElementById('create-poll-btn').addEventListener('click', async () => {
        const question = sanitize(pollQuestionInput.value.trim());
        const optionsStr = sanitize(pollOptionsInput.value.trim());

        if (!question || !optionsStr) {
            showToast("Please enter a question and at least 2 options.", "ph-warning", "var(--warning)");
            return;
        }

        const options = optionsStr.split(',').map(o => o.trim()).filter(o => o !== '');
        if (options.length < 2) {
            showToast("Please enter at least 2 options.", "ph-warning", "var(--warning)");
            return;
        }

        const votes = {};
        options.forEach(o => votes[o] = 0);

        try {
            await addDoc(collection(db, "polls"), {
                question,
                options,
                votes,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            });
            pollQuestionInput.value = '';
            pollOptionsInput.value = '';
            showToast("Poll created successfully!", "ph-check", "var(--success)");
            logAction("Create Poll", `Question: ${question}`);
        } catch (e) {
            showToast("Error creating poll: " + e.message, "ph-x", "var(--danger)");
        }
    });

    // Lockout Toggle
    document.getElementById('lockout-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('lockout-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                lockoutEnabled: newState,
                updatedBy: auth.currentUser.email,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast(`Developer Lockout Mode turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Lockout", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Save Lockout Passcode
    document.getElementById('save-lockout-btn').addEventListener('click', async () => {
        const passcodeVal = document.getElementById('lockout-passcode-input').value.trim();
        if (!passcodeVal) {
            return showToast("Passcode cannot be empty", "ph-x-circle", "var(--danger)");
        }
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                lockoutPasscode: passcodeVal,
                updatedBy: auth.currentUser.email,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast("Developer passcode saved successfully");
            logAction("Update Lockout Passcode", "Changed passcode");
            loadSettings();
        } catch (e) {
            showToast("Error saving passcode: " + e.message);
        }
    });

    // Banner Toggle
    document.getElementById('banner-toggle').addEventListener('click', async () => {
        const btn = document.getElementById('banner-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                bannerEnabled: newState,
                updatedBy: auth.currentUser.email,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast(`Global Alert Banner turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Alert Banner", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Save Banner Configuration
    document.getElementById('save-banner-btn').addEventListener('click', async () => {
        const bannerTextVal = document.getElementById('banner-text-input').value.trim();
        const bannerTypeVal = document.getElementById('banner-type-select').value;
        if (!bannerTextVal) {
            return showToast("Banner message cannot be empty", "ph-x-circle", "var(--danger)");
        }
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                bannerText: bannerTextVal,
                bannerType: bannerTypeVal,
                updatedBy: auth.currentUser.email,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast("Alert banner settings published!");
            logAction("Publish Alert Banner", `Text: ${bannerTextVal} (${bannerTypeVal})`);
            loadSettings();
        } catch (e) {
            showToast("Error saving banner settings: " + e.message);
        }
    });

    async function loadAuditLog() {
        const list = document.getElementById('audit-log-list');
        try {
            const snap = await getDocs(query(collection(db, "audit_log"), orderBy("timestamp", "desc")));
            let html = '';
            snap.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp ? data.timestamp.toDate().toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Just now';

                html += `
                <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-main);">${data.action}</span>
                        <span style="color: var(--text-secondary); font-size: 0.65rem;">${date}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic; margin-bottom: 0.1rem;">
                        ${data.details}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--accent-color); font-weight: 500;">
                        <i class="ph ph-user" style="font-size: 0.7rem;"></i> ${data.user} (${data.role})
                    </div>
                </div>
            `;
            });
            list.innerHTML = html || '<p style="text-align:center; color:var(--text-secondary); padding: 1rem;">No logs yet.</p>';
        } catch (e) {
            list.innerHTML = `<p style="color:var(--danger); padding: 1rem;">Error: ${e.message}</p>`;
        }
    }

    // Load Bug Reports (real-time)
    function loadBugReports() {
        if (bugListener) { bugListener(); bugListener = null; }

        bugListener = onSnapshot(query(collection(db, "bugs"), orderBy("createdAt", "desc")), (snap) => {
            const newCount = snap.docs.filter(d => d.data().status === 'new').length;
            if (bugCountBadge) bugCountBadge.textContent = newCount;

            if (snap.empty) {
                bugReportsList.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding: 1rem;">No bug reports yet.</p>';
                return;
            }

            let html = '';
            snap.forEach(d => {
                const data = d.data();
                const date = data.createdAt ? data.createdAt.toDate().toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Just now';
                const isNew = data.status === 'new';

                html += `
                <div class="admin-sched-card" style="border-left: 4px solid ${isNew ? 'var(--danger)' : 'var(--success)'}; margin-bottom: 0.75rem;">
                    <div class="admin-sched-card-header">
                        <div style="display:flex; flex-direction:column; gap:0.15rem;">
                            <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(data.subject)}</span>
                            <span style="font-size:0.7rem; color:var(--text-secondary);">${date} — ${data.page || 'unknown page'}</span>
                        </div>
                        <div class="admin-sched-card-actions">
                            ${isNew ? `<button class="resolve-bug-btn admin-btn-icon" data-id="${d.id}" style="color:var(--success);" title="Mark as Resolved"><i class="ph ph-check"></i></button>` : ''}
                            <button class="delete-bug-btn admin-btn-danger admin-btn-icon" data-id="${d.id}" title="Delete"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-main); margin-top:0.5rem; white-space:pre-wrap; background:var(--bg-color); padding:0.75rem; border-radius:6px;">
                        ${escapeHtml(data.description)}
                    </div>
                    ${!isNew ? '<div style="margin-top:0.5rem; font-size:0.7rem; color:var(--success); font-weight:600;"><i class="ph ph-check-circle"></i> Resolved</div>' : ''}
                </div>
            `;
            });
            bugReportsList.innerHTML = html;

            document.querySelectorAll('.resolve-bug-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    await updateDoc(doc(db, "bugs", id), { status: 'resolved' });
                    logAction("Resolve Bug Report", `ID: ${id}`);
                });
            });

            document.querySelectorAll('.delete-bug-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (await customConfirm("Delete Bug Report", "Permanently delete this bug report?")) {
                        const id = btn.getAttribute('data-id');
                        await deleteDoc(doc(db, "bugs", id));
                        logAction("Delete Bug Report", `ID: ${id}`);
                    }
                });
            });
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialization
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
    });

    // Sync system states in real-time on Admin page
    async function syncAdminSystemStates() {
        if (systemStatesListener) return; // avoid duplicate listeners

        try {
            systemStatesListener = onSnapshot(doc(db, "settings", "maintenance"), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // 1. Global Alert Banner Mode
                    const existingBanner = document.getElementById('system-global-banner');
                    if (data.bannerEnabled && data.bannerText) {
                        if (existingBanner) {
                            existingBanner.className = `global-alert-banner alert-banner-${data.bannerType || 'info'}`;
                            const contentEl = existingBanner.querySelector('.banner-content');
                            if (contentEl) contentEl.textContent = data.bannerText;

                            const iconEl = existingBanner.querySelector('i');
                            if (iconEl) {
                                iconEl.className = data.bannerType === 'danger' ? 'ph ph-warning-octagon' :
                                    data.bannerType === 'warning' ? 'ph ph-warning' :
                                        'ph ph-info';
                            }
                        } else {
                            const banner = document.createElement('div');
                            banner.id = 'system-global-banner';
                            banner.className = `global-alert-banner alert-banner-${data.bannerType || 'info'}`;

                            const iconClass = data.bannerType === 'danger' ? 'ph ph-warning-octagon' :
                                data.bannerType === 'warning' ? 'ph ph-warning' :
                                    'ph ph-info';

                            banner.innerHTML = `
                            <i class="${iconClass}"></i>
                            <div class="banner-content">${data.bannerText}</div>
                        `;
                            document.body.insertBefore(banner, document.body.firstChild);
                        }
                    } else {
                        if (existingBanner) existingBanner.remove();
                    }

                    // 2. Developer Lockout Gate (Bypassed for Admins)
                    const isAdmin = currentUserRole === 'admin';
                    const isBypassed = sessionStorage.getItem('dev_bypass') === 'true';
                    if (data.lockoutEnabled && !isAdmin && !isBypassed) {
                        showAdminLockoutOverlay(data.lockoutPasscode || '');
                    } else {
                        hideAdminLockoutOverlay();
                    }
                }
            });
        } catch (e) {
            console.error("Failed to sync admin system states", e);
        }
    }

    function showAdminLockoutOverlay(correctPasscode) {
        if (document.getElementById('lockout-overlay')) return;

        const appContainer = document.getElementById('admin-container');
        const lContainer = document.getElementById('login-container');
        if (appContainer) appContainer.style.display = 'none';
        if (lContainer) lContainer.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.id = 'lockout-overlay';
        overlay.className = 'lockout-screen-overlay';
        overlay.innerHTML = `
        <div class="lockout-card">
            <i class="ph ph-lock-keyhole lockout-icon"></i>
            <h1>System Locked</h1>
            <p>This portal is currently under active development. Enter the developer passcode to access.</p>
            
            <div class="lockout-input-wrapper">
                <input type="password" id="dev-passcode-input" placeholder="Enter Passcode..." class="form-input" style="width: 100%; box-sizing: border-box; text-align: center;">
            </div>
            <div id="dev-passcode-error" class="lockout-error">❌ Incorrect passcode. Please try again.</div>
            
            <button id="dev-bypass-btn" class="btn-primary btn-full" style="padding: 0.75rem 1.5rem; width: 100%;">
                <i class="ph ph-key"></i> Unlock Dashboard
            </button>
        </div>
    `;

        document.body.appendChild(overlay);

        const input = document.getElementById('dev-passcode-input');
        const button = document.getElementById('dev-bypass-btn');
        const card = overlay.querySelector('.lockout-card');
        const errorEl = document.getElementById('dev-passcode-error');

        const handleUnlock = () => {
            const value = input.value.trim();
            if (value === correctPasscode) {
                sessionStorage.setItem('dev_bypass', 'true');
                const icon = card.querySelector('.lockout-icon');
                icon.className = 'ph ph-lock-simple-open-fill lockout-icon';
                icon.style.color = 'var(--success)';
                icon.style.background = 'rgba(36, 161, 72, 0.1)';
                card.querySelector('h1').textContent = 'Access Granted';
                card.querySelector('p').textContent = 'Decrypting database and preparing dashboard...';
                input.style.display = 'none';
                button.style.display = 'none';
                errorEl.style.display = 'none';

                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.4s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        overlay.remove();
                        if (appContainer) appContainer.style.display = 'block';
                    }, 400);
                }, 1000);
            } else {
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
                errorEl.style.display = 'block';
                input.value = '';
                input.focus();
            }
        };

        button.addEventListener('click', handleUnlock);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleUnlock();
        });

        input.focus();
    }

    function hideAdminLockoutOverlay() {
        const overlay = document.getElementById('lockout-overlay');
        if (overlay) overlay.remove();

        const appContainer = document.getElementById('admin-container');
        if (appContainer && auth.currentUser) appContainer.style.display = 'block';
    }

    // Archive Toggle
    document.getElementById('archive-toggle')?.addEventListener('click', async () => {
        const btn = document.getElementById('archive-toggle');
        const newState = btn.textContent !== 'ON';
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                archiveEnabled: newState
            }, { merge: true });
            showToast(`Auto-Archive turned ${newState ? 'ON' : 'OFF'}`);
            logAction("Toggle Archive", `State: ${newState ? 'ON' : 'OFF'}`);
            loadSettings();
        } catch (e) {
            showToast("Error updating settings: " + e.message);
        }
    });

    // Save Archive Days
    document.getElementById('save-archive-btn')?.addEventListener('click', async () => {
        const days = parseInt(document.getElementById('archive-days-input').value);
        if (isNaN(days) || days < 1) return showToast("Please enter a valid number of days");
        try {
            await setDoc(doc(db, "settings", "maintenance"), {
                archiveDays: days
            }, { merge: true });
            showToast("Archive settings saved");
            logAction("Update Archive Days", `Days: ${days}`);
        } catch (e) {
            showToast("Error saving: " + e.message);
        }
    });

// Expose openModal to global scope
window.openModal = openModal;

function setRandomTagline() {
    const taglines = [
        "Inspiring the next generation.",
        "Making every lesson count.",
        "Empowering minds, one day at a time.",
        "Your dedication makes the difference.",
        "Building a brighter future together.",
        "Teaching is a work of heart.",
        "Excellence in every interaction."
    ];
    const tagline = taglines[Math.floor(Math.random() * taglines.length)];
    
    const taglineEl = document.getElementById('tagline-text');
    if (taglineEl) taglineEl.textContent = tagline;
}

document.addEventListener('DOMContentLoaded', () => {
    const greetingSection = document.getElementById('greeting-section');
    if (greetingSection) {
        greetingSection.addEventListener('click', () => openModal('profile-edit-modal-card'));
    }
    setRandomTagline();
});

