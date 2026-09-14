import React, {useState} from 'react';
import {Modal, StyleSheet, Text, View} from 'react-native';

import type {SyncConflict} from '../api/sync';
import {useSync} from '../sync/SyncContext';
import {conflictTitle} from '../sync/conflicts';
import {colors, radius, space, text} from '../theme';
import {formatDateTime} from '../utils/format';
import {PrimaryButton, SecondaryButton} from './buttons';
import {AlertIcon} from './icons';

/**
 * Shown when the server refused a row because another device of this
 * account wrote a newer version. One conflict at a time; the farmer picks
 * "giữ bản của tôi" or "lấy bản mới" — nothing is decided for them.
 */
export function ConflictDialog() {
  const {conflicts, resolveConflict} = useSync();
  const [busy, setBusy] = useState(false);
  const current: SyncConflict | undefined = conflicts[0];
  if (!current) return null;

  const choose = async (choice: 'mine' | 'theirs') => {
    setBusy(true);
    try {
      await resolveConflict(current, choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="conflict-dialog">
          <View style={styles.head}>
            <AlertIcon size={22} />
            <Text style={[text('subheading'), styles.title]}>Thiết bị khác vừa sửa</Text>
          </View>
          <Text style={[text('body', colors.text.secondary), styles.body]}>
            {conflictTitle(current)} đã được sửa trên một thiết bị khác của tài khoản này lúc{' '}
            {formatDateTime(current.server_updated_at)}. Bạn muốn giữ bản trên máy này hay lấy bản mới?
          </Text>
          {conflicts.length > 1 ? (
            <Text style={[text('caption', colors.text.muted), styles.body]}>Còn {conflicts.length - 1} bản ghi khác cần chọn.</Text>
          ) : null}
          <PrimaryButton testID="conflict-theirs" label="Lấy bản mới" onPress={() => choose('theirs')} loading={busy} style={styles.action} />
          <SecondaryButton testID="conflict-mine" label="Giữ bản của tôi" onPress={() => choose('mine')} disabled={busy} style={styles.action} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    flex: 1,
  },
  body: {
    marginTop: space.md,
  },
  action: {
    marginTop: space.md,
  },
});
