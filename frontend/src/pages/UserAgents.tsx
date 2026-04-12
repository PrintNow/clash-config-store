import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { userAgentsApi } from '@/api/user-agents'
import type { UserAgent } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

// 常用 UA 预设
const UA_PRESETS = [
  { name: 'Mihomo', value: 'Mihomo/1.18.0' },
  { name: 'ClashX', value: 'ClashX/1.96.2.4' },
  { name: 'Clash', value: 'Clash/0.20.0' },
]

interface UAFormData {
  name: string
  value: string
}

export function UserAgents() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingUA, setEditingUA] = useState<UserAgent | null>(null)
  const [deletingUA, setDeletingUA] = useState<UserAgent | null>(null)
  const [formData, setFormData] = useState<UAFormData>({ name: '', value: '' })
  const [formErrors, setFormErrors] = useState<Partial<UAFormData>>({})

  const { data: userAgents = [], isLoading } = useQuery({
    queryKey: ['user-agents'],
    queryFn: userAgentsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: userAgentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agents'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UAFormData }) =>
      userAgentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agents'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: userAgentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agents'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
  })

  const openCreateDialog = () => {
    setEditingUA(null)
    setFormData({ name: '', value: '' })
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (ua: UserAgent) => {
    setEditingUA(ua)
    setFormData({ name: ua.name, value: ua.value })
    setFormErrors({})
    setDialogOpen(true)
  }

  const openDeleteDialog = (ua: UserAgent) => {
    setDeletingUA(ua)
    setDeleteDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Partial<UAFormData> = {}
    if (!formData.name.trim()) errors.name = t('common.required')
    if (!formData.value.trim()) errors.value = t('common.required')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    if (editingUA) {
      updateMutation.mutate({ id: editingUA.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('userAgents.title')}</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t('userAgents.addUA')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('userAgents.uaName')}</TableHead>
              <TableHead>{t('userAgents.uaValue')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[120px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                </TableRow>
              ))
            ) : userAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              userAgents.map((ua) => (
                <TableRow key={ua.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {ua.name}
                      {ua.is_preset && (
                        <Badge variant="secondary">{t('ruleProviders.presetBadge')}</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-xs truncate">{ua.value}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(ua.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {ua.is_preset ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(ua)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(ua)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingUA ? t('userAgents.editUA') : t('userAgents.addUA')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('userAgents.uaName')}</Label>
                <Input
                  placeholder={t('userAgents.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('userAgents.uaValue')}</Label>
                <Input
                  placeholder={t('userAgents.valuePlaceholder')}
                  value={formData.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                />
                {formErrors.value && (
                  <p className="text-sm text-destructive">{formErrors.value}</p>
                )}
                {/* 预设快选 */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground self-center">
                    {t('userAgents.presets')}:
                  </span>
                  {UA_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, value: preset.value }))
                      }
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('userAgents.deleteUA')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('userAgents.deleteConfirm')}
            {deletingUA && (
              <span className="font-medium text-foreground"> "{deletingUA.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingUA && deleteMutation.mutate(deletingUA.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.submitting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
