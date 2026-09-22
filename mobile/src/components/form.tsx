import React, {useState} from 'react';
import type {KeyboardTypeOptions, StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {colors, radius, size, space, text} from '../theme';

/** "680000" → "680.000". Chuỗi rỗng giữ nguyên để placeholder còn hiện. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  /**
   * Ô tiền: hiện "680.000" trong khi state của màn vẫn là "680000".
   * Bảy chữ số liền nhau không đếm được bằng mắt ngoài đồng.
   */
  money?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  /** Số dòng thấy được khi multiline. Mặc định 4 — đủ một câu ghi chú. */
  numberOfLines?: number;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Label + boxed input.
 *
 * Font size is fixed at 16 and the box at 50 pt minimum: below either of those
 * iOS zooms the page on focus and the control stops being a reliable target
 * with muddy hands (§3.4). Focus is shown with the green border, error with red.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType,
  money = false,
  secureTextEntry,
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 4,
  editable = true,
  style,
  testID,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={style}>
      <Text style={[text('meta', colors.text.secondary), styles.label]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          !editable && styles.inputWrapReadonly,
          focused && styles.inputWrapFocused,
          error ? styles.inputWrapError : null,
        ]}>
        <TextInput
          testID={testID}
          value={money ? groupThousands(value) : value}
          onChangeText={onChangeText && (next => onChangeText(money ? next.replace(/\D/g, '') : next))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.text.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          editable={editable}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
      {error ? (
        <Text style={[text('caption', colors.text.danger), styles.hint]}>{error}</Text>
      ) : hint ? (
        <Text style={[text('bodySm', colors.text.secondary), styles.hint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface PickerFieldProps {
  label: string;
  value: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A box that looks like an input but opens a picker — date, variety, etc. */
export function PickerField({
  label,
  value,
  onPress,
  icon,
  hint,
  error,
  placeholder,
  testID,
  style,
}: PickerFieldProps) {
  const empty = !value;
  return (
    <View style={style}>
      <Text style={[text('meta', colors.text.secondary), styles.label]}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder || 'chưa chọn'}`}
        style={({pressed}) => [
          styles.inputWrap,
          styles.pickerWrap,
          pressed && styles.pickerPressed,
          error ? styles.inputWrapError : null,
        ]}>
        <Text
          numberOfLines={2}
          style={[
            text('input', empty ? colors.text.placeholder : colors.text.primary),
            styles.pickerValue,
          ]}>
          {value || placeholder || 'Chưa chọn'}
        </Text>
        {icon}
      </Pressable>
      {error ? (
        <Text style={[text('caption', colors.text.danger), styles.hint]}>{error}</Text>
      ) : hint ? (
        <Text style={[text('bodySm', colors.text.secondary), styles.hint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Selectable chip — status picker, unit picker. Selected = green border + soft fill. */
export function SelectChip({label, selected, onPress, style}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{selected}}
      accessibilityLabel={label}
      style={({pressed}) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && !selected && styles.chipPressed,
        style,
      ]}>
      <Text
        numberOfLines={1}
        style={text('meta', selected ? colors.primary.default : colors.text.secondary)}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SegmentedProps<K extends string> {
  items: ReadonlyArray<{key: K; label: string}>;
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}

/** Segmented control: gray track, the active segment lifted to white. */
export function SegmentedControl<K extends string>({items, value, onChange, style}: SegmentedProps<K>) {
  return (
    <View style={[styles.segmentTrack, style]} accessibilityRole="tablist">
      {items.map(item => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => onChange(item.key)}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text
              numberOfLines={1}
              style={text('meta', active ? colors.text.primary : colors.text.muted)}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: space.sm,
  },
  inputWrap: {
    minHeight: size.inputMinHeight,
    borderRadius: radius.md,
    // 2pt at rest: a hairline box disappears against a white card in sunlight,
    // and the focus ring then has nothing to thicken from.
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
    justifyContent: 'center',
  },
  inputWrapMultiline: {
    minHeight: 104,
  },
  inputWrapReadonly: {
    backgroundColor: colors.surface.subtle,
  },
  inputWrapFocused: {
    borderColor: colors.border.focus,
  },
  // Chips and segments keep the old hairline; only the text box got heavier.
  inputWrapError: {
    borderColor: colors.border.danger,
  },
  input: {
    paddingHorizontal: space.lg,
    paddingVertical: 0,
    fontFamily: 'OpenSans-Medium',
    fontSize: 16,
    color: colors.text.primary,
    minHeight: size.inputMinHeight,
  },
  inputMultiline: {
    minHeight: 104,
    paddingTop: space.md,
    paddingBottom: space.md,
    textAlignVertical: 'top',
    fontFamily: 'OpenSans-Regular',
    fontSize: 15,
  },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    // Chừa chỗ cho giá trị dài xuống 2 dòng mà không chạm viền.
    paddingVertical: space.sm,
  },
  pickerPressed: {
    backgroundColor: colors.surface.pressed,
  },
  pickerValue: {
    flex: 1,
  },
  hint: {
    marginTop: space.sm,
  },
  chip: {
    flex: 1,
    // Chọn nhầm đơn vị (kg/tấn) là sai cả phiếu, nên chip này ăn đủ 48 chứ
    // không dùng chipMinHeight 40 như chip lọc.
    minHeight: size.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  chipIdle: {
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
  },
  chipPressed: {
    backgroundColor: colors.surface.pressed,
  },
  chipSelected: {
    borderColor: colors.border.selected,
    backgroundColor: colors.surface.selected,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surface.subtle,
    borderRadius: radius.sm,
    padding: space.xs,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: size.minTouchTarget,
    borderRadius: radius.sm - space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  segmentActive: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
