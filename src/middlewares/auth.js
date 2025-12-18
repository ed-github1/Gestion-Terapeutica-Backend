import { verifyToken } from '../utils/auth.js';

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('🔐 Role check:', { 
      userRole: req.user?.role, 
      allowedRoles,
      userId: req.user?.id 
    });
    
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: role no definido'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: se requiere rol ${allowedRoles.join(' o ')}`
      });
    }

    next();
  };
};
