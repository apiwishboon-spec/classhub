import { db, imgbbApiKey } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, query, orderBy, limit, onSnapshot, updateDoc, increment, addDoc, serverTimestamp, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sanitize } from './profanity-filter.js';

// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const currentTimeDisplay = document.getElementById('current-time-display');
const scheduleContainer = document.getElementById('schedule-container');
const announcementsContainer = document.getElementById('announcements-container');
const homeworkContainer = document.getElementById('homework-container');
const notesContainer = document.getElementById('notes-container');
const globalSearch = document.getElementById('global-search');
const addNoteBtn = document.getElementById('add-note-btn');
const pollsSection = document.getElementById('polls-section');
const pollsContainer = document.getElementById('polls-container');

// State
let dashboardData = {
    schedule: [],
    announcements: [],
    homework: [],
    notes: []
};

// Polls Logic
function fetchPolls() {
    onSnapshot(query(collection(db, "polls"), orderBy("createdAt", "desc")), (snap) => {
        if (snap.empty) {
            if (pollsSection) pollsSection.style.display = 'none';
            return;
        }

        if (pollsSection) pollsSection.style.display = 'block';
        const pollIdParam = new URLSearchParams(window.location.search).get('pollId');
        
        let html = '';
        snap.forEach(d => {
            const data = d.data();
            const totalVotes = Object.values(data.votes || {}).reduce((a, b) => a + b, 0);
            const hasVoted = localStorage.getItem(`voted_${d.id}`);
            const isTargetPoll = pollIdParam === d.id;
            const isOpen = data.isOpen !== false;
            const showResults = !isOpen || hasVoted; // Always show if voted, OR if closed

            html += `
                <div class="poll-card" style="margin-bottom: 1.5rem; ${isTargetPoll ? 'border: 2px solid var(--accent-color); padding: 1rem; border-radius: 8px;' : ''}" id="poll-${d.id}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                        <h3 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                            ${data.question}
                            ${isTargetPoll ? '<span class="time-badge" style="font-size: 0.6rem; background: var(--accent-color); color: white;">SCANNED</span>' : ''}
                        </h3>
                        <span class="time-badge" style="font-size: 0.7rem;">${totalVotes} votes</span>
                    </div>
                    
                    ${!isOpen && !hasVoted ? `<p style="text-align:center; color:var(--danger); font-weight:600; margin-bottom:1rem;">🗳️ This poll is now CLOSED. See results below.</p>` : ''}

                    <div class="poll-options" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${data.options.map(opt => {
                            const count = data.votes[opt] || 0;
                            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            
                            // Only show percentages/bars if closed OR if the user has already voted
                            const revealStats = !isOpen || (isOpen && hasVoted);
                            
                            return `
                                <div class="poll-option-wrapper" style="position: relative;">
                                    <button class="poll-vote-btn btn-secondary" 
                                            style="width: 100%; text-align: left; position: relative; z-index: 1; background: transparent; overflow: hidden; display: flex; justify-content: space-between;"
                                            data-poll-id="${d.id}" data-option="${opt}" ${hasVoted || !isOpen ? 'disabled' : ''}>
                                        <span>${opt}</span>
                                        ${revealStats ? `<span>${percent}% (${count})</span>` : ''}
                                        <div class="poll-progress" style="position: absolute; top: 0; left: 0; height: 100%; background: var(--highlight-bg); width: ${revealStats ? percent : 0}%; z-index: -1; transition: width 0.5s ease;"></div>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="status-msg" style="text-align: center; margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-secondary);">
                        ${!isOpen ? 'Poll closed by Admin.' : hasVoted ? 'You have already voted.' : 'Select an option to vote!'}
                    </div>
                </div>
            `;
        });
        if (pollsContainer) pollsContainer.innerHTML = html;

        // Add vote listeners
        document.querySelectorAll('.poll-vote-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const pollId = btn.getAttribute('data-poll-id');
                const option = btn.getAttribute('data-option');
                
                // Immediate check
                if (localStorage.getItem(`voted_${pollId}`)) return;

                // Disable all buttons for THIS poll immediately
                const pollCard = document.getElementById(`poll-${pollId}`);
                if (pollCard) {
                    pollCard.querySelectorAll('.poll-vote-btn').forEach(b => b.disabled = true);
                }

                try {
                    const pollRef = doc(db, "polls", pollId);
                    await updateDoc(pollRef, {
                        [`votes.${option}`]: increment(1)
                    });
                    localStorage.setItem(`voted_${pollId}`, 'true');
                    showToast("Vote submitted!", "ph-check", "var(--success)");
                } catch (e) {
                    localStorage.removeItem(`voted_${pollId}`);
                    if (pollCard) {
                        pollCard.querySelectorAll('.poll-vote-btn').forEach(b => b.disabled = false);
                    }
                    showToast("Error voting: " + e.message, "ph-x", "var(--danger)");
                }
            });
        });

        // If target poll exists, scroll to it
        if (pollIdParam) {
            setTimeout(() => {
                const el = document.getElementById(`poll-${pollIdParam}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    });
}
let hwFilter = 'all'; // all, soon, overdue, completed
let searchTerm = '';
let selectedDay = null; // For mobile day selector
let isMobileView = false;

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
    
    // Show notifications for new items (in-app toast)
    newItems.forEach(item => {
        if (type === 'homework') {
            showToast(`New homework: ${item.subject} — ${item.homework}`, 'ph-book-open', 'var(--success)');
        } else if (type === 'announcements') {
            showToast(`New: ${item.title}`, 'ph-megaphone', 'var(--accent-color)');
        } else if (type === 'features') {
            showWhatsNewPopup(item);
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
                const annData = snap.docs.map(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    return data;
                });
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

        // Listen for Feature Updates + popup notification
        onSnapshot(query(collection(db, "feature_updates"), orderBy("timestamp", "desc")), (snap) => {
            if (!snap.empty) {
                const featData = snap.docs.map(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    return data;
                });
                checkForUpdates('features', featData);
            }
        }, (error) => {
            console.error('Error fetching feature updates:', error);
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
    }, 30000);
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
    let filteredAnn = dashboardData.announcements.filter(ann => 
        matchesSearch(ann.title || '') || matchesSearch(ann.message || '') || matchesSearch(ann.author || '')
    );

    // Apply Auto-Archive Filter
    const archiveDays = systemSettings?.archiveDays || 7;
    const archiveEnabled = systemSettings?.archiveEnabled || false;
    
    if (archiveEnabled) {
        const now = new Date();
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - archiveDays);
        
        filteredAnn = filteredAnn.filter(ann => {
            if (!ann.timestamp) return true;
            const annDate = ann.timestamp.toDate ? ann.timestamp.toDate() : new Date(ann.timestamp);
            return annDate >= cutoff;
        });
    }

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
                <div class="announcement-author" style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="ph ph-user-circle"></i> ${ann.author || 'Teacher'}</span>
                    ${ann.posterName ? `<span style="font-size: 0.7rem; opacity: 0.7;">Posted by: ${ann.posterName}</span>` : ''}
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
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="hw-due"><i class="ph ph-clock-circle"></i> Due: ${formatDueDate(hw.due)}</div>
                        ${hw.posterName ? `<span style="font-size: 0.65rem; opacity: 0.6; font-style: italic;">By: ${hw.posterName}</span>` : ''}
                    </div>
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

// What's New Popup
function showWhatsNewPopup(item) {
    const modal = document.getElementById('whatsnew-modal');
    const title = document.getElementById('whatsnew-title');
    const description = document.getElementById('whatsnew-description');
    const version = document.getElementById('whatsnew-version');
    const date = document.getElementById('whatsnew-date');

    if (!modal || !title || !description) return;

    title.textContent = item.title || 'What\'s New';
    description.textContent = item.description || '';

    if (item.version) {
        version.style.display = 'inline-block';
        version.textContent = item.version;
    } else {
        version.style.display = 'none';
    }

    date.textContent = item.date ? `📅 ${item.date}` : '';
    modal.style.display = 'flex';

    // Mark as seen so it doesn't pop up again on next full page load
    const storageKey = 'notif_features_last';
    const lastData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!lastData.some(d => (d.id || d.title || '') === (item.id || item.title || ''))) {
        lastData.push(item);
        localStorage.setItem(storageKey, JSON.stringify(lastData));
    }
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
    fetchPolls();
    initBanner();
    initBannerUpload();
    
    // Show Royal Image Modal (Once every 2 days)
    const royalModal = document.getElementById('image-modal-overlay');
    const lastDismissed = localStorage.getItem('royal_modal_last_dismissed');
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (royalModal && (!lastDismissed || (now - parseInt(lastDismissed)) > twoDaysInMs)) {
        royalModal.style.display = 'flex';
        royalModal.addEventListener('click', () => {
            royalModal.style.display = 'none';
            localStorage.setItem('royal_modal_last_dismissed', Date.now().toString());
        });
    }

    // Suggestion Modal Logic
    const suggestionModal = document.getElementById('suggestion-modal');
    const openSuggestionBtn = document.getElementById('open-suggestion-modal');
    const suggestionInput = document.getElementById('suggestion-input');
    const sendSuggestionBtn = document.getElementById('send-suggestion-btn');
    
    if (openSuggestionBtn && suggestionModal) {
        openSuggestionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            suggestionModal.classList.add('active');
            suggestionInput.focus();
        });

        suggestionModal.querySelector('.close-modal')?.addEventListener('click', () => {
            suggestionModal.classList.remove('active');
        });

        suggestionModal.addEventListener('click', (e) => {
            if (e.target === suggestionModal) suggestionModal.classList.remove('active');
        });
    }
    
    if (sendSuggestionBtn && suggestionInput) {
        sendSuggestionBtn.addEventListener('click', async () => {
            const text = sanitize(suggestionInput.value.trim());
            if (!text) return;

            sendSuggestionBtn.disabled = true;
            sendSuggestionBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Sending...';

            try {
                await addDoc(collection(db, "feedback"), {
                    message: text,
                    type: 'suggestion',
                    status: 'new',
                    urgent: false,
                    createdAt: serverTimestamp()
                });
                
                suggestionInput.value = '';
                suggestionModal.classList.remove('active');
                showToast("Suggestion sent anonymously!", "ph-chat-teardrop-dots", "var(--success)");
            } catch (e) {
                showToast("Error sending: " + e.message, "ph-x", "var(--danger)");
            } finally {
                sendSuggestionBtn.disabled = false;
                sendSuggestionBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send Suggestion';
            }
        });
    }

    // Class Banner Logic
    function initBanner() {
        const bannerSection = document.getElementById('banner-section');
        const bannerContainer = document.getElementById('banner-display-container');
        if (!bannerSection || !bannerContainer) return;

        onSnapshot(query(collection(db, "banners"), orderBy("createdAt", "desc"), limit(1)), (snap) => {
            if (snap.empty) {
                bannerContainer.innerHTML = `
                    <div style="padding: 2.5rem; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; background: linear-gradient(135deg, var(--hover-color) 0%, var(--bg-color) 100%); width: 100%; box-sizing: border-box;">
                        <i class="ph ph-image-square" style="font-size: 3.5rem; opacity: 0.15;"></i>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No banner uploaded yet.</p>
                        <p style="margin: 0; font-size: 0.8rem; opacity: 0.7;">${systemSettings?.classBannerPaymentRequired !== false ? 'Be the first to share a photo/announcement with the class for 0.01 THB!' : 'Be the first to share a photo/announcement with the class!'}</p>
                    </div>
                `;
                return;
            }

            snap.forEach(d => {
                const data = d.data();
                const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Just now';

                const url = data.url;
                const caption = sanitize(data.caption || '');
                const postedBy = sanitize(data.postedBy || '');

                bannerContainer.innerHTML = `
                    <div style="position: relative; width: 100%; min-height: 200px; max-height: 350px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <img src="${url}" alt="Class Banner" style="width: 100%; height: 100%; min-height: 200px; max-height: 350px; object-fit: cover; display: block; opacity: 0.9;">
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%); padding: 1.5rem 1rem 1rem 1rem; color: #fff; text-align: left; box-sizing: border-box;">
                            ${caption ? `<p style="margin: 0; font-size: 1rem; font-weight: 600; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">${caption}</p>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${caption ? '0.25rem' : '0'};">
                                ${postedBy ? `<span style="font-size: 0.8rem; opacity: 0.9;"><i class="ph ph-user"></i> ${postedBy}</span>` : ''}
                                <span style="font-size: 0.75rem; opacity: 0.8;">${dateStr}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        });
    }

    function initBannerUpload() {
        const changeBannerBtn = document.getElementById('change-banner-btn');
        const bannerModal = document.getElementById('banner-modal');
        const closeBannerBtn = document.getElementById('close-banner-modal');
        const confirmPayCheckbox = document.getElementById('banner-confirm-pay');
        const submitBannerBtn = document.getElementById('submit-banner-btn');
        const bannerPicInput = document.getElementById('banner-pic-input');
        const bannerCaptionInput = document.getElementById('banner-caption-input');
        const bannerPostedByInput = document.getElementById('banner-posted-by-input');

        if (!changeBannerBtn || !bannerModal) return;

        changeBannerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Limit check: 1 time per day
            const lastUpload = localStorage.getItem('last_banner_upload_time');
            if (lastUpload) {
                const diff = Date.now() - parseInt(lastUpload);
                const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - diff) / (1000 * 60 * 60));
                if (diff < 24 * 60 * 60 * 1000) {
                    showToast(`Limit reached: Next upload available in ${hoursLeft} hours.`, "ph-warning", "var(--warning)");
                    return;
                }
            }
            
            bannerModal.classList.add('active');
            bannerPicInput.value = '';
            bannerCaptionInput.value = '';
            if (bannerPostedByInput) bannerPostedByInput.value = '';
            confirmPayCheckbox.checked = false;
            submitBannerBtn.disabled = true;
        });

        const closeModal = () => {
            bannerModal.classList.remove('active');
        };
        if (closeBannerBtn) closeBannerBtn.addEventListener('click', closeModal);
        bannerModal.addEventListener('click', (e) => {
            if (e.target === bannerModal) closeModal();
        });

        const updateSubmitBtnState = () => {
            const paymentRequired = systemSettings?.classBannerPaymentRequired !== false;
            submitBannerBtn.disabled = paymentRequired ? (!confirmPayCheckbox.checked || !bannerPicInput.files[0]) : !bannerPicInput.files[0];
        };

        confirmPayCheckbox.addEventListener('change', updateSubmitBtnState);
        bannerPicInput.addEventListener('change', updateSubmitBtnState);

        submitBannerBtn.addEventListener('click', async () => {
            const file = bannerPicInput.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showToast("Image too large. Max 5MB allowed.", "ph-x", "var(--danger)");
                return;
            }

            submitBannerBtn.disabled = true;
            submitBannerBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Uploading Pic...';

            try {
                const formData = new FormData();
                formData.append('image', file);
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error.message || "Failed to upload image to ImgBB.");
                }
                const photoURL = data.data.url;

                const caption = sanitize(bannerCaptionInput.value.trim());
                const postedBy = sanitize(bannerPostedByInput ? bannerPostedByInput.value.trim() : '');

                // Best-effort cleanup of old banners (may fail for non-admin users)
                try {
                    const existingSnap = await getDocs(collection(db, "banners"));
                    const deletePromises = [];
                    existingSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
                    await Promise.all(deletePromises);
                } catch (_) {
                    // Cleanup is best-effort — proceed even if permission denied
                }

                await addDoc(collection(db, "banners"), {
                    url: photoURL,
                    caption: caption,
                    postedBy: postedBy || '',
                    createdAt: serverTimestamp()
                });

                localStorage.setItem('last_banner_upload_time', Date.now().toString());

                showToast("Banner updated successfully!", "ph-check", "var(--success)");
                closeModal();
            } catch (err) {
                console.error("Banner upload failed:", err);
                showToast("Update failed: " + err.message, "ph-x", "var(--danger)");
                submitBannerBtn.disabled = false;
                submitBannerBtn.innerHTML = '<i class="ph ph-upload-simple"></i> Upload & Update';
            }
        });
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Register main SW
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

    // Update clock every second
    setInterval(updateClock, 1000);
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
document.addEventListener('DOMContentLoaded', () => {
    init();
    syncSystemStates();
    detectAdBlock();
});

