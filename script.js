import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const currentTimeDisplay = document.getElementById('current-time-display');
const scheduleContainer = document.getElementById('schedule-container');
const announcementsContainer = document.getElementById('announcements-container');
const homeworkContainer = document.getElementById('homework-container');
const notesContainer = document.getElementById('notes-container');
const globalSearch = document.getElementById('global-search');
const addNoteBtn = document.getElementById('add-note-btn');

// State
let dashboardData = {
    schedule: [],
    announcements: [],
    homework: [],
    notes: []
};
let hwFilter = 'all'; // all, soon, overdue, completed
let searchTerm = '';
let selectedDay = null; // For mobile day selector
let isMobileView = false;

// Notification system
function showToast(message, icon, color) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon"><i class="ph ${icon}"></i></span><span class="toast-text">${message}</span>`;
    toast.style.borderLeftColor = color || 'var(--accent-color)';
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // Auto remove after 4.5s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

function checkForUpdates(type, newData) {
    const storageKey = `notif_${type}_last`;
    const lastData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (lastData.length === 0) {
        // First load — just store data, no notifications
        localStorage.setItem(storageKey, JSON.stringify(newData));
        return;
    }
    
    // Find new items by ID or content hash
    const newItems = newData.filter(item => {
        const id = item.id || item.title || item.homework || '';
        return !lastData.some(last => (last.id || last.title || last.homework || '') === id);
    });
    
    // Show notifications for new items
    newItems.forEach(item => {
        const id = item.id || '';
        if (type === 'homework') {
            showToast(`New homework: ${item.subject} — ${item.homework}`, 'ph-book-open', 'var(--success)');
        } else if (type === 'announcements') {
            showToast(`New: ${item.title}`, 'ph-megaphone', 'var(--accent-color)');
        }
    });
    
    // Update stored data
    localStorage.setItem(storageKey, JSON.stringify(newData));
}

// Check schedule changes
let lastScheduleHash = '';

function checkScheduleUpdates(scheduleData) {
    const hash = JSON.stringify(scheduleData.map(s => s.time + (s.monday||'') + (s.tuesday||'') + (s.wednesday||'') + (s.thursday||'') + (s.friday||'')));
    if (lastScheduleHash && lastScheduleHash !== hash) {
        showToast('Schedule has been updated!', 'ph-calendar', 'var(--warning)');
    }
    lastScheduleHash = hash;
}

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
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="ph ph-sun"></i>';
    } else if (savedTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i class="ph ph-moon"></i>';
    } else {
        // Auto: check time for sunset/sunrise
        applySunsetTheme();
    }
}

function applySunsetTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') return; // Manual override
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Rough sunset ~18:30 (1110 min), sunrise ~6:00 (360 min) for Thailand
    const sunsetMin = 18 * 60 + 30; // 18:30
    const sunriseMin = 6 * 60;      // 6:00
    
    const shouldBeDark = totalMinutes >= sunsetMin || totalMinutes < sunriseMin;
    const isDark = document.documentElement.hasAttribute('data-theme');
    
    if (shouldBeDark && !isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="ph ph-sun"></i>';
    } else if (!shouldBeDark && isDark) {
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
let lastMinute = -1;

function updateClock() {
    const now = new Date();
    const currentMin = now.getMinutes();
    
    // Update display every second
    const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
    currentTimeDisplay.textContent = timeString;
    
    // Only run heavy logic once per minute
    if (currentMin !== lastMinute) {
        lastMinute = currentMin;
        highlightCurrentClass();
        applySunsetTheme();
    }
}

// Fetch Data (Real-time Auto Refresh)
function fetchDashboardData() {
    try {
        // Only fetch if not using mock config
        if (db.app.options.apiKey === "YOUR_API_KEY") {
            renderMockData();
            return;
        }

        // Listen for Schedule changes + notifications
        onSnapshot(collection(db, "schedule"), (snap) => {
            if (!snap.empty) {
                const schedData = snap.docs.map(doc => doc.data());
                schedData.sort((a, b) => {
                    const timeA = a.time.split('-')[0].trim();
                    const timeB = b.time.split('-')[0].trim();
                    const [hA, mA] = timeA.split(/[:.]/).map(Number);
                    const [hB, mB] = timeB.split(/[:.]/).map(Number);
                    return (hA * 60 + (mA || 0)) - (hB * 60 + (mB || 0));
                });
                dashboardData.schedule = schedData;
                checkScheduleUpdates(schedData);
            } else {
                dashboardData.schedule = [];
            }
            renderDashboard();
        }, (error) => {
            console.error('Error fetching schedule:', error);
            scheduleContainer.innerHTML = '<p style="color:var(--danger)">Failed to load schedule.</p>';
        });

        // Listen for Announcements changes + notifications
        onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snap) => {
            if (!snap.empty) {
                const annData = snap.docs.map(doc => doc.data());
                dashboardData.announcements = annData;
                checkForUpdates('announcements', annData);
            } else {
                dashboardData.announcements = [];
            }
            renderDashboard();
        }, (error) => {
            console.error('Error fetching announcements:', error);
            announcementsContainer.innerHTML = '<p style="color:var(--danger)">Failed to load announcements.</p>';
        });

        // Listen for Homework changes + notifications
        onSnapshot(query(collection(db, "homework"), orderBy("timestamp", "desc")), (snap) => {
            if (!snap.empty) {
                const hwData = snap.docs.map(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    return data;
                });
                dashboardData.homework = hwData;
                checkForUpdates('homework', hwData);
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
    renderNotes();
    highlightCurrentClass();
}

// Search Logic
function handleSearch(e) {
    searchTerm = e.target.value.toLowerCase();
    renderDashboard();
}

globalSearch.addEventListener('input', handleSearch);

// Helper to check if item matches search
function matchesSearch(text) {
    if (!searchTerm) return true;
    return text.toLowerCase().includes(searchTerm);
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

    if (searchTerm) {
        renderSearchSchedule();
        return;
    }

    isMobileView = window.innerWidth <= 768;
    if (isMobileView) {
        renderMobileSchedule();
    } else {
        renderDesktopSchedule();
    }
}

function renderSearchSchedule() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayLabels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];
    let results = [];

    dashboardData.schedule.forEach((col, periodIdx) => {
        days.forEach((day, dayIdx) => {
            const subject = col[day] || '';
            if (subject.toLowerCase().includes(searchTerm)) {
                results.push({
                    day: dayLabels[dayIdx],
                    time: col.time,
                    subject: subject,
                    period: periodIdx + 1
                });
            }
        });
    });

    if (results.length === 0) {
        scheduleContainer.innerHTML = `<div class="empty-notes"><i class="ph ph-magnifying-glass"></i><p>No classes matching "${searchTerm}"</p></div>`;
        return;
    }

    let html = `<div class="day-schedule-list slide-in">`;
    results.forEach(res => {
        const color = getSubjectColor(res.subject);
        html += `
            <div class="schedule-item">
                <div class="sched-time">${res.time}</div>
                <div class="sched-period">${res.day} คาบที่ ${res.period}</div>
                <div class="sched-info">
                    <span class="sched-subject">
                        <span class="subject-tag" style="background:${color.bg};color:${color.text};border:1px solid ${color.text}33;">${res.subject}</span>
                    </span>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    scheduleContainer.innerHTML = `
        <div style="margin-bottom:1rem; font-size:0.85rem; color:var(--text-secondary);">
            Search results for "${searchTerm}":
        </div>
        ${html}
    `;
}

function renderMobileSchedule() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayLabels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];

    const now = new Date();
    const currentDayIndex = now.getDay(); // 0=Sun
    const defaultDay = (currentDayIndex >= 1 && currentDayIndex <= 5) ? days[currentDayIndex - 1] : null;
    
    // Show weekend message if it's Saturday/Sunday
    if (currentDayIndex === 0 || currentDayIndex === 6) {
        const weekendLabel = currentDayIndex === 0 ? 'อาทิตย์' : 'เสาร์';
        const dayTabsHtml = days.map((day, di) => {
            const activeClass = day === selectedDay ? ' active' : '';
            return `<button class="day-tab${activeClass}" data-day="${day}">${dayLabels[di]}</button>`;
        }).join('');
        
        scheduleContainer.innerHTML = `
            <div class="weekend-message">
                <div class="weekend-icon"><i class="ph ph-beach-ball"></i></div>
                <div class="weekend-title">วัน<span class="weekend-day">${weekendLabel}</span></div>
                <div class="weekend-sub">พักผ่อนวันหยุด 🎉</div>
            </div>
            <div class="day-tabs">${dayTabsHtml}</div>
        `;

        // Attach day tab click events for weekend mode
        document.querySelectorAll('.day-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                selectedDay = tab.getAttribute('data-day');
                renderMobileSchedule();
            });
        });
        return;
    }
    
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

    // Today's progress bar (weekday only)
    let progressHtml = '';
    if (isToday && !(currentDayIndex === 0 || currentDayIndex === 6) && dashboardData.schedule.length > 0) {
        // Find first and last period times
        const firstTime = dashboardData.schedule[0].time.split('-')[0].trim();
        const lastTime = dashboardData.schedule[dashboardData.schedule.length - 1].time.split('-')[1].trim();
        const firstParts = firstTime.split(/[:.]/).map(Number);
        const lastParts = lastTime.split(/[:.]/).map(Number);
        const firstMins = firstParts[0] * 60 + (firstParts[1] || 0);
        const lastMins = lastParts[0] * 60 + (lastParts[1] || 0);
        const totalSchoolMins = lastMins - firstMins;
        
        let progressPercent = 0;
        if (currentMinutes >= firstMins && currentMinutes <= lastMins) {
            progressPercent = ((currentMinutes - firstMins) / totalSchoolMins) * 100;
        } else if (currentMinutes > lastMins) {
            progressPercent = 100;
        }
        
        const reminderHtml = progressPercent >= 100 ? `<div style="color:var(--accent-color); font-weight:700; font-size:0.75rem; margin-top:0.25rem; text-align:center;">เลิกเรียนแล้ว! อย่าลืมทำการบ้านด้วยนะ 📚</div>` : '';
        
        progressHtml = `
            <div class="day-progress-container">
                <div class="day-progress-bar">
                    <div class="day-progress-fill" style="width:${progressPercent}%"></div>
                </div>
                <div class="day-progress-label">${Math.round(progressPercent)}% ของวันเรียน</div>
                ${reminderHtml}
            </div>
        `;
    }

    // Day selector tabs
    let html = `<div class="day-tabs" id="day-tabs">`;
    days.forEach((day, di) => {
        const activeClass = day === selectedDay ? ' active' : '';
        html += `<button class="day-tab${activeClass}" data-day="${day}">${dayLabels[di]}</button>`;
    });
    html += `</div>`;

    // Progress bar + countdown
    html += progressHtml;

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
    const filteredAnn = dashboardData.announcements.filter(ann => 
        matchesSearch(ann.title || '') || matchesSearch(ann.message || '') || matchesSearch(ann.author || '')
    );

    if (filteredAnn.length === 0) {
        announcementsContainer.innerHTML = searchTerm ? '<p>No results found.</p>' : '<p>No announcements right now.</p>';
        return;
    }

    let html = '<div class="announcement-list">';
    filteredAnn.forEach(ann => {
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

function getHwStatus(due) {
    if (!due) return 'soon';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let dueDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        dueDate = new Date(due);
    } else if (due.toLowerCase().includes('tomorrow')) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
    } else if (due.toLowerCase().includes('today')) {
        dueDate = new Date();
    } else {
        return 'soon'; // Default
    }
    
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < now) return 'overdue';
    const diff = (dueDate - now) / (1000 * 60 * 60 * 24);
    if (diff <= 3) return 'soon';
    return 'later';
}

function renderHomework() {
    const finishedHw = JSON.parse(localStorage.getItem('finishedHomework') || '[]');
    
    const filteredHw = dashboardData.homework.filter(hw => 
        matchesSearch(hw.subject || '') || matchesSearch(hw.homework || '')
    );

    // Sort by actual due date first
    function parseDate(due) {
        if (!due) return new Date(8640000000000000); // Far future
        if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return new Date(due);
        const now = new Date();
        if (due.toLowerCase().includes('tomorrow')) {
            now.setDate(now.getDate() + 1);
            return now;
        }
        if (due.toLowerCase().includes('today')) return now;
        return new Date(8640000000000000);
    }

    filteredHw.sort((a, b) => parseDate(a.due) - parseDate(b.due));

    const categorized = {
        soon: [],
        overdue: [],
        completed: [],
        later: []
    };

    filteredHw.forEach(hw => {
        const hwId = hw.id || hw.homework;
        if (finishedHw.includes(hwId)) {
            categorized.completed.push(hw);
        } else {
            const status = getHwStatus(hw.due);
            categorized[status].push(hw);
        }
    });

    const soonCount = categorized.soon.length;
    const overdueCount = categorized.overdue.length;
    const completedCount = categorized.completed.length;
    const totalCount = filteredHw.length;

    if (totalCount === 0) {
        homeworkContainer.innerHTML = searchTerm ? '<p>No results found.</p>' : '<p>No homework! Enjoy your day.</p>';
        return;
    }

    let html = `
        <div class="hw-categories">
            <button class="hw-cat-btn ${hwFilter === 'all' ? 'active' : ''}" data-filter="all">All <span class="hw-badge">${totalCount}</span></button>
            <button class="hw-cat-btn ${hwFilter === 'soon' ? 'active' : ''}" data-filter="soon">Soon <span class="hw-badge">${soonCount}</span></button>
            <button class="hw-cat-btn ${hwFilter === 'overdue' ? 'active' : ''}" data-filter="overdue">Overdue <span class="hw-badge">${overdueCount}</span></button>
            <button class="hw-cat-btn ${hwFilter === 'completed' ? 'active' : ''}" data-filter="completed">Done <span class="hw-badge">${completedCount}</span></button>
        </div>
        <div class="homework-list">
    `;

    let displayItems = [];
    if (hwFilter === 'all') {
        displayItems = [...categorized.overdue, ...categorized.soon, ...categorized.later, ...categorized.completed];
    } else {
        displayItems = categorized[hwFilter] || [];
    }

    if (displayItems.length === 0) {
        html += `<p style="padding: 1rem; text-align: center; color: var(--text-secondary);">No homework in this category.</p>`;
    }

    displayItems.forEach((hw, index) => {
        const hwId = hw.id || `mock-${index}`;
        const isFinished = finishedHw.includes(hwId);
        const finishedClass = isFinished ? 'hw-finished' : '';
        const checked = isFinished ? 'checked' : '';
        const status = getHwStatus(hw.due);
        
        let statusTag = '';
        if (!isFinished) {
            if (status === 'overdue') statusTag = '<span style="color:var(--danger);font-size:0.7rem;font-weight:700;">OVERDUE</span>';
            else if (status === 'soon') statusTag = '<span style="color:var(--warning);font-size:0.7rem;font-weight:700;">DUE SOON</span>';
        }

        const hwColor = getSubjectColor(hw.subject);
        html += `
            <div class="homework-item ${finishedClass}" data-id="${hwId}" style="border-left: 3px solid ${isFinished ? 'var(--border-color)' : hwColor.text};">
                <div class="hw-checkbox">
                    <input type="checkbox" class="hw-check-input" id="check-${hwId}" ${checked}>
                </div>
                <div class="hw-icon" style="color:${isFinished ? 'var(--text-secondary)' : hwColor.text};">
                    <i class="ph ph-book-open"></i>
                </div>
                <div class="hw-content">
                    <div class="hw-subject">
                        <span class="subject-tag" style="background:${hwColor.bg};color:${hwColor.text};border:1px solid ${hwColor.text}33;font-size:0.7rem;">${hw.subject || 'Subject'}</span>
                        ${statusTag}
                    </div>
                    <div class="hw-title">${hw.homework || 'Task'}</div>
                    <div class="hw-due"><i class="ph ph-clock-circle"></i> Due: ${formatDueDate(hw.due)}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    homeworkContainer.innerHTML = html;

    // Attach event listeners
    document.querySelectorAll('.hw-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hwFilter = btn.getAttribute('data-filter');
            renderHomework();
        });
    });

    function formatDueDate(due) {
        if (!due) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
            const [y, m, d] = due.split('-');
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${d} ${months[parseInt(m)-1]} ${y}`;
        }
        return due;
    }

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

// Quick Notes Logic
function fetchNotes() {
    const notes = JSON.parse(localStorage.getItem('user_notes') || '[]');
    dashboardData.notes = notes;
}

function saveNotes() {
    localStorage.setItem('user_notes', JSON.stringify(dashboardData.notes));
}

function renderNotes() {
    const filteredNotes = dashboardData.notes.filter(note => 
        matchesSearch(note.content || '') || matchesSearch(note.type || '')
    );
    
    // Sort: pinned first
    filteredNotes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (filteredNotes.length === 0) {
        notesContainer.innerHTML = `
            <div class="empty-notes">
                <i class="ph ph-pencil-line"></i>
                <p>${searchTerm ? 'No results found.' : 'No notes yet. Click + to add one!'}</p>
            </div>
        `;
        return;
    }

    let html = '';
    filteredNotes.forEach(note => {
        const pinnedClass = note.pinned ? 'pinned' : '';
        const pinActive = note.pinned ? 'pin-active' : '';
        const typeIcon = note.type === 'formula' ? 'ph-function' : (note.type === 'task' ? 'ph-check-square' : 'ph-push-pin');
        
        html += `
            <div class="note-card ${pinnedClass}" data-id="${note.id}">
                <div class="note-header">
                    <span class="note-type"><i class="ph ${typeIcon}"></i> ${note.type}</span>
                    <div class="note-actions">
                        <button class="note-btn toggle-pin ${pinActive}" title="Pin Note"><i class="ph ph-push-pin"></i></button>
                        <button class="note-btn delete-note" title="Delete Note"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div class="note-content" contenteditable="true" spellcheck="false">${note.content}</div>
            </div>
        `;
    });
    notesContainer.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.delete-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.note-card').getAttribute('data-id');
            dashboardData.notes = dashboardData.notes.filter(n => n.id !== id);
            saveNotes();
            renderNotes();
        });
    });

    document.querySelectorAll('.toggle-pin').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.note-card').getAttribute('data-id');
            const note = dashboardData.notes.find(n => n.id === id);
            if (note) note.pinned = !note.pinned;
            saveNotes();
            renderNotes();
        });
    });

    document.querySelectorAll('.note-content').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = el.closest('.note-card').getAttribute('data-id');
            const note = dashboardData.notes.find(n => n.id === id);
            if (note) {
                note.content = el.innerText;
                saveNotes();
            }
        });
    });
}

addNoteBtn.addEventListener('click', () => {
    const types = ['reminder', 'formula', 'task'];
    const type = types[Math.floor(Math.random() * types.length)];
    const newNote = {
        id: Date.now().toString(),
        content: 'New note...',
        type: type,
        pinned: false,
        timestamp: new Date()
    };
    dashboardData.notes.unshift(newNote);
    saveNotes();
    renderNotes();
    
    // Focus the new note
    setTimeout(() => {
        const firstNote = notesContainer.querySelector('.note-content');
        if (firstNote) {
            firstNote.focus();
            const range = document.createRange();
            range.selectNodeContents(firstNote);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, 0);
});

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
    fetchNotes();
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                console.log('SW registered!', reg);
            }).catch(err => {
                console.log('SW registration failed: ', err);
            });
        });
    }

    // PWA Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show custom install banner after a short delay
        if (!localStorage.getItem('pwa_prompt_dismissed')) {
            setTimeout(() => {
                showInstallBanner(deferredPrompt);
            }, 5000);
        }
    });

    // Request Notification Permission on first open
    if ('Notification' in window && Notification.permission === 'default') {
        if (!localStorage.getItem('notif_asked')) {
            setTimeout(() => {
                requestNotifPermission();
            }, 3000);
        }
    }

    // Update clock every second
    setInterval(updateClock, 1000);
    
    // Fetch data every 5 minutes
    setInterval(fetchDashboardData, 5 * 60 * 1000);
}

function requestNotifPermission() {
    Notification.requestPermission().then(permission => {
        localStorage.setItem('notif_asked', 'true');
        if (permission === 'granted') {
            showToast('Notifications enabled!', 'ph-bell', 'var(--success)');
        }
    });
}

function showInstallBanner(prompt) {
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
        <div class="pwa-content">
            <i class="ph ph-download-simple"></i>
            <span>Add MyClassHub to your home screen for a better experience!</span>
        </div>
        <div class="pwa-actions">
            <button id="pwa-install-btn" class="btn-primary" style="padding: 0.4rem 0.8rem; min-height: auto; font-size: 0.8rem;">Install</button>
            <button id="pwa-close-btn" class="icon-button" style="width: 30px; height: 30px;"><i class="ph ph-x"></i></button>
        </div>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('pwa-install-btn').addEventListener('click', () => {
        prompt.prompt();
        prompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            banner.remove();
        });
    });
    
    document.getElementById('pwa-close-btn').addEventListener('click', () => {
        localStorage.setItem('pwa_prompt_dismissed', 'true');
        banner.remove();
    });
}

// Run init on load
document.addEventListener('DOMContentLoaded', init);
