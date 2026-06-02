import { db } from './firebase-config.js';
import { doc, setDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function trackVisit() {
    try {
        let path = window.location.pathname;
        // Handle root path
        if (path === '/' || path === '' || path.endsWith('/')) {
            path += 'index.html';
        }
        
        // Sanitize path for document ID
        const pageId = path.replace(/\//g, '_').replace(/^\_+|\_+$/g, '') || 'home';
        const pageRef = doc(db, 'page_visits', pageId);
        
        // Increment visit count
        await setDoc(pageRef, {
            count: increment(1),
            last_visit: new Date().toISOString(),
            path: window.location.pathname
        }, { merge: true });
        
        console.log(`Visit tracked for: ${pageId}`);

        // Update UI if element exists
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

// Run when script loads
trackVisit();
