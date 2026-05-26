/**
 * MyClassHub Bilingual Help Manual
 * Shows on first visit as a popup, accessible via "?" icon button.
 * Supports EN/TH language toggle.
 */

// Help content in English and Thai
const HELP_CONTENT = {
    en: {
        title: "Welcome to MyClassHub! 👋",
        sections: [
            {
                icon: "ph-calendar",
                title: "Schedule",
                desc: "View your weekly class schedule. The current day is highlighted. On mobile, you can tap a day to filter. Subjects are color-coded by course."
            },
            {
                icon: "ph-megaphone",
                title: "Announcements",
                desc: "Important updates from your teacher appear here. New announcements are marked with a badge."
            },
            {
                icon: "ph-pencil-simple",
                title: "Homework",
                desc: "View all assignments with due dates. Filter by: All, Due Soon, Overdue, or Completed. Mark homework as done by clicking the checkbox."
            },
            {
                icon: "ph-note",
                title: "Quick Notes",
                desc: "Jot down anything you need to remember. Notes auto-save and sync across devices."
            },
            {
                icon: "ph-moon",
                title: "Dark Mode",
                desc: "Toggle between light and dark themes using the moon icon in the header."
            },
            {
                icon: "ph-user-gear",
                title: "Admin Panel",
                desc: "Teachers can log in to post announcements, add homework, manage schedules, and more."
            },
            {
                icon: "ph-bell",
                title: "Push Notifications",
                desc: "Enable notifications to get alerts when new homework or announcements are posted."
            },
            {
                icon: "ph-magnifying-glass",
                title: "Search",
                desc: "Use the search bar to quickly find anything — schedule entries, homework, or notes."
            }
        ],
        footer: "Need more help? Contact your admin from the footer link."
    },
    th: {
        title: "ยินดีต้อนรับสู่ MyClassHub! 👋",
        sections: [
            {
                icon: "ph-calendar",
                title: "ตารางเรียน",
                desc: "ดูตารางเรียนประจำสัปดาห์ วันปัจจุบันจะถูกไฮไลต์ บนมือถือสามารถแตะวันเพื่อกรองได้ แต่ละวิชามีสีประจำวิชา"
            },
            {
                icon: "ph-megaphone",
                title: "ประกาศ",
                desc: "ประกาศสำคัญจากครูจะแสดงที่นี่ ประกาศใหม่จะมีการแสดงสัญลักษณ์แจ้งเตือน"
            },
            {
                icon: "ph-pencil-simple",
                title: "การบ้าน",
                desc: "ดูงานที่มอบหมายทั้งหมดพร้อมกำหนดส่ง กรองตาม: ทั้งหมด, ใกล้กำหนด, เลยกำหนด, หรือ เสร็จแล้ว สามารถทำเครื่องหมายว่าทำเสร็จได้"
            },
            {
                icon: "ph-note",
                title: "บันทึกด่วน",
                desc: "จดสิ่งที่ต้องจำ บันทึกจะบันทึกอัตโนมัติและซิงค์ข้ามอุปกรณ์"
            },
            {
                icon: "ph-moon",
                title: "โหมดมืด",
                desc: "สลับระหว่างธีมสว่างและมืดโดยใช้ไอคอนพระจันทร์ที่แถบด้านบน"
            },
            {
                icon: "ph-user-gear",
                title: "แผงผู้ดูแล",
                desc: "ครูสามารถเข้าสู่ระบบเพื่อโพสต์ประกาศ เพิ่มการบ้าน จัดการตารางเรียน และอื่นๆ"
            },
            {
                icon: "ph-bell",
                title: "การแจ้งเตือน",
                desc: "เปิดการแจ้งเตือนเพื่อรับการแจ้งเตือนเมื่อมีการบ้านหรือประกาศใหม่"
            },
            {
                icon: "ph-magnifying-glass",
                title: "ค้นหา",
                desc: "ใช้แถบค้นหาเพื่อค้นหาข้อมูลได้อย่างรวดเร็ว ไม่ว่าจะเป็นตารางเรียน การบ้าน หรือบันทึก"
            }
        ],
        footer: "ต้องการความช่วยเหลือเพิ่มเติม? ติดต่อผู้ดูแลระบบได้ที่ลิงก์ท้ายหน้า"
    }
};

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    setupHelpButton();
    checkFirstVisit();
});

