import React, {useState} from 'react';
import {Modal, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../../auth/AuthContext';
import {IconButton, PrimaryButton} from '../../components/buttons';
import {DateField} from '../../components/DateField';
import {Field} from '../../components/form';
import {CloseIcon} from '../../components/icons';
import type CropCycle from '../../db/models/CropCycle';
import type Plot from '../../db/models/Plot';
import {createCycle, endCycle} from '../../db/repositories/cropCycleRepository';
import {colors, radius, space, text} from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  plot: Plot;
  cycle?: CropCycle; // Nếu mode='end'
  mode: 'create' | 'end';
}

export function CropCycleFormSheet({visible, onClose, plot, cycle, mode}: Props) {
  const author = useChangeAuthor();

  // Create state
  const [name, setName] = useState('');
  const [varietyName, setVarietyName] = useState(plot.varietyName ?? '');
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [notes, setNotes] = useState('');

  // End state
  const [endedAt, setEndedAt] = useState<number>(Date.now());
  const [yieldKgStr, setYieldKgStr] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreate = mode === 'create';
  const title = isCreate ? 'Bắt đầu vụ mới' : 'Kết thúc vụ';

  const resetForm = () => {
    setName('');
    setVarietyName(plot.varietyName ?? '');
    setStartedAt(Date.now());
    setNotes('');
    setEndedAt(Date.now());
    setYieldKgStr('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    if (isCreate) {
      if (!name.trim()) {
        setError('Tên chu kỳ không được để trống.');
        return;
      }
    } else {
      if (cycle && endedAt < cycle.startedAt) {
        setError('Ngày kết thúc không được trước ngày bắt đầu.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isCreate) {
        await createCycle(
          plot,
          {
            name: name.trim(),
            cropType: plot.cropType,
            varietyId: plot.varietyId,
            varietyName: varietyName.trim() || null,
            stage: 'seedling',
            startedAt,
            notes: notes.trim() || null,
          },
          author,
        );
      } else {
        if (!cycle) throw new Error('Missing cycle to end');
        const yieldNum = yieldKgStr ? parseFloat(yieldKgStr) : null;
        await endCycle(cycle, endedAt, yieldNum, author);
      }
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[text('heading'), styles.headerTitle]}>{title}</Text>
          <IconButton accessibilityLabel="Đóng" onPress={handleClose}>
            <CloseIcon />
          </IconButton>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Text style={[text('bodySm', colors.text.danger), styles.error]}>{error}</Text> : null}

          {isCreate ? (
            <View style={styles.fields}>
              <Field label="Tên chu kỳ" value={name} onChangeText={setName} placeholder="VD: Vụ Xuân 2024" />
              <Field
                label="Giống cây"
                value={varietyName}
                onChangeText={setVarietyName}
                placeholder="VD: Arabica"
                hint="Kế thừa từ lô đất, có thể sửa đổi nếu vụ này dùng giống khác."
              />
              <DateField label="Ngày xuống giống" value={startedAt} onChange={setStartedAt} />
              <Field
                label="Ghi chú"
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Ghi chú bổ sung (không bắt buộc)"
              />
            </View>
          ) : (
            <View style={styles.fields}>
              <DateField label="Ngày kết thúc" value={endedAt} onChange={setEndedAt} />
              <Field
                label="Sản lượng thu hoạch (kg)"
                value={yieldKgStr}
                onChangeText={setYieldKgStr}
                keyboardType="numeric"
                placeholder="0"
                hint="Có thể bỏ qua nếu không thống kê sản lượng."
              />
            </View>
          )}

          <View style={styles.footer}>
            <PrimaryButton label={title} onPress={handleSubmit} loading={loading} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  fields: {
    gap: space.lg,
    marginTop: space.md,
  },
  footer: {
    marginTop: space.xl,
  },
  error: {
    marginBottom: space.md,
    backgroundColor: colors.badge.redBg,
    padding: space.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
