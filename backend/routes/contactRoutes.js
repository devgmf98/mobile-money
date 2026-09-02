import express from 'express';
import { authMiddleware, adminMiddleware, staffMiddleware, optionalAuth } from '../middleware/auth.js';
import {
  submitContactMessage,
  getContactMessages,
  updateContactMessage,
  getContactMessageCount,
  getMailStatus,
} from '../controllers/contactController.js';

const router = express.Router();

/* Sending is open to anyone — a customer locked out of their account is
   exactly who needs to get in touch, and requiring a login to report that
   would be a closed door with a bell on it. `optionalAuth` still records the
   sender when they happen to be signed in. */
router.post('/', optionalAuth, submitContactMessage);

/* Reading and answering is open to admins AND sub-admins. Sub-admins run the
   counter and are the people customers are usually writing about, so routing
   every message past an admin first only delays the reply. */
router.get('/', authMiddleware, staffMiddleware, getContactMessages);
router.get('/count', authMiddleware, staffMiddleware, getContactMessageCount);
router.patch('/:id', authMiddleware, staffMiddleware, updateContactMessage);

/* The one exception. This reports the SMTP host and support address, which is
   infrastructure configuration rather than customer correspondence — and a
   sub-admin could not act on it anyway. */
router.get('/mail-status', authMiddleware, adminMiddleware, getMailStatus);

export default router;
