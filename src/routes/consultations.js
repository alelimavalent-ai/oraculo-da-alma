// Rotas da esteira de consultas.
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/consultationController');
const { authRequired, adminRequired } = require('../middleware/auth');

// Usuário logado
router.post('/', authRequired, ctrl.criarConsulta);          // criar consulta (gera pagamento pendente)
router.get('/', authRequired, ctrl.listarConsultas);         // histórico "Minhas Consultas"
router.get('/:id', authRequired, ctrl.detalheConsulta);      // detalhe (se liberada)
router.get('/:id/pdf', authRequired, ctrl.baixarPdf);        // baixar relatório premium em PDF

// Confirmação de pagamento: em produção, webhook PIX. Aqui, restrito a admin para testes.
router.post('/:id/confirm', authRequired, adminRequired, ctrl.confirmarPagamento);

module.exports = router;
