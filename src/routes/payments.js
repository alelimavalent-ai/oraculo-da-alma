// Rotas de pagamento PIX (Asaas).
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

router.post('/pix', authRequired, ctrl.gerarPix);            // gera a cobrança PIX
router.get('/status/:id', authRequired, ctrl.statusPix);     // consulta status e libera

module.exports = router;
