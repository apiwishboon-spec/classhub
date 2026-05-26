/**
 * Cloud Functions for MyClassHub Push Notifications
 *
 * Deploy with: firebase deploy --only functions
 *
 * These functions trigger when new homework, announcements, or schedule
 * changes are written to Firestore, and send FCM push notifications
 * to all registered device tokens.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

/**
 * Helper: Send push notification to all registered FCM tokens
 */
async function sendPushToAllTokens(payload) {
  const tokensSnapshot = await db.collection("fcm_tokens").get();
  
  if (tokensSnapshot.empty) {
    console.log("No FCM tokens registered.");
    return;
  }

  const tokens = [];
  tokensSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.token) {
      tokens.push(data.token);
    }
  });

  if (tokens.length === 0) {
    console.log("No valid tokens found.");
    return;
  }

  console.log(`Sending push notification to ${tokens.length} devices...`);

  // Send to all tokens in batches of 500 (FCM limit)
  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        ...payload,
      });
      console.log(
        `Batch ${i / batchSize + 1}: ${response.successCount} success, ${response.failureCount} failures`
      );

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(
              `Failed to send to ${batch[idx]}: ${resp.error.message}`
            );
            if (
              resp.error.code === "messaging/invalid-registration-token" ||
              resp.error.code === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(batch[idx]);
            }
          }
        });

        // Delete invalid tokens from Firestore
        if (invalidTokens.length > 0) {
          const batchDelete = db.batch();
          invalidTokens.forEach((token) => {
            const docRef = db.collection("fcm_tokens").doc(token);
            batchDelete.delete(docRef);
          });
          await batchDelete.commit();
          console.log(`Cleaned up ${invalidTokens.length} invalid tokens.`);
        }
      }
    } catch (error) {
      console.error("Error sending multicast:", error);
    }
  }
}

/**
 * Triggered when a new homework document is created
 */
exports.onNewHomework = functions.firestore
  .document("homework/{homeworkId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    const payload = {
      notification: {
        title: `📚 New Homework: ${data.subject || "Unknown Subject"}`,
        body: `${data.homework || "No description"}${data.due ? ` (Due: ${data.due})` : ""}`,
      },
      data: {
        type: "homework",
        subject: data.subject || "",
        homeworkId: context.params.homeworkId,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };

    await sendPushToAllTokens(payload);
  });

/**
 * Triggered when a new announcement document is created
 */
exports.onNewAnnouncement = functions.firestore
  .document("announcements/{announcementId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    const payload = {
      notification: {
        title: `📢 ${data.title || "New Announcement"}`,
        body: data.message 
          ? (data.message.length > 120 
            ? data.message.substring(0, 120) + "..." 
            : data.message)
          : "Check the announcements",
      },
      data: {
        type: "announcement",
        announcementId: context.params.announcementId,
        author: data.author || "",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };

    await sendPushToAllTokens(payload);
  });

/**
 * Triggered when a schedule document is created or updated
 */
exports.onScheduleChange = functions.firestore
  .document("schedule/{scheduleId}")
  .onWrite(async (change, context) => {
    // Only notify if it's a new document (create) or a modification (update)
    if (!change.before.exists) {
      // New schedule slot created
      const data = change.after.data();
      const payload = {
        notification: {
          title: "📅 Schedule Updated",
          body: `New time slot: ${data.time || ""}`,
        },
        data: {
          type: "schedule",
          scheduleId: context.params.scheduleId,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      };
      await sendPushToAllTokens(payload);
    } else if (JSON.stringify(change.before.data()) !== JSON.stringify(change.after.data())) {
      // Existing schedule slot modified
      const data = change.after.data();
      const payload = {
        notification: {
          title: "📅 Schedule Updated",
          body: `Time slot ${data.time || ""} has been modified`,
        },
        data: {
          type: "schedule",
          scheduleId: context.params.scheduleId,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      };
      await sendPushToAllTokens(payload);
    }
  });