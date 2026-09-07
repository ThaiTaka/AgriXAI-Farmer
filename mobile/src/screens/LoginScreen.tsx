/**
 * Màn hình 01 — Đăng nhập.
 *
 * Design reference: docs/design-reference/agrixai-farmer-v4.html, screen
 * "01 Đăng nhập". Layout: brand mark + headline pinned to the top, the glass
 * login card pushed to the bottom with `marginTop: auto`.
 */

import React, {useCallback, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ApiError, NetworkError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {PrimaryButton} from '../components/buttons';
import {Field} from '../components/form';
import {GlassSurface} from '../components/GlassSurface';
import {LeafMark} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import {glass, radius, spacing, text} from '../theme';

const CONTROL_COLORS = [...glass.control.gradientColors] as string[];

export function LoginScreen() {
  const {signIn} = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError('Nhập đủ tài khoản và mật khẩu.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (e) {
      if (e instanceof NetworkError) {
        // Login is the one action that genuinely needs the network — say so
        // plainly instead of showing a stack trace.
        setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Đăng nhập không thành công. Thử lại sau.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, identifier, password, signIn]);

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <LinearGradient
                  colors={CONTROL_COLORS}
                  start={glass.control.gradientStart}
                  end={glass.control.gradientEnd}
                  style={styles.brandMark}>
                  <LeafMark size={24} />
                </LinearGradient>
                <Text style={text('screenHeading')}>AgriXAI</Text>
              </View>

              <Text style={[text('screenTitle'), styles.headline]}>
                Chẩn đoán bệnh{'\n'}cây trồng bằng ảnh
              </Text>
              <Text style={[text('body'), styles.tagline]}>
                Nâng cao giá trị và phát triển bền vững từ sản xuất đến tiêu thụ.
              </Text>
            </View>

            <View style={styles.bottom}>
              <GlassSurface level="strong" style={styles.card}>
                <Field
                  testID="login-identifier"
                  label="Tài khoản"
                  value={identifier}
                  onChangeText={value => {
                    setIdentifier(value);
                    if (error) setError(null);
                  }}
                  placeholder="Tên đăng nhập hoặc email"
                  autoCapitalize="none"
                  style={styles.field}
                />
                <Field
                  testID="login-password"
                  label="Mật khẩu"
                  value={password}
                  onChangeText={value => {
                    setPassword(value);
                    if (error) setError(null);
                  }}
                  placeholder="Mật khẩu"
                  secureTextEntry
                  autoCapitalize="none"
                  error={error}
                  style={styles.fieldLast}
                />

                <PrimaryButton
                  label="Đăng nhập"
                  onPress={onSubmit}
                  withArrow
                  loading={busy}
                />
              </GlassSurface>

              <Pressable
                accessibilityRole="button"
                onPress={() => {}}
                style={({pressed}) => [styles.catalogLink, pressed && styles.pressed]}>
                <Text style={text('bodySm', 'rgba(18,48,29,0.88)')}>
                  Tra cứu bệnh mà không cần đăng nhập
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing['13'],
    paddingTop: spacing['15'],
    paddingBottom: spacing['13'],
  },
  header: {
    marginBottom: spacing['15'],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    marginBottom: spacing['15'],
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    marginBottom: spacing['6'],
  },
  tagline: {
    maxWidth: 300,
  },
  bottom: {
    marginTop: 'auto',
  },
  card: {
    padding: spacing['13'],
    borderRadius: 30,
  },
  field: {
    marginBottom: spacing['9'],
  },
  fieldLast: {
    marginBottom: spacing['13'],
  },
  catalogLink: {
    marginTop: spacing['10'],
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
