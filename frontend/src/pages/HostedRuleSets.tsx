import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Copy, RotateCcw } from 'lucide-react'
import { ruleSetsApi } from '@/api/rule-sets'
import type { RuleSet } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Card, CardContent } from '@/components/ui/card'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'

const emptyForm = {
  name: '',
  behavior: 'domain' as RuleSet['behavior'],
  format: 'yaml' as RuleSet['format'],
  content: '',
}

const namePattern = /^[A-Za-z0-9_-]+$/

function BehaviorBadge({ behavior, t }: { behavior: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    domain: t('ruleProviders.behaviorDomain'),
    ipcidr: t('ruleProviders.behaviorIpcidr'),
    classical: t('ruleProviders.behaviorClassical'),
  }
  return <Badge variant="outline">{map[behavior] ?? behavior}</Badge>
}

function FormatBadge({ format, t }: { format: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    yaml: t('ruleProviders.formatYaml'),
    text: t('ruleProviders.formatText'),
  }
  return <Badge variant="outline">{map[format] ?? format}</Badge>
}

export function HostedRuleSets() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rule-sets', 'hosted'],
    queryFn: () => ruleSetsApi.list('hosted'),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RuleSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RuleSet | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingItem(null)
    setForm(emptyForm)
  }

  const openCreate = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (it: RuleSet) => {
    setEditingItem(it)
    setForm({
      name: it.name,
      behavior: it.behavior,
      format: it.format,
      content: '',
    })
    setDialogOpen(true)
    ruleSetsApi
      .get(it.id, 'hosted')
      .then((full) => {
        setForm((f) => ({ ...f, content: full.content ?? '' }))
      })
      .catch(() => {
        toast.error(t('common.error'))
      })
  }

  const nameError = useMemo(() => {
    if (!form.name.trim()) return t('common.required')
    if (!namePattern.test(form.name.trim())) return t('hostedRuleSets.nameInvalid')
    return ''
  }, [form.name, t])

  const isFormValid = useMemo(() => {
    return !nameError && form.content.trim() !== ''
  }, [form.content, nameError])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        behavior: form.behavior,
        format: form.format,
        content: form.content,
      }
      return editingItem
        ? ruleSetsApi.update(editingItem.id, { source_type: 'hosted', ...payload })
        : ruleSetsApi.create({ source_type: 'hosted', ...payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets', 'hosted'] })
      toast.success(t('common.success'))
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ruleSetsApi.delete(id, 'hosted'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets', 'hosted'] })
      toast.success(t('common.success'))
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetTokensMutation = useMutation({
    mutationFn: ruleSetsApi.resetTokens,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets', 'hosted'] })
      toast.success(t('common.success'))
      setResetDialogOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const copyUrl = async (it: RuleSet) => {
    try {
      if (!it.hrs_url) return
      await navigator.clipboard.writeText(it.hrs_url)
      toast.success(t('common.copied'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('hostedRuleSets.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={() => setResetDialogOpen(true)} disabled={items.length === 0}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('hostedRuleSets.resetAllTokens')}</span>
            <span className="sm:hidden">{t('common.reset') || 'Reset'}</span>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('hostedRuleSets.add')}
          </Button>
        </div>
      </div>

      {/* 桌面端表格 */}
      <div className="hidden sm:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('ruleProviders.providerBehavior')}</TableHead>
              <TableHead>{t('ruleProviders.providerFormat')}</TableHead>
              <TableHead className="w-[260px]">{t('hostedRuleSets.url')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[120px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell><BehaviorBadge behavior={it.behavior} t={t} /></TableCell>
                  <TableCell><FormatBadge format={it.format} t={t} /></TableCell>
                  <TableCell className="max-w-[260px]">
                    {it.hrs_url ? (
                      <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs">{it.hrs_url}</code>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(it.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyUrl(it)} disabled={!it.hrs_url} aria-label={t('common.copy')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(it)} aria-label={t('common.edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(it)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片列表 */}
      <div className="block sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          items.map((it) => (
            <Card key={it.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{it.name}</span>
                      <BehaviorBadge behavior={it.behavior} t={t} />
                      <FormatBadge format={it.format} t={t} />
                    </div>
                    {it.hrs_url && (
                      <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs">{it.hrs_url}</code>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(it.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyUrl(it)} disabled={!it.hrs_url}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(it)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(it)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[720px]">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (isFormValid && !saveMutation.isPending) saveMutation.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingItem ? t('hostedRuleSets.edit') : t('hostedRuleSets.add')}</DialogTitle>
              <DialogDescription>{t('hostedRuleSets.nameHint')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hrs-name">{t('common.name')}</Label>
                <Input
                  id="hrs-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my_ruleset"
                />
                {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerBehavior')}</Label>
                <NativeSelect
                  value={form.behavior}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, behavior: e.target.value as RuleSet['behavior'] }))
                  }
                >
                  <NativeSelectOption value="domain">{t('ruleProviders.behaviorDomain')}</NativeSelectOption>
                  <NativeSelectOption value="ipcidr">{t('ruleProviders.behaviorIpcidr')}</NativeSelectOption>
                  <NativeSelectOption value="classical">{t('ruleProviders.behaviorClassical')}</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerFormat')}</Label>
                <NativeSelect
                  value={form.format}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, format: e.target.value as RuleSet['format'] }))
                  }
                >
                  <NativeSelectOption value="yaml">{t('ruleProviders.formatYaml')}</NativeSelectOption>
                  <NativeSelectOption value="text">{t('ruleProviders.formatText')}</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hrs-content">{t('hostedRuleSets.content')}</Label>
              <Textarea
                id="hrs-content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="min-h-[260px] font-mono"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={!isFormValid || saveMutation.isPending}>
                {saveMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('hostedRuleSets.delete')}</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">{t('hostedRuleSets.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置 Token 确认弹窗 */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('hostedRuleSets.resetAllTokens')}</DialogTitle>
            <DialogDescription>{t('hostedRuleSets.resetAllTokensConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={resetTokensMutation.isPending} onClick={() => resetTokensMutation.mutate()}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
