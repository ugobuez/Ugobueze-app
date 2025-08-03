// /middleware/auth.js
import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(400).json({ message: 'Invalid token.' });
  }
}

export function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admins only.' });
    }
    next();
  });
}
