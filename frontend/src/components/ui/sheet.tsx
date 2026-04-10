import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

// 从右侧滑入的内容容器
interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  resizable?: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  showClose?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      className,
      children,
      resizable = false,
      defaultWidth = 720,
      minWidth = 480,
      maxWidth,
      showClose = true,
      style,
      ...props
    },
    ref
  ) => {
    const [width, setWidth] = React.useState(defaultWidth)

    React.useEffect(() => {
      setWidth(defaultWidth)
    }, [defaultWidth])

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const pointerId = event.pointerId
      const startX = event.clientX
      const startWidth = width
      const viewportWidth = window.innerWidth
      const resolvedMaxWidth = Math.max(
        minWidth,
        Math.min(maxWidth ?? Math.floor(viewportWidth * 0.9), viewportWidth - 48)
      )

      const nextTarget = event.currentTarget
      nextTarget.setPointerCapture(pointerId)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX
        const nextWidth = Math.min(
          resolvedMaxWidth,
          Math.max(minWidth, startWidth + delta)
        )
        setWidth(nextWidth)
      }

      const handlePointerUp = () => {
        nextTarget.releasePointerCapture(pointerId)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }, [maxWidth, minWidth, width])

    return (
      <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed inset-y-0 right-0 z-50 h-full border-l bg-background shadow-lg',
            'flex flex-col',
            'transition-transform duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            resizable ? 'max-w-none' : 'w-3/4 max-w-2xl',
            className
          )}
          style={resizable ? { ...style, width: `${width}px`, maxWidth: '100vw' } : { ...style, maxWidth: '100vw' }}
          {...props}
        >
          {resizable && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整面板宽度"
              className="absolute inset-y-0 left-0 w-3 cursor-col-resize group"
              onPointerDown={handlePointerDown}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/60" />
            </div>
          )}
          {children}
          {showClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </SheetPortal>
    )
  }
)
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 p-6 border-b', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 border-t mt-auto', className)} {...props} />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
