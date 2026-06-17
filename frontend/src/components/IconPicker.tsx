import { useState } from 'react'
import { Image as ImageIcon, X, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ── 预设图标库（Koolson/Qure，jsDelivr CDN） ─────────────────────────
const ICON_BASE = 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color'

interface PresetIcon {
  id: string
  name: string
  category: 'policy' | 'region' | 'media' | 'social' | 'tech' | 'gaming'
  url: string
}

const PRESET_ICONS: PresetIcon[] = [
  // 策略
  { id: 'Global',        name: '全局',       category: 'policy', url: `${ICON_BASE}/Global.png` },
  { id: 'Proxy',         name: '代理',       category: 'policy', url: `${ICON_BASE}/Proxy.png` },
  { id: 'Auto',          name: '自动',       category: 'policy', url: `${ICON_BASE}/Auto.png` },
  { id: 'Final',         name: '兜底',       category: 'policy', url: `${ICON_BASE}/Final.png` },
  { id: 'Reject',        name: '拦截',       category: 'policy', url: `${ICON_BASE}/Reject.png` },
  { id: 'Direct',        name: '直连',       category: 'policy', url: `${ICON_BASE}/Direct.png` },
  { id: 'Bypass',        name: '绕过',       category: 'policy', url: `${ICON_BASE}/Bypass.png` },
  { id: 'Blackhole',     name: '黑洞',       category: 'policy', url: `${ICON_BASE}/Blackhole.png` },
  { id: 'Streaming',     name: '流媒体',     category: 'policy', url: `${ICON_BASE}/Streaming.png` },
  { id: 'ForeignMedia',  name: '境外媒体',   category: 'policy', url: `${ICON_BASE}/ForeignMedia.png` },
  { id: 'DomesticMedia', name: '国内媒体',   category: 'policy', url: `${ICON_BASE}/DomesticMedia.png` },
  { id: 'Domestic',      name: '国内',       category: 'policy', url: `${ICON_BASE}/Domestic.png` },
  // 地区
  { id: 'China',          name: '中国',   category: 'region', url: `${ICON_BASE}/China.png` },
  { id: 'Japan',          name: '日本',   category: 'region', url: `${ICON_BASE}/Japan.png` },
  { id: 'Singapore',      name: '新加坡', category: 'region', url: `${ICON_BASE}/Singapore.png` },
  { id: 'US',             name: '美国',   category: 'region', url: `${ICON_BASE}/US.png` },
  { id: 'Korea',          name: '韩国',   category: 'region', url: `${ICON_BASE}/Korea.png` },
  { id: 'UK',             name: '英国',   category: 'region', url: `${ICON_BASE}/UK.png` },
  { id: 'Germany',        name: '德国',   category: 'region', url: `${ICON_BASE}/Germany.png` },
  { id: 'France',         name: '法国',   category: 'region', url: `${ICON_BASE}/France.png` },
  { id: 'Russia',         name: '俄罗斯', category: 'region', url: `${ICON_BASE}/Russia.png` },
  { id: 'India',          name: '印度',   category: 'region', url: `${ICON_BASE}/India.png` },
  { id: 'Australia',      name: '澳大利亚', category: 'region', url: `${ICON_BASE}/Australia.png` },
  { id: 'Canada',         name: '加拿大', category: 'region', url: `${ICON_BASE}/Canada.png` },
  { id: 'Brazil',         name: '巴西',   category: 'region', url: `${ICON_BASE}/Brazil.png` },
  { id: 'Turkey',         name: '土耳其', category: 'region', url: `${ICON_BASE}/Turkey.png` },
  { id: 'Thailand',       name: '泰国',   category: 'region', url: `${ICON_BASE}/Thailand.png` },
  { id: 'Philippines',    name: '菲律宾', category: 'region', url: `${ICON_BASE}/Philippines.png` },
  { id: 'Malaysia',       name: '马来西亚', category: 'region', url: `${ICON_BASE}/Malaysia.png` },
  { id: 'Macao',          name: '澳门',   category: 'region', url: `${ICON_BASE}/Macao.png` },
  { id: 'EU',             name: '欧盟',   category: 'region', url: `${ICON_BASE}/EU.png` },
  // 媒体
  { id: 'YouTube',        name: 'YouTube',       category: 'media', url: `${ICON_BASE}/YouTube.png` },
  { id: 'YouTube_Music',  name: 'YouTube Music', category: 'media', url: `${ICON_BASE}/YouTube_Music.png` },
  { id: 'Netflix',        name: 'Netflix',       category: 'media', url: `${ICON_BASE}/Netflix.png` },
  { id: 'Spotify',        name: 'Spotify',       category: 'media', url: `${ICON_BASE}/Spotify.png` },
  { id: 'TikTok',         name: 'TikTok',        category: 'media', url: `${ICON_BASE}/TikTok.png` },
  { id: 'bilibili',       name: 'Bilibili',      category: 'media', url: `${ICON_BASE}/bilibili.png` },
  { id: 'iQIYI',          name: '爱奇艺',        category: 'media', url: `${ICON_BASE}/iQIYI.png` },
  { id: 'Netease_Music',  name: '网易云音乐',    category: 'media', url: `${ICON_BASE}/Netease_Music.png` },
  { id: 'Disney+',        name: 'Disney+',       category: 'media', url: `${ICON_BASE}/Disney+.png` },
  { id: 'Twitch',         name: 'Twitch',        category: 'media', url: `${ICON_BASE}/Twitch.png` },
  { id: 'Prime_Video',    name: 'Prime Video',   category: 'media', url: `${ICON_BASE}/Prime_Video.png` },
  { id: 'AbemaTV',        name: 'AbemaTV',       category: 'media', url: `${ICON_BASE}/AbemaTV.png` },
  { id: 'HBO_Max',        name: 'HBO Max',       category: 'media', url: `${ICON_BASE}/HBO_Max.png` },
  { id: 'Hulu',           name: 'Hulu',          category: 'media', url: `${ICON_BASE}/Hulu.png` },
  { id: 'Peacock',        name: 'Peacock',       category: 'media', url: `${ICON_BASE}/Peacock.png` },
  { id: 'ESPN+',          name: 'ESPN+',         category: 'media', url: `${ICON_BASE}/ESPN+.png` },
  { id: 'DAZN',           name: 'DAZN',          category: 'media', url: `${ICON_BASE}/DAZN.png` },
  { id: 'TIDAL',          name: 'TIDAL',         category: 'media', url: `${ICON_BASE}/TIDAL.png` },
  { id: 'deezer',         name: 'Deezer',        category: 'media', url: `${ICON_BASE}/deezer.png` },
  { id: 'niconico',       name: 'niconico',      category: 'media', url: `${ICON_BASE}/niconico.png` },
  { id: 'BBC_iPlayer',    name: 'BBC iPlayer',   category: 'media', url: `${ICON_BASE}/BBC_iPlayer.png` },
  { id: 'Vimeo',          name: 'Vimeo',         category: 'media', url: `${ICON_BASE}/Vimeo.png` },
  { id: 'Paramount',      name: 'Paramount+',    category: 'media', url: `${ICON_BASE}/Paramount.png` },
  { id: 'Star+',          name: 'Star+',         category: 'media', url: `${ICON_BASE}/Star+.png` },
  { id: 'discovery+',     name: 'discovery+',    category: 'media', url: `${ICON_BASE}/discovery+.png` },
  { id: 'KKBOX',          name: 'KKBOX',         category: 'media', url: `${ICON_BASE}/KKBOX.png` },
  // 社交
  { id: 'Telegram',       name: 'Telegram',  category: 'social', url: `${ICON_BASE}/Telegram.png` },
  { id: 'Twitter',        name: 'X/Twitter', category: 'social', url: `${ICON_BASE}/Twitter.png` },
  { id: 'Instagram',      name: 'Instagram', category: 'social', url: `${ICON_BASE}/Instagram.png` },
  { id: 'Facebook',       name: 'Facebook',  category: 'social', url: `${ICON_BASE}/Facebook.png` },
  { id: 'Discord',        name: 'Discord',   category: 'social', url: `${ICON_BASE}/Discord.png` },
  { id: 'WeChat',         name: '微信',       category: 'social', url: `${ICON_BASE}/WeChat.png` },
  { id: 'Weibo',          name: '微博',       category: 'social', url: `${ICON_BASE}/Weibo.png` },
  { id: 'Line',           name: 'Line',      category: 'social', url: `${ICON_BASE}/Line.png` },
  { id: 'Linkedin',       name: 'LinkedIn',  category: 'social', url: `${ICON_BASE}/Linkedin.png` },
  { id: 'QQ',             name: 'QQ',        category: 'social', url: `${ICON_BASE}/QQ.png` },
  // 科技
  { id: 'Google',         name: 'Google',      category: 'tech', url: `${ICON_BASE}/Google.png` },
  { id: 'Gmail',          name: 'Gmail',       category: 'tech', url: `${ICON_BASE}/Gmail.png` },
  { id: 'Google_Drive',   name: 'Google Drive',category: 'tech', url: `${ICON_BASE}/Google_Drive.png` },
  { id: 'Apple',          name: 'Apple',       category: 'tech', url: `${ICON_BASE}/Apple.png` },
  { id: 'iCloud',         name: 'iCloud',      category: 'tech', url: `${ICON_BASE}/iCloud.png` },
  { id: 'App_Store',      name: 'App Store',   category: 'tech', url: `${ICON_BASE}/App_Store.png` },
  { id: 'Microsoft',      name: 'Microsoft',   category: 'tech', url: `${ICON_BASE}/Microsoft.png` },
  { id: 'OneDrive',       name: 'OneDrive',    category: 'tech', url: `${ICON_BASE}/OneDrive.png` },
  { id: 'Azure',          name: 'Azure',       category: 'tech', url: `${ICON_BASE}/Azure.png` },
  { id: 'GitHub',         name: 'GitHub',      category: 'tech', url: `${ICON_BASE}/GitHub.png` },
  { id: 'ChatGPT',        name: 'ChatGPT',     category: 'tech', url: `${ICON_BASE}/ChatGPT.png` },
  { id: 'Copilot',        name: 'Copilot',     category: 'tech', url: `${ICON_BASE}/Copilot.png` },
  { id: 'Amazon',         name: 'Amazon',      category: 'tech', url: `${ICON_BASE}/Amazon.png` },
  { id: 'Cloudflare',     name: 'Cloudflare',  category: 'tech', url: `${ICON_BASE}/Cloudflare.png` },
  { id: 'PayPal',         name: 'PayPal',      category: 'tech', url: `${ICON_BASE}/PayPal.png` },
  { id: 'Notion',         name: 'Notion',      category: 'tech', url: `${ICON_BASE}/Notion.png` },
  { id: 'Speedtest',      name: 'Speedtest',   category: 'tech', url: `${ICON_BASE}/Speedtest.png` },
  { id: 'Taobao',         name: '淘宝',        category: 'tech', url: `${ICON_BASE}/Taobao.png` },
  // 游戏
  { id: 'Steam',          name: 'Steam',        category: 'gaming', url: `${ICON_BASE}/Steam.png` },
  { id: 'PlayStation',    name: 'PlayStation',  category: 'gaming', url: `${ICON_BASE}/PlayStation.png` },
  { id: 'Xbox',           name: 'Xbox',         category: 'gaming', url: `${ICON_BASE}/Xbox.png` },
  { id: 'Nintendo',       name: 'Nintendo',     category: 'gaming', url: `${ICON_BASE}/Nintendo.png` },
  { id: 'Epic_Games',     name: 'Epic Games',   category: 'gaming', url: `${ICON_BASE}/Epic_Games.png` },
  { id: 'League_of_Legends', name: 'LoL',       category: 'gaming', url: `${ICON_BASE}/League_of_Legends.png` },
]

const CATEGORIES = [
  { id: 'all',    label: '全部' },
  { id: 'policy', label: '策略' },
  { id: 'region', label: '地区' },
  { id: 'media',  label: '媒体' },
  { id: 'social', label: '社交' },
  { id: 'tech',   label: '科技' },
  { id: 'gaming', label: '游戏' },
] as const

// ── Emoji → SVG data URL ─────────────────────────────────────────────
function emojiToSVGDataURL(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// ── 预设图标网格 ──────────────────────────────────────────────────────
function PresetGrid({ current, onSelect }: { current: string; onSelect: (url: string) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  const filtered = PRESET_ICONS.filter((icon) => {
    const matchCat = category === 'all' || icon.category === category
    const matchSearch = !search || icon.name.toLowerCase().includes(search.toLowerCase()) || icon.id.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="h-7 pl-7 text-xs"
          placeholder="搜索图标..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={cn(
              'px-2 py-0.5 rounded text-xs border transition-colors',
              category === cat.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div
        className="h-[200px] overflow-y-auto overflow-x-hidden rounded-md"
        onWheel={(e) => e.stopPropagation()}
      >
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-6 gap-1">
            {filtered.map((icon) => (
              <Tooltip key={icon.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(icon.url)}
                    className={cn(
                      'flex items-center justify-center rounded-md p-1.5 border transition-colors',
                      current === icon.url
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:border-border hover:bg-muted'
                    )}
                  >
                    <img
                      src={icon.url}
                      alt={icon.name}
                      className="h-7 w-7 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2' }}
                      loading="lazy"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{icon.name}</TooltipContent>
              </Tooltip>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-6 py-6 text-center text-xs text-muted-foreground">无匹配图标</div>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}

// ── 自定义 URL ────────────────────────────────────────────────────────
function UrlTab({ current, onSelect }: { current: string; onSelect: (url: string) => void }) {
  const [url, setUrl] = useState(() => (current.startsWith('data:') ? '' : current))
  const [imgError, setImgError] = useState(false)

  const isValid = url.startsWith('http://') || url.startsWith('https://')

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Input
          className="text-xs"
          placeholder="https://example.com/icon.png"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setImgError(false) }}
        />
        <p className="text-xs text-muted-foreground">支持 PNG、JPG、SVG 等格式</p>
      </div>
      {isValid && !imgError && (
        <div className="flex items-center gap-3 rounded-md border p-3">
          <img
            src={url}
            alt="preview"
            className="h-10 w-10 rounded object-contain"
            onError={() => setImgError(true)}
          />
          <span className="text-xs text-muted-foreground break-all line-clamp-2">{url}</span>
        </div>
      )}
      {imgError && (
        <p className="text-xs text-destructive">图片加载失败，请检查 URL</p>
      )}
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!isValid || imgError}
        onClick={() => onSelect(url)}
      >
        使用此 URL
      </Button>
    </div>
  )
}

// ── Emoji 标签页 ──────────────────────────────────────────────────────
function EmojiTab({ onSelect }: { onSelect: (dataUrl: string) => void }) {
  const [emoji, setEmoji] = useState('')

  const svgUrl = emoji.trim() ? emojiToSVGDataURL(emoji.trim()) : ''

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Input
          className="text-2xl h-10 text-center"
          placeholder="🌐"
          value={emoji}
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">输入 emoji，直接生成 SVG 图标</p>
      </div>
      {svgUrl && (
        <div className="flex flex-col items-center gap-2">
          <img src={svgUrl} alt="emoji preview" className="h-14 w-14 rounded-lg border" />
          <Button type="button" size="sm" className="w-full" onClick={() => onSelect(svgUrl)}>
            使用此 Emoji
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────
interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('preset')

  const handleSelect = (url: string) => {
    onChange(url)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
              value
                ? 'border-border hover:border-primary/60'
                : 'border-dashed border-border hover:border-primary/60 bg-muted/30'
            )}
          >
            {value ? (
              <img
                src={value}
                alt="icon"
                className="h-7 w-7 rounded object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[340px] p-3"
          side="right"
          align="start"
          sideOffset={8}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">选择图标</span>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
                清除
              </button>
            )}
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 h-8 mb-3">
              <TabsTrigger value="preset" className="text-xs">预设库</TabsTrigger>
              <TabsTrigger value="url" className="text-xs">自定义 URL</TabsTrigger>
              <TabsTrigger value="emoji" className="text-xs">Emoji</TabsTrigger>
            </TabsList>
            <TabsContent value="preset" className="mt-0">
              <PresetGrid current={value} onSelect={handleSelect} />
            </TabsContent>
            <TabsContent value="url" className="mt-0">
              <UrlTab current={value} onSelect={handleSelect} />
            </TabsContent>
            <TabsContent value="emoji" className="mt-0">
              <EmojiTab onSelect={handleSelect} />
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* 当前值预览文字 */}
      {value && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-xs text-muted-foreground max-w-[200px]">
            {value.startsWith('data:image/svg+xml') ? 'Emoji（SVG）' : value.startsWith('data:') ? 'Emoji' : value}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {!value && (
        <span className="text-xs text-muted-foreground">点击左侧按钮选择图标</span>
      )}
    </div>
  )
}
