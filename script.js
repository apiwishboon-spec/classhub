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
let selectedDay = null; // For mobile day selector
let isMobileView = false;

// Subject color mapping — consistent colors per subject
const subjectColors = [
    { bg: '#e8f5e9', text: '#2e7d32' },
    { bg: '#e3f2fd', text: '#1565c0' },
    { bg: '#fce4ec', text: '#c62828' },
    { bg: '#fff3e0', text: '#e65100' },
    { bg: '#f3e5f5', text: '#6a1b9a' },
    { bg: '#e0f7fa', text: '#00838f' },
    { bg: '#fff8e1', text: '#f9a825' },
    { bg: '#fbe9e7', text: '#bf360c' },
    { bg: '#e8eaf6', text: '#283593' },
    { bg: '#fce4ec', text: '#ad1457' },
];

function getSubjectColor(subject) {
    if (!subject) return subjectColors[0];
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % subjectColors.length;
    return subjectColors[idx];
}

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
                dashboardData.schedule.sort((a, b) => {
                    const timeA = a.time.split('-')[0].trim();
                    const timeB = b.time.split('-')[0].trim();
                    const [hA, mA] = timeA.split(/[:.]/).map(Number);
                    const [hB, mB] = timeB.split(/[:.]/).map(Number);
                    return (hA * 60 + (mA || 0)) - (hB * 60 + (mB || 0));
                });
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

// Auto-updating countdown on mobile
let countdownInterval = null;

function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (!isMobileView) return;
    
    countdownInterval = setInterval(() => {
        // Update countdown texts without full re-render
        document.querySelectorAll('.schedule-item[id^="period-"]').forEach(item => {
            const timeStrEl = item.querySelector('.sched-time');
            if (!timeStrEl) return;
            const timeStr = timeStrEl.textContent.trim();
            if (!timeStr) return;
            
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const parts = timeStr.split('-');
            if (parts.length !== 2) return;
            const startParts = parts[0].split(/[:.]/).map(Number);
            const endParts = parts[1].split(/[:.]/).map(Number);
            const startMins = startParts[0] * 60 + (startParts[1] || 0);
            const endMins = endParts[0] * 60 + (endParts[1] || 0);
            
            const countdownEl = item.querySelector('.sched-countdown');
            const banner = document.querySelector('.countdown-banner');
            
            if (currentMinutes >= startMins && currentMinutes <= endMins) {
                const minsLeft = endMins - currentMinutes;
                if (countdownEl) {
                    countdownEl.textContent = `เหลือ ${minsLeft} นาที`;
                    countdownEl.className = 'sched-countdown countdown-active-text';
                }
                if (banner) {
                    const strong = banner.querySelector('strong');
                    if (strong) {
                        banner.className = 'countdown-banner countdown-active';
                        banner.innerHTML = `<i class="ph ph-chalkboard-teacher"></i><span>กำลังเรียน <strong>${strong.textContent}</strong> — เหลือ ${minsLeft} นาที</span>`;
                    }
                }
            } else if (currentMinutes < startMins) {
                const minsUntil = startMins - currentMinutes;
                if (countdownEl) {
                    countdownEl.textContent = `จะเริ่มใน ${minsUntil} นาที`;
                    countdownEl.className = 'sched-countdown countdown-upcoming-text';
                }
            } else if (countdownEl) {
                countdownEl.textContent = '';
                countdownEl.className = 'sched-countdown';
            }
        });
    }, 60000);
}

function renderSchedule() {
    if (!dashboardData.schedule || dashboardData.schedule.length === 0) {
        scheduleContainer.innerHTML = '<p>No schedule available.</p>';
        return;
    }

    isMobileView = window.innerWidth <= 768;

    if (isMobileView) {
        renderMobileSchedule();
    } else {
        renderDesktopSchedule();
    }
}

