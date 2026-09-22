import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {postLogs} from '../api/logs';
import type ErrorLogEntry from '../db/models/ErrorLogEntry';
import {markReported, markUploaded, recordError} from '../db/repositories/errorLogRepository';
import {friendlyDetail, toErrorRecord} from '../domain/errorLog';
import {colors, radius, space, text} from '../theme';
import {PrimaryButton, SecondaryButton} from './buttons';
import {Card} from './Card';
import {AlertIcon} from './icons';
import {Screen} from './Screen';

interface Props {
  /** Route name — becomes the log's `action` together with `detail`. */
  route: string;
  detail?: string | null;
  userId: string | null;
  token: string | null;
  /**
   * Lối thoát khi "Thử lại" cứ sập lại. Bỏ trống ở màn gốc (không có gì để
   * quay về) — khi đó "Thử lại" là lựa chọn duy nhất, đúng như thực tế.
   */
  onGoHome?: () => void;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  entry: ErrorLogEntry | null;
  reportState: 'idle' | 'sending' | 'sent' | 'queued';
  attempt: number;
}

/**
 * Catches a render/effect error inside one screen so the rest of the app keeps
 * working. The error is written to the local `error_logs` table at once;
 * "Thử lại" remounts the screen, "Báo lỗi" pushes the log to POST /logs now
 * (or leaves it queued when offline), "Về trang chủ" bỏ cả stack đang hỏng —
 * lỗi tất định thì "Thử lại" chỉ sập lại, và không còn thanh tab để thoát.
 *
 * A class component because React only exposes componentDidCatch on classes.
 */
export class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null, entry: null, reportState: 'idle', attempt: 0};

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {error};
  }

  componentDidCatch(error: Error): void {
    const record = toErrorRecord(error, this.props.route, this.props.detail ?? null, Date.now());
    console.warn('[boundary]', record.action, record.message);
    if (this.props.userId) {
      recordError(record, this.props.userId).then(entry => this.setState({entry}));
    }
  }

  retry = (): void => {
    this.setState(prev => ({error: null, entry: null, reportState: 'idle', attempt: prev.attempt + 1}));
  };

  report = async (): Promise<void> => {
    const {entry} = this.state;
    const {token} = this.props;
    if (!entry) return;
    this.setState({reportState: 'sending'});
    try {
      await markReported(entry);
      if (token) {
        const accepted = await postLogs(token, [entry]);
        if (accepted.includes(entry.id)) {
          await markUploaded([entry], Date.now());
          this.setState({reportState: 'sent'});
          return;
        }
      }
      this.setState({reportState: 'queued'});
    } catch {
      // Offline or server down: the log stays in the queue and goes with the next sync.
      this.setState({reportState: 'queued'});
    }
  };

  render(): React.ReactNode {
    const {error, reportState, attempt} = this.state;
    if (!error) {
      // Changing the key remounts the subtree — a clean retry.
      return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll} testID="error-boundary">
          <Card style={styles.card}>
            <View style={styles.icon}>
              <AlertIcon size={26} color={colors.badge.redFg} />
            </View>
            <Text style={[text('subheading'), styles.title]}>Oops, điều gì đó sai rồi</Text>
            <Text style={[text('body', colors.text.secondary), styles.body]}>
              Màn hình này gặp lỗi và đã dừng lại. Dữ liệu bạn đã lưu vẫn an toàn trên máy.
            </Text>
            <View style={styles.detail}>
              <Text style={text('eyebrow', colors.text.muted)}>Chi tiết</Text>
              <Text style={[text('bodySm', colors.text.secondary), styles.detailText]} selectable>
                {friendlyDetail(error.message)}
              </Text>
              <Text style={text('caption', colors.text.muted)}>{this.props.route}</Text>
            </View>
            <PrimaryButton testID="boundary-retry" label="Thử lại" onPress={this.retry} style={styles.action} />
            {this.props.onGoHome ? (
              <SecondaryButton
                testID="boundary-home"
                label="Về trang chủ"
                onPress={this.props.onGoHome}
                style={styles.action}
              />
            ) : null}
            <SecondaryButton
              testID="boundary-report"
              label={
                reportState === 'sent'
                  ? 'Đã gửi báo lỗi'
                  : reportState === 'queued'
                    ? 'Đã lưu, sẽ gửi khi có mạng'
                    : 'Báo lỗi'
              }
              onPress={this.report}
              loading={reportState === 'sending'}
              disabled={reportState === 'sent' || reportState === 'queued' || !this.state.entry}
              style={styles.action}
            />
            <Text style={[text('bodySm', colors.text.secondary), styles.footnote]}>
              Báo lỗi gửi thông điệp lỗi, màn hình đang mở và thời điểm — không gửi dữ liệu nông hộ.
            </Text>
          </Card>
        </ScrollView>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
  },
  card: {
    alignItems: 'stretch',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.badge.redBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space.md,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginTop: space.xs,
  },
  detail: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.subtle,
    gap: space.xs,
  },
  detailText: {
    fontFamily: 'monospace',
  },
  action: {
    marginTop: space.md,
  },
  footnote: {
    marginTop: space.md,
    textAlign: 'center',
  },
});
