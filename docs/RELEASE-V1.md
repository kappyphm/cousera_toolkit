**Coursera Toolkit V1 (v1.0.0)** — bản phát hành đầu tiên. Extension Chrome MV3 viết lại sạch bằng TypeScript từ prototype "Coursera Tool v1.0.8.5" (Pear104), không qua cổng license của vendor.

## Tính năng
- **Bỏ qua video / reading** và **làm discussion** tự động (logic 1:1 theo prototype).
- **Assignment**: nộp bài peer tự động; **xin chấm lại bằng peer** (tắt chấm AI — đã kiểm chứng live 2026-11-01: submission id đọc từ `latestSubmissionSummary.computed.id` của API permissions, mutation `RequestGradingByPeer` được server chấp nhận); **chấm bài peer tự động** (rubric + feedback, vòng lặp nguyên văn theo prototype; đã kiểm chứng live từng bài).
- **Gemini AI**:
  - Fill assignment (viết tay + upload file .txt) — cả đề gộp trong **1 lần gọi**, fill-only, nộp tay.
  - Auto-quiz: trích xuất câu hỏi → Gemini trả lời theo schema → điền vào đề (tự nộp là tuỳ chọn, mặc định tắt).
  - Chính sách gọi: **một model duy nhất** do người dùng chọn; retry chỉ cho 429 theo phút (backoff tối đa 5 lần); quota ngày dừng ngay; lỗi 500/503 dừng ngay với thông báo dễ đọc; log có cấu trúc cho từng lần gọi lỗi.
- **Giao diện**: Chrome **side panel** (bấm icon extension) gồm danh sách Chức năng, Tiến trình + Nhật ký trực tiếp và Cài đặt Gemini. Toast tiến trình trên trang chỉ còn ở hai flow bỏ qua học liệu (đúng UI của prototype).
- **Kiểm chứng**: bộ test jsdom với fixture là các trang Coursera thật (`pnpm test`, 18 test) chạy kèm mỗi thay đổi; CI build bản extension unpack trên mỗi PR merge vào `main` (Actions → Artifacts).

## Cài đặt
Tải bản build từ tab Actions (artifact `cousera-toolkit-unpacked`) hoặc tự build bằng `pnpm install && pnpm build`, rồi `chrome://extensions` → Developer mode → Load unpacked → chọn thư mục `dist/`. Mở trang Coursera, mở side panel và nhập Gemini API key trong mục Cài đặt là dùng được.
