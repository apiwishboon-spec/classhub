import { db } from './firebase-config.js';
import { doc, setDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function trackVisit() {
  try {
    let path = window.location.pathname;
    if (path === '/' || path === '' || path.endsWith('/')) {
      path = '/index';
    }
    const pageId = path.replace(/\//g, '_').replace(/^\_+|\_+$/g, '') || 'home';

    // Limit writes: only write if last track was >4 hours ago
    const lastTracked = localStorage.getItem(`visit_${pageId}`);
    const now = Date.now();
    if (lastTracked && (now - parseInt(lastTracked)) < (4 * 60 * 60 * 1000)) {
      const countDisplay = document.getElementById('visit-count');
      if (countDisplay) {
        const docSnap = await getDoc(doc(db, 'page_visits', pageId));
        if (docSnap.exists()) countDisplay.textContent = docSnap.data().count || 0;
      }
      return;
    }

    const pageRef = doc(db, 'page_visits', pageId);
    
    await setDoc(pageRef, {
      count: increment(1),
      last_visit: new Date().toISOString(),
      path: window.location.pathname
    }, { merge: true });
    
    localStorage.setItem(`visit_${pageId}`, now.toString());
    console.log(`Visit tracked for: ${pageId}`);

    const countDisplay = document.getElementById('visit-count');
    if (countDisplay) {
      const docSnap = await getDoc(pageRef);
      if (docSnap.exists()) {
        countDisplay.textContent = docSnap.data().count || 0;
      }
    }
  } catch (error) {
    console.error('Error tracking visit:', error);
  }
}

trackVisit();
