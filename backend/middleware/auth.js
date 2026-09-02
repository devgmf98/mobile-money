import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/* Reads a token when one is offered, and shrugs when it is not.

   For a route that has to serve signed-out visitors but should still record who
   a signed-in one is — Contact Us being the case in point. A bad or expired
   token is treated as no token rather than an error: someone whose session
   lapsed while typing should still have their message sent, just without an
   account attached to it. */
export const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    } catch (error) {
      /* Deliberately ignored — see above. */
    }
  }
  next();
};

export const adminMiddleware = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/* A sub-admin runs the counter: top-ups, pushes, agent withdrawals, destination
   transfers and exchanges. What separates them from an admin is that they
   cannot change the rules everyone else operates under — commission tiers,
   destinations, currencies, exchange rates — or act on other people's
   accounts. Those stay on adminMiddleware.

   Guarding the routes rather than only hiding the pages: the sidebar is a
   convenience, and a hidden page is still one fetch away. */
export const staffMiddleware = (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'sub-admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const agentMiddleware = (req, res, next) => {
  if (!['agent', 'admin', 'sub-admin'].includes(req.userRole)) {
    return res.status(403).json({ message: 'Agent access required' });
  }
  next();
};

export const notSuspended = async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ message: 'No user id found' });
    const user = await User.findByPk(req.userId, {
      attributes: ['isSuspended']
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isSuspended) {
      return res.status(403).json({ message: 'Your account has been suspended' });
    }
    next();
  } catch (err) {
    console.error('notSuspended middleware error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
