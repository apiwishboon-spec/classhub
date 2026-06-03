import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const MODAL_HTML = `
  <div id="bug-report-modal" class="modal-overlay">
    <div class="modal-card" style="display: block; max-width: 480px; padding: 1.5rem !important;">
      <h3 style="margin-bottom: 0.5rem !important;"><i class="ph ph-bug-beetle" style="color: var(--danger);"></i> Report a Bug</h3>
      <p style="margin-bottom: 1rem !important; font-size: 0.85rem !important; color: var(--text-secondary) !important;">Help us improve MyClassHub. Describe what went wrong.</p>

      <div class="admin-form-stack">
        <input type="text" id="bug-subject" placeholder="Subject (e.g. Schedule not loading)" class="form-input" style="border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.9rem;">
        <textarea id="bug-description" placeholder="Describe the bug in detail... What happened? What did you expect?" class="form-input" rows="4" style="border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.9rem;"></textarea>
        <div class="modal-actions">
          <button class="btn-secondary" id="close-bug-report">Cancel</button>
          <button class="btn-danger" id="send-bug-report"><i class="ph ph-paper-plane-tilt"></i> Send Report</button>
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
  toast.innerHTML = `<span class="toast-icon"><i class="ph ${icon || 'ph-info'}"></i></span><span class="toast-text">${message}</span>`;
  toast.style.borderLeftColor = color || 'var(--accent-color)';
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

  // Inject modal
  const div = document.createElement('div');
  div.innerHTML = MODAL_HTML;
  document.body.appendChild(div);

  // Inject trigger link into footer
  const footerLinks = document.querySelector('footer .admin-footer-links, footer div:first-child');
  if (footerLinks) {
    const link = document.createElement('a');
    link.href = '#';
    link.style.cssText = 'color: var(--text-secondary); text-decoration: none;';
    link.innerHTML = '<i class="ph ph-bug-beetle" style="font-size: 0.8rem;"></i> Report Bug';
    link.addEventListener('click', (e) => { e.preventDefault(); modalOpen(); });
    footerLinks.appendChild(link);
  } else {
    // Fallback: inject a link at the bottom of the page for pages without footer
    const footer = document.querySelector('footer');
    if (footer) {
      const linksDiv = footer.querySelector('div');
      if (linksDiv) {
        const link = document.createElement('a');
        link.href = '#';
        link.style.cssText = 'color: var(--text-secondary); text-decoration: none; margin-left: 1rem; font-size: 0.8rem;';
        link.innerHTML = '<i class="ph ph-bug-beetle"></i> Report Bug';
        link.addEventListener('click', (e) => { e.preventDefault(); modalOpen(); });
        linksDiv.appendChild(link);
      }
    }
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
      showToast('Please fill in both subject and description.', 'ph-warning', 'var(--warning)');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Sending...';

    try {
      await addDoc(collection(db, "bugs"), {
        subject,
        description,
        page: window.location.pathname,
        status: 'new',
        createdAt: serverTimestamp()
      });
      showToast('Bug report sent! Thank you.', 'ph-check', 'var(--success)');
      modal.style.display = 'none';
    } catch (e) {
      showToast('Error: ' + e.message, 'ph-x', 'var(--danger)');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send Report';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectBugReport);
} else {
  injectBugReport();
}
