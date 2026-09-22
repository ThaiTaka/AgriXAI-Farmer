import type {DependencyList} from 'react';
import {useEffect, useState} from 'react';
import type {Observable} from 'rxjs';

/**
 * Subscribes to a WatermelonDB observable query and re-renders on every change.
 *
 * This is what makes Điều 1 hold in practice: screens render from the local
 * database, so a write that happened while offline shows up immediately and the
 * later sync just produces another emission. No screen ever renders from an
 * HTTP response.
 */
export function useObservable<T>(
  factory: () => Observable<T>,
  deps: DependencyList,
  initial: T,
): T {
  return useObservableReady(factory, deps, initial).value;
}

/**
 * Như `useObservable` nhưng nói thêm đã nhận được emission đầu tiên chưa.
 *
 * SQLite trả về bất đồng bộ, nên tới lúc đó giá trị vẫn là `initial` — mảng
 * rỗng. Màn nào phân biệt "chưa tải xong" với "thật sự không có gì" phải dùng
 * hook này, nếu không nông hộ đang có lô đất sẽ thấy chớp "Chưa có lô đất nào"
 * mỗi lần mở app. Lỗi cũng bật `ready` để không kẹt ở vòng quay vĩnh viễn.
 */
export function useObservableReady<T>(
  factory: () => Observable<T>,
  deps: DependencyList,
  initial: T,
): {value: T; ready: boolean} {
  const [state, setState] = useState<{value: T; ready: boolean}>({value: initial, ready: false});

  useEffect(() => {
    const subscription = factory().subscribe({
      next: value => setState({value, ready: true}),
      error: error => {
        console.warn('[db] observable failed', error);
        setState(prev => ({value: prev.value, ready: true}));
      },
    });
    return () => subscription.unsubscribe();
    // `factory` is intentionally not a dependency — callers pass an inline
    // closure, and the explicit deps list is what controls resubscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