async function detectAdBlock() {
    // Try to fetch a resource that is commonly blocked by ad blockers (Firebase-related)
    try {
        const url = 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8';
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    } catch (error) {
        // If fetch fails, it might be due to an ad blocker
        console.warn('Ad blocker detected or connection issue:', error);
        showAdBlockPopup();
    }
}

function showAdBlockPopup() {
    if (document.getElementById('adblock-popup')) return;
    
    const popup = document.createElement('div');
    popup.id = 'adblock-popup';
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--warning);
        color: #000;
        padding: 0.8rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-weight: 500;
        font-size: 0.85rem;
        border-left: 5px solid #000;
        animation: slideDown 0.4s ease-out;
    `;
    popup.innerHTML = `
        <i class="ph ph-shield-warning" style="font-size: 1.2rem;"></i>
        <span>Ad-blocker detected! This may cause real-time updates to fail. Please disable it for this site.</span>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-left:10px;">&times;</button>
    `;
    document.body.appendChild(popup);
}

let systemSettings = null;

async function syncSystemStates() {
    try {
        onSnapshot(doc(db, "settings", "maintenance"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                systemSettings = data; // Store for other filters

                // 1. Maintenance Mode Popup
                if (data.enabled) {
                    showMaintenancePopup();
                } else {
                    const existingPopup = document.getElementById('maintenance-popup');
                    if (existingPopup) existingPopup.remove();
                }

                // 2. Global Alert Banner Mode
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

                // 3. Developer Lockout Gate
                const isBypassed = sessionStorage.getItem('dev_bypass') === 'true';
                if (data.lockoutEnabled && !isBypassed) {
                    showLockoutOverlay(data.lockoutPasscode || '');
                } else {
                    hideLockoutOverlay();
                }

                // 4. Class Banner display verification
                const bannerSection = document.getElementById('banner-section');
                if (bannerSection) {
                    bannerSection.style.display = data.showClassBanner !== false ? 'block' : 'none';
                }

                // 5. Class Banner Payment UI
                const paymentRequired = data.classBannerPaymentRequired !== false;
                const changeBannerBtn = document.getElementById('change-banner-btn');
                if (changeBannerBtn) {
                    changeBannerBtn.innerHTML = paymentRequired
                        ? '<i class="ph ph-upload-simple"></i> Change Banner (0.01 THB)'
                        : '<i class="ph ph-upload-simple"></i> Change Banner';
                }
                const bannerPriceText = document.getElementById('banner-price-text');
                const bannerQrSection = document.getElementById('banner-qr-section');
                const bannerConfirmPayRow = document.getElementById('banner-confirm-pay-row');
                if (bannerPriceText) {
                    if (!bannerPriceText.dataset.origDisplay) bannerPriceText.dataset.origDisplay = window.getComputedStyle(bannerPriceText).display;
                    bannerPriceText.style.display = paymentRequired ? bannerPriceText.dataset.origDisplay : 'none';
                }
                if (bannerQrSection) {
                    if (!bannerQrSection.dataset.origDisplay) bannerQrSection.dataset.origDisplay = window.getComputedStyle(bannerQrSection).display;
                    bannerQrSection.style.display = paymentRequired ? bannerQrSection.dataset.origDisplay : 'none';
                }
                if (bannerConfirmPayRow) {
                    if (!bannerConfirmPayRow.dataset.origDisplay) bannerConfirmPayRow.dataset.origDisplay = window.getComputedStyle(bannerConfirmPayRow).display;
                    bannerConfirmPayRow.style.display = paymentRequired ? bannerConfirmPayRow.dataset.origDisplay : 'none';
                }

                // 6. Scheduled Maintenance Countdown
                const existingSched = document.getElementById('sched-maintenance-banner');
                if (data.schedMaintenanceEnabled && data.schedMaintenanceTitle && data.schedMaintenanceMessage && data.schedMaintenanceTime) {
                    const schedTime = new Date(data.schedMaintenanceTime);
                    const now = new Date();
                    const diffMs = schedTime - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                    if (diffMs > 0) {
                        const timeStr = diffHours > 0
                            ? `in ${diffHours}h ${diffMins}m`
                            : `in ${diffMins}m`;

                        if (existingSched) {
                            const titleEl = existingSched.querySelector('.sched-maintenance-title');
                            const msgEl = existingSched.querySelector('.sched-maintenance-msg');
                            const countdownEl = existingSched.querySelector('.sched-maintenance-countdown');
                            if (titleEl) titleEl.textContent = data.schedMaintenanceTitle;
                            if (msgEl) msgEl.textContent = data.schedMaintenanceMessage;
                            if (countdownEl) countdownEl.textContent = timeStr;
                        } else {
                            const banner = document.createElement('div');
                            banner.id = 'sched-maintenance-banner';
                            banner.style.cssText = `
                                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                                background: var(--warning); color: #000; padding: 1rem 2rem;
                                border-radius: 12px; z-index: 9999;
                                box-shadow: 0 4px 20px rgba(0,0,0,0.25);
                                display: flex; align-items: center; gap: 1rem;
                                max-width: 90vw; font-weight: 500;
                                animation: slideUp 0.4s ease-out;
                            `;
                            banner.innerHTML = `
                                <i class="ph ph-warning" style="font-size: 1.5rem;"></i>
                                <div>
                                    <div class="sched-maintenance-title" style="font-weight: 700; margin-bottom: 0.25rem;">${data.schedMaintenanceTitle}</div>
                                    <div class="sched-maintenance-msg" style="font-size: 0.85rem; opacity: 0.9;">${data.schedMaintenanceMessage}</div>
                                    <div style="font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.7;">
                                        <i class="ph ph-clock-countdown"></i> <span class="sched-maintenance-countdown">${timeStr}</span>
                                    </div>
                                </div>
                                <button onclick="this.closest('#sched-maintenance-banner').remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;margin-left:auto;color:#000;">&times;</button>
                            `;
                            document.body.appendChild(banner);
                        }

                        // Update countdown every 30s
                        if (!window._schedCountdownInterval) {
                            window._schedCountdownInterval = setInterval(() => {
                                const b = document.getElementById('sched-maintenance-banner');
                                if (b) {
                                    const cd = b.querySelector('.sched-maintenance-countdown');
                                    if (cd) {
                                        const remaining = new Date(data.schedMaintenanceTime) - new Date();
                                        if (remaining <= 0) {
                                            b.remove();
                                            clearInterval(window._schedCountdownInterval);
                                            window._schedCountdownInterval = null;
                                        } else {
                                            const h = Math.floor(remaining / (1000 * 60 * 60));
                                            const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                                            cd.textContent = h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
                                        }
                                    }
                                }
                            }, 30000);
                        }
                    } else {
                        if (existingSched) existingSched.remove();
                        if (window._schedCountdownInterval) {
                            clearInterval(window._schedCountdownInterval);
                            window._schedCountdownInterval = null;
                        }
                    }
                } else {
                    if (existingSched) existingSched.remove();
                    if (window._schedCountdownInterval) {
                        clearInterval(window._schedCountdownInterval);
                        window._schedCountdownInterval = null;
                    }
                }
            }
        });
    } catch (e) {
        console.error("Failed to sync system states", e);
    }
}

function showMaintenancePopup() {
    if (document.getElementById('maintenance-popup')) return;
    
    const popup = document.createElement('div');
    popup.id = 'maintenance-popup';
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--danger);
        color: white;
        padding: 1rem 2rem;
        border-radius: 50px;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-weight: 600;
        animation: slideUp 0.4s ease-out;
    `;
    popup.innerHTML = `
        <i class="ph ph-warning-octagon" style="font-size: 1.2rem;"></i>
        <span>System under maintenance. Some features may be limited.</span>
    `;
    document.body.appendChild(popup);
}

function showLockoutOverlay(correctPasscode) {
    if (document.getElementById('lockout-overlay')) return;

    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';

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

function hideLockoutOverlay() {
    const overlay = document.getElementById('lockout-overlay');
    if (overlay) overlay.remove();
    
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'block';
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translate(-50%, 100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideDown {
        from { transform: translate(-50%, -100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
`;
document.head.appendChild(style);
