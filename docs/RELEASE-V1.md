**Coursera Toolkit V1** — bản phát hành đầu tiên. Extension Chrome MV3 viết lại sạch bằng TypeScript từ prototype "Coursera Tool v1.0.8.5" (Pear104), không qua cổng license của vendor.

## Tính năng
- **Bỏ qua video / reading** và **làm discussion** tự động (logic 1:1 theo prototype).
- **Assignment**: nộp bài peer tự động, xin chấm lại bằng peer, chấm bài peer tự động (rubric + feedback).
- **Gemini AI**:
  - Fill assignment (viết tay + upload file .txt) — cả đề gộp trong **1 lần gọi**, fill-only, nộp tay.
  - Auto-quiz: trích xuất câu hỏi → Gemini trả lời theo schema → điền vào đề.
  - Chính sách gọi: **một model duy nhất** do người dùng chọn; retry chỉ cho 429 theo phút (backoff tối đa 5 lần); quota ngày dừng ngay; lỗi 500/503 dừng ngay với thông báo dễ đọc; log có cấu trúc cho từng lần gọi lỗi.
- **Giao diện ngay trong trang Coursera**: sidebar ẩn/hiện (tab ở mép phải, phím Esc, hoặc bấm icon extension) gồm Chức năng, Tiến trình trực tiếp, Nhật ký trực tiếp và Cài đặt Gemini — thay cho popup. Kèm panel tiến trình nổi và toast OSD trên trang.
- **CI**: mỗi PR merge vào `main` sẽ tự build một bản extension unpack (Actions → Artifacts).

## Cài đặt
Tải bản build từ tab Actions (artifact `cousera-toolkit-unpacked`) hoặc tự build bằng `pnpm install && pnpm build`, rồi `chrome://extensions` → Developer mode → Load unpacked → chọn thư mục `dist/`. Mở trang Coursera, nhập Gemini API key trong mục Cài đặt của sidebar là dùng được.
