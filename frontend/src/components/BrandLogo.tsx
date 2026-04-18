import { cn } from '@/lib/utils'

type BrandLogoProps = {
  className?: string
  title?: string
}

/**
 * 品牌标：盾牌（安全托管 / 统一管理）+ 内嵌清单线（订阅与配置条目）
 * 结构保持极简，仅盾形路径 + 一条双划线路径。
 */
export function BrandLogo({ className, title = 'Clash Config Store' }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={cn('select-none', className)}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      <rect width="48" height="48" rx="12" className="fill-primary" />

      {/* 盾牌：保护与集中管理 */}
      <path
        className="fill-primary-foreground"
        d="M 24 7.5 L 37.2 13.6 L 37.2 26.8 C 37.2 33.6 31.8 39.4 24 42.2 C 16.2 39.4 10.8 33.6 10.8 26.8 L 10.8 13.6 Z"
      />

      {/* 订阅 / 配置清单（两行，上长下短） */}
      <path
        d="M 16.2 22.2 H 31.8 M 16.2 28.8 H 25.2"
        className="stroke-primary/50"
        strokeWidth={2.65}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
