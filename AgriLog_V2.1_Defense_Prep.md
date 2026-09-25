# Chuẩn bị bảo vệ — AgriLog V2.1

**Ngày bảo vệ:** 30/09/2026 · **PR:** [#8](https://github.com/ThaiTaka/AgriXAI-Farmer/pull/8)
**Tài liệu nền:** [ADR 0008](docs/adr/0008-v2-1-canh-tac-media-nhan-cong.md),
[RELEASE_NOTES_v2.1.0.md](RELEASE_NOTES_v2.1.0.md)

> Tài khoản demo dùng đúng **lethanhthai / matkhau123** (nông hộ) — đây là tài khoản có sẵn
> lịch sử trồng trọt thật để gợi ý và biểu đồ năng suất có gì để show. Tài khoản `thaitaka`
> trong README chỉ là ví dụ đăng nhập, không có lịch sử vụ trồng. Admin: `admin` / `admin123`.

## Phần 1 — Vấn đề & giải pháp (1–2 phút)

> "Nông hộ ghi vật tư, công việc, tiền nong vào sổ giấy hoặc trong đầu. Cuối vụ hỏi 'vụ này lãi
> hay lỗ, năm sau nên trồng gì' thì không có câu trả lời — vì lịch sử vụ trước không được lưu ở
> đâu có thể tra lại. V2.1 thêm bốn thứ để giải quyết: lịch sử trồng trọt tách khỏi lịch sử công
> việc, gợi ý cây cho vụ tới dựa trên năng suất thật của chính lô đó, ghi chú công việc kèm
> ảnh/video để nhớ lại cách đã làm, và tính tiền công để biết đủ chi phí một vụ."

## Phần 2 — Demo trực tiếp (5–6 phút)

Đăng nhập `lethanhthai` / `matkhau123` → mở lô đất có sẵn dữ liệu (`Ruộng ...` — lô demo chính).

### 2.1 Tab "Vụ trồng" — lịch sử trồng trọt thật
Mở tab **"Vụ trồng"** trên màn hình chi tiết lô đất. Lô này có 4 vụ đã ghi:

| Vụ | Cây | Mùa | Diện tích | Sản lượng | Năng suất |
|---|---|---|---|---|---|
| Đông 2024 | Bắp cải | Đông | 300 m² | 1.050 kg | 3.500 kg/1.000 m² |
| Xuân 2025 | Cà chua MV1 | Xuân | 300 m² | 1.380 kg | 4.600 kg/1.000 m² |
| Thu 2025 | Cà rốt | Thu | 300 m² | 840 kg | 2.800 kg/1.000 m² |
| Xuân 2026 | Cà chua MV1 | Xuân | 300 m² | 1.230 kg | 4.100 kg/1.000 m² |

Chỉ ra biểu đồ năng suất theo vụ. **Nói:** "Cà chua trồng hai vụ xuân liên tiếp, năng suất
4.600 rồi 4.100 kg/1.000m² — nhỉnh hơn hẳn cà rốt (2.800) hay bắp cải (3.500)."

### 2.2 Gợi ý cây cho vụ tới
Bấm thêm vụ mới → card **"Gợi ý cây cho vụ tới"** (trong `CyclesTab`). Vì lô này chỉ từng
trồng cà chua vào mùa xuân (chưa từng trồng cây khác vào xuân), gợi ý sẽ ra **Cà chua**, kèm
năng suất trung bình hai vụ xuân đã ghi. **Nói:** "Gợi ý không bịa — chỉ xếp hạng cây đã từng
trồng thật trên chính lô này, ưu tiên cùng mùa. Nếu vụ tới không phải mùa xuân, ứng dụng dùng
lịch sử của mọi mùa và nói rõ điều đó."

### 2.3 Hướng dẫn chăm sóc có video
Mở tab **"Hướng dẫn chăm sóc"**. Chọn một hướng dẫn có video → video YouTube phát ngay trong
app (nhúng qua `youtube-nocookie.com`, không mở trình duyệt ngoài). Cuộn xuống thấy các bước
kèm ảnh, mỗi bước có ghi nguồn. **Nói:** "Nếu tắt mạng, khung video báo cần có mạng nhưng chữ
và ảnh các bước vẫn đọc được vì đã đồng bộ về máy trước đó."

### 2.4 Ghi chú công việc kèm ảnh/video
Vào lịch sử công việc của lô → tab **"Chưa làm" / "Đã làm"**. Mở một việc, bấm
**"Đã làm xong việc này"**, chụp hoặc chọn ảnh/video minh hoạ cách làm → lưu. **Nói:** "Ảnh lưu
vào máy trước, không cần mạng ngay lúc chụp. Khi có sóng, app tự tải lên máy chủ và đổi trạng
thái từ 'chờ tải lên' sang đã đồng bộ."

### 2.5 Tiền công
Trong cùng màn hình công việc, thêm tiền công: **1 người × 2 giờ × 30.000₫/giờ = 60.000₫**
(hiện tự động, không cần bấm tính). **Nói:** "Khoản này tự vào Thu – Chi như một chi phí Công
nhân, không cần ghi lại lần hai."

## Phần 3 — Kỹ thuật (2 phút)

- Mở rộng bảng có sẵn (`crop_cycles`, `expense`) thay vì tạo 5 bảng mới như đề bài gốc đề nghị —
  tránh hai nguồn sự thật cho cùng một vụ/khoản chi (xem ADR 0008 §1).
- Ảnh/video không đi qua giao thức `/sync` — chỉ mã tệp đi qua, file tải riêng qua `POST
  /media`, vì `/sync` được thiết kế cho JSON nhỏ, không phải file lớn.
- 235 test backend (SQLite + PostgreSQL 16), 236 test mobile (94% dòng), build web-admin sạch.
- Vá 2 lỗi có sẵn: quyền trên `/sync` (một hộ có thể sửa/xoá bản ghi hộ khác nếu đoán được id),
  và mất dữ liệu khi app cũ nâng schema (migration sync).

## Câu hỏi dự kiến & cách trả lời trung thực

**Q1. "Tại sao gợi ý mà không cho nông hộ tự chọn cây?"**
A: Nông hộ vẫn tự chọn — gợi ý chỉ là một con số tham khảo hiện sẵn trong form thêm vụ mới, có
thể bỏ qua. Mục đích là nhắc lại năng suất các năm trước, thứ nông hộ dễ quên khi ghi sổ tay.

**Q2. "Video YouTube có luôn xem được không?"**
A: Không — cần mạng để phát video. Phần chữ và ảnh từng bước vẫn đọc offline vì đã đồng bộ về
máy. Đây là giới hạn có chủ đích, không phải lỗi.

**Q3. "Đã chạy thử trên điện thoại thật chưa?"**
A: **Chưa.** Đã chạy đầy đủ trên **emulator Pixel 6a (Android 13)** — migration, chụp ảnh, tải
lên, phát video, tính tiền công đều đúng. Riêng **quay video bằng camera** trên emulator bị
crash (lỗi camera ảo AOSP, không phải lỗi app) — chọn video có sẵn trong thư viện thì chạy
đúng. Cần thử quay trực tiếp trên máy Android thật trước khi khẳng định tính năng này hoàn
chỉnh.

**Q4. "Sao lại gợi ý được cây có lợi nhất mà không gợi ý trồng xen, khoảng cách?"**
A: Có chủ đích không làm — dự án yêu cầu mọi số liệu nông học phải có nguồn chính thống, và
hiện chưa tìm được bộ dữ liệu trồng xen/khoảng cách đáng tin để trích dẫn. Thà không gợi ý còn
hơn bịa.

**Q5. "Ảnh/video tải lên nhiều thì máy chủ có đầy không?"**
A: Có nguy cơ đó — hiện ảnh/video lưu trên đĩa của một máy chủ, chưa chuyển sang S3/MinIO, và
xoá ghi chú chưa xoá tệp trên máy chủ (tệp mồ côi). Đây là giới hạn đã ghi rõ trong ADR 0008,
việc kế tiếp nếu mở rộng dự án.

**Q6. "Tiền công tính ở điện thoại và máy chủ có ra cùng một số không?"**
A: Có — trước đây từng lệch vì Python làm tròn về số chẵn còn JavaScript làm tròn lên; đã sửa
để cả hai dùng chung luật "nửa lên", có test cho cả hai phía.

## Ảnh chụp thật để mang theo (`docs/screenshots/`)

`85-v21-cultivation-history-chart.png` · `86-v21-crop-suggestion-spring.png` ·
`87-v21-new-season-suggestion.png` · `88-v21-care-tab-video-guides.png` ·
`89-v21-youtube-embedded-playing.png` · `90-v21-task-history-done.png` ·
`91-v21-task-note-photo-pending.png` · `92-v21-labor-cost-60000.png` ·
`93-v21-finance-labor-breakdown.png` · `94-v21-local-video-playback.png` ·
`95-v21-web-admin-care-guide-editor.png`

## Trước khi vào phòng bảo vệ

- [ ] Emulator Pixel 6a đã chạy sẵn, backend đã chạy (`uvicorn`, không `--reload`), đăng nhập
      sẵn `lethanhthai` để khỏi mất thời gian gõ.
      **Lưu ý:** đừng tắt wifi máy tính để giả lập offline — bundle debug nạp từ Metro qua
      wifi. Tắt backend để giả lập offline thay vào đó.
- [ ] Chụp lại ảnh màn hình dự phòng trong `docs/screenshots/85-95` phòng khi demo trực tiếp
      lỗi mạng/thiết bị tại chỗ.
- [ ] Thuộc bốn con số: 235 test backend, 236 test mobile, 4.600 kg/1.000m² (năng suất cao nhất
      cà chua), 60.000₫ (ví dụ tiền công).
- [ ] Nhớ nói rõ "emulator", không nói "điện thoại thật" khi được hỏi về môi trường chạy thử.
