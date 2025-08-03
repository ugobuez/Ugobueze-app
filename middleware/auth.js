import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      error: "Access denied",
      message: "No token provided" 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return res.status(403).json({ 
      error: "Invalid token",
      message: "Token verification failed" 
    });
  }
}

export function authenticateAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ 
      error: "Access denied",
      message: "Admin privileges required" 
    });
  }
  next();
}