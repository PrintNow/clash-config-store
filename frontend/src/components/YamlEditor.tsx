import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml'
import { useThemeStore } from '@/store/theme'
import { cn } from '@/lib/utils'

type AppTheme = 'light' | 'dark' | 'system'

/** 与 theme store 中 applyTheme 逻辑一致，用于 CodeMirror 亮暗主题 */
function resolveIsDark(theme: AppTheme): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function useResolvedDark(): boolean {
  const theme = useThemeStore((s) => s.theme)
  const [isDark, setIsDark] = useState(() => resolveIsDark(theme))

  useEffect(() => {
    setIsDark(resolveIsDark(theme))
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setIsDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return isDark
}

export interface YamlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 编辑器最小高度，如 200px、300px */
  minHeight?: string
  className?: string
}

/** YAML 语法高亮编辑区，主题随应用亮/暗/system 切换 */
export function YamlEditor({
  value,
  onChange,
  placeholder,
  minHeight = '200px',
  className,
}: YamlEditorProps) {
  const isDark = useResolvedDark()

  return (
    <div className={cn('rounded-md border border-input overflow-hidden', className)}>
      <CodeMirror
        value={value}
        minHeight={minHeight}
        theme={isDark ? 'dark' : 'light'}
        extensions={[yaml()]}
        onChange={onChange}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          autocompletion: false,
        }}
        className="text-sm font-mono"
      />
    </div>
  )
}
