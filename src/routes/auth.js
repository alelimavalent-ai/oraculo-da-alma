// Define as rotas de autenticação e liga cada uma ao controller.
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

// Públicas
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);

// Protegidas (exigem token)
router.get('/me', authRequired, ctrl.me);
router.post('/change-password', authRequired, ctrl.changePassword);
router.post('/logout', authRequired, ctrl.logout);

module.exports = router;
