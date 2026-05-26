/**
 * MyClassHub Bilingual Help Manual
 * Shows on first visit as a popup, accessible via "?" icon button.
 * Supports EN/TH language toggle.
 * Works on both index.html and admin.html.
 */

const HELP_CONTENT = {
    en: {
        title: "Welcome to MyClassHub! 👋",
        sections: [
            { icon: "ph-calendar", title: "Schedule", desc: "View your weekly class schedule. The current day is highlighted. On mobile, you can tap a day to filter. Subjects are color-coded by course." },
            { icon: "ph-megaphone", title: "Announcements", desc: "Important updates from your teacher appear here. New announcements are marked with a badge." },
            { icon: "ph-pencil-simple", title: "Homework", desc: "View all assignments with due dates. Filter by: All, Due Soon, Overdue, or Completed. Mark homework as done by clicking the checkbox." },
            { icon: "ph-note", title: "Quick Notes", desc: "Jot down anything you need to remember. Notes auto-save and sync across devices." },
            { icon: "ph-moon", title: "Dark Mode", desc: "Toggle between light and dark themes using the moon icon in the header." },
            { icon: "ph-user-gear", title: "Admin Panel", desc: "Teachers can log in to post announcements, add homework, manage schedules, and more." },
            { icon: "ph-bell", title: "Push Notifications", desc: "Enable notifications to get alerts when new homework or announcements are posted." },
            { icon: "ph-magnifying-glass", title: "Search", desc: "Use the search bar to quickly find anything — schedule entries, homework, or notes." }
        ],
        footer: "Need more help? Contact your admin from the footer link."
    },
    th: {
        title: "ยินดีต้อนรับสู่ MyClassHub! 👋",
        sections: [
            { icon: "ph-calendar", title: "ตารางเรียน", desc: "ดูตารางเรียนประจำสัปดาห์ วันปัจจุบันจะถูกไฮไลต์ บนมือถือสามารถแตะวันเพื่อกรองได้ แต่ละวิชามีสีประจำวิชา" },
            { icon: "ph-megaphone", title: "ประกาศ", desc: "ประกาศสำคัญจากครูจะแสดงที่นี่ ประกาศใหม่จะมีการแสดงสัญลักษณ์แจ้งเตือน" },
            { icon: "ph-pencil-simple", title: "การบ้าน", desc: "ดูงานที่มอบหมายทั้งหมดพร้อมกำหนดส่ง กรองตาม: ทั้งหมด, ใกล้กำหนด, เลยกำหนด, หรือ เสร็จแล้ว สามารถทำเครื่องหมายว่าทำเสร็จได้" },
            { icon: "ph-note", title: "บันทึกด่วน", desc: "จดสิ่งที่ต้องจำ บันทึกจะบันทึกอัตโนมัติและซิงค์ข้ามอุปกรณ์" },
            { icon: "ph-moon", title: "โหมดมืด", desc: "สลับระหว่างธีมสว่างและมืดโดยใช้ไอคอนพระจันทร์ที่แถบด้านบน" },
            { icon: "ph-user-gear", title: "แผงผู้ดูแล", desc: "ครูสามารถเข้าสู่ระบบเพื่อโพสต์ประกาศ เพิ่มการบ้าน จัดการตารางเรียน และอื่นๆ" },
            { icon: "ph-bell", title: "การแจ้งเตือน", desc: "เปิดการแจ้งเตือนเพื่อรับการแจ้งเตือนเมื่อมีการบ้านหรือประกาศใหม่" },
            { icon: "ph-magnifying-glass", title: "ค้นหา", desc: "ใช้แถบค้นหาเพื่อค้นหาข้อมูลได้อย่างรวดเร็ว ไม่ว่าจะเป็นตารางเรียน การบ้าน หรือบันทึก" }
        ],
        footer: "ต้องการความช่วยเหลือเพิ่มเติม? ติดต่อผู้ดูแลระบบได้ที่ลิงก์ท้ายหน้า"
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
    // Try both page layouts: index.html or admin.html
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
    const content = HELP_CONTENT[lang] || HELP_CONTENT.en;
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