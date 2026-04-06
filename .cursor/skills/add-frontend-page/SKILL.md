---
name: add-frontend-page
description: 在 Clash Config Store 前端新增一个完整页面，包括 API 模块、TanStack Query 数据获取、ShadcnUI 组件、路由注册和 i18n 翻译键。当用户要求新增前端页面、管理界面或数据展示页面时使用。
---

# 新增前端页面

## 步骤清单

- [ ] 1. 在 `src/api/` 添加对应 API 模块
- [ ] 2. 在 `src/types/index.ts` 添加 TypeScript 类型
- [ ] 3. 创建 `src/pages/FooPage.tsx`
- [ ] 4. 在 `src/App.tsx` 注册路由
- [ ] 5. 在 `src/components/layout/Sidebar.tsx` 添加导航项（如需）
- [ ] 6. 在 `src/i18n/locales/zh.ts` 和 `en.ts` 添加翻译键

---

## 1. API 模块（`src/api/foos.ts`）

```typescript
import { apiClient } from './client'
import type { Foo } from '@/types'

export const foosApi = {
  list: () => apiClient.get<{code:number; data: Foo[]}>('/foos').then(r => r.data.data),
  create: (data: Pick<Foo, 'name'>) => apiClient.post<{code:number; data: Foo}>('/foos', data).then(r => r.data.data),
  update: (id: number, data: Partial<Foo>) => apiClient.put<{code:number; data: Foo}>(`/foos/${id}`, data).then(r => r.data.data),
  delete: (id: number) => apiClient.delete(`/foos/${id}`),
}
```

---

## 2. 类型定义（`src/types/index.ts`）

```typescript
export interface Foo {
  id: number
  user_id: number
  name: string
  created_at: string
}
```

---

## 3. 页面组件（`src/pages/FooPage.tsx`）

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { foosApi } from '@/api/foos'
import type { Foo } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function FooPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFoo, setEditingFoo] = useState<Foo | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [name, setName] = useState('')

  const { data: foos = [], isLoading } = useQuery({
    queryKey: ['foos'],
    queryFn: foosApi.list,
  })

  const saveMutation = useMutation({
    mutationFn: (data: Pick<Foo, 'name'>) =>
      editingFoo ? foosApi.update(editingFoo.id, data) : foosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foos'] })
      toast.success(t('common.saveSuccess'))
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: foosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foos'] })
      toast.success(t('common.deleteSuccess'))
      setDeleteId(null)
    },
  })

  const openCreate = () => { setEditingFoo(null); setName(''); setDialogOpen(true) }
  const openEdit = (foo: Foo) => { setEditingFoo(foo); setName(foo.name); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditingFoo(null); setName('') }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('foo.title')}</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('common.create')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.createdAt')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foos.map(foo => (
                  <TableRow key={foo.id}>
                    <TableCell className="font-medium">{foo.name}</TableCell>
                    <TableCell>{new Date(foo.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(foo)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(foo.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingFoo ? t('common.edit') : t('common.create')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button onClick={() => saveMutation.mutate({ name })} disabled={!name || saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

---

## 4. 注册路由（`src/App.tsx`）

```tsx
import { FooPage } from '@/pages/FooPage'
// 在 Route path="/" 的子路由中添加：
<Route path="foos" element={<FooPage />} />
```

## 5. 侧边栏（`src/components/layout/Sidebar.tsx`）

```tsx
// 在 navItems 数组中添加：
{ path: '/foos', label: t('nav.foos'), icon: SomeIcon }
```

## 6. 翻译（`src/i18n/locales/zh.ts` 和 `en.ts`）

```typescript
// zh.ts
foo: {
  title: 'Foo 管理',
},
nav: {
  foos: 'Foo 管理',
}
```
