import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'diwali_campaign_jwt_session_secret_key_2026';

export interface AuthUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'CASHIER';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (err) {
    return null;
  }
}

export function requireAuth(roles: ('ADMIN' | 'CASHIER')[] = ['ADMIN', 'CASHIER']) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this role' });
    }

    req.user = user;
    next();
  };
}
