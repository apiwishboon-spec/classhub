/**
 * MyClassHub Bilingual Help Manual
 */

const HELP_CONTENT = {
    user: {
        en: {
            title: "Welcome to MyClassHub! 👋",
            sections: [
                { icon: "ph-calendar", title: "Schedule", desc: "View your weekly class schedule. The current day is highlighted." },
                { icon: "ph-megaphone", title: "Announcements", desc: "Important updates from your teacher appear here." },
                { icon: "ph-pencil-simple", title: "Homework", desc: "View all assignments with due dates. Mark them as done!" },
                { icon: "ph-chat-centered-text", title: "Message Staff", desc: "Use the chat icon in the top header to send anonymous messages to your staff." },
                { icon: "ph-magnifying-glass", title: "Search", desc: "Quickly find schedule entries, homework, or announcements." }
            ],
            footer: "Need more help? Contact your admin."
        },
        th: {
            title: "ยินดีต้อนรับสู่ MyClassHub! 👋",
            sections: [
                { icon: "ph-calendar", title: "ตารางเรียน", desc: "ดูตารางเรียนประจำสัปดาห์ของคุณ วันปัจจุบันจะถูกไฮไลต์" },
                { icon: "ph-megaphone", title: "ประกาศ", desc: "ประกาศสำคัญจากครูจะแสดงที่นี่" },
                { icon: "ph-pencil-simple", title: "การบ้าน", desc: "ดูงานที่มอบหมายพร้อมกำหนดส่ง สามารถทำเครื่องหมายว่าเสร็จสิ้นได้" },
                { icon: "ph-chat-centered-text", title: "ติดต่อเจ้าหน้าที่", desc: "ใช้ไอคอนแชทที่แถบด้านบนเพื่อส่งข้อความแบบไม่ระบุตัวตน" }
            ],
            footer: "ต้องการความช่วยเหลือเพิ่มเติม? ติดต่อผู้ดูแลระบบ"
        }
    },
    admin: {
        en: {
            title: "Admin Dashboard Guide ⚙️",
            sections: [
                { icon: "ph-user-gear", title: "Admin Panel", desc: "Manage users, announcements, homework, and schedules from here." },
                { icon: "ph-chats-teardrop", title: "Staff Chat", desc: "Use the private Staff Chat icon (top right) for internal communication." },
                { icon: "ph-tray", title: "Feedback Inbox", desc: "Review student questions. You can reply, mark as solved (which locks the thread), or delete." },
                { icon: "ph-chart-bar", title: "Class Polls", desc: "Create polls and generate QR codes for students to vote instantly." },
                { icon: "ph-check-circle", title: "Auto-Cleanup", desc: "Resolved messages and closed polls are automatically deleted after 1 month." }
            ],
            footer: "Ensure your staff status is set to 'Available' to receive student inquiries."
        },
        th: {
            title: "คู่มือแผงผู้ดูแลระบบ ⚙️",
            sections: [
                { icon: "ph-user-gear", title: "แผงควบคุม", desc: "จัดการผู้ใช้ ประกาศ การบ้าน และตารางเรียนจากที่นี่" },
                { icon: "ph-chats-teardrop", title: "แชทเจ้าหน้าที่", desc: "ใช้ไอคอนแชทส่วนตัว (ขวาบน) เพื่อสื่อสารกับเจ้าหน้าที่ภายใน" },
                { icon: "ph-tray", title: "ข้อความนักเรียน", desc: "อ่านคำถามจากนักเรียน สามารถตอบ, ทำเครื่องหมายว่าแก้ไขแล้ว (ล็อกแชท), หรือลบ" },
                { icon: "ph-chart-bar", title: "แบบสำรวจ", desc: "สร้างแบบสำรวจและสร้าง QR Code เพื่อให้นักเรียนลงคะแนน" }
            ],
            footer: "ตั้งสถานะของคุณเป็น 'Available' เพื่อรับคำถามจากนักเรียน"
        }
    }
};

