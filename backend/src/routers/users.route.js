const express = require('express');
const {
  signUp,
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  logout
} = require('../controllers/auth.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const {
  getAllUsers,
  getUser,
  updateMe,
  deactiveMe,
  deactiveUser
} = require('../controllers/user.controller');
const {
  signupLimiter,
  loginLimiter,
  forgotLimiter
} = require('../utils/rateLimitor');

const router = express.Router();

router

  .post('/signup', signupLimiter, signUp)
  .post('/login', loginLimiter, login)
  .post('/forgot-password', forgotLimiter, forgotPassword)
  .patch('/reset-password/:token', resetPassword);

router.use(protect);

router
  .get('/me', (req, res) => {
    res.status(200).json({
      status: 'success',
      user: req.user
    });
  })
  .patch('/update-password', updatePassword)
  .patch('/update-me', updateMe)
  .delete('/delete-me', deactiveMe)
  .post('/logout', logout);

router.use(restrictTo('admin'));

router.get('/', getAllUsers).get('/:id', getUser).delete('/:id', deactiveUser);

module.exports = router;
