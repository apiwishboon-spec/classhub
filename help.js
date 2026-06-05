/**
 * MyClassHub Bilingual Help Manual
 */

const HELP_CONTENT = {
    user: {
        en: {
            title: "Welcome to MyClassHub! 👋",
            sections: [
                { icon: "ph-calendar", title: "Schedule", desc: "View your weekly class schedule. The current day is automatically highlighted. Tap on any subject block to see more details." },
                { icon: "ph-megaphone", title: "Announcements", desc: "Read important updates from your teachers. New items are highlighted with a badge. Scroll down to see older posts." },
                { icon: "ph-pencil-simple", title: "Homework Tracking", desc: "Manage your study load. Filter tasks by 'All', 'Due Soon', or 'Overdue'. Click the checkbox to mark an assignment as 'Completed'." },
                { icon: "ph-note", title: "Quick Notes", desc: "Keep personal notes for each class. These notes are saved automatically to your browser and sync across your devices." },
                { icon: "ph-chat-centered-text", title: "Message Staff", desc: "Need help? Tap the chat icon in the header to start a private, anonymous conversation with your teachers or staff." },
                { icon: "ph-moon", title: "Theme Settings", desc: "Click the moon icon in the navigation bar to toggle between Light and Dark mode for a comfortable view." },
                { icon: "ph-magnifying-glass", title: "Smart Search", desc: "Find specific homework, announcements, or calendar events instantly using the search bar at the top." }
            ],
            footer: "Need more help? Contact your admin via the contact link in the footer."
        },
        th: {
            title: "ยินดีต้อนรับสู่ MyClassHub! 👋",
            sections: [
                { icon: "ph-calendar", title: "ตารางเรียน", desc: "ดูตารางเรียนประจำสัปดาห์ของคุณ วันปัจจุบันจะถูกไฮไลต์ไว้ แตะที่วิชาเพื่อดูรายละเอียดเพิ่มเติม" },
                { icon: "ph-megaphone", title: "ประกาศ", desc: "อ่านอัปเดตสำคัญจากครู ประกาศใหม่จะมีสัญลักษณ์แจ้งเตือน" },
                { icon: "ph-pencil-simple", title: "การติดตามการบ้าน", desc: "จัดการภาระงานของคุณ กรองตาม 'ทั้งหมด', 'ใกล้กำหนด' หรือ 'เกินกำหนด' กดเช็คบ็อกซ์เพื่อทำเครื่องหมายว่าทำเสร็จแล้ว" },
                { icon: "ph-note", title: "บันทึกด่วน", desc: "จดสิ่งที่ต้องจำสำหรับแต่ละวิชา บันทึกจะถูกซิงค์อัตโนมัติข้ามอุปกรณ์" },
                { icon: "ph-chat-centered-text", title: "ติดต่อเจ้าหน้าที่", desc: "ใช้ไอคอนแชทเพื่อส่งข้อความถึงครูแบบไม่ระบุตัวตน" },
                { icon: "ph-moon", title: "ตั้งค่าธีม", desc: "คลิกไอคอนพระจันทร์เพื่อเปลี่ยนธีม สว่าง/มืด" },
                { icon: "ph-magnifying-glass", title: "ค้นหาอัจฉริยะ", desc: "ค้นหาการบ้าน ประกาศ หรือตารางเรียนได้อย่างรวดเร็ว" }
            ],
            footer: "ต้องการความช่วยเหลือเพิ่มเติม? ติดต่อผู้ดูแลระบบ"
        }
    },
    admin: {
        en: {
            title: "Admin Dashboard Guide ⚙️",
            sections: [
                { icon: "ph-user-gear", title: "User Management", desc: "Manage teacher/TA accounts. You can create, edit, or disable user accounts and assign roles (Admin, Teacher, TA)." },
                { icon: "ph-megaphone", title: "Announcements", desc: "Draft and post announcements that appear on the student dashboard immediately." },
                { icon: "ph-notebook", title: "Homework Management", desc: "Add homework tasks with specific due dates. You can also edit or delete past assignments." },
                { icon: "ph-tray", title: "Feedback Inbox", desc: "Read student messages. Use the 'Reply' button to answer. Mark as 'Solved' to lock the thread and mark it for auto-cleanup." },
                { icon: "ph-chart-bar", title: "Class Polls", desc: "Create polls with multiple options. Each poll generates a unique QR code for student voting." },
                { icon: "ph-check-circle", title: "System Maintenance", desc: "The system automatically cleans up resolved feedback and expired polls older than 1 month to keep the database fast." },
                { icon: "ph-shield-check", title: "Session Security", desc: "Logging out of the Admin panel now clears your active session across all devices for extra security." }
            ],
            footer: "Tip: Keep your status set to 'Available' when you're actively monitoring messages!"
        },
        th: {
            title: "คู่มือแผงผู้ดูแลระบบ ⚙️",
            sections: [
                { icon: "ph-user-gear", title: "การจัดการผู้ใช้", desc: "เพิ่มหรือระงับบัญชีผู้ใช้งาน และกำหนดสิทธิ์ (Admin, Teacher, TA)" },
                { icon: "ph-megaphone", title: "ประกาศ", desc: "สร้างและประกาศข้อมูลไปยังแดชบอร์ดนักเรียนทันที" },
                { icon: "ph-notebook", title: "จัดการการบ้าน", desc: "เพิ่ม แก้ไข หรือลบการบ้านและกำหนดวันส่ง" },
                { icon: "ph-tray", title: "ข้อความนักเรียน", desc: "ตอบคำถามนักเรียน สามารถกด 'Solved' เพื่อล็อกการสนทนา" },
                { icon: "ph-chart-bar", title: "แบบสำรวจ", desc: "สร้างโพลและ QR Code สำหรับการลงคะแนน" }
            ],
            footer: "คำแนะนำ: ตั้งสถานะเป็น 'Available' เมื่อคุณพร้อมรับคำถาม"
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
    const context = window.location.pathname.includes('admin') ? 'admin' : 'user';
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
