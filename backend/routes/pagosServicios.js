const express = require('express');
const router = express.Router();
const pagoServicioController = require('../controllers/pagoServicioController');

// Rutas principales
router.get('/', pagoServicioController.list);
router.get('/nuevo', pagoServicioController.showNewForm);
router.get('/:id/editar', pagoServicioController.showEditForm); // <-- NUEVA RUTA
router.post('/', pagoServicioController.create);
router.put('/:id', pagoServicioController.update); // <-- NUEVA RUTA
router.post('/:id/pagar', pagoServicioController.pagar);
router.delete('/:id/pago/:pagoId', pagoServicioController.eliminarPago);
router.delete('/:id', pagoServicioController.delete);

module.exports = router;