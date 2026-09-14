/**
 * Báo cáo → PDF.
 *
 * Pick a month or quarter (defaults to the current month), tap "Xuất PDF":
 * the report is built from local rows into HTML, printed to an A4 PDF on
 * the device (react-native-html-to-pdf) and handed to the share sheet
 * (react-native-share). Works with the network off. A period with nothing
 * in it says "Không có dữ liệu tháng này" instead of producing an empty file.
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';
import {generatePDF} from 'react-native-html-to-pdf';
import Share from 'react-native-share';

import {useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {PrimaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {ShareIcon} from '../../components/icons';
import {NumberText} from '../../components/NumberText';
import {PeriodPicker} from '../../components/PeriodPicker';
import {Screen} from '../../components/Screen';
import type Expense from '../../db/models/Expense';
import type Income from '../../db/models/Income';
import type WarehouseIn from '../../db/models/WarehouseIn';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {observeExpense, observeIncome, toEntries} from '../../db/repositories/financeRepository';
import {observeWarehouseIn, observeWarehouseOut, toInRows, toOutRows} from '../../db/repositories/warehouseRepository';
import {useObservable} from '../../db/useObservable';
import {financialReport} from '../../domain/finance';
import {isEmptyReport, noteLines, reportFileName, reportHtml, reportNotes} from '../../domain/reportPdf';
import type {PeriodFilter} from '../../domain/warehouse';
import {stockSummary} from '../../domain/warehouse';
import type {RootStackParamList} from '../../navigation/types';
import {useSync} from '../../sync/SyncContext';
import {colors, space, text} from '../../theme';
import {formatDate, formatVnd} from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// A4 in PDF points (1 pt = 1/72 in): 210 × 297 mm. 20 mm margin ≈ 57 pt.
const A4 = {width: 595, height: 842, padding: 57};
/** Sub-folder of the app's files directory that holds exported reports. */
const REPORT_DIR = 'bao-cao';

export function ReportExportScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {state} = useSync();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodFilter>({kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1});
  const [busy, setBusy] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);

  const incomes = useObservable<Income[]>(() => observeIncome(user.id), [user.id], []);
  const expenses = useObservable<Expense[]>(() => observeExpense(user.id), [user.id], []);
  const ins = useObservable<WarehouseIn[]>(() => observeWarehouseIn(user.id), [user.id], []);
  const outs = useObservable<WarehouseOut[]>(() => observeWarehouseOut(user.id), [user.id], []);

  const report = useMemo(() => financialReport(toEntries(incomes), toEntries(expenses), period), [incomes, expenses, period]);
  const notes = useMemo(
    () => reportNotes(report, stockSummary(toInRows(ins), toOutRows(outs)), toEntries(expenses)),
    [report, ins, outs, expenses],
  );
  const empty = isEmptyReport(report);

  const exportPdf = useCallback(async () => {
    if (empty || busy) return;
    setBusy(true);
    try {
      const html = reportHtml({
        farmerName: user.fullName || user.username,
        address: user.region ?? null,
        report,
        notes,
        generatedAt: Date.now(),
        formatVnd,
        formatDay: formatDate,
      });
      const result = await generatePDF({
        html,
        fileName: reportFileName(period),
        // A named folder (not a temp file) so the PDF keeps its exact name and
        // stays on the phone after sharing; the app's FileProvider exposes it.
        directory: REPORT_DIR,
        width: A4.width,
        height: A4.height,
        padding: A4.padding,
        bgColor: '#FFFFFF',
      });
      if (!result.filePath) throw new Error('Không tạo được file PDF');
      setLastFile(result.filePath.split('/').pop() ?? result.filePath);
      await Share.open({
        title: 'Báo cáo thu – chi',
        url: `file://${result.filePath}`,
        type: 'application/pdf',
        failOnCancel: false,
      });
    } catch (e) {
      Alert.alert('Không xuất được PDF', e instanceof Error ? e.message : 'Thử lại.');
    } finally {
      setBusy(false);
    }
  }, [empty, busy, user, report, notes, period]);

  return (
    <Screen>
      <AppHeader eyebrow="Tài chính nông hộ" title="Xuất báo cáo PDF" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PeriodPicker value={period} onChange={setPeriod} allowAll={false} style={styles.period} />

        {empty ? (
          <EmptyState
            title="Không có dữ liệu tháng này"
            body="Chưa có khoản thu hay chi nào trong kỳ đã chọn. Chọn kỳ khác hoặc ghi giao dịch ở Thu – Chi."
            action={{label: 'Mở Thu – Chi', onPress: () => navigation.navigate('Finance')}}
          />
        ) : (
          <>
            <Card style={styles.preview} testID="report-preview">
              <View style={styles.previewHead}>
                <Text style={text('cardTitle')}>Xem trước · {report.label}</Text>
                <Badge label={report.profit >= 0 ? 'Lãi' : 'Lỗ'} tone={report.profit >= 0 ? 'green' : 'red'} />
              </View>
              <Row label="Thu" value={formatVnd(report.totalIncome)} />
              <Row label="Chi" value={formatVnd(report.totalExpense)} />
              <Row label="Lãi/Lỗ" value={formatVnd(report.profit)} strong negative={report.profit < 0} />
              <Text style={[text('caption', colors.text.muted), styles.count]}>
                {report.incomes.length} khoản thu · {report.expenses.length} khoản chi
              </Text>
              <Text style={[text('eyebrow', colors.text.muted), styles.notesLabel]}>Ghi chú trong báo cáo</Text>
              {noteLines(notes, formatVnd).map((line, index) => (
                <Text key={index} style={[text('bodySm', colors.text.secondary), styles.note]}>
                  • {line}
                </Text>
              ))}
            </Card>

            <PrimaryButton testID="report-pdf" label="Xuất PDF" icon={<ShareIcon color={colors.white} />} onPress={exportPdf} loading={busy} />
            {lastFile ? (
              <Text style={[text('caption', colors.text.muted), styles.footnote]} numberOfLines={2}>
                Đã tạo {lastFile} trong thư mục {REPORT_DIR} của ứng dụng
              </Text>
            ) : null}
          </>
        )}

        <Text style={[text('caption', colors.text.muted), styles.footnote]}>
          Khổ A4, lề 20 mm, chỉ chữ và số. File tạo ngay trên máy{state === 'offline' ? ' (đang offline — vẫn xuất được)' : ''} và
          mở bảng chia sẻ để gửi Zalo, Gmail, Drive… Cùng nội dung với PDF tải từ trang quản trị.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Row({label, value, strong = false, negative = false}: {label: string; value: string; strong?: boolean; negative?: boolean}) {
  return (
    <View style={styles.row}>
      <Text style={text(strong ? 'bodyStrong' : 'bodySm', colors.text.secondary)}>{label}</Text>
      <NumberText size={strong ? 'lg' : 'md'} color={negative ? colors.text.danger : strong ? colors.primary.default : colors.text.primary}>
        {value}
      </NumberText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  period: {
    marginBottom: space.lg,
  },
  preview: {
    marginBottom: space.lg,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  count: {
    marginTop: space.sm,
  },
  notesLabel: {
    marginTop: space.md,
    marginBottom: space.xs,
  },
  note: {
    marginTop: 2,
  },
  footnote: {
    marginTop: space.md,
  },
});
