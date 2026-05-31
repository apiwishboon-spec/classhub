import { db, auth, firebaseConfig } from './firebase-config.js';

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
import { collection, addDoc, getDoc, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// DOM Elements
const loginContainer = document.getElementById('login-container');
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
const systemSettingsSection = document.getElementById('system-settings-section');
const auditLogSection = document.getElementById('audit-log-section');

// Notification system
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
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
}

// Global modal close listeners
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-modal')) {
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

// Global Theme Management
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
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const sunsetMin = 18 * 60 + 30; // 18:30
    const sunriseMin = 6 * 60;      // 6:00
    const shouldBeDark = totalMinutes >= sunsetMin || totalMinutes < sunriseMin;
    if (shouldBeDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
}

// Check for Email Link Sign-in on load
async function checkEmailLinkSignIn() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }
        
        try {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            console.log("Successfully signed in with email link!", result.user);
        } catch (error) {
            console.error("Error signing in with email link:", error);
            showToast("Error signing in with email link: " + error.message);
        }
    }
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Logged in
        loginContainer.style.display = 'none';
        adminContainer.style.display = 'block';
        
        try {
            // Fetch user role from Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            
            // Update last login
            const lastLoginTs = serverTimestamp();
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                
                // Check if account is disabled
                if (data.disabled) {
                    await signOut(auth);
                    showToast("This account has been disabled. Please contact the administrator.", "ph-prohibit", "var(--danger)");
                    return;
                }
                
                currentUserRole = data.role || 'teacher';
                // Update last login for existing user
                await setDoc(userDocRef, { lastLogin: lastLoginTs }, { merge: true });
            } else {
                // For the very first user ever, we might want to make them admin.
                const usersSnap = await getDocs(collection(db, "users"));
                if (usersSnap.empty) {
                    currentUserRole = 'admin';
                } else {
                    currentUserRole = 'teacher'; // Default for new signups
                }
                await setDoc(userDocRef, { 
                    role: currentUserRole, 
                    email: user.email,
                    lastLogin: lastLoginTs
                });
            }
            
            const displayRole = currentUserRole === 'ta' ? 'TA' : currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1);
            userRoleBadge.textContent = `Role: ${displayRole}`;
            
            // Manage Section Visibility based on Role
            if (currentUserRole === 'admin') {
                manageUsersSection.style.display = 'block';
                manageScheduleSection.style.display = 'block';
                addAnnouncementSection.style.display = 'block';
                addHomeworkSection.style.display = 'block';
                manageAnnouncementsSection.style.display = 'block';
                manageHomeworkSection.style.display = 'block';
                systemSettingsSection.style.display = 'block';
                auditLogSection.style.display = 'block';
                
                loadUsers();
                loadSchedule();
                loadAnnouncements();
                loadHomework();
                loadSettings();
                loadAuditLog();
            } else if (currentUserRole === 'teacher') {
                manageUsersSection.style.display = 'none';
                manageScheduleSection.style.display = 'none';
                addAnnouncementSection.style.display = 'block';
                addHomeworkSection.style.display = 'block';
                manageAnnouncementsSection.style.display = 'block';
                manageHomeworkSection.style.display = 'block';
                
                loadAnnouncements();
                loadHomework();
            } else if (currentUserRole === 'ta') {
                manageUsersSection.style.display = 'none';
                manageScheduleSection.style.display = 'none';
                addAnnouncementSection.style.display = 'none';
                addHomeworkSection.style.display = 'block';
                manageAnnouncementsSection.style.display = 'none';
                manageHomeworkSection.style.display = 'block';
                
                loadHomework();
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
        }
    } else {
        // Logged out
        loginContainer.style.display = 'block';
        adminContainer.style.display = 'none';
        checkEmailLinkSignIn();
    }
});

// Password Login
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

// Email Link Login
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

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
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
    
    const title = document.getElementById('ann-title').value.trim();
    const message = document.getElementById('ann-message').value.trim();
    const author = document.getElementById('ann-author').value.trim();
    
    if(!title || !message) return showToast("Title and Message required");
    
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
        loadAnnouncements();
    } catch (error) {
        showToast("Error: " + error.message);
    } finally {
        btn.textContent = 'Post Announcement';
        btn.disabled = false;
    }
});

