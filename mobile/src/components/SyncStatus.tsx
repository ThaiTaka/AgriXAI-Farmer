import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useSync} from '../sync/SyncContext';
import {colors, radius, spacing, text} from '../theme';
import {OfflineIcon} from './icons';

/**
 * A quiet line telling the farmer where their data stands.
 *
 * Being offline is a normal working state out in a field, so it is reported as
 * information, never as an error dialog that blocks what they were doing.
 */
export function SyncStatus() {
  const {state, lastSyncedAt, sync} = useSync();

  if (state === 'syncing') {
    return (
      <View style={styles.row}>
        <Text style={text('caption', colors.text.alpha['60'])}>Đang đồng bộ…</Text>
      </View>
    );
  }

  if (state === 'offline' || state === 'error') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thử đồng bộ lại"
        onPress={() => {
          sync().catch(() => {});
        }}
        style={({pressed}) => [styles.offline, pressed && styles.pressed]}>
        <OfflineIcon size={16} />
        <Text style={[text('caption', colors.amber['700']), styles.offlineText]}>
          {state === 'offline'
            ? 'Chưa đồng bộ được — dữ liệu vẫn lưu an toàn trên máy. Chạm để thử lại.'
            : 'Đồng bộ gặp lỗi. Chạm để thử lại.'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={text('caption', colors.text.alpha['60'])}>
        {lastSyncedAt ? `Đã đồng bộ lúc ${formatClock(lastSyncedAt)}` : 'Chưa đồng bộ lần nào'}
      </Text>
    </View>
  );
}

function formatClock(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing['3'],
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
    paddingVertical: spacing['5'],
    paddingHorizontal: spacing['8'],
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(242,161,4,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242,161,4,0.34)',
  },
  offlineText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
