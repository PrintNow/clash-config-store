import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Copy, RotateCcw } from 'lucide-react'
import { hostedRuleSetsApi } from '@/api/hosted-rule-sets'
import type { HostedRuleSet } from '@/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const emptyForm = {
  name: '',
  behavior: 'domain' as HostedRuleSet['behavior'],
  format: 'yaml' as HostedRuleSet['format'],
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
    queryKey: ['hosted-rule-sets'],
    queryFn: hostedRuleSetsApi.list,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<HostedRuleSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HostedRuleSet | null>(null)
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

  const openEdit = (it: HostedRuleSet) => {
    setEditingItem(it)
    setForm({
      name: it.name,
      behavior: it.behavior,
      format: it.format,
      content: '',
    })
    setDialogOpen(true)
    hostedRuleSetsApi
      .get(it.id)
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
        ? hostedRuleSetsApi.update(editingItem.id, payload)
        : hostedRuleSetsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-rule-sets'] })
      toast.success(t('common.success'))
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hostedRuleSetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-rule-sets'] })
      toast.success(t('common.success'))
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetTokensMutation = useMutation({
    mutationFn: hostedRuleSetsApi.resetTokens,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-rule-sets'] })
      toast.success(t('common.success'))
      setResetDialogOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const copyUrl = async (it: HostedRuleSet) => {
    try {
      if (!it.url) return
      await navigator.clipboard.writeText(it.url)
      toast.success(t('common.copied'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('hostedRuleSets.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={() => setResetDialogOpen(true)} disabled={items.length === 0}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('hostedRuleSets.resetAllTokens')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('hostedRuleSets.add')}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('ruleProviders.providerBehavior')}</TableHead>
              <TableHead>{t('ruleProviders.providerFormat')}</TableHead>
              <TableHead className="w-[260px]">{t('hostedRuleSets.url')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[140px]">{t('common.actions')}</TableHead>
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
                    {it.url ? (
                      <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs">{it.url}</code>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(it.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyUrl(it)} disabled={!it.url} aria-label={t('common.copy')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(it)} aria-label={t('common.edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(it)}
                        className="text-destructive hover:text-destructive"
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
                <Select
                  value={form.behavior}
                  onValueChange={(v) => setForm((f) => ({ ...f, behavior: v as HostedRuleSet['behavior'] }))}
                >
                  <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">{t('ruleProviders.behaviorDomain')}</SelectItem>
                    <SelectItem value="ipcidr">{t('ruleProviders.behaviorIpcidr')}</SelectItem>
                    <SelectItem value="classical">{t('ruleProviders.behaviorClassical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerFormat')}</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm((f) => ({ ...f, format: v as HostedRuleSet['format'] }))}
                >
                  <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yaml">{t('ruleProviders.formatYaml')}</SelectItem>
                    <SelectItem value="text">{t('ruleProviders.formatText')}</SelectItem>
                  </SelectContent>
                </Select>
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
