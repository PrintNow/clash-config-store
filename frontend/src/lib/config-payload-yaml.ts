import { dump } from 'js-yaml'

/** 将配置快照格式化为可读 YAML（键排序便于与另一份快照对齐 diff） */
export function configPayloadToYaml(value: unknown): string {
  return dump(value, {
    indent: 2,
    lineWidth: 1024,
    noRefs: true,
    sortKeys: true,
  })
}
