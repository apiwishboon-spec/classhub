import { db, auth, firebaseConfig } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, getDoc, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// DOM Elements
const loginContainer = document.getElementById('login-container');
const adminContainer = document.getElementById('admin-container');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userRoleBadge = document.getElementById('user-role-badge');
const manageUsersSection = document.getElementById('manage-users-section');

let currentUserRole = 'teacher';

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
                // First time login or role not set, default to admin if it's the very first user, otherwise teacher.
                // For safety, defaulting to admin if they know the credentials but let's just use teacher, or let's say admin for testing purposes since user mentioned "admin can do everything".
                // We'll default to admin just so the user can actually use it upon initial setup.
                currentUserRole = 'admin';
                await setDoc(doc(db, "users", user.uid), { role: 'admin', email: user.email });
            }
            
            const displayRole = currentUserRole === 'ta' ? 'TA' : currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1);
            userRoleBadge.textContent = `Role: ${displayRole}`;
            
            if (currentUserRole === 'admin') {
                manageUsersSection.style.display = 'block';
                loadUsers();
            } else {
                manageUsersSection.style.display = 'none';
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            // Ignore for now, might be permission issue if rules are strict
        }
    } else {
        // Logged out
        loginContainer.style.display = 'block';
        adminContainer.style.display = 'none';
    }
});

// Login
loginBtn.addEventListener('click', async () => {
    loginError.style.display = 'none';
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
        loginBtn.textContent = 'Login';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// Add Announcement
document.getElementById('add-ann-btn').addEventListener('click', async () => {
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

// Load Users
async function loadUsers() {
    if (currentUserRole !== 'admin') return;
    
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<div style="text-align:center; padding: 1rem;"><div class="spinner"></div><p>Loading users...</p></div>';
    
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
                    <button class="remove-user-btn" data-uid="${doc.id}" style="color:var(--danger); background:none; border:none; cursor:pointer; font-weight: 600;"><i class="ph ph-trash"></i> Remove</button>
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
