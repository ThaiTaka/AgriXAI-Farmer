/**
 * Màn hình 02 — Trang chủ, danh sách lô đất.
 *
 * Design reference: screen "02 Trang chủ · lô đất". The weather card and the
 * diagnosis shortcut belong to Giai đoạn 2, so this screen ships the header,
 * the plot list and the "+ Thêm lô" action.
 *
 * Everything renders from a WatermelonDB observable query — with the network
 * off the list still loads, and a plot added offline appears the instant it is
 * written (Điều 1).
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAuth, useCurrentUser} from '../auth/AuthContext';
import {GhostButton} from '../components/buttons';
import {GlassSurface} from '../components/GlassSurface';
import {PlusIcon} from '../components/icons';
import {PlotCard} from '../components/PlotCard';
import {ScreenBackground} from '../components/ScreenBackground';
import {SyncStatus} from '../components/SyncStatus';
import type Plot from '../db/models/Plot';
import {observePlots} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, glass, radius, spacing, text} from '../theme';
import {formatWeekdayDate} from '../utils/format';

const CONTROL_COLORS = [...glass.control.gradientColors] as string[];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {signOut} = useAuth();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  const openPlot = useCallback(
    (plot: Plot) => navigation.navigate('PlotDetail', {plotId: plot.id}),
    [navigation],
  );

  const confirmSignOut = useCallback(() => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      {text: 'Huỷ', style: 'cancel'},
      {text: 'Đăng xuất', style: 'destructive', onPress: () => {
        signOut().catch(error => console.warn('[auth] sign out failed', error));
      }},
    ]);
  }, [signOut]);

  // Vietnamese names put the given name last, so the avatar shows the first
  // letter of the final word: "Triệu Quang Học" -> "H".
  const initial = (user.fullName || user.username).trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={text('groupTitle')} numberOfLines={1}>
                Chào {user.fullName || user.username}
              </Text>
              <Text style={[text('metaSm', 'rgba(18,48,29,0.88)'), styles.headerMeta]}>
                {formatWeekdayDate()}
                {user.region ? ` · ${user.region}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất"
              onPress={confirmSignOut}
              style={({pressed}) => pressed && styles.pressed}>
              <LinearGradient
                colors={CONTROL_COLORS}
                start={glass.control.gradientStart}
                end={glass.control.gradientEnd}
                style={styles.avatar}>
                <Text style={text('cardTitle')}>{initial}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.sectionHead}>
            <Text style={text('groupTitle')}>Lô đất của bạn</Text>
            <GhostButton
              label="Thêm lô"
              icon={<PlusIcon size={16} />}
              onPress={() => navigation.navigate('PlotForm')}
              style={styles.addButton}
            />
          </View>

          {plots.length === 0 ? (
            <EmptyState onAdd={() => navigation.navigate('PlotForm')} />
          ) : (
            <View style={styles.list}>
              {plots.map(plot => (
                <PlotCard key={plot.id} plot={plot} onPress={openPlot} />
              ))}
            </View>
          )}

          <View style={styles.footnote}>
            <SyncStatus />
            <Text style={[text('caption', colors.text.alpha['60']), styles.footnoteText]}>
              Danh sách đọc từ máy — vẫn xem và thêm lô được khi mất mạng.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function EmptyState({onAdd}: {onAdd: () => void}) {
  return (
    <GlassSurface level="card" style={styles.empty}>
      <Text style={text('cardTitleLg')}>Chưa có lô đất nào</Text>
      <Text style={[text('body', colors.text.alpha['74']), styles.emptyBody]}>
        Thêm lô đất đầu tiên để bắt đầu ghi nhật ký canh tác và chẩn đoán bệnh cho vườn của
        bạn.
      </Text>
      <GhostButton label="+ Thêm lô đất" onPress={onAdd} style={styles.emptyButton} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['11'],
    paddingBottom: spacing['18'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    marginBottom: spacing['15'],
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    marginTop: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['8'],
    gap: spacing['8'],
  },
  addButton: {
    minWidth: 118,
  },
  list: {
    gap: spacing['7'],
  },
  empty: {
    padding: spacing['13'],
    borderRadius: radius['6xl'],
  },
  emptyBody: {
    marginTop: spacing['3'],
    marginBottom: spacing['11'],
  },
  emptyButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing['8'],
  },
  footnote: {
    marginTop: spacing['13'],
    gap: spacing['3'],
  },
  footnoteText: {},
  pressed: {
    opacity: 0.82,
  },
});
