const express = require('express');
const router  = express.Router();
const resumeController = require('../controllers/resumeController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/:id',          resumeController.getResume);
router.post('/:id/section', resumeController.saveSection);
router.post('/:id/photo',   upload.single('photo'), resumeController.uploadPhoto);
router.delete('/:id/photo', resumeController.deletePhoto);

module.exports = router;
