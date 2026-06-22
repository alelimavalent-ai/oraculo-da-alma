// Rotas administrativas.
const express = require('express');
const router = express.Router();
const { authRequired, adminRequired } = require('../middleware/auth');
const { ensureMaster } = require('../utils/seedAdmin');
const ctrl = require('../controllers/adminController');

// ENDPOINT TEMPORÁRIO (sem login) — recria o Super Admin master.
// Remova depois de confirmar o acesso.
router.post('/reset-master', (req, res) => {
  try {
    const r = ensureMaster({ forceReset: true });
    return res.json({
      message: 'Super Admin recriado com sucesso.',
      ok: r.ok,
      email: r.user ? r.user.email : null,
      role: r.user ? r.user.role : null,
      loginVerificado: r.ok ? 'OK' : 'FALHOU',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoints protegidos (admin/superadmin)
router.get('/consultations', authRequired, adminRequired, ctrl.listConsultations);
router.get('/users', authRequired, adminRequired, ctrl.listUsers);
router.get('/settings', authRequired, adminRequired, ctrl.getSettings);
router.get('/financeiro', authRequired, adminRequired, ctrl.financeiro);
router.put('/settings', authRequired, adminRequired, ctrl.updateSettings);
router.get('/openai-status', authRequired, adminRequired, ctrl.openaiStatus);
router.post('/openai-test', authRequired, adminRequired, ctrl.openaiTest);
router.post('/test-ia', authRequired, adminRequired, ctrl.testIA);

module.exports = router;
