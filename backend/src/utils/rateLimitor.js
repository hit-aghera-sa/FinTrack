const rateLimit = require("express-rate-limit");

const signupLimiter = rateLimit({
    max: 5,
    windowMs: 15*60*1000,
    message: `Too many signUp attempts, try again after 15 minute`
})

const loginLimiter = rateLimit({
    max: 10,
    windowMs: 15*60*1000,
    message: `Too many login attempts, try again after 15 minute`
})

const forgotLimiter = rateLimit({
    max: 5,
    windowMs: 60*60*1000,
    message: `Too many login attempts, try again after 1 hour`
});

module.exports = {signupLimiter, loginLimiter, forgotLimiter}