import React from 'react';
import type {KeyboardTypeOptions, StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {colors, glass, radius, size, spacing, text} from '../theme';

const CONTROL_COLORS = [...glass.control.gradientColors] as string[];

interface FieldProps {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Label + pill input, matching screens 01 and 09.
 *
 * Font size is fixed at the token value (16) and the box at 50px minimum: below
 * either of those iOS zooms the page on focus and the control stops being a
 * reliable target with muddy hands (§3.4).
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'sentences',
  multiline = false,
  editable = true,
  style,
  testID,
}: FieldProps) {
  return (
    <View style={style}>
      <Text style={[text('metaSm', colors.text.alpha['74']), styles.label]}>{label}</Text>
      <LinearGradient
        colors={CONTROL_COLORS}
        start={glass.control.gradientStart}
        end={glass.control.gradientEnd}
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          error ? styles.inputWrapError : null,
        ]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.alpha['55']}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          editable={editable}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </LinearGradient>
      {error ? (
        <Text style={[text('caption', '#8A3708'), styles.hint]}>{error}</Text>
      ) : hint ? (
        <Text style={[text('caption', colors.text.alpha['60']), styles.hint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface ReadonlyFieldProps {
  label: string;
  value: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  hint?: string;
  placeholder?: string;
  testID?: string;
}

/** A pill that looks like an input but opens a picker — date, variety, etc. */
export function PickerField({
  label,
  value,
  onPress,
  icon,
  hint,
  placeholder,
  testID,
}: ReadonlyFieldProps) {
  const empty = !value;
  return (
    <View>
      <Text style={[text('metaSm', colors.text.alpha['74']), styles.label]}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder || 'chưa chọn'}`}
        style={({pressed}) => (pressed ? styles.pressed : null)}>
        <LinearGradient
          colors={CONTROL_COLORS}
          start={glass.control.gradientStart}
          end={glass.control.gradientEnd}
          style={[styles.inputWrap, styles.pickerWrap]}>
          <Text
            numberOfLines={1}
            style={[
              text('input', empty ? colors.text.alpha['55'] : colors.text.primary),
              styles.pickerValue,
            ]}>
            {value || placeholder || 'Chưa chọn'}
          </Text>
          {icon}
        </LinearGradient>
      </Pressable>
      {hint ? <Text style={[text('caption', colors.text.alpha['60']), styles.hint]}>{hint}</Text> : null}
    </View>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Selectable pill — status picker on screen 09, tab bar on screen 08. */
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
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        numberOfLines={1}
        // metaSm, not meta: three status chips share one row and "Đang canh tác"
        // was being clipped at the larger size.
        style={text('metaSm', selected ? colors.neutral.white : colors.text.alpha['74'])}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing['2'],
  },
  inputWrap: {
    minHeight: size.inputMinHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.control.borderColor,
    justifyContent: 'center',
  },
  inputWrapMultiline: {
    minHeight: 96,
    borderRadius: radius['4xl'],
  },
  inputWrapError: {
    borderColor: 'rgba(194,74,18,0.6)',
  },
  input: {
    paddingHorizontal: spacing['12'],
    paddingVertical: 0,
    fontFamily: 'OpenSans-SemiBold',
    fontSize: 16,
    color: colors.text.primary,
    minHeight: size.inputMinHeight,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: spacing['10'],
    paddingBottom: spacing['10'],
    textAlignVertical: 'top',
    fontFamily: 'OpenSans-Regular',
    fontSize: 15,
  },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
    paddingHorizontal: spacing['12'],
  },
  pickerValue: {
    flex: 1,
  },
  hint: {
    marginTop: spacing['3'],
    paddingLeft: spacing['2'],
  },
  chip: {
    flex: 1,
    minHeight: size.buttonMinHeightSm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3'],
  },
  chipIdle: {
    borderColor: glass.control.borderColor,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  chipSelected: {
    borderColor: colors.green['700'],
    backgroundColor: colors.green['700'],
  },
  pressed: {
    opacity: 0.82,
  },
});
