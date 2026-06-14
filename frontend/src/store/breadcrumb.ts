import { create } from 'zustand'
import { useEffect } from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbStore {
  items: BreadcrumbItem[]
  setItems: (items: BreadcrumbItem[]) => void
  clear: () => void
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}))

/** 在组件挂载时注册面包屑，卸载时自动清除 */
export function useBreadcrumb(items: BreadcrumbItem[]) {
  const setItems = useBreadcrumbStore((s) => s.setItems)
  const clear = useBreadcrumbStore((s) => s.clear)

  useEffect(() => {
    setItems(items)
    return () => clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.label + i.href).join(',')])
}
