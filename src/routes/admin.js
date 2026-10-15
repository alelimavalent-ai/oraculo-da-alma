// Rotas administrativas.
const express = require('express');
const router = express.Router();
const { authRequired, adminRequired } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

// Endpoints protegidos (admin/superadmin)
router.get('/consultations', authRequired, adminRequired, ctrl.listConsultations);
router.get('/gratis', authRequired, adminRequired, ctrl.gratisPagantes);
router.get('/users', authRequired, adminRequired, ctrl.listUsers);
router.get('/settings', authRequired, adminRequired, ctrl.getSettings);
router.get('/financeiro', authRequired, adminRequired, ctrl.financeiro);
router.put('/settings', authRequired, adminRequired, ctrl.updateSettings);
router.get('/openai-status', authRequired, adminRequired, ctrl.openaiStatus);
router.post('/openai-test', authRequired, adminRequired, ctrl.openaiTest);
router.post('/test-ia', authRequired, adminRequired, ctrl.testIA);

module.exports = router;
