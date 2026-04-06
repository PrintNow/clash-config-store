import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { customConfigsApi } from '@/api/custom-configs'
import type { CustomConfig } from '@/types'
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

export function CustomConfigs() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConfig, setDeletingConfig] = useState<CustomConfig | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['custom-configs'],
    queryFn: customConfigsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: customConfigsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('common.success'))
      setCreateDialogOpen(false)
      // 创建后直接跳转到详情页
      navigate(`/custom-configs/${data.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: customConfigsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
  })

  const handleCreate = () => {
    if (!newName.trim()) {
      setNameError(t('common.required'))
      return
    }
    createMutation.mutate({ name: newName, proxies: '', proxy_groups: '', rules: '' })
  }

  const openDeleteDialog = (config: CustomConfig) => {
    setDeletingConfig(config)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('customConfigs.title')}</h1>
        <Button onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          {t('customConfigs.addConfig')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                </TableRow>
              ))
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                      onClick={() => navigate(`/custom-configs/${config.id}`)}
                    >
                      {config.name}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(config.id).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(config)}
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

      {/* 创建规则集 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('customConfigs.addConfig')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('customConfigs.configName')}</Label>
              <Input
                placeholder={t('customConfigs.namePlaceholder')}
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNameError('') }}
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.submitting') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('customConfigs.deleteConfig')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('customConfigs.deleteConfirm')}
            {deletingConfig && (
              <span className="font-medium text-foreground"> "{deletingConfig.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingConfig && deleteMutation.mutate(deletingConfig.id)}
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