function renderMobileSchedule() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayLabels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];

    const now = new Date();
    const currentDayIndex = now.getDay(); // 0=Sun
    const defaultDay = (currentDayIndex >= 1 && currentDayIndex <= 5) ? days[currentDayIndex - 1] : 'monday';
    
    if (!selectedDay) {
        selectedDay = defaultDay;
    }

    // Calculate current time in minutes for highlighting
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Format cell helper
    function formatCell(text) {
        if (!text || text.trim() === '') return '';
        const cleaned = text.replace(/\b\d{4}\b/g, '').trim();
        const match = cleaned.match(/^(\S+)\s+(.+)$/);
        if (match) {
            return { subject: match[1], teacher: match[2].trim() };
        }
        return { subject: cleaned, teacher: '' };
    }

    // Countdown helper
    function getCountdown(timeStr) {
        const parts = timeStr.split('-');
        if (parts.length !== 2) return null;
        const startParts = parts[0].split(/[:.]/).map(Number);
        const endParts = parts[1].split(/[:.]/).map(Number);
        const startMins = startParts[0] * 60 + (startParts[1] || 0);
        const endMins = endParts[0] * 60 + (endParts[1] || 0);

        if (currentMinutes >= startMins && currentMinutes <= endMins) {
            const minsLeft = endMins - currentMinutes;
            return { type: 'active', text: `เหลือ ${minsLeft} นาที`, minsLeft };
        }
        if (currentMinutes < startMins) {
            const minsUntil = startMins - currentMinutes;
            return { type: 'upcoming', text: `จะเริ่มใน ${minsUntil} นาที`, minsUntil };
        }
        return { type: 'past', text: '' };
    }

    // Check if showing today
    const isToday = selectedDay === defaultDay;

    // Day selector tabs
    let html = `<div class="day-tabs" id="day-tabs">`;
    days.forEach((day, di) => {
        const activeClass = day === selectedDay ? ' active' : '';
        html += `<button class="day-tab${activeClass}" data-day="${day}">${dayLabels[di]}</button>`;
    });
    html += `</div>`;

    // Countdown banner for today
    if (isToday && !(currentDayIndex === 0 || currentDayIndex === 6)) {
        let nextClassCountdown = null;
        let currentClassFound = null;
        
        for (const col of dashboardData.schedule) {
            const subject = col[selectedDay] || '';
            const formatted = formatCell(subject);
            if (!formatted.subject) continue;
            
            const countdown = getCountdown(col.time);
            if (countdown && countdown.type === 'active') {
                currentClassFound = { subject: formatted.subject, time: col.time, ...countdown };
                break;
            }
            if (countdown && countdown.type === 'upcoming' && !nextClassCountdown) {
                nextClassCountdown = { subject: formatted.subject, time: col.time, ...countdown };
            }
        }

        if (currentClassFound) {
            html += `<div class="countdown-banner countdown-active">
                <i class="ph ph-chalkboard-teacher"></i>
                <span>กำลังเรียน <strong>${currentClassFound.subject}</strong> — ${currentClassFound.text}</span>
            </div>`;
        } else if (nextClassCountdown) {
            html += `<div class="countdown-banner countdown-upcoming">
                <i class="ph ph-alarm"></i>
                <span>คาบต่อไป: <strong>${nextClassCountdown.subject}</strong> — ${nextClassCountdown.text}</span>
            </div>`;
        }
    }

    // Vertical list for the selected day
    html += `<div class="day-schedule-list" id="day-schedule-list">`;
    let activePeriodId = null;
    
    dashboardData.schedule.forEach((col, i) => {
        const subject = col[selectedDay] || '';
        const formatted = formatCell(subject);
        const periodNum = i + 1;
        let itemClasses = 'schedule-item';
        let countdownHtml = '';
        
        // Check if this is the current class (only when viewing today)
        if (isToday && formatted.subject) {
            const countdown = getCountdown(col.time);
            if (countdown) {
                if (countdown.type === 'active') {
                    itemClasses += ' schedule-current';
                    activePeriodId = `period-${i}`;
                    countdownHtml = `<span class="sched-countdown countdown-active-text">${countdown.text}</span>`;
                } else if (countdown.type === 'upcoming') {
                    countdownHtml = `<span class="sched-countdown countdown-upcoming-text">${countdown.text}</span>`;
                }
            }
        }
        
        if (!formatted.subject) {
            itemClasses += ' schedule-empty';
            html += `
                <div class="${itemClasses}" id="period-${i}">
                    <div class="sched-time">${col.time}</div>
                    <div class="sched-period">คาบที่ ${periodNum}</div>
                    <div class="sched-free">ว่าง</div>
                </div>
            `;
        } else {
            const color = getSubjectColor(formatted.subject);
            html += `
                <div class="${itemClasses}" id="period-${i}">
                    <div class="sched-time">${col.time}</div>
                    <div class="sched-period">คาบที่ ${periodNum}</div>
                    <div class="sched-info">
                        <span class="sched-subject">
                            <span class="subject-tag" style="background:${color.bg};color:${color.text};border:1px solid ${color.text}33;">${formatted.subject}</span>
                        </span>
                        ${formatted.teacher ? `<span class="sched-teacher">${formatted.teacher}</span>` : ''}
                    </div>
                    ${countdownHtml}
                </div>
            `;
        }
    });
    
    html += `</div>`;
    scheduleContainer.innerHTML = html;

    // Animate in
    const listContainer = document.getElementById('day-schedule-list');
    if (listContainer) {
        listContainer.classList.remove('slide-in');
        // Force reflow
        void listContainer.offsetWidth;
        listContainer.classList.add('slide-in');
    }

    // Auto-scroll to current period
    if (activePeriodId) {
        setTimeout(() => {
            const el = document.getElementById(activePeriodId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }

    startCountdownTimer();

    // Attach day tab click events
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedDay = tab.getAttribute('data-day');
            renderMobileSchedule();
        });
    });

    // Swipe between days
    const listEl = document.getElementById('day-schedule-list');
    if (listEl) {
        let startX = 0;
        let startY = 0;
        let distX = 0;
        let isSwiping = false;

        listEl.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwiping = false;
        }, { passive: true });

        listEl.addEventListener('touchmove', (e) => {
            if (!isSwiping) {
                distX = e.touches[0].clientX - startX;
                const distY = e.touches[0].clientY - startY;
                // Only trigger if horizontal swipe
                if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 30) {
                    isSwiping = true;
                }
            }
        }, { passive: true });

        listEl.addEventListener('touchend', () => {
            if (!isSwiping) return;
            const dayIdx = days.indexOf(selectedDay);
            if (distX < -50 && dayIdx < days.length - 1) {
                // Swipe left → next day
                selectedDay = days[dayIdx + 1];
                renderMobileSchedule();
            } else if (distX > 50 && dayIdx > 0) {
                // Swipe right → previous day
                selectedDay = days[dayIdx - 1];
                renderMobileSchedule();
            }
            distX = 0;
            isSwiping = false;
        }, { passive: true });
    }
}