let helpOverlay = null;
let helpModal = null;

document.addEventListener('DOMContentLoaded', () => {
    buildHelpElements();
    setupHelpButton();
    checkFirstVisit();
});

function buildHelpElements() {
    helpOverlay = document.createElement('div');
    helpOverlay.id = 'help-overlay';
    helpOverlay.className = 'modal-overlay';
    helpOverlay.style.display = 'none';
    helpOverlay.addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });
    helpModal = document.createElement('div');
    helpModal.id = 'help-modal';
    helpModal.className = 'help-modal-card';
    helpOverlay.appendChild(helpModal);
    document.body.appendChild(helpOverlay);
}

function setupHelpButton() {
    const target = document.querySelector('.admin-header-actions') || document.querySelector('.top-nav > div:last-child');
    if (!target || document.getElementById('help-btn')) return;

    const helpBtn = document.createElement('button');
    helpBtn.id = 'help-btn';
    helpBtn.className = 'icon-button';
    helpBtn.setAttribute('aria-label', 'Help');
    helpBtn.innerHTML = '<i class="ph ph-question"></i>';
    helpBtn.addEventListener('click', showHelpModal);
    target.appendChild(helpBtn);
}

function checkFirstVisit() {
    const hasSeen = localStorage.getItem('classhub_help_seen');
    if (!hasSeen) {
        setTimeout(() => {
            showHelpModal();
            localStorage.setItem('classhub_help_seen', 'true');
        }, 800);
    }
}

function showHelpModal() {
    if (!helpModal || !helpOverlay) buildHelpElements();
    const lang = getHelpLanguage();
    renderHelpContent(helpModal, lang);
    bindModalEvents();
    helpOverlay.style.display = 'flex';
    helpOverlay.style.alignItems = 'center';
    helpOverlay.style.justifyContent = 'center';
}

function bindModalEvents() {
    const closeBtn = helpModal.querySelector('.help-close-btn');
    if (closeBtn) closeBtn.onclick = () => { helpOverlay.style.display = 'none'; };
    const enBtn = helpModal.querySelector('.help-lang-btn[data-lang="en"]');
    const thBtn = helpModal.querySelector('.help-lang-btn[data-lang="th"]');
    if (enBtn) enBtn.onclick = () => { localStorage.setItem('classhub_help_lang', 'en'); renderHelpContent(helpModal, 'en'); bindModalEvents(); };
    if (thBtn) thBtn.onclick = () => { localStorage.setItem('classhub_help_lang', 'th'); renderHelpContent(helpModal, 'th'); bindModalEvents(); };
}

function getHelpLanguage() {
    return localStorage.getItem('classhub_help_lang') || 'en';
}

function renderHelpContent(modal, lang) {
    const context = (typeof currentUserRole !== 'undefined' && currentUserRole) ? 'admin' : 'user';
    const content = HELP_CONTENT[context][lang] || HELP_CONTENT.user.en;
    modal.innerHTML = `
        <div class="help-modal-header">
            <div class="help-lang-tabs">
                <button class="help-lang-btn ${lang === 'en' ? 'active' : ''}" data-lang="en">🇬🇧 English</button>
                <button class="help-lang-btn ${lang === 'th' ? 'active' : ''}" data-lang="th">🇹🇭 ภาษาไทย</button>
            </div>
            <button class="help-close-btn icon-button" aria-label="Close"><i class="ph ph-x"></i></button>
        </div>
        <div class="help-modal-body">
            <h2 class="help-title">${content.title}</h2>
            <div class="help-sections">
                ${content.sections.map(s => `
                    <div class="help-section-item">
                        <div class="help-section-icon"><i class="ph ${s.icon}"></i></div>
                        <div class="help-section-text"><h4>${s.title}</h4><p>${s.desc}</p></div>
                    </div>`).join('')}
            </div>
            <p class="help-footer-text">${content.footer}</p>
        </div>`;
}
