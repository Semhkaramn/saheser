'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'

interface AlertDialogContextValue {
  onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  onOpenChange: () => {}
})

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({ open = false, onOpenChange = () => {}, children }: AlertDialogProps) {
  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </AlertDialogContext.Provider>
  )
}

export function AlertDialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogContent className={cn('max-w-md', className)} {...props}>
      {children}
    </DialogContent>
  )
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <DialogHeader className={className} {...props} />
}

export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <DialogTitle className={className} {...props} />
}

interface AlertDialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  asChild?: boolean
}

export function AlertDialogDescription({ className, asChild, children, ...props }: AlertDialogDescriptionProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: cn((children as React.ReactElement<{ className?: string }>).props.className, className)
    })
  }
  return <DialogDescription className={className} {...props}>{children}</DialogDescription>
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: () => void
}

export function AlertDialogAction({ className, onClick, ...props }: AlertDialogActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function AlertDialogCancel({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(AlertDialogContext)

  return (
    <button
      onClick={(e) => {
        onClick?.(e)
        onOpenChange(false)
      }}
      className={cn(
        'mt-2 sm:mt-0 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
