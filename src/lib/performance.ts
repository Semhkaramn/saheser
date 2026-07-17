/**
 * Performance optimization utilities
 */

import { ComponentType, lazy } from 'react'

/**
 * Enhanced lazy loading with retry logic
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000
): ReturnType<typeof lazy> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = (attemptsLeft: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (attemptsLeft === 1) {
              reject(error)
              return
            }
            setTimeout(() => {
              attemptImport(attemptsLeft - 1)
            }, interval)
          })
      }
      attemptImport(retries)
    })
  })
}

/**
 * Preload a component
 */
export function preloadComponent(componentImport: () => Promise<any>) {
  if (typeof window !== 'undefined') {
    componentImport()
  }
}

/**
 * Intersection Observer for lazy loading
 */
export function observeElement(
  element: Element,
  callback: () => void,
  options?: IntersectionObserverInit
) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    callback()
    return
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback()
        observer.disconnect()
      }
    })
  }, options)

  observer.observe(element)
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Request Idle Callback polyfill
 */
export function requestIdleCallbackPolyfill(callback: () => void, options?: { timeout?: number }) {
  if (typeof window === 'undefined') {
    return
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, options)
  } else {
    setTimeout(callback, 1)
  }
}

/**
 * Prefetch a route
 */
export function prefetchRoute(url: string) {
  if (typeof window === 'undefined') {
    return
  }

  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'document'
  document.head.appendChild(link)
}

/**
 * Check if device is low-end
 */
export function isLowEndDevice(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check for low memory
  const memory = (navigator as any).deviceMemory
  if (memory && memory < 4) {
    return true
  }

  // Check for slow connection
  const connection = (navigator as any).connection
  if (connection) {
    const slowConnectionTypes = ['slow-2g', '2g']
    if (slowConnectionTypes.includes(connection.effectiveType)) {
      return true
    }
  }

  // Check hardware concurrency (CPU cores)
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    return true
  }

  return false
}

/**
 * Optimize images based on device capabilities
 */
export function getOptimizedImageQuality(): number {
  if (isLowEndDevice()) {
    return 60
  }
  return 85
}
