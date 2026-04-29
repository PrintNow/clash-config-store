export interface RuleTypeMeta {
  payloadLabel: string
  payloadPlaceholder: string
  hintKey: string
  category: 'all' | 'domain' | 'rule-set' | 'geoip' | 'match'
}

const RULE_TYPE_META: Record<string, RuleTypeMeta> = {
  DOMAIN: {
    payloadLabel: 'Domain',
    payloadPlaceholder: 'github.com',
    hintKey: 'customConfigs.ruleTypeHint.exactDomain',
    category: 'domain',
  },
  'DOMAIN-SUFFIX': {
    payloadLabel: 'Suffix',
    payloadPlaceholder: 'github.com',
    hintKey: 'customConfigs.ruleTypeHint.suffixDomain',
    category: 'domain',
  },
  'DOMAIN-KEYWORD': {
    payloadLabel: 'Keyword',
    payloadPlaceholder: 'github',
    hintKey: 'customConfigs.ruleTypeHint.keywordDomain',
    category: 'domain',
  },
  'DOMAIN-REGEX': {
    payloadLabel: 'Regex',
    payloadPlaceholder: '^.*github.*$',
    hintKey: 'customConfigs.ruleTypeHint.regexDomain',
    category: 'domain',
  },
  'DOMAIN-WILDCARD': {
    payloadLabel: 'Wildcard',
    payloadPlaceholder: '*.github.com',
    hintKey: 'customConfigs.ruleTypeHint.wildcardDomain',
    category: 'domain',
  },
  GEOSITE: {
    payloadLabel: 'GeoSite',
    payloadPlaceholder: 'github',
    hintKey: 'customConfigs.ruleTypeHint.geoSite',
    category: 'domain',
  },
  GEOIP: {
    payloadLabel: 'Country Code',
    payloadPlaceholder: 'CN',
    hintKey: 'customConfigs.ruleTypeHint.geoIp',
    category: 'geoip',
  },
  'SRC-GEOIP': {
    payloadLabel: 'Country Code',
    payloadPlaceholder: 'CN',
    hintKey: 'customConfigs.ruleTypeHint.srcGeoIp',
    category: 'geoip',
  },
  'IP-ASN': {
    payloadLabel: 'ASN',
    payloadPlaceholder: 'AS13335',
    hintKey: 'customConfigs.ruleTypeHint.ipAsn',
    category: 'all',
  },
  'SRC-IP-ASN': {
    payloadLabel: 'ASN',
    payloadPlaceholder: 'AS13335',
    hintKey: 'customConfigs.ruleTypeHint.ipAsn',
    category: 'all',
  },
  'IP-CIDR': {
    payloadLabel: 'CIDR',
    payloadPlaceholder: '1.1.1.0/24',
    hintKey: 'customConfigs.ruleTypeHint.ipCidr',
    category: 'all',
  },
  'IP-CIDR6': {
    payloadLabel: 'CIDR6',
    payloadPlaceholder: '240c::/32',
    hintKey: 'customConfigs.ruleTypeHint.ipCidr6',
    category: 'all',
  },
  'SRC-IP-CIDR': {
    payloadLabel: 'CIDR',
    payloadPlaceholder: '10.0.0.0/8',
    hintKey: 'customConfigs.ruleTypeHint.ipCidr',
    category: 'all',
  },
  'IP-SUFFIX': {
    payloadLabel: 'Suffix',
    payloadPlaceholder: '24',
    hintKey: 'customConfigs.ruleTypeHint.ipSuffix',
    category: 'all',
  },
  'SRC-IP-SUFFIX': {
    payloadLabel: 'Suffix',
    payloadPlaceholder: '24',
    hintKey: 'customConfigs.ruleTypeHint.ipSuffix',
    category: 'all',
  },
  'SRC-PORT': {
    payloadLabel: 'Port',
    payloadPlaceholder: '8080',
    hintKey: 'customConfigs.ruleTypeHint.port',
    category: 'all',
  },
  'DST-PORT': {
    payloadLabel: 'Port',
    payloadPlaceholder: '443',
    hintKey: 'customConfigs.ruleTypeHint.port',
    category: 'all',
  },
  'IN-PORT': {
    payloadLabel: 'Port',
    payloadPlaceholder: '7890',
    hintKey: 'customConfigs.ruleTypeHint.port',
    category: 'all',
  },
  DSCP: {
    payloadLabel: 'DSCP',
    payloadPlaceholder: '46',
    hintKey: 'customConfigs.ruleTypeHint.dscp',
    category: 'all',
  },
  'PROCESS-NAME': {
    payloadLabel: 'Process',
    payloadPlaceholder: 'Telegram',
    hintKey: 'customConfigs.ruleTypeHint.processName',
    category: 'all',
  },
  'PROCESS-PATH': {
    payloadLabel: 'Path',
    payloadPlaceholder: '/usr/bin/curl',
    hintKey: 'customConfigs.ruleTypeHint.processPath',
    category: 'all',
  },
  'PROCESS-NAME-REGEX': {
    payloadLabel: 'Regex',
    payloadPlaceholder: '^telegram.*$',
    hintKey: 'customConfigs.ruleTypeHint.processName',
    category: 'all',
  },
  'PROCESS-PATH-REGEX': {
    payloadLabel: 'Regex',
    payloadPlaceholder: '^/usr/bin/.*$',
    hintKey: 'customConfigs.ruleTypeHint.processPath',
    category: 'all',
  },
  'PROCESS-NAME-WILDCARD': {
    payloadLabel: 'Wildcard',
    payloadPlaceholder: '*telegram*',
    hintKey: 'customConfigs.ruleTypeHint.processName',
    category: 'all',
  },
  'PROCESS-PATH-WILDCARD': {
    payloadLabel: 'Wildcard',
    payloadPlaceholder: '*/bin/*',
    hintKey: 'customConfigs.ruleTypeHint.processPath',
    category: 'all',
  },
  NETWORK: {
    payloadLabel: 'Network',
    payloadPlaceholder: 'tcp',
    hintKey: 'customConfigs.ruleTypeHint.network',
    category: 'all',
  },
  UID: {
    payloadLabel: 'UID',
    payloadPlaceholder: '1000',
    hintKey: 'customConfigs.ruleTypeHint.uid',
    category: 'all',
  },
  'IN-TYPE': {
    payloadLabel: 'Type',
    payloadPlaceholder: 'http',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  'IN-USER': {
    payloadLabel: 'User',
    payloadPlaceholder: 'admin',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  'IN-NAME': {
    payloadLabel: 'Name',
    payloadPlaceholder: 'my-in',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  'SUB-RULE': {
    payloadLabel: 'Sub-Rule',
    payloadPlaceholder: '(DOMAIN,a.com)',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  AND: {
    payloadLabel: 'AND',
    payloadPlaceholder: '(conditions)',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  OR: {
    payloadLabel: 'OR',
    payloadPlaceholder: '(conditions)',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  NOT: {
    payloadLabel: 'NOT',
    payloadPlaceholder: '(condition)',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  },
  'RULE-SET': {
    payloadLabel: 'Rule Set',
    payloadPlaceholder: 'apple',
    hintKey: 'customConfigs.ruleTypeHint.ruleSet',
    category: 'rule-set',
  },
  MATCH: {
    payloadLabel: '',
    payloadPlaceholder: '',
    hintKey: 'customConfigs.ruleTypeHint.match',
    category: 'match',
  },
}

export { RULE_TYPE_META }

export function getRuleTypeMeta(type: string): RuleTypeMeta {
  return RULE_TYPE_META[type.trim().toUpperCase()] ?? {
    payloadLabel: 'Payload',
    payloadPlaceholder: 'rule payload',
    hintKey: 'customConfigs.ruleTypeHint.default',
    category: 'all',
  }
}