function setupHelpButton() {
    // Add "?" button next to theme toggle
    const headerActions = document.querySelector('.top-nav > div:last-child');
    if (!headerActions) return;

    const helpBtn = document.createElement('button');
    helpBtn.id = 'help-btn';
    helpBtn.className = 'icon-button';
    helpBtn.setAttribute('aria-label', 'Help / ช่วยเหลือ');
    helpBtn.innerHTML = '<i class="ph ph-question"></i>';
    helpBtn.addEventListener('click', showHelpModal);
    
    // Insert before theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        headerActions.insertBefore(helpBtn, themeToggle);
    } else {
        headerActions.appendChild(helpBtn);
    }
}

function checkFirstVisit() {
    const hasSeenHelp = localStorage.getItem('classhub_help_seen');
    if (!hasSeenHelp) {
        // Small delay for page to fully render
        setTimeout(() => {
            showHelpModal();
            localStorage.setItem('classhub_help_seen', 'true');
        }, 800);
    }
}

function showHelpModal() {
    let overlay = document.getElementById('help-overlay');
    let modal = document.getElementById('help-modal');
    
    // Create if not exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'help-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        modal = document.createElement('div');
        modal.id = 'help-modal';
        modal.className = 'help-modal-card';
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
    }
    
    // Build content with current language
    const lang = getHelpLanguage();
    renderHelpContent(modal, lang);
    
    // Close handlers
    const closeModal = () => {
        overlay.style.display = 'none';
    };
    
    // Remove old listeners by replacing
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    newOverlay.addEventListener('click', (e) => {
        const modalCard = newOverlay.querySelector('.help-modal-card');
        if (e.target === newOverlay) {
            newOverlay.style.display = 'none';
        }
    });
    
    // Attach events to buttons in the new overlay
    const closeBtn = newOverlay.querySelector('.help-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => newOverlay.style.display = 'none');
    
    const enBtn = newOverlay.querySelector('.help-lang-btn[data-lang="en"]');
    const thBtn = newOverlay.querySelector('.help-lang-btn[data-lang="th"]');
    
    if (enBtn) {
        enBtn.addEventListener('click', () => {
            localStorage.setItem('classhub_help_lang', 'en');
            renderHelpContent(newOverlay.querySelector('.help-modal-card'), 'en');
            // Reattach events
            attachLangEvents(newOverlay);
        });
    }
    if (thBtn) {
        thBtn.addEventListener('click', () => {
            localStorage.setItem('classhub_help_lang', 'th');
            renderHelpContent(newOverlay.querySelector('.help-modal-card'), 'th');
            attachLangEvents(newOverlay);
        });
    }
    
    // Re-attach close on the new close button after render
    setTimeout(() => {
        const newClose = newOverlay.querySelector('.help-close-btn');
        if (newClose) newClose.addEventListener('click', () => newOverlay.style.display = 'none');
    }, 0);
}

function attachLangEvents(overlay) {
    const enBtn = overlay.querySelector('.help-lang-btn[data-lang="en"]');
    const thBtn = overlay.querySelector('.help-lang-btn[data-lang="th"]');
    
    if (enBtn) {
        enBtn.onclick = () => {
            localStorage.setItem('classhub_help_lang', 'en');
            renderHelpContent(overlay.querySelector('.help-modal-card'), 'en');
            attachLangEvents(overlay);
        };
    }
    if (thBtn) {
        thBtn.onclick = () => {
            localStorage.setItem('classhub_help_lang', 'th');
            renderHelpContent(overlay.querySelector('.help-modal-card'), 'th');
            attachLangEvents(overlay);
        };
    }
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
            <button class="help-close-btn icon-button" aria-label="Close">
                <i class="ph ph-x"></i>
            </button>
        </div>
        <div class="help-modal-body">
            <h2 class="help-title">${content.title}</h2>
            <div class="help-sections">
                ${content.sections.map(section => `
                    <div class="help-section-item">
                        <div class="help-section-icon"><i class="ph ${section.icon}"></i></div>
                        <div class="help-section-text">
                            <h4>${section.title}</h4>
                            <p>${section.desc}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <p class="help-footer-text">${content.footer}</p>
        </div>
    `;
}