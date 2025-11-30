function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_CODE;
  const code = req.query.code || req.headers['x-admin-code'];
  if (!expected || code !== expected) {
    return res.status(403).json({ error: 'Forbidden: invalid admin code' });
  }
  next();
}

module.exports = { requireAdmin };
