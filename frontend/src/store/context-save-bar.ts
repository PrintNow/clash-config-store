import { useEffect } from 'react'
import { create } from 'zustand'

/** 可选扩展按钮图标（由 ContextSaveBar 统一渲染） */
export type ContextSaveBarExtraActionIcon = 'git-compare'

/** 顶栏保存条「放弃」左侧的自定义操作，由页面注入 */
export type ContextSaveBarExtraAction = {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: ContextSaveBarExtraActionIcon
}

/** 当前页面注册到顶栏「Context Save Bar」的快照（同时仅允许一个注册方） */
export type ContextSaveBarRegistration = {
  dirty: boolean
  saving: boolean
  saveDisabled: boolean
  onSave: () => void
  onDiscard: () => void
  /** 显示在「放弃」左侧的额外按钮，默认无 */
  extraActions?: ContextSaveBarExtraAction[]
}

type ContextSaveBarState = {
  registration: ContextSaveBarRegistration | null
  setRegistration: (r: ContextSaveBarRegistration | null) => void
}

export const useContextSaveBarStore = create<ContextSaveBarState>((set) => ({
  registration: null,
  setRegistration: (r) => set({ registration: r }),
}))

export type RegisterContextSaveBarOptions = {
  /** 为 false 时不注册并清空（如数据未就绪） */
  enabled?: boolean
  dirty: boolean
  saving: boolean
  saveDisabled: boolean
  onSave: () => void
  onDiscard: () => void
  extraActions?: ContextSaveBarExtraAction[]
}

/**
 * 向全局顶栏注册保存条；卸载或 enabled 变为 false 时自动注销。
 */
export function useRegisterContextSaveBar(options: RegisterContextSaveBarOptions) {
  const {
    enabled = true,
    dirty,
    saving,
    saveDisabled,
    onSave,
    onDiscard,
    extraActions,
  } = options
  const setRegistration = useContextSaveBarStore((s) => s.setRegistration)

  // 依赖变化时直接覆盖 registration，不在 cleanup 里先置 null（否则每次 deps 变都会闪成无注册，顶栏消失）
  useEffect(() => {
    if (!enabled) {
      setRegistration(null)
      return
    }
    setRegistration({
      dirty,
      saving,
      saveDisabled,
      onSave,
      onDiscard,
      ...(extraActions?.length ? { extraActions } : {}),
    })
  }, [
    enabled,
    dirty,
    saving,
    saveDisabled,
    onSave,
    onDiscard,
    extraActions,
    setRegistration,
  ])

  // 仅页面卸载时注销，避免与其它 effect 的「先清空再写入」竞态
  useEffect(() => {
    return () => setRegistration(null)
  }, [setRegistration])
}
