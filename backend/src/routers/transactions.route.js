const express = require('express');
const {
  createTransaction,
  getAllTransction,
  getMyTransaction,
  getTransaction,
  updateTransaction,
  deactiveTransaction
} = require('../controllers/transasction.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const router = express.Router();

router.use(protect);

router
  .get('/', getMyTransaction)
  .post('/', createTransaction)
  .patch('/:id', updateTransaction)
  .delete('/:id', deactiveTransaction);

router.use(restrictTo('admin'));

router.get('/all', getAllTransction).get('/admin/:id', getTransaction);

module.exports = router;
