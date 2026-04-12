import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2, FileCode2 } from 'lucide-react'
import { configTemplatesApi } from '@/api/config-templates'
import type { ConfigTemplate } from '@/types'
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
import { Skeleton } from '@/components/ui/skeleton'

export function ConfigTemplates() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<ConfigTemplate | null>(null)

  // 新建表单状态
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [nameError, setNameError] = useState('')

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['config-templates'],
    queryFn: configTemplatesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: configTemplatesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['config-templates'] })
      toast.success(t('common.success'))
      setCreateDialogOpen(false)
      // 创建后直接跳转到详情页
      navigate(`/config-templates/${data.id}`)
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: configTemplatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-templates'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
      setDeletingTemplate(null)
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const handleOpenCreate = () => {
    setNewName('')
    setNewDescription('')
    setNameError('')
    setCreateDialogOpen(true)
  }

  const handleCreate = () => {
    if (!newName.trim()) {
      setNameError(t('common.required'))
      return
    }
    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    })
  }

  const openDeleteDialog = (template: ConfigTemplate) => {
    setDeletingTemplate(template)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 + 新建按钮 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('configTemplates.title')}</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('configTemplates.addTemplate')}
        </Button>
      </div>

      {/* 模板列表表格 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.description')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  {/* 名称，可点击跳转详情 */}
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline flex items-center gap-1.5"
                      onClick={() => navigate(`/config-templates/${template.id}`)}
                    >
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                      {template.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                    {template.description || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(template.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(template)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新建模板 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('configTemplates.addTemplate')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('configTemplates.templateName')}</Label>
                <Input
                  placeholder={t('configTemplates.namePlaceholder')}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setNameError('')
                  }}
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label>
                  {t('configTemplates.templateDescription')}
                  <span className="ml-1 text-xs text-muted-foreground">({t('common.optional')})</span>
                </Label>
                <Input
                  placeholder={t('configTemplates.descriptionPlaceholder')}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('common.submitting') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('configTemplates.deleteTemplate')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('configTemplates.deleteConfirm')}
            {deletingTemplate && (
              <span className="font-medium text-foreground"> "{deletingTemplate.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTemplate && deleteMutation.mutate(deletingTemplate.id)}
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
