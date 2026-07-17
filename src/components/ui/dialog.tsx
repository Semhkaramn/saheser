"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | undefined>(undefined);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogTrigger must be used within Dialog");

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => context.setOpen(true),
      });
    }

    return (
      <button ref={ref} onClick={() => context.setOpen(true)} {...props}>
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = "DialogTrigger";

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", children, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    if (!context) throw new Error("DialogContent must be used within Dialog");

    if (!context.open || !mounted) return null;

    const modalContent = (
      <>
        <div
          className="fixed inset-0 z-[9999] bg-black/80"
          onClick={() => context.setOpen(false)}
        />
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto"
          onClick={() => context.setOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              ref={ref}
              className={cn("relative w-full max-w-lg rounded-2xl border bg-[var(--user-card,#141D33)] border-[var(--user-card-border,#232E4A)] p-6 shadow-lg", className)}
              onClick={(e) => e.stopPropagation()}
              {...props}
            >
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 text-white z-10"
                onClick={() => context.setOpen(false)}
              >
                ✕
              </button>
              {children}
            </div>
          </div>
        </div>
      </>
    );

    return createPortal(modalContent, document.body);
  }
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-white", className)} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-[var(--user-text-muted,#64748B)]", className)} {...props} />
  )
);
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
