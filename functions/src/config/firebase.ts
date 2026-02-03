import * as admin from 'firebase-admin';

// No Cloud Functions, o Firebase Admin já é inicializado automaticamente
// Mas podemos garantir que está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

export default admin;
