import admin from "firebase-admin";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing");

  // env에 '...'로 넣었을 때 대비
  const trimmed = raw.trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
  return JSON.parse(trimmed);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  });
}

export const firebaseAdmin = admin;
