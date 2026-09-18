import React, {useState} from 'react';
import {ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, View} from 'react-native';

import {changePassword} from '../../api/auth';
import {ApiError} from '../../api/client';
import {useAuth} from '../../auth/AuthContext';
import {GhostButton, SecondaryButton} from '../../components/buttons';
import {colors, space, text} from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ChangePasswordSheet({visible, onClose}: Props) {
  const {session} = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Lỗi', 'Mật khẩu mới không được trùng mật khẩu hiện tại');
      return;
    }

    if (!session?.token) {
      Alert.alert('Lỗi', 'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(session.token, currentPassword, newPassword);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công.');
      handleClose();
    } catch (e: any) {
      let msg = 'Không thể đổi mật khẩu. Vui lòng thử lại.';
      if (e instanceof ApiError && e.message) {
        msg = e.message;
      }
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={[text('subheading'), styles.title]}>Đổi mật khẩu</Text>

          <TextInput
            style={styles.input}
            placeholder="Mật khẩu hiện tại"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu mới"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Xác nhận mật khẩu mới"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />

          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={colors.text.default} />
          ) : (
            <View style={styles.actions}>
              <GhostButton label="Huỷ" onPress={handleClose} style={styles.cancelBtn} />
              <SecondaryButton label="Đổi mật khẩu" onPress={handleSubmit} style={styles.submitBtn} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    padding: space.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    marginBottom: space.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: space.md,
    marginBottom: space.md,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.md,
    marginTop: space.md,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 1,
  },
  loader: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
});
