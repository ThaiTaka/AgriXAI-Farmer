import React, {createContext, useContext, useEffect, useState} from 'react';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

/**
 * Ai trả tiền cho khoảng trống dưới thanh trạng thái.
 *
 * Dải đồng bộ (OfflineBanner) nằm trên cùng, phủ nền của nó lên tận mép máy
 * rồi tự đẩy chữ xuống dưới đồng hồ/pin. Khi dải đó hiện, mọi màn hình phía
 * dưới KHÔNG được cộng inset lần nữa — cộng hai lần thì nội dung tụt xuống
 * một khoảng trống to bằng tai thỏ. Dải hiện lên thì "nhận" phần inset qua
 * useClaimTopInset; màn hình hỏi lại bằng useTopInset / useTopEdge.
 */

const ClaimedContext = createContext(false);
/** Tách setter ra context riêng để danh tính hàm không đổi theo state. */
const ClaimContext = createContext<(claimed: boolean) => void>(() => {});

export function TopInsetProvider({children}: {children: React.ReactNode}) {
  const [claimed, setClaimed] = useState(false);
  return (
    <ClaimContext.Provider value={setClaimed}>
      <ClaimedContext.Provider value={claimed}>{children}</ClaimedContext.Provider>
    </ClaimContext.Provider>
  );
}

/** Báo rằng thành phần này đang tự phủ nền dưới thanh trạng thái. */
export function useClaimTopInset(active: boolean) {
  const claim = useContext(ClaimContext);
  useEffect(() => {
    claim(active);
    return () => claim(false);
  }, [active, claim]);
}

/** Chiều cao tai thỏ còn phải bù, hoặc 0 nếu dải trên đã bù rồi. */
export function useTopInset(): number {
  const insets = useContext(SafeAreaInsetsContext);
  const claimed = useContext(ClaimedContext);
  return claimed ? 0 : (insets?.top ?? 0);
}

/** Màn hình còn cần cạnh 'top' của SafeAreaView hay không. */
export function useTopEdge(): boolean {
  return !useContext(ClaimedContext);
}
