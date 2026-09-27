const { AuditLog } = require('../models');

const logAudit = (action, entity) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      res.send = originalSend;
      res.send(data);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = req.user ? req.user.id : null;
          const ipAddress = req.ip || req.connection.remoteAddress;
          const userAgent = req.headers['user-agent'];

          AuditLog.create({
            user_id: userId,
            action,
            entity,
            entity_id: req.params.id || (req.body && req.body.id ? String(req.body.id) : null),
            ip_address: ipAddress,
            user_agent: userAgent,
            details: { method: req.method, url: req.originalUrl },
          }).catch(err => console.error('[AUDIT ERROR]', err.message));
        } catch (e) {
          console.error('[AUDIT LOGGING FAILED]', e);
        }
      }
    };
    next();
  };
};

module.exports = logAudit;
