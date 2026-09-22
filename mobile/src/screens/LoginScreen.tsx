/**
 * Màn hình 01 — Đăng nhập (thiết kế v6).
 *
 * Nền chuyển sắc rất nhẹ (#F8F9FA → #F0F4F8, dựng bằng dải nội suy — xem
 * SoftGradient), form nằm trong một thẻ trắng rộng tối đa 360pt căn giữa, có ô
 * "Lưu thông tin đăng nhập" nhớ tên đăng nhập (không bao giờ nhớ mật khẩu).
 * Đăng nhập là thao tác duy nhất thật sự cần mạng, nên lỗi mạng được nói rõ
 * bằng tiếng Việt thường ngày.
 */

import React, {useCallback, useEffect, useState} from 'react';
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
import {
  clearRememberedIdentifier,
  loadRememberedIdentifier,
  saveRememberedIdentifier,
} from '../auth/rememberStore';
import {PrimaryButton} from '../components/buttons';
import {Checkbox} from '../components/Checkbox';
import {Field} from '../components/form';
import {AlertIcon, LeafMark} from '../components/icons';
import {FarmScene} from '../components/illustrations';
import {Screen} from '../components/Screen';
import {colors, radius, shadows, space, text} from '../theme';
import {APP_VERSION} from '../utils/version';

export function LoginScreen() {
  const {signIn} = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pre-fill from the last "remember me" login. A missing entry just means the
  // farmer never ticked the box.
  useEffect(() => {
    let cancelled = false;
    loadRememberedIdentifier()
      .then(saved => {
        if (cancelled || !saved) return;
        setIdentifier(saved);
        setRemember(true);
      })
      .catch(() => {
        // rememberStore already logs; an unreadable entry is not worth a banner.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      // Only after a login that actually worked — otherwise a typo gets remembered.
      await (remember ? saveRememberedIdentifier(identifier) : clearRememberedIdentifier());
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
  }, [busy, identifier, password, remember, signIn]);

  return (
    <Screen ground="gradient" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <LeafMark size={22} />
            </View>
            <View style={styles.brandText}>
              <Text style={text('cardTitle')}>AgriXAI Farmer</Text>
              <Text style={text('caption', colors.text.muted)}>Quản lý vật tư nông nghiệp</Text>
            </View>
          </View>

          <View style={styles.scene}>
            <FarmScene width={200} />
          </View>

          <View style={styles.card} testID="login-card">
            <Text style={[text('heading'), styles.cardTitle]}>Đăng nhập</Text>
            <Text style={[text('bodySm', colors.text.muted), styles.cardLead]}>
              Chỉ lần đầu cần mạng. Sau đó mọi ghi chép lưu trên máy và tự đồng bộ.
            </Text>

            <Field
              testID="login-identifier"
              label="Tên đăng nhập"
              value={identifier}
              onChangeText={value => {
                setIdentifier(value);
                if (error) setError(null);
              }}
              placeholder="nguyenvancuong hoặc email"
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
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              style={styles.field}
            />

            <Checkbox
              testID="login-remember"
              label="Lưu thông tin đăng nhập"
              checked={remember}
              onChange={setRemember}
              style={styles.remember}
            />

            {error ? (
              <View style={styles.error} testID="login-error">
                <AlertIcon size={18} color={colors.semantic.error} />
                <Text style={[text('bodySm', colors.text.danger), styles.errorText]}>{error}</Text>
              </View>
            ) : null}

            <PrimaryButton label="Đăng nhập" onPress={onSubmit} withArrow loading={busy} />
          </View>

          <Text style={[text('bodySm', colors.text.secondary), styles.footer]}>
            AgriLog v{APP_VERSION} · Số liệu lưu trên máy, dùng được khi mất mạng
          </Text>
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
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    marginBottom: space.xl,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  scene: {
    alignItems: 'center',
    marginBottom: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: space.xl,
    backgroundColor: colors.surface.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.raised,
  },
  cardTitle: {
    marginBottom: space.xs,
  },
  cardLead: {
    marginBottom: space.xl,
  },
  field: {
    marginBottom: space.lg,
  },
  remember: {
    marginBottom: space.md,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.danger,
    backgroundColor: colors.badge.redBg,
  },
  errorText: {
    flex: 1,
  },
  footer: {
    marginTop: space.xl,
    textAlign: 'center',
  },
});
