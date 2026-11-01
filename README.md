# Coursera Toolkit

Extension Chrome MV3 hỗ trợ tự động hoá các tác vụ lặp lại trên Coursera: bỏ qua học liệu, nộp bài, chấm bài peer và điền bài bằng Gemini AI.

Dự án là bản viết lại sạch bằng TypeScript từ logic phía client của "Coursera Tool v1.0.8.5" (Pear104). Mọi logic đều được port theo bằng chứng giải mã từ bundle prototype (thư mục `analysis/`), không qua máy chủ và không có cổng license của vendor — extension chỉ gọi `coursera.org` và API Gemini bằng key của chính người dùng.

## Tính năng

**Học liệu**
- Bỏ qua video / reading (đánh dấu hoàn thành hàng loạt theo tuần).
- Tự động làm discussion prompt.

**Assignment**
- Nộp bài peer tự động (điền các phần, tick honor code, nộp, xác nhận).
- **Xin chấm lại bằng peer** (tắt chấm AI): lấy submission id qua API permissions của Coursera rồi gọi mutation `RequestGradingByPeer` — đã kiểm chứng live (2026-11-01).
- Chấm bài peer tự động: chấm rubric theo quy tắc spread của prototype + feedback, chạy vòng lặp trên trang review và trang `/review-next`.

**Gemini AI** (cần API key của người dùng)
- Điền assignment: toàn bộ đề trong **một lần gọi** Gemini, hỗ trợ phần viết và phần upload file `.txt`. Chế độ **fill-only** — extension điền và kiểm chứng lại nội dung, người dùng tự bấm nộp.
- Auto-quiz: trích xuất câu hỏi → Gemini trả lời theo schema → điền đáp án. Tuỳ chọn tự nộp (mặc định tắt = chỉ điền).
- Chính sách gọi: **một model duy nhất** do người dùng chọn (không tự đổi model); chỉ retry với lỗi 429 theo phút (backoff, tối đa 5 lần); chạm quota ngày thì dừng ngay; lỗi 500/503 dừng ngay với thông báo dễ đọc; mọi lần gọi lỗi đều có log có cấu trúc trong panel.

## Giao diện

Điều khiển qua **Chrome side panel** (bấm icon extension khi đang ở trang Coursera): danh sách chức năng, tiến trình và nhật ký trực tiếp, cùng mục cài đặt Gemini (API key, model, tuỳ chọn tự retry / tự nộp quiz). Log chi tiết theo từng bước giúp đối chiếu hành vi với prototype khi cần kiểm chứng.

## Cài đặt

1. Tải bản build từ GitHub Actions (artifact `cousera-toolkit-unpacked` của workflow trên `main`) hoặc tự build: `pnpm install && pnpm build`.
2. Mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `dist/`.
3. Mở một trang khoá học trên Coursera, mở side panel, nhập Gemini API key trong mục Cài đặt nếu dùng các tính năng AI.

## Phát triển

```bash
pnpm install
pnpm test    # jsdom + node --test, fixture là các trang Coursera thật đã lưu
pnpm build   # tsc --noEmit + vite (background/panel) + vite content (1 file content.js duy nhất)
```

Cấu trúc source:

```
src/
  content/
    main.ts            # điểm vào content script, nhận lệnh từ panel
    progress.ts        # toast tiến trình (của prototype, cho 2 flow skip)
    features/          # mỗi tính năng một file: skip-video-reading, skip-discussing,
                       # submit-assignment, request-peer-grading, peer-review,
                       # auto-quiz, editor-fill, file-upload, question-extract...
  panel/panel.ts       # giao diện side panel
  background/sw.ts     # service worker
  platform/            # hạ tầng dùng chung: coursera-dom, coursera-api, finder,
                       # gemini, gemini-error, logger, bridge, random
tests/                 # test suite + fixtures (trang thật)
analysis/              # bằng chứng giải mã prototype (v1–v4) — nguồn sự thật khi port
docs/                  # release notes, tài liệu nghiên cứu
```

**Nguyên tắc port:** logic phải khớp prototype; mọi điểm bằng chứng giải mã không đủ rõ đều được ghi chú ngay trong code và trong issue tương ứng thay vì tự suy diễn. Các thay đổi lệch khỏi prototype (khi bắt buộc vì UI/API hiện tại đã khác) đều được đánh dấu rõ là deviation kèm lý do.

## Phạm vi và giới hạn

- Không gọi bất kỳ API nào của vendor (cosemira); cổng kiểm tra license của prototype được thay bằng noop.
- Các flow dùng Gemini cho bài được chấm AI hoạt động fill-only: extension không tự nộp thay người dùng.
- Thao tác không thể đảo ngược (ví dụ chuyển một bài sang chấm peer) chỉ chạy khi người dùng bấm đúng nút chức năng đó trong panel.
- Chỉ hoạt động trên các trang khoá học `coursera.org/learn/...`.

## Trạng thái

**V1 (v1.0.0)** — xem ghi chú phát hành tại [docs/RELEASE-V1.md](docs/RELEASE-V1.md).