function renderDesktopSchedule() {
    selectedDay = null; // Reset mobile selection

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayLabels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];

    function formatCell(text) {
        if (!text || text.trim() === '') return '';
        const cleaned = text.replace(/\b\d{4}\b/g, '').trim();
        const match = cleaned.match(/^(\S+)\s+(.+)$/);
        if (match) {
            return `<span class="cell-subject">${match[1]}</span><span class="cell-teacher">${match[2].trim()}</span>`;
        }
        return `<span class="cell-subject">${cleaned}</span>`;
    }

    const periodNums = dashboardData.schedule.map((_, i) => i + 1);

    let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="time-col sticky-header">วัน \\ คาบ</th>
                    ${periodNums.map((n, i) => `
                        <th>
                            <div class="period-num">คาบที่ ${n}</div>
                            <div class="time-sub-header">${dashboardData.schedule[i].time}</div>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    days.forEach((day, di) => {
        html += `<tr><td class="time-col day-label"><strong>${dayLabels[di]}</strong></td>`;
        dashboardData.schedule.forEach(col => {
            const subject = col[day] || '';
            const formatted = formatCell(subject);
            const color = getSubjectColor(subject);
            html += `<td class="class-cell" data-day="${day}" data-time="${col.time}" style="background:linear-gradient(135deg,${color.bg}22 0%,var(--card-bg) 100%);">
                ${formatted}
                <span class="cell-color-dot" style="background:${color.text};"></span>
            </td>`;
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

        const hwColor = getSubjectColor(hw.subject);
        html += `
            <div class="homework-item ${finishedClass}" data-id="${hwId}" style="border-left: 3px solid ${hwColor.text}44;">
                <div class="hw-checkbox">
                    <input type="checkbox" class="hw-check-input" id="check-${hwId}" ${checked}>
                </div>
                <div class="hw-icon" style="color:${hwColor.text};">
                    <i class="ph ph-book-open"></i>
                </div>
                <div class="hw-content">
                    <div class="hw-subject">
                        <span class="subject-tag" style="background:${hwColor.bg};color:${hwColor.text};border:1px solid ${hwColor.text}33;font-size:0.7rem;">${hw.subject || 'Subject'}</span>
                    </div>
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

    // Find all class cells for today
    const classCells = document.querySelectorAll(`.class-cell[data-day="${currentDayStr}"]`);
    classCells.forEach(cell => {
        const timeStr = cell.getAttribute('data-time'); // "08:00-08:50"
        if (!timeStr) return;

        const parts = timeStr.split('-');
        if (parts.length === 2) {
            const startParts = parts[0].split(/[:.]/).map(Number);
            const endParts = parts[1].split(/[:.]/).map(Number);
            
            const startMins = startParts[0] * 60 + (startParts[1] || 0);
            const endMins = endParts[0] * 60 + (endParts[1] || 0);

            if (currentMinutes >= startMins && currentMinutes <= endMins) {
                if (cell.textContent.trim() !== '') {
                    cell.classList.add('active-class');
                }
            }
        }
    });
}

// Listen for resize to switch between desktop and mobile views
window.addEventListener('resize', () => {
    const nowMobile = window.innerWidth <= 768;
    if (nowMobile !== isMobileView && dashboardData.schedule.length > 0) {
        renderSchedule();
    }
});

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
