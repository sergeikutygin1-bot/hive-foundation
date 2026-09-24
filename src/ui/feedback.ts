import type { RejectReason } from '../sim/commands';
import type { GameEvent } from '../sim/events';
import { formatCoins, formatKg } from './format';
import { t } from './i18n';

export type ToastKind = 'info' | 'success' | 'error';

export function reasonText(reason: RejectReason): string {
  return t(`reason.${reason}`);
}

export function toastForEvent(e: GameEvent): { text: string; kind: ToastKind } | null {
  switch (e.type) {
    case 'harvested':
      return { text: t('toast.harvested', { kg: formatKg(e.amount) }), kind: 'success' };
    case 'sold':
      return { text: t('toast.sold', { coins: formatCoins(e.coins) }), kind: 'success' };
    case 'producerFull':
      return { text: t('toast.full'), kind: 'info' };
    case 'safetyNetGranted':
      return { text: t('toast.safetyNet', { coins: formatCoins(e.coins) }), kind: 'info' };
    default:
      return null;
  }
}
