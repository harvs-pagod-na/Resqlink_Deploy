// Rate Limiter Pass-Through for seamless development & testing
const apiLimiter = (req, res, next) => next();
const loginLimiter = (req, res, next) => next();

module.exports = { apiLimiter, loginLimiter };
