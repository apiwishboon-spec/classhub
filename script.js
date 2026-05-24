import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const currentTimeDisplay = document.getElementById('current-time-display');
const scheduleContainer = document.getElementById('schedule-container');
const announcementsContainer = document.getElementById('announcements-container');
const homeworkContainer = document.getElementById('homework-container');

// State
let dashboardData = {
    schedule: [],
    announcements: [],
    homework: []
};

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="ph ph-sun"></i>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i class="ph ph-moon"></i>';
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.hasAttribute('data-theme');
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="ph ph-moon"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="ph ph-sun"></i>';
    }
});

// Time and Clock Management
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    currentTimeDisplay.textContent = timeString;
    highlightCurrentClass();
}

// Fetch Data
async function fetchDashboardData() {
    try {
        // Only fetch if not using mock config
        if (db.app.options.apiKey === "YOUR_API_KEY") {
            renderMockData();
            return;
        }

        const scheduleSnap = await getDocs(collection(db, "schedule"));
        if (!scheduleSnap.empty) {
            dashboardData.schedule = scheduleSnap.docs.map(doc => doc.data());
            // Sort by time
            dashboardData.schedule.sort((a, b) => a.time.localeCompare(b.time));
        }

        const announcementsSnap = await getDocs(query(collection(db, "announcements"), orderBy("timestamp", "desc")));
        if (!announcementsSnap.empty) {
            dashboardData.announcements = announcementsSnap.docs.map(doc => doc.data());
        }

        const homeworkSnap = await getDocs(query(collection(db, "homework"), orderBy("timestamp", "desc")));
        if (!homeworkSnap.empty) {
            dashboardData.homework = homeworkSnap.docs.map(doc => doc.data());
        }
        
        // If everything is empty but we successfully connected, maybe render mock data for demo purposes, 
        // or just render the empty dashboard.
        if (scheduleSnap.empty && announcementsSnap.empty && homeworkSnap.empty) {
            console.log("No data found in Firebase, rendering mock data for demo.");
            renderMockData();
            return;
        }

        renderDashboard();
    } catch (error) {
        console.error('Error fetching data from Firebase:', error);
        scheduleContainer.innerHTML = '<p style="color:var(--danger)">Failed to load data. Please check Firebase config.</p>';
        announcementsContainer.innerHTML = '<p style="color:var(--danger)">Failed to load announcements.</p>';
        homeworkContainer.innerHTML = '<p style="color:var(--danger)">Failed to load homework.</p>';
        
        // Fallback to mock data for demonstration
        setTimeout(renderMockData, 2000);
    }
}

function renderMockData() {
    // Fallback mock data if API is not set
    dashboardData = {
        schedule: [
            { time: "08:00-08:50", monday: "Math", tuesday: "Physics", wednesday: "English", thursday: "Biology", friday: "Chemistry" },
            { time: "09:00-09:50", monday: "History", tuesday: "Math", wednesday: "PE", thursday: "Physics", friday: "English" },
            { time: "10:00-10:50", monday: "Biology", tuesday: "Chemistry", wednesday: "Math", thursday: "English", friday: "History" }
        ],
        announcements: [
            { title: "Welcome to a new term!", message: "Please check your schedules carefully as there have been some room changes.", author: "Mr. Smith", date: "Oct 24" },
            { title: "Science Fair", message: "Don't forget to submit your science fair project ideas by Friday.", author: "Mrs. Davis", date: "Oct 22" }
        ],
        homework: [
            { subject: "Math", homework: "Page 42, Exercises 1-10", due: "Tomorrow" },
            { subject: "Physics", homework: "Read Chapter 4", due: "Friday" },
            { subject: "English", homework: "Write an essay on 'The Great Gatsby'", due: "Next Monday" }
        ]
    };
    renderDashboard();
}

// Render Functions
function renderDashboard() {
    renderSchedule();
    renderAnnouncements();
    renderHomework();
    highlightCurrentClass();
}

function renderSchedule() {
    if (!dashboardData.schedule || dashboardData.schedule.length === 0) {
        scheduleContainer.innerHTML = '<p>No schedule available.</p>';
        return;
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
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
                </tr>
            </thead>
            <tbody>
    `;

    dashboardData.schedule.forEach((row) => {
        html += `<tr><td class="time-col" data-time="${row.time}">${row.time}</td>`;
        days.forEach(day => {
            const subject = row[day] || '';
            html += `<td class="class-cell" data-day="${day}">${subject}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    scheduleContainer.innerHTML = html;
}

function renderAnnouncements() {
    if (!dashboardData.announcements || dashboardData.announcements.length === 0) {
        announcementsContainer.innerHTML = '<p>No announcements right now.</p>';
        return;
    }

    let html = '<div class="announcement-list">';
    dashboardData.announcements.forEach(ann => {
        html += `
            <div class="announcement-card">
                <div class="announcement-header">
                    <div class="announcement-title">${ann.title || 'Announcement'}</div>
                    <div class="announcement-date">${ann.date || ''}</div>
                </div>
                <div class="announcement-message">${ann.message || ''}</div>
                <div class="announcement-author">
                    <i class="ph ph-user-circle"></i> ${ann.author || 'Teacher'}
                </div>
            </div>
        `;
    });
    html += '</div>';
    announcementsContainer.innerHTML = html;
}

function renderHomework() {
    if (!dashboardData.homework || dashboardData.homework.length === 0) {
        homeworkContainer.innerHTML = '<p>No homework! Enjoy your day.</p>';
        return;
    }

    let html = '<div class="homework-list">';
    dashboardData.homework.forEach(hw => {
        html += `
            <div class="homework-item">
                <div class="hw-icon">
                    <i class="ph ph-book-open"></i>
                </div>
                <div class="hw-content">
                    <div class="hw-subject">${hw.subject || 'Subject'}</div>
                    <div class="hw-title">${hw.homework || 'Task'}</div>
                    <div class="hw-due"><i class="ph ph-clock-circle"></i> Due: ${hw.due || ''}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    homeworkContainer.innerHTML = html;
}

function highlightCurrentClass() {
    const table = document.querySelector('.schedule-table');
    if (!table) return;

    // Remove all previous highlights
    document.querySelectorAll('.active-class').forEach(el => el.classList.remove('active-class'));

    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    if (currentDayIndex === 0 || currentDayIndex === 6) return; // Weekend

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const currentDayStr = days[currentDayIndex - 1];
    
    // Parse current time to minutes since midnight for easier comparison
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const timeCells = document.querySelectorAll('.time-col');
    timeCells.forEach(cell => {
        const timeStr = cell.getAttribute('data-time'); // "08:00-08:50"
        if (!timeStr) return;

        const parts = timeStr.split('-');
        if (parts.length === 2) {
            const startParts = parts[0].split(':');
            const endParts = parts[1].split(':');
            
            const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

            if (currentMinutes >= startMins && currentMinutes <= endMins) {
                // Find the corresponding cell for the current day
                const row = cell.parentElement;
                const classCell = row.querySelector(`.class-cell[data-day="${currentDayStr}"]`);
                if (classCell && classCell.textContent.trim() !== '') {
                    classCell.classList.add('active-class');
                }
            }
        }
    });
}

// Initialization
function init() {
    initTheme();
    updateClock();
    fetchDashboardData();
    
    // Update clock every minute
    setInterval(updateClock, 60000);
    
    // Fetch data every 5 minutes
    setInterval(fetchDashboardData, 5 * 60 * 1000);
}

// Run init on load
document.addEventListener('DOMContentLoaded', init);
