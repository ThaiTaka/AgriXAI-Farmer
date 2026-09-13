import React, {useCallback, useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../../auth/AuthContext';
import {PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Field} from '../../components/form';
import type {VarietyOption} from '../../db/repositories/varietyRepository';
import {
  createVariety,
  slugifyCropName,
  USER_CATEGORY_ID,
  USER_CATEGORY_NAME,
} from '../../db/repositories/varietyRepository';
import {colors, radius, shadows, space, text} from '../../theme';
import {cropTypeById} from '../../utils/staticData';

interface Props {
  visible: boolean;
  /** Fixed crop + category (step 3). Omit both to let the farmer name a new crop (step 1). */
  crop?: {id: string; name: string; categoryId: string; categoryName: string};
  /** Every variety currently known, for the duplicate check. */
  existing: VarietyOption[];
  onClose: () => void;
  onCreated: (variety: VarietyOption) => void;
}

/**
 * "+ Thêm giống mới" — a bottom sheet with two or three fields.
 *
 * Writes straight to SQLite and hands the new row back for immediate selection:
 * no network round trip, so it works in the middle of a field (Điều 1). The row
 * syncs up later and an admin can approve it from web-admin.
 */
export function AddVarietySheet({visible, crop, existing, onClose, onCreated}: Props) {
  const author = useChangeAuthor();
  const [cropName, setCropName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{cropName?: string; name?: string}>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCropName('');
      setName('');
      setDescription('');
      setErrors({});
      setSaving(false);
    }
  }, [visible]);

  const submit = useCallback(async () => {
    if (saving) return;
    const next: {cropName?: string; name?: string} = {};

    const cropLabel = crop ? crop.name : cropName.trim();
    if (!cropLabel) next.cropName = 'Nhập tên cây trồng.';

    const varietyName = name.trim();
    if (!varietyName) next.name = 'Nhập tên giống.';

    const cropId = crop ? crop.id : slugifyCropName(cropLabel);
    if (!crop && cropTypeById(cropId)) {
      next.cropName = `"${cropLabel}" đã có trong danh mục — quay lại và chọn ở bước 1.`;
    }
    if (
      varietyName &&
      existing.some(
        v => v.cropType === cropId && v.name.toLowerCase() === varietyName.toLowerCase(),
      )
    ) {
      next.name = 'Giống này đã có trong danh sách.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const created = await createVariety(
        {
          name: varietyName,
          cropType: cropId,
          cropName: cropLabel,
          categoryId: crop ? crop.categoryId : USER_CATEGORY_ID,
          categoryName: crop ? crop.categoryName : USER_CATEGORY_NAME,
          description: description.trim() || null,
        },
        author,
      );
      onCreated({
        id: created.id,
        name: created.name,
        cropType: created.cropType,
        cropName: created.cropName,
        categoryId: created.categoryId ?? USER_CATEGORY_ID,
        categoryName: created.categoryName ?? USER_CATEGORY_NAME,
        description: created.description,
        usage: null,
        growingNote: null,
        badge: null,
        isSeed: false,
        approved: false,
      });
    } catch (error) {
      console.error('[variety] create failed', error);
      setErrors({name: 'Không lưu được. Thử lại.'});
    } finally {
      setSaving(false);
    }
  }, [saving, crop, cropName, name, description, existing, author, onCreated]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Đóng" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={text('subheading')}>
                {crop ? 'Thêm giống mới' : 'Thêm cây trồng khác'}
              </Text>
              <Text style={[text('bodySm', colors.text.muted), styles.hint]}>
                {crop
                  ? `Vào nhóm "${crop.categoryName}" của ${crop.name}. Lưu ngay trên máy, đồng bộ khi có mạng.`
                  : 'Cho cây chưa có trong danh mục. Bạn đặt tên cây và giống; hệ thống lưu ngay trên máy và đồng bộ khi có mạng.'}
              </Text>

              {!crop ? (
                <Field
                  testID="new-crop-name"
                  label="Tên cây trồng"
                  value={cropName}
                  onChangeText={value => {
                    setCropName(value);
                    if (errors.cropName) setErrors(e => ({...e, cropName: undefined}));
                  }}
                  placeholder="Ví dụ: Sầu riêng"
                  error={errors.cropName}
                  style={styles.field}
                />
              ) : null}

              <Field
                testID="new-variety-name"
                label="Tên giống"
                value={name}
                onChangeText={value => {
                  setName(value);
                  if (errors.name) setErrors(e => ({...e, name: undefined}));
                }}
                placeholder={crop ? 'Ví dụ: Cà chua beef Hà Lan' : 'Ví dụ: Ri6'}
                error={errors.name}
                style={styles.field}
              />

              <Field
                label="Mô tả (không bắt buộc)"
                value={description}
                onChangeText={setDescription}
                placeholder="Đặc điểm quả, thời gian sinh trưởng, nơi mua giống…"
                multiline
                style={styles.field}
              />

              <PrimaryButton
                testID="new-variety-save"
                label="Lưu và chọn giống này"
                onPress={submit}
                loading={saving}
              />
              <SecondaryButton label="Huỷ" onPress={onClose} style={styles.cancel} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface.overlay,
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    maxHeight: '92%',
    ...shadows.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.gray['300'],
    marginBottom: space.lg,
  },
  hint: {
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  field: {
    marginBottom: space.lg,
  },
  cancel: {
    marginTop: space.md,
  },
});
