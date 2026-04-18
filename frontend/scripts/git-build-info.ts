import { execSync } from 'node:child_process'

function gitShort(ref: string): string {
  return execSync(`git rev-parse --short ${ref}`, { encoding: 'utf-8' }).trim()
}

/**
 * 生产构建用：最新 v* 标签 + 该标签指向提交的短 hash；
 * 无 v* 标签时：版本为 v0.0.0，短 hash **仅**来自当前 HEAD（与计划一致）。
 * 可通过环境变量 VITE_BUILD_LABEL 覆盖。
 */
export function computeProductionBuildLabel(): string {
  const fromEnv = process.env.VITE_BUILD_LABEL?.trim()
  if (fromEnv) return fromEnv

  try {
    const tagList = execSync('git tag -l "v*" --sort=-v:refname', {
      encoding: 'utf-8',
    }).trim()
    const tag = tagList.split('\n').filter(Boolean)[0]

    if (!tag) {
      const hash = gitShort('HEAD')
      return `v0.0.0-${hash || '0000000'}`
    }

    const version = tag.startsWith('v') ? tag : `v${tag}`
    const hash = gitShort(`${tag}^{commit}`)
    if (!hash) {
      const head = gitShort('HEAD')
      return `${version}-${head || '0000000'}`
    }
    return `${version}-${hash}`
  } catch {
    try {
      const hash = gitShort('HEAD')
      return `v0.0.0-${hash || '0000000'}`
    } catch {
      return 'v0.0.0-0000000'
    }
  }
}