// Add Homework
document.getElementById('add-hw-btn').addEventListener('click', async () => {
    const subject = document.getElementById('hw-subject').value.trim();
    const task = document.getElementById('hw-task').value.trim();
    const due = document.getElementById('hw-due').value.trim();
    
    if(!subject || !task) return showToast("Subject and Task required");
    
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
        loadHomework();
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
    const pass = document.getElementById('new-user-pass').value.trim();
    const role = document.getElementById('new-user-role').value;
    
    if(!email || !pass) return showToast("Email and Password required");
    
    const btn = document.getElementById('add-user-btn');
    btn.textContent = 'Adding...';
    btn.disabled = true;
    
    try {
        // Use a secondary app instance to create a user without logging out the current admin
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        const newUser = userCredential.user;
        
        // Add to users collection in Firestore (using main app db)
        await setDoc(doc(db, "users", newUser.uid), {
            email: email,
            role: role
        });
        
        // Sign out and delete the secondary app instance
        await signOut(secondaryAuth);
        
        showToast(`User ${email} added successfully as ${role}!`);
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-pass').value = '';
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
    
    if(!time) return showToast("Time is required");
    
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
                
                html += `
                    <div class="admin-sched-card" id="user-card-${doc.id}">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;word-break:break-all;">${data.email}</span>
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
                        <th>Email</th>
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
                
                html += `
                <tr id="user-row-${doc.id}">
                    <td>${data.email}</td>
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
    
    if(await customConfirm("Confirm Deletion", "Remove this user's data from the database? (Note: This will not delete the Authentication account, only their permissions and role.)")) {
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

// Load Announcements
async function loadAnnouncements() {
    if (currentUserRole === 'ta') return;
    const list = document.getElementById('announcements-list-admin');
    list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';
    
    try {
        const snap = await getDocs(collection(db, "announcements"));
        const isMobile = window.innerWidth <= 768;
        let html = '';
        
        if (isMobile) {
            html = `<div class="admin-sched-cards">`;
            snap.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;">${data.title}</span>
                            <button class="remove-ann-btn admin-btn-danger admin-btn-icon" data-id="${doc.id}"><i class="ph ph-trash"></i></button>
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
            
            snap.forEach(doc => {
                const data = doc.data();
                html += `
                <tr>
                    <td>${data.title}</td>
                    <td>${data.author}</td>
                    <td>${data.date}</td>
                    <td>
                        <button class="remove-ann-btn admin-btn-danger" data-id="${doc.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        list.innerHTML = html;
        
        document.querySelectorAll('.remove-ann-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(await customConfirm("Confirm Action", "Delete this announcement?")) {
                    const id = e.target.closest('.remove-ann-btn').getAttribute('data-id');
                    await deleteDoc(doc(db, "announcements", id));
                    logAction("Delete Announcement", `ID: ${id}`);
                    loadAnnouncements();
                }
            });
        });
    } catch (error) {
        list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
    }
}

// Load Homework
async function loadHomework() {
    const list = document.getElementById('homework-list-admin');
    list.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';
    
    try {
        const snap = await getDocs(collection(db, "homework"));
        const isMobile = window.innerWidth <= 768;
        let html = '';
        
        if (isMobile) {
            html = `<div class="admin-sched-cards">`;
            snap.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="admin-sched-card">
                        <div class="admin-sched-card-header">
                            <span style="font-weight:600;font-size:0.85rem;">${data.subject}</span>
                            <button class="remove-hw-btn admin-btn-danger admin-btn-icon" data-id="${doc.id}"><i class="ph ph-trash"></i></button>
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
            
            snap.forEach(doc => {
                const data = doc.data();
                html += `
                <tr>
                    <td>${data.subject}</td>
                    <td>${data.homework}</td>
                    <td>${data.due}</td>
                    <td>
                        <button class="remove-hw-btn admin-btn-danger" data-id="${doc.id}"><i class="ph ph-trash"></i> Delete</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        list.innerHTML = html;
        
        document.querySelectorAll('.remove-hw-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(await customConfirm("Confirm Action", "Delete this homework?")) {
                    const id = e.target.closest('.remove-hw-btn').getAttribute('data-id');
                    await deleteDoc(doc(db, "homework", id));
                    logAction("Delete Homework", `ID: ${id}`);
                    loadHomework();
                }
            });
        });
    } catch (error) {
        list.innerHTML = `<p style="color:var(--danger)">${error.message}</p>`;
    }
}

// Remove Schedule Function
async function removeSchedule(id) {
    if (currentUserRole !== 'admin') return;
    
    if(await customConfirm("Confirm Action", "Remove this time slot from the schedule?")) {
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
    const btn = document.getElementById('maintenance-toggle');
    if (docSnap.exists() && docSnap.data().enabled) {
        btn.textContent = 'ON';
        btn.className = 'btn-danger';
    } else {
        btn.textContent = 'OFF';
        btn.className = 'btn-secondary';
    }
}

document.getElementById('maintenance-toggle').addEventListener('click', async () => {
    const btn = document.getElementById('maintenance-toggle');
    const isCurrentlyOn = btn.textContent === 'ON';
    const newState = !isCurrentlyOn;
    
    try {
        await setDoc(doc(db, "settings", "maintenance"), {
            enabled: newState,
            updatedBy: auth.currentUser.email,
            updatedAt: serverTimestamp()
        });
        showToast(`Maintenance Mode turned ${newState ? 'ON' : 'OFF'}`);
        logAction("Toggle Maintenance", `State: ${newState ? 'ON' : 'OFF'}`);
        loadSettings();
    } catch (e) {
        showToast("Error updating settings: " + e.message);
    }
});

async function loadAuditLog() {
    const list = document.getElementById('audit-log-list');
    try {
        const snap = await getDocs(query(collection(db, "audit_log"), orderBy("timestamp", "desc")));
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Just now';
            html += `
                <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.2rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 700; color: var(--accent-color);">${data.action}</span>
                        <span style="color: var(--text-secondary); font-size: 0.65rem;">${date}</span>
                    </div>
                    <div style="word-break: break-all;">${data.details}</div>
                    <div style="font-size: 0.65rem; color: var(--text-secondary);">By: ${data.user} (${data.role})</div>
                </div>
            `;
        });
        list.innerHTML = html || '<p style="text-align:center; color:var(--text-secondary);">No logs yet.</p>';
    } catch (e) {
        list.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});
