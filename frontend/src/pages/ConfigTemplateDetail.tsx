import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Save, FileCode2 } from 'lucide-react'
import { configTemplatesApi } from '@/api/config-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

export function ConfigTemplateDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const templateId = Number(id)

  // 编辑状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [nameError, setNameError] = useState('')

  const { data: template, isLoading } = useQuery({
    queryKey: ['config-templates', templateId],
    queryFn: () => configTemplatesApi.get(templateId),
    enabled: !isNaN(templateId),
  })

  // 数据加载后初始化表单
  useEffect(() => {
    if (template) {
      setName(template.name)
      setDescription(template.description ?? '')
      setContent(template.content ?? '')
    }
  }, [template])

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; content?: string }) =>
      configTemplatesApi.update(templateId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['config-templates', templateId], updated)
      queryClient.invalidateQueries({ queryKey: ['config-templates'] })
      toast.success(t('configTemplates.saveSuccess'))
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(t('common.required'))
      return
    }
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      content,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-20 ml-auto" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <FileCode2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t('common.noData')}</p>
        <Button variant="outline" onClick={() => navigate('/config-templates')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏：返回 + 名称 + 描述 + 保存 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/config-templates')}
          className="shrink-0 self-center"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('common.back')}
        </Button>

        {/* 名称输入 */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">
            {t('configTemplates.templateName')}
          </Label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError('')
            }}
            className="h-9"
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        {/* 描述输入 */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">
            {t('configTemplates.templateDescription')}
            <span className="ml-1">({t('common.optional')})</span>
          </Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('configTemplates.descriptionPlaceholder')}
            className="h-9"
          />
        </div>

        {/* 保存按钮 */}
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="shrink-0 self-end"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      {/* YAML 内容编辑区域 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('configTemplates.templateContent')}</Label>
        </div>

        {/* 内容提示 */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('configTemplates.contentHint')}
        </p>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('configTemplates.contentPlaceholder')}
          className="font-mono text-sm h-96 min-h-96 resize-y"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
