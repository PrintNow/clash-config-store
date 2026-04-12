import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, MoreHorizontal, Copy, Download, Upload, FolderUp } from 'lucide-react'
import { customConfigsApi } from '@/api/custom-configs'
import type { CustomConfig, CustomConfigTransferPayload } from '@/types'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConfig, setDeletingConfig] = useState<CustomConfig | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')
  const [importText, setImportText] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const cloneMutation = useMutation({
    mutationFn: customConfigsApi.clone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('customConfigs.cloneSuccess'))
    },
  })

  const importMutation = useMutation({
    mutationFn: customConfigsApi.import,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('customConfigs.importSuccess'))
      setImportDialogOpen(false)
      setImportText('')
      setImportFileName('')
      setImportError('')
      navigate(`/custom-configs/${data.id}`)
    },
  })

  const handleCreate = () => {
    if (!newName.trim()) {
      setNameError(t('common.required'))
      return
    }
    createMutation.mutate({ name: newName, proxies: [], proxy_groups: [], rules: [], rule_provider_ids: [] })
  }

  const openDeleteDialog = (config: CustomConfig) => {
    setDeletingConfig(config)
    setDeleteDialogOpen(true)
  }

  const parseImportPayload = (raw: string): CustomConfigTransferPayload | null => {
    try {
      const parsed = JSON.parse(raw) as Partial<CustomConfigTransferPayload>
      if (!parsed || typeof parsed !== 'object') {
        setImportError(t('customConfigs.importInvalidFormat'))
        return null
      }
      if (typeof parsed.name !== 'string') {
        setImportError(t('customConfigs.importInvalidFormat'))
        return null
      }
      if (!Array.isArray(parsed.proxies) || !Array.isArray(parsed.proxy_groups) || !Array.isArray(parsed.rules) || !Array.isArray(parsed.rule_provider_ids)) {
        setImportError(t('customConfigs.importInvalidFormat'))
        return null
      }
      setImportError('')
      return {
        name: parsed.name,
        proxies: parsed.proxies,
        proxy_groups: parsed.proxy_groups,
        rules: parsed.rules,
        rule_provider_ids: parsed.rule_provider_ids,
      }
    } catch {
      setImportError(t('customConfigs.importInvalidJson'))
      return null
    }
  }

  const handleImportSubmit = () => {
    const payload = parseImportPayload(importText)
    if (!payload) return
    importMutation.mutate(payload)
  }

  const handleImportFileChange = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    setImportText(text)
    setImportFileName(file.name)
    parseImportPayload(text)
  }

  const handleExport = async (config: CustomConfig) => {
    try {
      const blob = await customConfigsApi.export(config.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeName = config.name.trim().replace(/[^\w-]+/g, '-')
      link.href = url
      link.download = `custom-config-${safeName || 'config'}-${config.id}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('customConfigs.exportSuccess'))
    } catch {
      // axios interceptor 已处理 toast
    }
  }

  const formatDateTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  const formatRelativeTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0) return t('customConfigs.relativeJustNow')
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 60) return t('customConfigs.relativeJustNow')
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return t('customConfigs.relativeMinutesAgo', { count: diffMinutes })
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t('customConfigs.relativeHoursAgo', { count: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    return t('customConfigs.relativeDaysAgo', { count: diffDays })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('customConfigs.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setImportDialogOpen(true)
              setImportText('')
              setImportFileName('')
              setImportError('')
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t('customConfigs.importConfig')}
          </Button>
          <Button onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('customConfigs.addConfig')}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead>{t('customConfigs.updatedAt')}</TableHead>
              <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="mt-2 h-4 w-44" />
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                </TableRow>
              ))
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow
                  key={config.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/custom-configs/${config.id}`)}
                >
                  <TableCell>
                    <div className="font-medium text-primary flex items-center gap-1">
                      {config.name}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('customConfigs.statsSummary', {
                        proxies: config.proxies.length,
                        groups: config.proxy_groups.length,
                        rules: config.rules.length,
                        ruleSets: config.rule_provider_ids.length,
                      })}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(config.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{formatDateTime(config.updated_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(config.updated_at)}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/custom-configs/${config.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t('common.detail')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => cloneMutation.mutate(config.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {t('customConfigs.cloneConfig')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(config)}>
                          <Download className="mr-2 h-4 w-4" />
                          {t('customConfigs.exportConfig')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(config)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
          >
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleImportSubmit()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('customConfigs.importConfig')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('customConfigs.importUploadFile')}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => handleImportFileChange(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FolderUp className="mr-2 h-4 w-4" />
                  {importFileName || t('customConfigs.importChooseFile')}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>{t('customConfigs.importPasteJson')}</Label>
                <textarea
                  className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value)
                    if (importError) setImportError('')
                  }}
                  placeholder={`{\n  "name": "example",\n  "proxies": [],\n  "proxy_groups": [],\n  "rules": [],\n  "rule_provider_ids": []\n}`}
                />
              </div>
              {importError && <p className="text-sm text-destructive">{importError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={importMutation.isPending}>
                {importMutation.isPending ? t('common.submitting') : t('customConfigs.importConfig')}
              </Button>
            </DialogFooter>
          </form>
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
