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
        // 仅保留适度左右留白；py 用 0 + leading 与高度对齐，避免挤占可视区域导致文字显示不全
        size === 'default' && 'h-10 py-0 pl-2.5 pr-8 text-sm leading-10',
        size === 'sm' && 'h-8 py-0 pl-2 pr-7 text-xs leading-8',
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
