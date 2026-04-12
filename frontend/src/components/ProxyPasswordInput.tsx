import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ProxyPasswordInputProps = {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  id?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  /** 供浏览器与密码扩展区分字段，避免与站点登录冲突 */
  inputName?: string
  'aria-label'?: string
}

/**
 * 代理节点表单专用：非站点登录密码，弱化密码管理器抓取；支持显示/隐藏切换。
 */
export function ProxyPasswordInput({
  value,
  onChange,
  id: idProp,
  className,
  disabled,
  placeholder,
  inputName = 'clash-proxy-node-secret',
  'aria-label': ariaLabel,
}: ProxyPasswordInputProps) {
  const { t } = useTranslation()
  const reactId = useId()
  const id = idProp ?? reactId
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        name={inputName}
        className={cn('pr-10', className)}
        autoComplete="new-password"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-bwignore
        data-form-type="other"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
        aria-controls={id}
        disabled={disabled}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}
