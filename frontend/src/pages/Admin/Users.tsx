import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, ShieldCheck, User } from 'lucide-react'
import { adminApi, type AdminUser } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth'

type EditForm = {
  name: string
  email: string
  is_admin: boolean
  password: string
}

type CreateForm = {
  name: string
  email: string
  password: string
  is_admin: boolean
}

export function AdminUsers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    email: '',
    is_admin: false,
    password: '',
  })
  const [editErrors, setEditErrors] = useState<Partial<EditForm>>({})

  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '',
    email: '',
    password: '',
    is_admin: false,
  })
  const [createErrors, setCreateErrors] = useState<Partial<CreateForm>>({})

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EditForm> }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('common.success'))
      setEditingUser(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.userDeleted'))
      setDeletingUser(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.userCreated'))
      setCreateOpen(false)
      setCreateForm({ name: '', email: '', password: '', is_admin: false })
    },
  })

  const openEdit = (user: AdminUser) => {
    setEditingUser(user)
    setEditForm({ name: user.name, email: user.email, is_admin: user.is_admin, password: '' })
    setEditErrors({})
  }

  const validateEdit = () => {
    const errors: Partial<EditForm> = {}
    if (!editForm.name.trim()) errors.name = t('common.required')
    if (!editForm.email.trim()) errors.email = t('common.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email))
      errors.email = t('auth.emailInvalid')
    if (editForm.password && editForm.password.length < 6)
      errors.password = t('auth.passwordMinLength', { min: 6 })
    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEditSubmit = () => {
    if (!editingUser || !validateEdit()) return
    const payload: Parameters<typeof adminApi.updateUser>[1] = {
      name: editForm.name,
      email: editForm.email,
      is_admin: editForm.is_admin,
    }
    if (editForm.password) payload.password = editForm.password
    updateMutation.mutate({ id: editingUser.id, data: payload })
  }

  const validateCreate = () => {
    const errors: Partial<CreateForm> = {}
    if (!createForm.name.trim()) errors.name = t('common.required')
    if (!createForm.email.trim()) errors.email = t('common.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email))
      errors.email = t('auth.emailInvalid')
    if (!createForm.password) errors.password = t('common.required')
    else if (createForm.password.length < 6) errors.password = t('auth.passwordMinLength', { min: 6 })
    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateSubmit = () => {
    if (!validateCreate()) return
    createMutation.mutate(createForm)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('admin.userManagement')}</h1>
        <Button size="sm" onClick={() => { setCreateOpen(true); setCreateErrors({}) }}>
          <Plus className="h-4 w-4 mr-1" />
          {t('admin.createUser')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t('admin.userInfo')}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t('admin.role')}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t('admin.resources')}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t('common.createdAt')}
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {user.is_admin ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        {t('admin.admin')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <User className="h-3 w-3" />
                        {t('admin.normalUser')}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{t('admin.providers')}: {user.provider_count}</span>
                      <span>{t('admin.subscriptions')}: {user.subscription_count}</span>
                      <span>{t('admin.customConfigs')}: {user.custom_config_count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={user.id === currentUser?.id}
                        onClick={() => setDeletingUser(user)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 编辑用户弹窗 */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">{t('settings.username')}</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
              />
              {editErrors.name && (
                <p className="text-xs text-destructive">{editErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('settings.email')}</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="h-8 text-sm"
              />
              {editErrors.email && (
                <p className="text-xs text-destructive">{editErrors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">
                {t('settings.newPassword')}
                <span className="text-muted-foreground ml-1">({t('common.optional')})</span>
              </Label>
              <Input
                type="password"
                value={editForm.password}
                placeholder={t('admin.passwordPlaceholder')}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                className="h-8 text-sm"
              />
              {editErrors.password && (
                <p className="text-xs text-destructive">{editErrors.password}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="edit-is-admin"
                checked={editForm.is_admin}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, is_admin: checked }))}
              />
              <Label htmlFor="edit-is-admin" className="text-sm cursor-pointer">
                {t('admin.isAdmin')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建用户弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.createUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">{t('settings.username')}</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
              />
              {createErrors.name && (
                <p className="text-xs text-destructive">{createErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('settings.email')}</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="h-8 text-sm"
              />
              {createErrors.email && (
                <p className="text-xs text-destructive">{createErrors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('auth.password')}</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="h-8 text-sm"
              />
              {createErrors.password && (
                <p className="text-xs text-destructive">{createErrors.password}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="create-is-admin"
                checked={createForm.is_admin}
                onCheckedChange={(checked) => setCreateForm((f) => ({ ...f, is_admin: checked }))}
              />
              <Label htmlFor="create-is-admin" className="text-sm cursor-pointer">
                {t('admin.isAdmin')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.submitting') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.deleteUserTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('admin.deleteUserConfirm', { name: deletingUser?.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeletingUser(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
