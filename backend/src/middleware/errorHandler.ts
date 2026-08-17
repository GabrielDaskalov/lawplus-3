import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Твърде голям payload (body-parser) → коректен 413, не 500
  if ((error as any)?.type === 'entity.too.large' || (error as any)?.status === 413) {
    res.status(413).json({
      success: false,
      error: 'Payload Too Large',
      message: 'Заявката е твърде голяма.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Очакваните откази (403 „няма покупка“, 422 „сгрешена форма“) са
  // нормална работа, не авария. Ако се пишат в дневника, при 1000 гости
  // на ден дневникът се пълни с „грешки“, които не са грешки, и истинският
  // проблем се губи. Записваме само 5xx.
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  if (statusCode >= 500) console.error('Error:', error);

  if (error instanceof AppError) {
    // Грешките по полета (валидация на форма) се пренасят до фронтенда,
    // за да се покажат до съответния вход, а не като общо съобщение.
    const fields = (error as AppError & { errors?: Record<string, string> }).errors;

    return res.status(error.statusCode).json({
      success: false,
      error: error.name,
      message: error.message,
      code: error.code,
      ...(fields ? { errors: fields } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
}
