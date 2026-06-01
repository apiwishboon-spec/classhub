# MyClassHub

MyClassHub is a comprehensive classroom dashboard designed to streamline classroom management and information sharing. It provides students and teachers with a centralized hub for schedules, announcements, homework, and quick notes.

## 🚀 Features

- **Dynamic Schedule:** Real-time classroom schedule tracking.
- **Announcements:** Stay updated with the latest classroom news.
- **Homework Tracker:** Keep track of assignments and deadlines.
- **Quick Notes:** Personal or shared note-taking section.
- **Admin Panel:** Secure management for authorized users.
- **Dark Mode:** Support for both light and dark themes.
- **Responsive Design:** Optimized for various devices and screen sizes.
- **Search:** Global search functionality for quick access to information.

## 🛠 Tech Stack

- **Frontend:** HTML5, Vanilla CSS, JavaScript (ES Modules)
- **Backend/Hosting:** [Firebase](https://firebase.google.com/) (Hosting, Firestore, Firebase Admin SDK)
- **Icons:** [Phosphor Icons](https://phosphoricons.com/)
- **Fonts:** IBM Plex Sans (via Google Fonts)
- **Analytics:** Google Analytics (gtag.js)

## 📦 Project Structure

- `index.html`: Main dashboard entry point.
- `admin.html`: Administrative management interface.
- `script.js`: Core frontend logic.
- `firebase-config.js`: Firebase initialization and configuration.
- `firestore.rules`: Security rules for database access.
- `style.css`: Visual styling and theming.

## 🚀 Deployment

This project is hosted on **Cloudflare Pages**. 

- **Production:** Automatic deployments from the `main` branch.
- **Previews:** Every Pull Request generates a unique preview URL to test changes.

## 🤖 GitHub Actions

GitHub Actions is used to automate the development workflow. For Cloudflare Pages, it handles:

1.  **Preview Deployments:** Automatically builds and deploys a preview version of the site for every Pull Request.
2.  **Production Deployments:** Automatically updates the live site when changes are merged into the `main` branch.
3.  **Code Quality:** Can be configured to run linters (like ESLint) and tests before allowing a merge.

### How it works with Cloudflare Pages
While Cloudflare Pages has built-in GitHub integration, using a GitHub Action (via the `cloudflare/pages-action`) gives you more control, such as:
- Running custom build scripts before deployment.
- Running security scans.
- Conditional deployments based on which files changed.

