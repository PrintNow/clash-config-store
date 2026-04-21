import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SubscriptionShareDialogProps {
  open: boolean
  subscriptionName: string
  subscriptionUrl: string
  onOpenChange: (open: boolean) => void
  onCopy: () => void
}

export function SubscriptionShareDialog({
  open,
  subscriptionName,
  subscriptionUrl,
  onOpenChange,
  onCopy,
}: SubscriptionShareDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.shareDialogTitle', { name: subscriptionName })}</DialogTitle>
          <DialogDescription>{t('subscriptions.shareDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={subscriptionUrl}
              size={240}
              level="H"
              includeMargin
              imageSettings={{
                src: '/logo.svg',
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          </div>

          <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t('subscriptions.urlConfirmation')}
            </p>
            <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
              {subscriptionUrl}
            </code>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onOpenChange.bind(null, false)}>
            {t('common.close')}
          </Button>
          <Button onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t('subscriptions.copySubscriptionUrl')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
