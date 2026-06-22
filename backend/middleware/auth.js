const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// BUG FIX #6: No auth middleware existed — all routes were unprotected
module.exports = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer'))
      token = req.headers.authorization.split(' ')[1];
    if (!token)
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user)
      return res.status(401).json({ success: false, message: 'User not found' });
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
