/**
 * ClassHub FCM Notification Worker
 * Deployed on Cloudflare Workers (free plan)
 *
 * Required environment secrets (set via Cloudflare dashboard):
 *   PRIVATE_KEY    - Firebase service account private key
 *   CLIENT_EMAIL   - Firebase service account email
 *   PROJECT_ID     - Firebase project ID (classhub-e1e8b)
 *   WORKER_SECRET  - A random string you choose to secure this endpoint
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify secret to prevent unauthorized calls
    const secret = request.headers.get('X-Worker-Secret');
    if (!env.WORKER_SECRET || secret !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    try {
      const { title, body, type } = await request.json();
      if (!title || !body) {
        return new Response(JSON.stringify({ success: false, error: 'title and body are required' }), {
          status: 400, headers: corsHeaders
        });
      }

      // Step 1: Get OAuth access token from Google
      const accessToken = await getAccessToken(env.CLIENT_EMAIL, env.PRIVATE_KEY);

      // Step 2: Get all FCM tokens from Firestore
      const tokens = await getFCMTokens(env.PROJECT_ID, accessToken);

      if (tokens.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0, message: 'No devices registered' }), {
          headers: corsHeaders
        });
      }

      // Step 3: Send notifications to all tokens
      let successCount = 0;
      let failCount = 0;
      const invalidTokens = [];

      for (const token of tokens) {
        const result = await sendFCM(token, title, body, type, env.PROJECT_ID, accessToken);
        if (result.ok) {
          successCount++;
        } else {
          failCount++;
          if (result.invalid) invalidTokens.push(token);
        }
      }

      // Step 4: Clean up invalid tokens from Firestore
      for (const token of invalidTokens) {
        await deleteToken(token, env.PROJECT_ID, accessToken);
      }

      return new Response(JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        cleaned: invalidTokens.length
      }), { headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: corsHeaders
      });
    }
  }
};

// ─── OAuth2 Token ──────────────────────────────────────────────────────────────

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const jwt = await signJWT(header, payload, privateKeyPem);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

// ─── Firestore: Get FCM Tokens ─────────────────────────────────────────────────

async function getFCMTokens(projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fcm_tokens?pageSize=300`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const data = await response.json();
  if (!data.documents) return [];

  return data.documents
    .map(doc => doc.fields?.token?.stringValue)
    .filter(Boolean);
}

// ─── Firestore: Delete Invalid Token ──────────────────────────────────────────

async function deleteToken(token, projectId, accessToken) {
  const encodedToken = encodeURIComponent(token);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fcm_tokens/${encodedToken}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
}

// ─── FCM: Send Notification ────────────────────────────────────────────────────

async function sendFCM(token, title, body, type, projectId, accessToken) {
  let clickUrl = 'https://myclasshub.pages.dev/index.html';
  if (type === 'homework') clickUrl = 'https://myclasshub.pages.dev/index.html#homework';
  else if (type === 'announcement') clickUrl = 'https://myclasshub.pages.dev/index.html#announcements';
  else if (type === 'schedule') clickUrl = 'https://myclasshub.pages.dev/index.html#schedule';

  const message = {
    message: {
      token,
      notification: { title, body },
      data: { type: type || 'general', url: clickUrl },
      webpush: {
        notification: {
          title, body,
          icon: 'https://myclasshub.pages.dev/favicon.png',
          badge: 'https://myclasshub.pages.dev/favicon.png',
          requireInteraction: 'true',
          vibrate: '200,100,200',
        },
        fcm_options: { link: clickUrl }
      }
    }
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  if (response.ok) return { ok: true };

  const err = await response.json().catch(() => ({}));
  const invalid =
    err?.error?.details?.some(d => d.errorCode === 'UNREGISTERED') ||
    err?.error?.status === 'NOT_FOUND';

  return { ok: false, invalid };
}

// ─── JWT Signing ───────────────────────────────────────────────────────────────

async function signJWT(header, payload, privateKeyPem) {
  const b64url = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${sig}`;
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
