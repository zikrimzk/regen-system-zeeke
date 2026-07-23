const express = require('express');
const router  = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',           dashboardController.listResumes);
router.post('/',          dashboardController.createResume);
router.patch('/:id/title',dashboardController.renameResume);
router.delete('/:id',     dashboardController.deleteResume);

module.exports = router;
