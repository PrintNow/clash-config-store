import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Copy, RotateCcw, Link2, Link2Off } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'

const emptyForm = {
  name: '',
  behavior: 'domain' as HostedRuleSet['behavior'],
  format: 'yaml' as HostedRuleSet['format'],
  content: '',
  share_enabled: false,
}

function BehaviorBadge({ behavior, t }: { behavior: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    domain: t('ruleProviders.behaviorDomain'),
    ipcidr: t('ruleProviders.behaviorIpcidr'),
    classical: t('ruleProviders.behaviorClassical'),
  }
  const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
    domain: 'default',
    ipcidr: 'secondary',
    classical: 'outline',
  }
  return <Badge variant={variantMap[behavior] ?? 'outline'}>{map[behavior] ?? behavior}</Badge>
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
      share_enabled: it.share_enabled,
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

  const isFormValid = useMemo(() => {
    return form.name.trim() !== '' && form.content.trim() !== ''
  }, [form.content, form.name])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        behavior: form.behavior,
        format: form.format,
        content: form.content,
        share_enabled: form.share_enabled,
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

  const shareMutation = useMutation({
    mutationFn: async (p: { id: number; enabled: boolean }) => {
      if (p.enabled) return hostedRuleSetsApi.shareEnable(p.id)
      return hostedRuleSetsApi.shareDisable(p.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-rule-sets'] })
      toast.success(t('common.success'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetTokenMutation = useMutation({
    mutationFn: (id: number) => hostedRuleSetsApi.resetToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-rule-sets'] })
      toast.success(t('common.success'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const copyShareUrl = async (it: HostedRuleSet) => {
    try {
      if (!it.share_url) return
      await navigator.clipboard.writeText(it.share_url)
      toast.success(t('subscriptions.copySuccess'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('hostedRuleSets.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('hostedRuleSets.add')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('ruleProviders.providerBehavior')}</TableHead>
              <TableHead>{t('ruleProviders.providerFormat')}</TableHead>
              <TableHead>{t('hostedRuleSets.share')}</TableHead>
              <TableHead className="w-[200px]">{t('hostedRuleSets.shareUrl')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[160px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>
                    <BehaviorBadge behavior={it.behavior} t={t} />
                  </TableCell>
                  <TableCell>
                    <FormatBadge format={it.format} t={t} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={it.share_enabled ? 'secondary' : 'outline'}>
                      {it.share_enabled ? t('common.enabled') : t('common.disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {it.share_url ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded block truncate">
                        {it.share_url}
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(it.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyShareUrl(it)}
                        disabled={!it.share_url}
                        title={t('common.copy')}
                        aria-label={t('common.copy')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(it)}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => shareMutation.mutate({ id: it.id, enabled: !it.share_enabled })}
                        title={it.share_enabled ? t('common.disabled') : t('common.enabled')}
                        aria-label={it.share_enabled ? t('common.disabled') : t('common.enabled')}
                      >
                        {it.share_enabled ? (
                          <Link2Off className="h-4 w-4" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resetTokenMutation.mutate(it.id)}
                        disabled={!it.share_enabled}
                        title={t('hostedRuleSets.resetToken')}
                        aria-label={t('hostedRuleSets.resetToken')}
                      >
                        <RotateCcw className="h-4 w-4" />
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
              <DialogTitle>
                {editingItem ? t('hostedRuleSets.edit') : t('hostedRuleSets.add')}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hrs-name">{t('common.name')}</Label>
                <Input
                  id="hrs-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label>{t('hostedRuleSets.share')}</Label>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      {form.share_enabled ? t('common.enabled') : t('common.disabled')}
                    </span>
                    <Switch
                      checked={form.share_enabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, share_enabled: v }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerBehavior')}</Label>
                <Select
                  value={form.behavior}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, behavior: v as HostedRuleSet['behavior'] }))
                  }
                >
                  <SelectTrigger type="button">
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger type="button">
                    <SelectValue />
                  </SelectTrigger>
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
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
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
          <p className="text-sm text-muted-foreground py-2">{t('hostedRuleSets.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
