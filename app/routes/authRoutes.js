const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { redirectIfLoggedIn } = require('../middleware/auth');

router.post('/login',    authController.login);
router.post('/register', authController.register);
router.get('/logout',    authController.logout);
router.get('/me',        authController.me);

module.exports = router;
