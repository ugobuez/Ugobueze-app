import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("Authenticate: Authorization header:", authHeader || "None");

  if (!authHeader) {
    console.log("Authenticate: No Authorization header provided");
    return res.status(401).json({
      error: "Access denied",
      message: "No Authorization header provided",
    });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  console.log("Authenticate: Extracted token:", token ? token.substring(0, 20) + "..." : "None");

  if (!token) {
    console.log("Authenticate: No token found in Authorization header");
    return res.status(401).json({
      error: "Access denied",
      message: "No token provided",
    });
  }

  try {
    console.log("Authenticate: Verifying with JWT_SECRET:", process.env.JWT_SECRET?.substring(0, 5) + "...");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Authenticate: Token decoded successfully:", {
      userId: decoded._id,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
      iat: decoded.iat,
      exp: decoded.exp,
    });
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Authenticate: JWT Verification Error:", {
      message: err.message,
      token: token.substring(0, 20) + "...",
      stack: err.stack,
    });
    return res.status(403).json({
      error: "Invalid token",
      message: "Token verification failed",
      details: process.env.NODE_ENV === "development" ? err.message : null,
    });
  }
}

export function authenticateAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    console.log("Authenticate: Non-admin user attempted admin action:", req.user?.email || "Unknown");
    return res.status(403).json({
      error: "Access denied",
      message: "Admin privileges required",
    });
  }
  console.log("Authenticate: Admin access granted for user:", req.user.email);
  next();
}