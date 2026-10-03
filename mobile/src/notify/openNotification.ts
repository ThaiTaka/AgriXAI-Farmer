/**
 * Where a tapped system notification leads.
 *
 *   notice   -> its target (weather, price list, a care guide) or the inbox;
 *               marked read either way, since the farmer has seen it
 *   reminder -> the care protocol of that plot
 *   sync     -> Cài đặt, where every table's sync state is listed
 */

import {findNotification, markRead} from '../db/repositories/notificationRepository';
import {targetOf} from '../domain/notifications';
import {navigationRef, whenNavigationReady} from '../navigation/navigationRef';
import {fertilizerProduct} from '../utils/staticData';
import type {OpenedNotification} from './notifier';

export function openNotification(data: OpenedNotification, userId: string | null): void {
  switch (data.type) {
    case 'notice':
      openNotice(data.id, data.link, userId);
      break;
    case 'reminder':
      whenNavigationReady(() =>
        navigationRef.navigate('CareProtocol', {protocolId: data.protocolId, plotId: data.plotId || undefined}),
      );
      break;
    case 'sync':
      whenNavigationReady(() => navigationRef.navigate('Settings'));
      break;
    default:
      break;
  }
}

function openNotice(id: string | undefined, link: string | undefined, userId: string | null): void {
  if (id && userId) {
    findNotification(id)
      .then(n => (n ? markRead(userId, [{id: n.id, updatedAt: n.updatedAt}]) : undefined))
      .catch(error => console.warn('[notify] mark read failed', error));
  }
  const target = targetOf(link);
  whenNavigationReady(() => {
    switch (target?.screen) {
      case 'Weather':
        navigationRef.navigate('Weather');
        return;
      case 'Prices': {
        const product = target.productId ? fertilizerProduct(target.productId) : undefined;
        if (product) navigationRef.navigate('FertilizerProducts', {categoryCode: product.category});
        else navigationRef.navigate('FertilizerGroups');
        return;
      }
      case 'CareGuide':
        navigationRef.navigate('CareGuide', {guideId: target.guideId});
        return;
      default:
        navigationRef.navigate('Notifications', id ? {focusId: id} : undefined);
    }
  });
}
