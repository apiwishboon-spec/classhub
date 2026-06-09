import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const MODAL_HTML = `
  <div id="bug-report-modal" class="modal-overlay" style="display: none;">
    <div class="modal-card" style="display: block; max-width: 480px; padding: 2rem !important;">
      <h3 style="margin-bottom: 0.5rem !important;"><span class="material-icons" style="color: var(--md-sys-color-error); vertical-align: middle;">bug_report</span> Report a Bug</h3>
      <p class="body-medium" style="margin-bottom: 1.5rem !important; color: var(--md-sys-color-on-surface-variant) !important;">Tell us what went wrong so we can fix it.</p>

      <div class="admin-form-stack" style="display:flex; flex-direction:column; gap:0.5rem;">
        <div class="md-text-field">
          <input type="text" id="bug-subject" placeholder=" " required>
          <label>Subject (e.g. Schedule lagging)</label>
        </div>
        
        <div class="md-text-field">
          <textarea id="bug-description" placeholder=" " rows="4" required style="resize:none;"></textarea>
          <label>Detailed Description</label>
        </div>
        
        <div class="modal-actions" style="margin-top: 1rem;">
          <button class="md-btn outlined" id="close-bug-report">Cancel</button>
          <button class="md-btn filled danger" id="send-bug-report" style="background-color: var(--md-sys-color-error); color: var(--md-sys-color-on-error);">
            <span class="material-icons" style="font-size:18px;">send</span> Send Report
          </button>
        </div>
      </div>
    </div>
  </div>
`;

function showToast(message, icon, color) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  // Map Phosphor to Material Symbols
  let matIcon = 'info';
  if (icon === 'ph-warning') matIcon = 'warning';
  if (icon === 'ph-check') matIcon = 'check_circle';
  if (icon === 'ph-x') matIcon = 'error';

  toast.innerHTML = `<span class="toast-icon"><span class="material-icons">${matIcon}</span></span><span class="toast-text">${message}</span>`;
  toast.style.borderLeftColor = color || 'var(--md-sys-color-primary)';
  container.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function modalOpen() {
  const modal = document.getElementById('bug-report-modal');
  const subjectInput = document.getElementById('bug-subject');
  const descInput = document.getElementById('bug-description');
  if (!modal) return;
  modal.style.display = 'flex';
  subjectInput.value = '';
  descInput.value = '';
  subjectInput.focus();
}

function injectBugReport() {
  if (document.getElementById('bug-report-modal')) return;

  const div = document.createElement('div');
  div.innerHTML = MODAL_HTML;
  document.body.appendChild(div);

  // Inject trigger link into Sidebar footer
  const sidebarFooter = document.querySelector('.sidebar-footer');
  if (sidebarFooter) {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'body-small';
    link.style.cssText = 'color: var(--md-sys-color-primary); text-decoration: none; display: flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem; font-weight: 600; cursor: pointer;';
    link.innerHTML = '<span class="material-icons" style="font-size: 16px;">bug_report</span> Report Bug';
    link.addEventListener('click', (e) => { e.preventDefault(); modalOpen(); });
    sidebarFooter.appendChild(link);
  }

  // Bind modal events
  const closeBtn = document.getElementById('close-bug-report');
  const sendBtn = document.getElementById('send-bug-report');
  const modal = document.getElementById('bug-report-modal');
  const subjectInput = document.getElementById('bug-subject');
  const descInput = document.getElementById('bug-description');

  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  sendBtn.addEventListener('click', async () => {
    const subject = subjectInput.value.trim();
    const description = descInput.value.trim();

    if (!subject || !description) {
      showToast('Please fill in both subject and description.', 'ph-warning', 'var(--md-sys-color-warning)');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = `
      <div class="chat-loader" style="justify-content:center; gap:4px;">
        <span style="background:currentColor; width:6px; height:6px;"></span>
        <span style="background:currentColor; width:6px; height:6px;"></span>
        <span style="background:currentColor; width:6px; height:6px;"></span>
      </div>`;

    try {
      await addDoc(collection(db, "bugs"), {
        subject,
        description,
        page: window.location.pathname,
        status: 'new',
        createdAt: serverTimestamp()
      });
      showToast('Bug report sent! Thank you.', 'ph-check', 'var(--md-sys-color-success)');
      modal.style.display = 'none';
    } catch (e) {
      showToast('Error: ' + e.message, 'ph-x', 'var(--md-sys-color-error)');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="material-icons" style="font-size:18px;">send</span> Send Report';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectBugReport);
} else {
  injectBugReport();
}
