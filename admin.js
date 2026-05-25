import { db, auth, firebaseConfig } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    getAuth,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, getDoc, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

// Email Link Elements
const emailLinkInput = document.getElementById('email-link-input');
const sendLinkBtn = document.getElementById('send-link-btn');

let currentUserRole = 'teacher';

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
            alert("Error signing in with email link: " + error.message);
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
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().role || 'teacher';
            } else {
                // For the very first user ever, we might want to make them admin.
                // But for safety in a shared environment, let's check if any users exist.
                const usersSnap = await getDocs(collection(db, "users"));
                if (usersSnap.empty) {
                    currentUserRole = 'admin';
                } else {
                    currentUserRole = 'teacher'; // Default for new signups
                }
                await setDoc(doc(db, "users", user.uid), { role: currentUserRole, email: user.email });
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
                
                loadUsers();
                loadSchedule();
                loadAnnouncements();
                loadHomework();
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

// Add Announcement
document.getElementById('add-ann-btn').addEventListener('click', async () => {
    if (currentUserRole === 'ta') return alert("Unauthorized. TAs can only post homework.");
    
    const title = document.getElementById('ann-title').value.trim();
    const message = document.getElementById('ann-message').value.trim();
    const author = document.getElementById('ann-author').value.trim();
    
    if(!title || !message) return alert("Title and Message required");
    
    const btn = document.getElementById('add-ann-btn');
    btn.textContent = 'Posting...';
    btn.disabled = true;
    
    try {
        await addDoc(collection(db, "announcements"), {
            title, message, author,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            timestamp: new Date()
        });
        alert("Announcement added!");
        document.getElementById('ann-title').value = '';
        document.getElementById('ann-message').value = '';
        document.getElementById('ann-author').value = '';
        loadAnnouncements();
    } catch (error) {
        alert("Error: " + error.message);
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
    
    if(!subject || !task) return alert("Subject and Task required");
    
    const btn = document.getElementById('add-hw-btn');
    btn.textContent = 'Posting...';
    btn.disabled = true;
    
    try {
        await addDoc(collection(db, "homework"), {
            subject, homework: task, due,
            timestamp: new Date()
        });
        alert("Homework added!");
        document.getElementById('hw-subject').value = '';
        document.getElementById('hw-task').value = '';
        document.getElementById('hw-due').value = '';
        loadHomework();
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.textContent = 'Post Homework';
        btn.disabled = false;
    }
});

// Add User (Admin Only)
document.getElementById('add-user-btn').addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return alert("Unauthorized");
    
    const email = document.getElementById('new-user-email').value.trim();
    const pass = document.getElementById('new-user-pass').value.trim();
    const role = document.getElementById('new-user-role').value;
    
    if(!email || !pass) return alert("Email and Password required");
    
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
        
        alert(`User ${email} added successfully as ${role}!`);
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-pass').value = '';
        loadUsers();
    } catch (error) {
        alert("Error adding user: " + error.message);
    } finally {
        btn.textContent = 'Add User';
        btn.disabled = false;
    }
});

// Add Schedule (Admin Only)
document.getElementById('add-sched-btn').addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return alert("Unauthorized");
    
    const time = document.getElementById('sched-time').value.trim();
    const monday = document.getElementById('sched-mon').value.trim();
    const tuesday = document.getElementById('sched-tue').value.trim();
    const wednesday = document.getElementById('sched-wed').value.trim();
    const thursday = document.getElementById('sched-thu').value.trim();
    const friday = document.getElementById('sched-fri').value.trim();
    
    if(!time) return alert("Time is required");
    
    const btn = document.getElementById('add-sched-btn');
    btn.textContent = 'Adding...';
    btn.disabled = true;
    
    try {
        await setDoc(doc(db, "schedule", time), {
            time, monday, tuesday, wednesday, thursday, friday
        });
        alert("Schedule added/updated!");
        document.getElementById('sched-time').value = '';
        document.getElementById('sched-mon').value = '';
        document.getElementById('sched-tue').value = '';
        document.getElementById('sched-wed').value = '';
        document.getElementById('sched-thu').value = '';
        document.getElementById('sched-fri').value = '';
        loadSchedule();
    } catch (error) {
        alert("Error adding schedule: " + error.message);
    } finally {
        btn.textContent = 'Add Time Slot';
        btn.disabled = false;
    }
});

// Load Users
async function loadUsers() {
    if (currentUserRole !== 'admin') return;
    
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<div class="loading-placeholder"><div class="loader"></div><p>Loading users...</p></div>';
    
    try {
        const snap = await getDocs(collection(db, "users"));
        let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        snap.forEach(doc => {
            const data = doc.data();
            const listRole = data.role === 'ta' ? 'TA' : (data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : 'Unknown');
            html += `
            <tr>
                <td>${data.email}</td>
                <td><span class="time-badge">${listRole}</span></td>
                <td>
                        <button class="remove-user-btn admin-btn-danger" data-uid="${doc.id}"><i class="ph ph-trash"></i> Remove</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        usersList.innerHTML = html;
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.closest('.remove-user-btn').getAttribute('data-uid');
                removeUser(uid);
            });
        });
        
    } catch (error) {
        usersList.innerHTML = `<p style="color:var(--danger)">Error loading users: ${error.message}</p>`;
    }
}

// Remove User Function
async function removeUser(uid) {
    if (currentUserRole !== 'admin') return;
    
    if(confirm("Remove this user's access? (Note: To completely delete the authentication account, you must use the Firebase Console or Admin SDK. This will remove their role and login privileges.)")) {
        try {
            await deleteDoc(doc(db, "users", uid));
            alert("User role removed.");
            loadUsers();
        } catch (error) {
            alert("Error removing user: " + error.message);
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
        
        let html = `
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
                    document.getElementById('schedule-form-container').scrollIntoView({ behavior: 'smooth' });
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
        let html = `
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
        list.innerHTML = html;
        
        document.querySelectorAll('.remove-ann-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("Delete this announcement?")) {
                    const id = e.target.closest('.remove-ann-btn').getAttribute('data-id');
                    await deleteDoc(doc(db, "announcements", id));
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
        let html = `
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
        list.innerHTML = html;
        
        document.querySelectorAll('.remove-hw-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("Delete this homework?")) {
                    const id = e.target.closest('.remove-hw-btn').getAttribute('data-id');
                    await deleteDoc(doc(db, "homework", id));
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
    
    if(confirm("Remove this time slot from the schedule?")) {
        try {
            await deleteDoc(doc(db, "schedule", id));
            alert("Time slot removed.");
            loadSchedule();
        } catch (error) {
            alert("Error removing schedule: " + error.message);
        }
    }
}
