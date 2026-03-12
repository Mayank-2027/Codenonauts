const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { generateReport, getReport } = require('../controllers/reportController');

router.post('/generate', protect, authorize('doctor'), generateReport);

router.get('/:id', protect, getReport);

module.exports = router;
