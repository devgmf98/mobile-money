import express from 'express';
import { authMiddleware, adminMiddleware, staffMiddleware, optionalAuth } from '../middleware/auth.js';
import {
  getHelpArticles,
  markHelpArticleRead,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
} from '../controllers/helpController.js';

const router = express.Router();

/* Reading is open to everyone — a help centre behind a login helps nobody, and
   the people most in need of it are often the ones who cannot get in.
   `optionalAuth` is still used so staff see their own unpublished drafts. */
router.get('/', optionalAuth, getHelpArticles);
router.post('/:slug/read', optionalAuth, markHelpArticleRead);

/* Writing is staff work. Sub-admins answer customers all day and know which
   questions keep coming back, so they can write the answers down. */
router.post('/', authMiddleware, staffMiddleware, createHelpArticle);
router.patch('/:id', authMiddleware, staffMiddleware, updateHelpArticle);

/* Deleting is admin-only. Editing a wrong answer is recoverable; removing an
   article someone has already been sent a link to is not. */
router.delete('/:id', authMiddleware, adminMiddleware, deleteHelpArticle);

export default router;
