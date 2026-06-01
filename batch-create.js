const admin = require("firebase-admin");
const path = require("path");

// 1. Path to your downloaded service account key (keep this gitignored!)
const serviceAccountPath = path.join(__dirname, "service-account-key.json");

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  console.error("❌ ERROR: Could not find 'service-account-key.json'!");
  console.error("Please download your Service Account JSON from the Firebase Console:");
  console.error("👉 Settings Gear -> Project Settings -> Service Accounts -> Generate New Private Key");
  console.error(`Save it in this directory as: ${serviceAccountPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// 2. Define the list of users you want to create
// Change these or read them from a JSON file / CSV as needed!
const usersToCreate = [
  {
    email: "student1@school.edu",
    password: "Password123!",
    displayName: "Jane Doe",
    role: "student" // Options: 'student', 'ta', 'teacher', 'admin'
  },
  {
    email: "teacher.smith@school.edu",
    password: "SecurePassword456!",
    displayName: "Mr. Smith",
    role: "teacher"
  }
];

async function runBatch() {
  console.log(`🚀 Starting batch user creation for ${usersToCreate.length} users...`);
  console.log("--------------------------------------------------");

  for (const user of usersToCreate) {
    try {
      // A. Create the user in Firebase Authentication
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true // Automatically marks email as verified
      });
      console.log(`✅ Auth user created: ${user.email} (UID: ${userRecord.uid})`);

      // B. Save the user's role in the Firestore 'users' collection
      await db.collection("users").doc(userRecord.uid).set({
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`🔑 Assigned role '${user.role}' in Firestore for ${user.email}`);
      console.log("--------------------------------------------------");

    } catch (error) {
      console.error(`❌ Error creating user ${user.email}:`, error.message);
      console.log("--------------------------------------------------");
    }
  }
  console.log("🎉 Batch user creation complete!");
}

runBatch();
