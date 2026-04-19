import * as React from 'react'
import { cn } from '@/lib/utils'

export type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  /** 与 Input 高度档位对齐，便于表单统一 */
  size?: 'sm' | 'default'
}

/**
 * 原生 &lt;select&gt;，样式与 Input / 旧 SelectTrigger 对齐，无 Portal 浮层。
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, size = 'default', children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-input bg-background ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive',
        size === 'default' && 'h-10 px-3 py-2 text-sm',
        size === 'sm' && 'h-8 px-2 py-1 text-xs',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
NativeSelect.displayName = 'NativeSelect'

const NativeSelectOption = React.forwardRef<
  HTMLOptionElement,
  React.ComponentProps<'option'>
>(({ className, ...props }, ref) => (
  <option ref={ref} className={cn(className)} {...props} />
))
NativeSelectOption.displayName = 'NativeSelectOption'

const NativeSelectOptGroup = React.forwardRef<
  HTMLOptGroupElement,
  React.ComponentProps<'optgroup'>
>(({ className, ...props }, ref) => (
  <optgroup ref={ref} className={cn(className)} {...props} />
))
NativeSelectOptGroup.displayName = 'NativeSelectOptGroup'

export { NativeSelect, NativeSelectOption, NativeSelectOptGroup }
