// Use AFTER the `protect` middleware (needs req.user already set).
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access only' });
  next();
};
