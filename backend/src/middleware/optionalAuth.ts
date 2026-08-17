/**
 * Разпознава потребителя, ако носи валиден токен, но НЕ отказва заявката,
 * ако няма такъв.
 *
 * Нужно е за витрината: каталогът и първите теми на всеки предмет се
 * виждат и от нерегистриран посетител, но ако е влязъл — вижда и това,
 * което е купил. Без такъв междинен слой всеки публичен маршрут трябва
 * да разчита токена ръчно.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';

interface TokenPayload {
  user_id: string;
  email: string;
  role: string;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.substring(7), config.jwt.secret) as TokenPayload;
  } catch {
    // Невалиден или изтекъл токен — третираме заявката като анонимна,
    // вместо да я отхвърляме. Защитените маршрути пазят сами.
    next();
    return;
  }

  req.user = {
    user_id: payload.user_id,
    email: payload.email,
    role: payload.role,
  };

  // Ролята в токена живее до изтичането му. За админските маршрути това
  // е рисково, затова admin твърдението се сверява с базата.
  if (payload.role !== 'admin') {
    next();
    return;
  }

  db.oneOrNone<{ role: string; is_active: boolean }>(
    'SELECT role, is_active FROM users WHERE id = $1',
    [payload.user_id],
  )
    .then((user) => {
      if (!user || !user.is_active || user.role !== 'admin') {
        // Свален или деактивиран админ пада до обикновен потребител.
        req.user!.role = user?.is_active ? user.role : 'none';
      }
      next();
    })
    .catch(() => {
      // При проблем с базата НЕ оставяме админските права да минат —
      // по-добре отказан достъп, отколкото повишени права при срив.
      req.user!.role = 'none';
      next();
    });
}
