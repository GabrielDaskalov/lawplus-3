import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import { AuthError } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        email: string;
        role: string;
      };
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('No authorization token provided');
  }

  const token = authHeader.substring(7);

  let payload: any;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new AuthError('Invalid or expired token');
  }

  req.user = {
    user_id: payload.user_id,
    email: payload.email,
    role: payload.role,
  };

  // ПОПРАВКА: ролята живее в токена до 24ч — свален админ оставаше админ.
  // Когато токенът ТВЪРДИ admin, проверяваме базата (1 бърза заявка,
  // само за админ токени — студентските не плащат нищо).
  if (payload.role === 'admin') {
    db.oneOrNone<{ role: string; is_active: boolean }>(
      'SELECT role, is_active FROM users WHERE id = $1',
      [payload.user_id]
    )
      .then((u) => {
        if (!u || !u.is_active || u.role !== 'admin') {
          req.user!.role = u && u.is_active ? u.role : 'none';
        }
        next();
      })
      .catch(() => next()); // при DB проблем не блокираме заявката
    return;
  }

  next();
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthError('User not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthError('Insufficient permissions', 'FORBIDDEN');
    }

    next();
  };
}

export function asyncHandler(
  // Promise<any>: позволява `return res.status(...).json(...)` в handler-ите —
  // това е стандартна Express практика и връщаната стойност не се използва.
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
