/**
 * AgriLog v2 — ứng dụng nông hộ.
 *
 * Giai đoạn 1: đăng nhập, danh sách lô đất, chi tiết lô đất, thêm/sửa lô đất.
 * Giai đoạn 3: tư vấn phân bón, quy trình chăm sóc, kho, thu-chi.
 */

import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AuthProvider} from './src/auth/AuthContext';
import {RootNavigator} from './src/navigation/RootNavigator';
import {SyncProvider} from './src/sync/SyncContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <RootNavigator />
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
