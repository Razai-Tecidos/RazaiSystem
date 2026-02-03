import admin from 'firebase-admin';
import serviceAccount from '../../config/firebase-adminsdk.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: 'razaisystem'
});

export default admin;
