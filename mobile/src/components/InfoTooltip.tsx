import React, {useContext, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {colors, radius, size, space, text} from '../theme';
import {SecondaryButton} from './buttons';
import {CloseIcon, InfoIcon} from './icons';

interface Props {
  /** Nhan đề của tấm giải thích — thường là tên mục đứng cạnh icon. */
  title: string;
  /** Phần giải thích đầy đủ. Đây là chỗ chứa câu đã bị gỡ khỏi màn chính. */
  body: string;
  testID?: string;
}

/**
 * Icon (i) cạnh tiêu đề; chạm vào mở tấm giải thích từ đáy màn.
 *
 * Lý do tồn tại: những câu giải thích cách tính (tồn kho, ngưỡng giá, số giai
 * đoạn) đúng nhưng dài, và nằm thường trực thì nông hộ phải đọc lướt qua chúng
 * mỗi lần mở màn chỉ để nhìn một con số. Giấu sau icon giữ được thông tin cho
 * người cần mà không bắt người khác trả giá.
 */
export function InfoTooltip({title, body, testID}: Props) {
  // Đọc context thay vì useSafeAreaInsets(): hook đó ném lỗi khi chưa có
  // provider, khiến component không dựng được ngoài cây app thật.
  const insets = useContext(SafeAreaInsetsContext);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Giải thích: ${title}`}
        hitSlop={12}
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.trigger, pressed && styles.triggerPressed]}>
        <InfoIcon size={20} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} accessibilityLabel="Đóng" onPress={() => setOpen(false)}>
          {/* Chặn chạm xuyên qua tấm nội dung xuống lớp scrim bên dưới. */}
          <Pressable style={[styles.sheet, {paddingBottom: (insets?.bottom ?? 0) + space.lg}]} onPress={() => {}}>
            <View style={styles.head}>
              <Text style={text('subheading')} numberOfLines={2}>
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                hitSlop={12}
                onPress={() => setOpen(false)}
                style={styles.close}>
                <CloseIcon size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.bodyScroll}>
              <View style={styles.body}>
                <Text style={text('bodySm', colors.text.secondary)}>{body}</Text>
              </View>
            </ScrollView>

            <SecondaryButton label="Đã hiểu" onPress={() => setOpen(false)} style={styles.done} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: size.minTouchTarget,
    height: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerPressed: {
    opacity: 0.6,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface.overlay,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    maxHeight: '70%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginBottom: space.lg,
  },
  close: {
    width: size.minTouchTarget,
    height: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -space.sm,
    marginRight: -space.sm,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  body: {
    // Vạch xanh bên trái: dấu hiệu quen thuộc của "đây là ghi chú", không phải
    // một con số hay hành động.
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.default,
    paddingLeft: space.md,
  },
  done: {
    marginTop: space.lg,
  },
});
