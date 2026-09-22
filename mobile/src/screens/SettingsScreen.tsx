/**
 * Tab "Cài đặt" — who is signed in, where the data stands per table, the
 * local error log, and sign-out. This is where "Offline 3 giờ · 2 thay đổi
 * chờ" lives, so a farmer can see exactly what has not reached the server.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useAuth, useCurrentUser} from '../auth/AuthContext';
import {AppHeader} from '../components/AppHeader';
import {Badge} from '../components/Badge';
import {DangerButton, SecondaryButton} from '../components/buttons';
import {Card} from '../components/Card';
import {ChevronRight} from '../components/icons';
import {Screen} from '../components/Screen';
import type ErrorLogEntry from '../db/models/ErrorLogEntry';
import {APP_VERSION, clearUploadedLogs, observeErrorLogs} from '../db/repositories/errorLogRepository';
import {SUPPORT_EMAIL} from '../utils/version';
import {useObservable} from '../db/useObservable';
import {tableStatusLine} from '../domain/syncStatus';
import {useSync} from '../sync/SyncContext';
import {colors, space, text} from '../theme';
import {formatDateTime} from '../utils/format';

export function SettingsScreen() {
  const user = useCurrentUser();
  const {signOut} = useAuth();
  const {state, lastSyncedAt, pending, refreshPending, sync} = useSync();
  const logs = useObservable<ErrorLogEntry[]>(() => observeErrorLogs(user.id), [user.id], []);
  const [now, setNow] = useState(Date.now());
  // Dev-only switch that makes this screen throw, to exercise the per-screen
  // error boundary ("Thử lại" / "Báo lỗi") on a device. Never shown in release.
  const [blowUp, setBlowUp] = useState(false);
  if (blowUp) throw new Error('Kiểm tra màn hình lỗi (chủ động từ Cài đặt)');

  useEffect(() => {
    refreshPending().catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [refreshPending]);

  const confirmSignOut = useCallback(() => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      {text: 'Huỷ', style: 'cancel'},
      {text: 'Đăng xuất', style: 'destructive', onPress: () => signOut().catch(() => {})},
    ]);
  }, [signOut]);

  const openSupportMail = useCallback(() => {
    // Subject carries the version so a report arrives already saying which
    // build it came from — the farmer should not have to find that out.
    const subject = encodeURIComponent(`AgriLog v2 (${APP_VERSION}) — cần hỗ trợ`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {
      // No mail app configured: the address is on screen either way.
    });
  }, []);

  const unsent = logs.filter(l => !l.uploadedAt).length;
  const visibleTables = pending.filter(p => p.pending > 0 || ['plans', 'warehouse_in', 'warehouse_out', 'income', 'expense', 'tasks_history', 'plots'].includes(p.table));

  return (
    <Screen>
      <AppHeader title="Cài đặt" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={text('eyebrow', colors.text.muted)}>Tài khoản</Text>
          <Text style={[text('subheading'), styles.name]}>{user.fullName || user.username}</Text>
          <Text style={text('bodySm', colors.text.muted)}>
            {user.username}
            {user.region ? ` · ${user.region}` : ''}
          </Text>
          <Text style={[text('caption', colors.text.muted), styles.version]}>AgriLog v2 · phiên bản {APP_VERSION}</Text>
        </Card>

        <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Hỗ trợ</Text>
        <Card flush style={styles.table}>
          <Pressable
            testID="support-email"
            accessibilityRole="link"
            accessibilityLabel={`Gửi email hỗ trợ tới ${SUPPORT_EMAIL}`}
            onPress={openSupportMail}
            style={({pressed}) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}>
            <View style={styles.rowBody}>
              <Text style={text('bodyStrong')}>Gửi email hỗ trợ</Text>
              <Text style={text('caption', colors.text.muted)}>{SUPPORT_EMAIL}</Text>
            </View>
            <ChevronRight />
          </Pressable>
        </Card>

        <View style={styles.sectionHead}>
          <Text style={text('eyebrow', colors.text.muted)}>Đồng bộ theo bảng</Text>
          <Badge
            label={state === 'syncing' ? 'Đang đồng bộ' : state === 'offline' ? 'Offline' : state === 'error' ? 'Lỗi' : 'Online'}
            tone={state === 'idle' ? 'green' : state === 'syncing' ? 'blue' : 'yellow'}
          />
        </View>
        <Card flush style={styles.table} testID="sync-tables">
          {visibleTables.map((info, index) => (
            <View key={info.table} style={[styles.row, index === visibleTables.length - 1 && styles.rowLast]} testID={`sync-${info.table}`}>
              <View style={styles.rowBody}>
                <Text style={text('bodyStrong')}>{info.label}</Text>
                <Text style={text('caption', info.pending > 0 ? colors.badge.yellowFg : colors.text.muted)}>
                  {tableStatusLine(info, lastSyncedAt, now, formatDateTime)}
                </Text>
              </View>
              {info.pending > 0 ? <Badge label={`${info.pending}`} tone="yellow" /> : null}
            </View>
          ))}
        </Card>
        <SecondaryButton
          small
          label="Đồng bộ ngay"
          loading={state === 'syncing'}
          disabled={state === 'syncing'}
          onPress={() => sync().catch(() => {})}
          style={styles.syncNow}
        />

        <View style={styles.sectionHead}>
          <Text style={text('eyebrow', colors.text.muted)}>Nhật ký lỗi</Text>
          {unsent > 0 ? <Badge label={`${unsent} chưa gửi`} tone="yellow" /> : null}
        </View>
        {logs.length === 0 ? (
          <Card>
            <Text style={text('bodySm', colors.text.muted)}>Chưa ghi nhận lỗi nào trên máy này.</Text>
          </Card>
        ) : (
          <Card flush style={styles.table}>
            {logs.slice(0, 20).map((log, index) => (
              <View key={log.id} style={[styles.row, index === Math.min(logs.length, 20) - 1 && styles.rowLast]}>
                <View style={styles.rowBody}>
                  <Text style={text('bodySm')} numberOfLines={2}>
                    {log.message}
                  </Text>
                  <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                    {log.action} · {formatDateTime(log.occurredAt)}
                  </Text>
                </View>
                <Badge label={log.uploadedAt ? 'Đã gửi' : log.reported ? 'Chờ gửi' : 'Tự ghi'} tone={log.uploadedAt ? 'green' : 'gray'} />
              </View>
            ))}
          </Card>
        )}
        {logs.some(l => l.uploadedAt) ? (
          <SecondaryButton
            small
            label="Xoá log đã gửi"
            onPress={() => clearUploadedLogs(user.id).catch(() => {})}
            style={styles.syncNow}
          />
        ) : null}
        {__DEV__ ? (
          <SecondaryButton small label="Thử màn hình lỗi (dev)" onPress={() => setBlowUp(true)} style={styles.syncNow} />
        ) : null}

        <DangerButton label="Đăng xuất" onPress={confirmSignOut} style={styles.signOut} />
        <Text style={[text('caption', colors.text.muted), styles.footnote]}>
          Đăng xuất không xoá dữ liệu trên máy; thay đổi chưa đồng bộ sẽ được gửi khi bạn đăng nhập lại và có mạng.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  card: {
    marginBottom: space.xl,
  },
  name: {
    marginTop: space.xs,
  },
  sectionLabel: {
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  rowPressed: {
    backgroundColor: colors.surface.pressed,
  },
  version: {
    marginTop: space.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Same top rhythm as sectionLabel; RN has no margin collapsing.
    marginTop: space.xl,
    marginBottom: space.sm,
    gap: space.sm,
  },
  table: {
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  syncNow: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  signOut: {
    marginTop: space.xl,
  },
  footnote: {
    marginTop: space.md,
    textAlign: 'center',
  },
});
