const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Middleware to authenticate any logged-in user
const auth = async (req, res, next) => {
  try {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authorization.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_Secret);

    // Ensure the user exists AND that this token is still valid (not revoked)
    // const user = await User.findOne({
    //   _id: decoded._id,
    //   'tokens.token': token,
    // });
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Optional checks:
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    if (user.role === 'tutor' && !user.isApproved) {
      return res.status(403).json({
        message:
          'Account pending admin approval. Please wait for admin approval.',
      });
    }

    req.user = user;
    req.token = token; // useful if you want logout / revoke
    next();
  } catch (error) {
    res.status(401).json({ error: error.message || 'Unauthorized' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

const requireApproval = (req, res, next) => {
  if (req.user.role === 'tutor' && !req.user.isApproved) {
    return res.status(403).json({
      message: 'Account pending approval. Please wait for admin approval.',
    });
  }
  next();
};

module.exports = { auth, authorize, requireApproval };
