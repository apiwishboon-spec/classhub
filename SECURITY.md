# Security Standards

**Last Updated:** June 13, 2026

MyClassHub prioritizes the security and integrity of its platform.

## Security Features
- **Centralized Profanity Filtering:** All user-generated content (chat messages, polls, announcements, homework) is automatically sanitized via a dedicated `profanity-filter.js` module.
- **Audit Logging:** Sensitive administrative actions are recorded to the database to ensure accountability and facilitate troubleshooting.
- **Role-Based Access Control (RBAC):** Access to management features is gated by defined user roles (Admin, Teacher, TA).
- **Secure Infrastructure:** Leveraging Google Firebase enterprise-grade security for authentication, database access, and hosting.

## Security Practices
- **Authentication:** All user sessions are managed securely via Firebase. Session revocation is implemented to prevent unauthorized access.
- **Data Protection:** We employ security rules for Firestore to ensure users can only access information appropriate to their role.
- **Vulnerability Reporting:** Please report any security vulnerabilities or bugs directly to the administration.
