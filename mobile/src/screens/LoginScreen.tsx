/**
 * Màn hình 01 — Đăng nhập.
 *
 * White ground, brand mark + headline at the top, the form pushed to the
 * bottom with `marginTop: auto`. Login is the one action that genuinely needs
 * the network, so a network failure is explained in plain words.
 */

import React, {useCallback, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {ApiError, NetworkError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {PrimaryButton} from '../components/buttons';
import {Field} from '../components/form';
import {LeafMark} from '../components/icons';
import {Screen} from '../components/Screen';
import {colors, radius, space, text} from '../theme';

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
    <Screen ground="card" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <LeafMark size={22} />
              </View>
              <Text style={text('subheading')}>AgriXAI</Text>
            </View>

            <Text style={[text('display'), styles.headline]}>
              Ghi chép vật tư{'\n'}và chi phí nhà nông
            </Text>
            <Text style={[text('body', colors.text.muted), styles.tagline]}>
              Lô đất, giống cây, phân bón, kho và thu-chi — ghi ngay tại ruộng, không cần mạng.
            </Text>
          </View>

          <View style={styles.bottom}>
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

            <PrimaryButton label="Đăng nhập" onPress={onSubmit} withArrow loading={busy} />

            <Text style={[text('caption', colors.text.muted), styles.footnote]}>
              Chỉ lần đăng nhập đầu cần mạng. Sau đó mọi ghi chép được lưu trên máy và tự đồng bộ.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space['2xl'],
    paddingBottom: space.xl,
  },
  header: {
    marginBottom: space['2xl'],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space['2xl'],
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    marginBottom: space.md,
  },
  tagline: {
    maxWidth: 320,
  },
  bottom: {
    marginTop: 'auto',
  },
  field: {
    marginBottom: space.lg,
  },
  fieldLast: {
    marginBottom: space.xl,
  },
  footnote: {
    marginTop: space.lg,
    textAlign: 'center',
  },
});
