const express = require('express');
const validate = require('../middlewares/validate.middleware');

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
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema
} = require('../validations/auth.validation');

const { updateMeSchema } = require('../validations/user.validation');


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

  .post('/signup', signupLimiter, validate(signupSchema), signUp)
  .post('/login', loginLimiter, validate(loginSchema), login)
  .post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), forgotPassword)
  .patch('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

router.use(protect);

router
  .get('/me', (req, res) => {
    res.status(200).json({
      status: 'success',
      user: req.user
    });
  })
  .patch('/update-password', validate(updatePasswordSchema), updatePassword)
  .patch('/update-me', validate(updateMeSchema), updateMe)
  .delete('/delete-me', deactiveMe)
  .post('/logout', logout);

router.use(restrictTo('admin'));

router.get('/', getAllUsers)
  .get('/:id', getUser)
  .delete('/:id', deactiveUser);

module.exports = router;
