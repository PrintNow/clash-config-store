import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml'
import { EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin } from '@codemirror/view'
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
  onChange?: (value: string) => void
  placeholder?: string
  /** 编辑器最小高度，如 200px、300px */
  minHeight?: string
  /** 编辑器固定高度，设置后内容超出时滚动 */
  height?: string
  /** 编辑器最大高度，超出后滚动 */
  maxHeight?: string
  className?: string
  readOnly?: boolean
  highlightedLine?: number | null
}

/** YAML 语法高亮编辑区，主题随应用亮/暗/system 切换 */
export function YamlEditor({
  value,
  onChange,
  placeholder,
  minHeight = '200px',
  height,
  maxHeight,
  className,
  readOnly = false,
  highlightedLine = null,
}: YamlEditorProps) {
  const isDark = useResolvedDark()
  const extensions: Extension[] = [yaml()]

  if (highlightedLine && highlightedLine > 0) {
    const highlightTheme = EditorView.theme({
      '.cm-active-line-highlighted': {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
      },
    })
    const highlightPlugin = ViewPlugin.fromClass(class {
      decorations

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view)
      }

      update(update: { view: EditorView }) {
        this.decorations = this.buildDecorations(update.view)
      }

      buildDecorations(view: EditorView) {
        const line = view.state.doc.line(Math.min(highlightedLine, view.state.doc.lines))
        return Decoration.set([
          Decoration.line({ class: 'cm-active-line-highlighted' }).range(line.from),
        ])
      }
    }, {
      decorations: (value) => value.decorations,
    })

    extensions.push(highlightTheme, highlightPlugin)
  }

  if (readOnly) {
    extensions.push(
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ tabIndex: '0' }),
      keymap.of([
        {
          key: 'Mod-a',
          run: (view) => {
            view.dispatch({
              selection: { anchor: 0, head: view.state.doc.length },
            })
            return true
          },
        },
      ])
    )
  }

  return (
    <div className={cn('rounded-md border border-input overflow-hidden', className)}>
      <CodeMirror
        value={value}
        minHeight={minHeight}
        height={height}
        maxHeight={maxHeight}
        theme={isDark ? 'dark' : 'light'}
        extensions={extensions}
        onChange={onChange}
        placeholder={placeholder}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          autocompletion: false,
          foldGutter: !readOnly,
          highlightActiveLine: true,
        }}
        className={cn('text-sm font-mono', readOnly && '[&_.cm-content]:cursor-text')}
      />
    </div>
  )
}
