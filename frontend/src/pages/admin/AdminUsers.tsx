import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { User } from '@/types'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PAGE_SIZE = 20

export function AdminUsers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isRoot = currentUser?.role === 'root'
  const isAdmin = currentUser?.role === 'admin'

  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user' as 'root' | 'admin' | 'user',
  })
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminApi.listUsers(page, PAGE_SIZE),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-profile-sync'] })
      toast.success(t('admin.roleUpdateSuccess'))
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const role = isRoot
        ? createForm.role
        : createForm.role === 'root'
          ? 'user'
          : createForm.role
      return adminApi.createUser({
        email: createForm.email.trim(),
        name: createForm.name.trim() || undefined,
        password: createForm.password,
        role,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.createUserSuccess'))
      setCreateOpen(false)
      setCreateForm({ email: '', name: '', password: '', role: 'user' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editUser) return Promise.reject()
      const p: { name?: string; email?: string; password?: string } = {}
      if (editForm.name !== editUser.name) p.name = editForm.name
      if (editForm.email !== editUser.email) p.email = editForm.email
      if (editForm.password) p.password = editForm.password
      if (Object.keys(p).length === 0) {
        return Promise.reject(new Error('no changes'))
      }
      return adminApi.updateUser(editUser.id, p)
    },
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      if (u.id === currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: ['user-profile-sync'] })
      }
      toast.success(t('admin.updateUserSuccess'))
      setEditUser(null)
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'no changes') {
        toast.error(t('admin.noChanges'))
        return
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.deleteUserSuccess'))
      setDeleteUser(null)
    },
  })

  const roleLabel = (r: string | undefined) => {
    switch (r) {
      case 'root':
        return t('admin.roleRoot')
      case 'admin':
        return t('admin.roleAdmin')
      default:
        return t('admin.roleUser')
    }
  }

  const roleVariant = (r: string | undefined): 'default' | 'secondary' | 'outline' => {
    if (r === 'root') return 'default'
    if (r === 'admin') return 'secondary'
    return 'outline'
  }

  const onRoleChange = (u: User, newRole: string) => {
    if (u.role === 'root' || newRole === u.role) return
    roleMutation.mutate({ id: u.id, role: newRole })
  }

  const openEdit = (u: User) => {
    setEditForm({ name: u.name, email: u.email, password: '' })
    setEditUser(u)
  }

  const canEdit = (u: User) => u.role !== 'root' || isRoot
  const canDelete = (u: User) => {
    if (u.id === currentUser?.id) return false
    if (u.role === 'root') return false
    if (isRoot) return true
    if (isAdmin && u.role === 'user') return true
    return false
  }

  const showAdd = isRoot || isAdmin

  const openCreate = () => {
    setCreateForm({ email: '', name: '', password: '', role: 'user' })
    setCreateOpen(true)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.usersTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('admin.usersSubtitle')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t('admin.usersTitle')}</CardTitle>
            <CardDescription>{t('admin.usersSubtitle')}</CardDescription>
          </div>
          {showAdd && (
            <Button type="button" onClick={openCreate} size="sm">
              <Plus data-icon="inline-start" className="h-4 w-4" />
              {t('admin.addUser')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('auth.email')}</TableHead>
                    <TableHead>{t('auth.username')}</TableHead>
                    <TableHead>{t('admin.role')}</TableHead>
                    <TableHead>{t('common.createdAt')}</TableHead>
                    <TableHead className="w-[120px]">{t('admin.userActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        {isRoot && u.role !== 'root' ? (
                          <NativeSelect
                            size="sm"
                            className="max-w-[140px]"
                            value={u.role ?? 'user'}
                            disabled={roleMutation.isPending}
                            onChange={(e) => onRoleChange(u, e.target.value)}
                            aria-label={t('admin.role')}
                          >
                            <NativeSelectOption value="admin">{t('admin.roleAdmin')}</NativeSelectOption>
                            <NativeSelectOption value="user">{t('admin.roleUser')}</NativeSelectOption>
                          </NativeSelect>
                        ) : (
                          <Badge variant={roleVariant(u.role)}>{roleLabel(u.role)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {canEdit(u) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(u)}
                              aria-label={t('admin.editUser')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete(u) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteUser(u)}
                              className="text-destructive hover:text-destructive"
                              aria-label={t('admin.deleteUser')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {t('admin.totalUsers', { total: data?.total ?? 0 })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('common.prev')}
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {t('common.page', { page })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.createUser')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-email">{t('auth.email')}</Label>
              <Input
                id="c-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-name">{t('auth.username')}</Label>
              <Input
                id="c-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('auth.usernameOptionalPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-pw">{t('auth.password')}</Label>
              <Input
                id="c-pw"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-role">{t('admin.role')}</Label>
              <NativeSelect
                id="c-role"
                value={createForm.role}
                onChange={(e) => {
                  const v = e.target.value as 'root' | 'admin' | 'user'
                  setCreateForm((f) => ({ ...f, role: v }))
                }}
              >
                {isRoot && <NativeSelectOption value="root">{t('admin.roleRoot')}</NativeSelectOption>}
                <NativeSelectOption value="admin">{t('admin.roleAdmin')}</NativeSelectOption>
                <NativeSelectOption value="user">{t('admin.roleUser')}</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!createForm.email.trim()) {
                  toast.error(t('auth.emailRequired'))
                  return
                }
                if (createForm.password.length < 6) {
                  toast.error(t('auth.passwordMinLength', { min: 6 }))
                  return
                }
                createMutation.mutate()
              }}
            >
              {createMutation.isPending ? t('common.submitting') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.editUser')}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="e-name">{t('auth.username')}</Label>
                  <Input
                    id="e-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="e-email">{t('auth.email')}</Label>
                  <Input
                    id="e-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="e-pw">{t('auth.password')}</Label>
                  <Input
                    id="e-pw"
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={t('admin.newPasswordOptional')}
                    autoComplete="new-password"
                  />
                  <p className="text-muted-foreground text-xs">{t('admin.passwordMin')}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  {updateMutation.isPending ? t('common.saving') : t('admin.saveUser')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.deleteUser')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('admin.deleteUserConfirm')}</p>
          {deleteUser && <p className="font-mono text-sm">{deleteUser.email}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteUser(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending ? t('common.submitting') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
