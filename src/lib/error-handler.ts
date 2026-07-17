/**
 * 🛡️ Centralized Error Handler
 * Tutarlı hata yönetimi ve logging için merkezi sistem
 */

import { NextResponse } from 'next/server'

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Predefined error types
 */
export const ErrorTypes = {
  UNAUTHORIZED: new AppError('Yetkisiz erişim', 401, ErrorSeverity.LOW),
  FORBIDDEN: new AppError('Bu işlem için yetkiniz yok', 403, ErrorSeverity.MEDIUM),
  NOT_FOUND: new AppError('Kayıt bulunamadı', 404, ErrorSeverity.LOW),
  VALIDATION_ERROR: new AppError('Geçersiz veri', 400, ErrorSeverity.LOW),
  INTERNAL_ERROR: new AppError('Sunucu hatası', 500, ErrorSeverity.HIGH),
  DATABASE_ERROR: new AppError('Veritabanı hatası', 500, ErrorSeverity.CRITICAL),
  RATE_LIMIT: new AppError('Çok fazla istek. Lütfen bekleyin.', 429, ErrorSeverity.MEDIUM),
} as const

/**
 * Error logger (genişletilebilir - Sentry, CloudWatch vb.)
 */
export function logError(
  error: Error | AppError,
  context?: Record<string, unknown>
): void {
  const isAppError = error instanceof AppError
  const severity = isAppError ? error.severity : ErrorSeverity.HIGH

  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    severity,
    timestamp: new Date().toISOString(),
    ...(isAppError && error.metadata ? { metadata: error.metadata } : {}),
    ...context
  }

  // Console logging (geliştirme için)
  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 Error:', errorData)
  }

  // Burada Sentry, CloudWatch vb. entegre edilebilir
  // if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
  //   Sentry.captureException(error, { contexts: { custom: errorData } })
  // }
}

/**
 * API route'lar için error response oluştur
 */
export function createErrorResponse(
  error: Error | AppError,
  context?: Record<string, unknown>
): NextResponse {
  // Error'u logla
  logError(error, context)

  // AppError ise statusCode ve metadata kullan
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && error.metadata
          ? { details: error.metadata }
          : {})
      },
      { status: error.statusCode }
    )
  }

  // Standart Error ise genel hata döndür
  return NextResponse.json(
    {
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Bir hata oluştu'
    },
    { status: 500 }
  )
}

/**
 * Try-catch wrapper for async route handlers
 */
export function withErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
  context?: Record<string, unknown>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        context
      )
    }
  }
}

/**
 * Validation helper
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined || value === '') {
    throw new AppError(
      `${fieldName} gereklidir`,
      400,
      ErrorSeverity.LOW,
      { field: fieldName }
    )
  }
  return value
}

/**
 * Validation helper for arrays
 */
export function validateArray<T>(
  value: T[],
  fieldName: string,
  minLength: number = 1
): T[] {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new AppError(
      `${fieldName} en az ${minLength} öğe içermelidir`,
      400,
      ErrorSeverity.LOW,
      { field: fieldName, minLength }
    )
  }
  return value
}

/**
 * Validation helper for numbers
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number
): number {
  const num = Number(value)

  if (Number.isNaN(num)) {
    throw new AppError(
      `${fieldName} geçerli bir sayı olmalıdır`,
      400,
      ErrorSeverity.LOW,
      { field: fieldName }
    )
  }

  if (min !== undefined && num < min) {
    throw new AppError(
      `${fieldName} en az ${min} olmalıdır`,
      400,
      ErrorSeverity.LOW,
      { field: fieldName, min, value: num }
    )
  }

  if (max !== undefined && num > max) {
    throw new AppError(
      `${fieldName} en fazla ${max} olmalıdır`,
      400,
      ErrorSeverity.LOW,
      { field: fieldName, max, value: num }
    )
  }

  return num
}
