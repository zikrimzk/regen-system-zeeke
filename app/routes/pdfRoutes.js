const express = require('express');
const router  = express.Router();
const pdfController = require('../controllers/pdfController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/:id/generate', pdfController.generatePdf);
router.get('/:id/preview',  pdfController.previewHtml);
router.post('/:id/preview-data', pdfController.previewDraftHtml);

module.exports = router;
