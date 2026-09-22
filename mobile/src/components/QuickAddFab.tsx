import React, {useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {colors, radius, shadows, size, space, text} from '../theme';
import {CoinsIcon, PlusIcon, WarehouseIcon} from './icons';

interface Props {
  onRecordMoney: () => void;
  onRecordStock: () => void;
}

/**
 * Nút tròn góc phải dưới cho hai việc ghi chép nhiều nhất trong ngày.
 *
 * Mở ra bằng Modal chứ không phải một View tuyệt đối trong màn: menu phải nằm
 * trên mọi thứ kể cả khi trang đang cuộn, và chạm ra ngoài phải đóng được.
 * Nền mờ cũng là thứ chặn chạm nhầm vào nội dung phía sau.
 */
export function QuickAddFab({onRecordMoney, onRecordStock}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const toggle = (next: boolean) => {
    setOpen(next);
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) {
        spin.setValue(next ? 1 : 0);
        return;
      }
      Animated.timing(spin, {
        toValue: next ? 1 : 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  };

  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '45deg']});

  const choose = (action: () => void) => {
    toggle(false);
    action();
  };

  return (
    <>
      <Pressable
        testID="quick-add"
        accessibilityRole="button"
        accessibilityLabel="Ghi nhanh"
        accessibilityState={{expanded: open}}
        onPress={() => toggle(!open)}
        style={({pressed}) => [styles.fab, {bottom: insets.bottom + space.lg}, pressed && styles.fabPressed]}>
        <Animated.View style={{transform: [{rotate}]}}>
          <PlusIcon size={26} color={colors.primary.onPrimary} />
        </Animated.View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => toggle(false)}>
        <Pressable style={styles.scrim} accessibilityLabel="Đóng" onPress={() => toggle(false)}>
          <View style={[styles.menu, {bottom: insets.bottom + space.lg + size.minTouchTarget + space.xl}]}>
            <MenuItem
              testID="quick-add-money"
              label="Ghi thu chi"
              hint="Tiền bán hàng, tiền mua vật tư"
              icon={<CoinsIcon size={24} color={colors.primary.default} />}
              onPress={() => choose(onRecordMoney)}
            />
            <MenuItem
              testID="quick-add-stock"
              label="Nhập xuất kho"
              hint="Phiếu mua phân, phiếu lấy phân ra bón"
              icon={<WarehouseIcon size={24} color={colors.primary.default} />}
              onPress={() => choose(onRecordStock)}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({
  label,
  hint,
  icon,
  onPress,
  testID,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={onPress}
      style={({pressed}) => [styles.item, pressed && styles.itemPressed]}>
      <View style={styles.itemIcon}>{icon}</View>
      <View style={styles.itemText}>
        <Text style={text('bodyStrong')} numberOfLines={1}>
          {label}
        </Text>
        <Text style={text('caption', colors.text.secondary)} numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.brand,
  },
  fabPressed: {
    backgroundColor: colors.primary.pressed,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
  },
  menu: {
    position: 'absolute',
    right: space.lg,
    left: space.lg,
    gap: space.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouchTarget,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
  },
  itemPressed: {
    backgroundColor: colors.surface.pressed,
  },
  itemIcon: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.md,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
});
