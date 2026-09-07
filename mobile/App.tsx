/**
 * AgriLog v2 — ứng dụng nông hộ.
 *
 * Giai đoạn 1: đăng nhập, danh sách lô đất, chi tiết lô đất, thêm/sửa lô đất.
 * Giai đoạn 2: chụp ảnh → phân tích → kết quả → gợi ý xử lý → lịch sử.
 */

import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AuthProvider} from './src/auth/AuthContext';
import {DiagnosisQueueProvider} from './src/diagnosis/DiagnosisQueueContext';
import {RootNavigator} from './src/navigation/RootNavigator';
import {SyncProvider} from './src/sync/SyncContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <DiagnosisQueueProvider>
            <RootNavigator />
          </DiagnosisQueueProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
