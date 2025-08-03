import jwt from 'jsonwebtoken';

const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
};

const authenticateToken = (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = decoded;  // Attach the decoded user information
        next();
    });amntyyyyghty 
};
 const authenticateAdmin = (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
  
    if (!token) return res.status(403).json({ message: "Access denied. No token provided." });
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.isAdmin) {
        return res.status(403).json({ message: "Access denied: Admins only" });
      }
  
      req.user = decoded;
      next();
    } catch (ex) {
      res.status(403).json({ message: "Invalid token" });
    }
  };

export { authenticateToken, authenticateAdmin };
