const express = require('express');
const router = express.Router();
const prestamoController = require('../controllers/prestamoController');

router.get('/', prestamoController.list);
router.get('/nuevo', prestamoController.showNewForm);
router.post('/', prestamoController.create);
router.post('/:id/pagar', prestamoController.pagarCuota);
router.delete('/:id/pago/:pagoId', prestamoController.eliminarPago); // <-- NUEVA RUTA
router.delete('/:id', prestamoController.delete);
router.get('/:id/detalle', prestamoController.getDetalle);

module.exports = router;