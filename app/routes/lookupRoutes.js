const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const lookupController = require('../controllers/lookupController');

router.get('/institutions', requireAuth, lookupController.institutions);
router.get('/locations', requireAuth, lookupController.locations);

module.exports = router;
