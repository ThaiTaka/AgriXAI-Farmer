/**
 * `useObservableReady` — phân biệt "chưa tải xong" với "thật sự không có gì".
 *
 * SQLite trả về bất đồng bộ nên giữa lúc mở màn và emission đầu tiên, giá trị
 * vẫn là `initial`. Nếu màn hình coi mảng rỗng là "không có dữ liệu", nông hộ
 * đang có lô đất vẫn thấy chớp "Chưa có lô đất nào" mỗi lần mở app.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Subject} from 'rxjs';

import {useObservable, useObservableReady} from '../src/db/useObservable';

function Probe({subject}: {subject: Subject<string[]>}) {
  const {value, ready} = useObservableReady<string[]>(() => subject, [subject], []);
  return React.createElement('Text', null, `${ready ? 'ready' : 'loading'}:${value.join(',')}`);
}

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

test('trước emission đầu tiên là "đang tải", không phải "rỗng"', () => {
  const subject = new Subject<string[]>();
  const tree = render(<Probe subject={subject} />);
  expect(JSON.stringify(tree.toJSON())).toContain('loading:');
});

test('một emission rỗng mới thật sự là "không có gì"', () => {
  const subject = new Subject<string[]>();
  const tree = render(<Probe subject={subject} />);
  ReactTestRenderer.act(() => subject.next([]));
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('ready:');
  expect(json).not.toContain('loading:');
});

test('có dữ liệu thì vừa ready vừa mang giá trị', () => {
  const subject = new Subject<string[]>();
  const tree = render(<Probe subject={subject} />);
  ReactTestRenderer.act(() => subject.next(['PUC-001-HB']));
  expect(JSON.stringify(tree.toJSON())).toContain('ready:PUC-001-HB');
});

test('lỗi cũng bật ready — không kẹt ở vòng quay vĩnh viễn', () => {
  const subject = new Subject<string[]>();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const tree = render(<Probe subject={subject} />);
  ReactTestRenderer.act(() => subject.error(new Error('ổ đĩa hỏng')));
  expect(JSON.stringify(tree.toJSON())).toContain('ready:');
  (console.warn as jest.Mock).mockRestore();
});

test('useObservable giữ nguyên hành vi cũ: chỉ trả giá trị', () => {
  const subject = new Subject<string[]>();
  function Plain() {
    const rows = useObservable<string[]>(() => subject, [subject], ['ban đầu']);
    return React.createElement('Text', null, rows.join(','));
  }
  const tree = render(<Plain />);
  expect(JSON.stringify(tree.toJSON())).toContain('ban đầu');
  ReactTestRenderer.act(() => subject.next(['đã đổi']));
  expect(JSON.stringify(tree.toJSON())).toContain('đã đổi');
});
