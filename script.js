import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

// Fetch Data (Real-time Auto Refresh)
function fetchDashboardData() {
    try {
        // Only fetch if not using mock config
        if (db.app.options.apiKey === "YOUR_API_KEY") {
            renderMockData();
            return;
        }

        // Listen for Schedule changes
        onSnapshot(collection(db, "schedule"), (snap) => {
            if (!snap.empty) {
                dashboardData.schedule = snap.docs.map(doc => doc.data());
                dashboardData.schedule.sort((a, b) => a.time.localeCompare(b.time));
            } else {
                dashboardData.schedule = [];
            }
            renderDashboard();
        }, (error) => {
            console.error('Error fetching schedule:', error);
            scheduleContainer.innerHTML = '<p style="color:var(--danger)">Failed to load schedule.</p>';
        });

        // Listen for Announcements changes
        onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snap) => {
            if (!snap.empty) {
                dashboardData.announcements = snap.docs.map(doc => doc.data());
            } else {
                dashboardData.announcements = [];
            }
            renderDashboard();
        }, (error) => {
            console.error('Error fetching announcements:', error);
            announcementsContainer.innerHTML = '<p style="color:var(--danger)">Failed to load announcements.</p>';
        });

        // Listen for Homework changes
        onSnapshot(query(collection(db, "homework"), orderBy("timestamp", "desc")), (snap) => {
            if (!snap.empty) {
                dashboardData.homework = snap.docs.map(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    return data;
                });
            } else {
                dashboardData.homework = [];
            }
            renderDashboard();
        }, (error) => {
            console.error('Error fetching homework:', error);
            homeworkContainer.innerHTML = '<p style="color:var(--danger)">Failed to load homework.</p>';
        });

    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
        scheduleContainer.innerHTML = '<p style="color:var(--danger)">Failed to connect. Please check Firebase config.</p>';
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
    const dayLabels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];

    // Helper: strip 4-digit room numbers and format as two lines
    function formatCell(text) {
        if (!text || text.trim() === '') return '';
        // Remove 4-digit numbers (room numbers like 5307, 3203, 3207, 8002)
        const cleaned = text.replace(/\b\d{4}\b/g, '').trim();
        // Split on last whitespace run: subject code + teacher name
        const match = cleaned.match(/^(\S+)\s+(.+)$/);
        if (match) {
            return `<span class="cell-subject">${match[1]}</span><span class="cell-teacher">${match[2].trim()}</span>`;
        }
        return `<span class="cell-subject">${cleaned}</span>`;
    }

    // Build period number header based on how many schedule rows exist
    const periodNums = dashboardData.schedule.map((_, i) => i + 1);

    let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="time-col" rowspan="2">วัน \ ชั่วโมง</th>
                    ${periodNums.map(n => `<th>${n}</th>`).join('')}
                </tr>
                <tr>
                    ${dashboardData.schedule.map(row => `<th class="time-sub-header">${row.time}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    // Render one row per day
    days.forEach((day, di) => {
        html += `<tr><td class="time-col day-label">${dayLabels[di]}</td>`;
        dashboardData.schedule.forEach(col => {
            const subject = col[day] || '';
            const formatted = formatCell(subject);
            html += `<td class="class-cell" data-day="${day}" data-time="${col.time}">${formatted}</td>`;
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

    const finishedHw = JSON.parse(localStorage.getItem('finishedHomework') || '[]');

    let html = '<div class="homework-list">';
    dashboardData.homework.forEach((hw, index) => {
        const hwId = hw.id || `mock-${index}`;
        const isFinished = finishedHw.includes(hwId);
        const finishedClass = isFinished ? 'hw-finished' : '';
        const checked = isFinished ? 'checked' : '';

        html += `
            <div class="homework-item ${finishedClass}" data-id="${hwId}">
                <div class="hw-checkbox">
                    <input type="checkbox" class="hw-check-input" id="check-${hwId}" ${checked}>
                </div>
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

    // Attach event listeners for checkboxes
    document.querySelectorAll('.hw-check-input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const hwItem = e.target.closest('.homework-item');
            const hwId = hwItem.getAttribute('data-id');
            let storedFinished = JSON.parse(localStorage.getItem('finishedHomework') || '[]');
            
            if (e.target.checked) {
                hwItem.classList.add('hw-finished');
                if (!storedFinished.includes(hwId)) storedFinished.push(hwId);
            } else {
                hwItem.classList.remove('hw-finished');
                storedFinished = storedFinished.filter(id => id !== hwId);
            }
            
            localStorage.setItem('finishedHomework', JSON.stringify(storedFinished));
        });
    });
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
