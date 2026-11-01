# Thống kê các dạng bài Coursera & giải pháp automation

Ngày: 2026-10-31. Nguồn bằng chứng: bộ giải mã prototype (`analysis/` v1–v4), code clone hiện tại trên `main`, 5 trang Coursera thật đã lưu và kiểm chứng bằng harness jsdom, và 1 lượt trinh sát live chỉ đọc (tài khoản của user) vào khoá *Introduction to Research for Essay Writing*.

## 1. Thống kê theo dạng bài

### A. Nội dung học (không nộp bài)

| # | Dạng bài | Cơ chế automation | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| 1 | Video | Đánh dấu hoàn thành qua API + reload (hàm `dD`) | Đã port 1:1 | Giải mã prototype; chưa verify live đầu-cuối |
| 2 | Reading | Cùng luồng `dD` | Đã port 1:1 | Như trên |
| 3 | Discussion prompt | Tự đăng phản hồi (hàm `vD`, nội dung từ kho từ ngẫu nhiên) | Đã port 1:1 | Giải mã prototype; chưa verify live |
| 4 | Coach / item đặc biệt trong luồng skip | Cần GraphQL doc `cD` trong bundle prototype | **Chưa làm được** — hiện log + bỏ qua | Thiếu bundle gốc |

### B. Quiz (làm trong attempt)

| # | Dạng câu hỏi | Cơ chế | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| 5 | Radio (1 đáp án) | Trích xuất → Gemini 1 lần gọi theo schema → điền; tuỳ chọn tự nộp | **Hoạt động** | 2 trang thật: Module 2 Quiz 10/10 câu, Advanced Argument 5 câu |
| 6 | Checkbox (nhiều đáp án) | Cùng pipeline, đáp án nối bằng `\|` | **Hoạt động** | Advanced Argument: 2/2 câu "check all that apply" |
| 7 | Text (trả lời ngắn) | Cùng pipeline, Gemini sinh câu trả lời ngắn, điền textarea | Đã code, **chưa có mẫu thật** | Chưa trang mẫu nào có dạng này |
| 8 | Câu hỏi/đáp án có hình ảnh | URL ảnh được nối vào term gửi Gemini | Đã code | Chưa có mẫu thật |

Ghi chú: file *Citing Sources and Formatting Quiz* user lưu là trang bìa (chưa mở attempt) nên không có câu hỏi trong DOM — không dùng kiểm chứng được.

### C. Assignment (có nộp bài)

| # | Dạng | Cơ chế | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| 9 | Phần trả lời viết (text part) | Trích xuất theo `data-testid="part-Submission_*"` → Gemini (gộp cả đề 1 lần gọi) → điền editor (cơ chế Slate `hx`/`i`), fill-only, user nộp tay | Đã code | Kiểm chứng trích xuất trên trang mẫu; điền live chưa chạy trọn (bị Gemini 503 chặn ở lần thử live) |
| 10 | Phần upload file (file part) | Gemini soạn nội dung → tạo `answer_part_<n>.txt` → đẩy vào Uppy bằng DataTransfer | Đã code | Trang Capstone thật: trích xuất đúng 4/4 file part; upload live chưa hoàn tất (cùng lần thử 503) |
| 11 | Bài peer-graded (nộp cho bạn học chấm) | Luồng nộp tự động `mD` + biến thể fill bằng Gemini | Đã port | Dùng chung machinery với #9/#10 |
| 12 | Bài AI-graded thuần | Như #9/#10, khác đường chấm | Đã code | Mẫu Capstone + trạng thái live (xem mục D) |
| 13 | Programming / công cụ ngoài (Jupyter…) | — | **Ngoài phạm vi** (prototype gốc cũng không có) | — |

### D. Các luồng phía chấm điểm

| # | Luồng | Cơ chế | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| 14 | Disable AI grading / xin chấm bằng peer (`d2`) | Đọc branchId + metadata từ trang → GET REST permissions lấy submissionId → POST GraphQL `PeerReviewAi_RequestGradingByPeer` → reload khi 200 | **Chưa rõ điểm gãy** — phía trang đã verify đúng trên markup hiện tại; tầng API chưa kiểm chứng | Live 2026-10-31: bài *Annotated Bibliography Assignment Feedback* đã nộp, bị AI chấm 0/10, trang `/submit` có đủ block "AI Grading", nút Like/Dislike và nút **"Switch to peer grading"** — đúng trạng thái mà `d2` phục vụ |
| 15 | Chấm bài cho peer (`_D`/`Pd`) | Cào DOM trang review: chọn đáp án theo luật spread, điền "Good ", nộp | **Đã sửa cho giao diện mới** (PR #29, đã merge) | Trang review thật: test jsdom 7/7. Live bổ sung: trang hub `/give-feedback` có bộ đếm **"4 left to complete"** và nút **"Start Reviewing"** — vòng điều hướng vào review của `_D` vẫn đang bám selector cũ, cần sửa tiếp (mục 3) |
| 16 | Xem điểm / review đã nhận | — | Không automation (prototype không có) | — |

### E. Tính năng nền tảng của tool gốc

| # | Tính năng | Trạng thái |
|---|---|---|
| 17 | Shareable link (`yy`) | Đã giải mã, chưa port |
| 18 | Bypass locked browser (`script.js`, v3) | Đã giải mã, chưa port |
| 19 | Quiz bank của vendor (`/quiz`, `/contribute`) | Cố ý không làm — đã thay bằng Gemini |

### Tổng số

- 14 export trong content script của prototype: đã port 10, stub có chủ đích 1 (`Cr` — cổng license), thay thế bằng Gemini 2 cụm (bank), chưa port 1 (`yy`).
- Dạng bài có bằng chứng trang thật: quiz radio, quiz checkbox, assignment file part, peer review, trạng thái AI grading (live).
- Dạng bài chưa có bằng chứng thật nào: discussion, quiz text, shareable link; và 2 đầu-cuối chưa chạy trọn live: upload Uppy, mutation của `d2`.

## 2. Bài học từ các vụ gãy

1. Mọi selector bám class hash (`.css-*`) đều là nợ kỹ thuật — Coursera build lại là gãy (peer review là ví dụ điển hình: 4 điểm gãy cùng lúc).
2. Selector bám `data-testid` và bám chữ hiển thị ("Submit Review", "left to complete") sống sót qua lần đổi giao diện này.
3. Luồng đi qua API (REST/GraphQL như `d2`) ổn định hơn DOM, nhưng khi gãy thì im lặng — bắt buộc phải có log có cấu trúc tại sidebar (đã có) để nhìn thấy status + body lỗi.
4. Mẫu trang thật + harness jsdom là cách kiểm chứng rẻ và đáng tin nhất hiện có: cả 3 vụ (quiz, Capstone, peer review) đều chốt được bằng chứng theo cách này trước khi đụng vào tài khoản thật.

## 3. Giải pháp automation (đề xuất)

**Nguyên tắc chung**
- Ưu tiên tầng API (như `d2`) > `data-testid` > neo theo chữ hiển thị > class hash (tránh). Mọi selector đều có fallback xếp tầng và log rõ tầng nào khớp.
- Mỗi flow DOM phải có ít nhất một trang mẫu thật trong harness kiểm chứng; khi Coursera đổi giao diện, chạy lại harness là biết ngay selector nào chết.
- Giữ chính sách an toàn hiện tại: AI fill-only + nộp tay; thao tác không hoàn tác được (chuyển peer grading) không tự chạy khi chưa có lệnh riêng.

**Lộ trình cụ thể**

| Ưu tiên | Việc | Cần gì |
|---|---|---|
| P0 | Chốt `d2`: một lần chạy có giám sát trên bài *Annotated Bibliography* (đang 0/10, có sẵn nút Switch) — đọc log sidebar để thấy status/body của mutation; nếu API đã đổi, sửa theo phản hồi thật | Lệnh riêng của user vì thao tác không hoàn tác được |
| P0 | Sửa nốt vòng điều hướng `_D` theo hub mới: ở trang `/give-feedback` thì bấm "Start Reviewing", đọc bộ đếm theo mẫu chữ "left to complete" thay cho `[data-testid="review-count"]` | 1 file HTML của trang give-feedback (user lưu như các lần trước) để chốt testid của bộ đếm |
| P1 | Verify live đầu-cuối upload Uppy (chạy lại Capstone khi Gemini hết 503) | Một lần chạy live |
| P1 | Tìm một quiz có câu hỏi dạng text để verify dạng #7 | Trang mẫu quiz đang trong attempt có câu text |
| P2 | Port shareable link (`yy`) — giải mã đã xong, công việc nhỏ | — |
| Ngoài phạm vi | Programming assignment, quiz bank vendor | Không làm |

## 4. Điểm chưa khớp cần user xác nhận

Lượt trinh sát live **không tìm thấy** bài nào tên "Submit Your Topic and Research Questions" trong khoá *Introduction to Research for Essay Writing* (đã rà Module 1–5 + trang Grades). Bài khớp mọi dấu hiệu AI grading trong khoá này là *Annotated Bibliography Assignment Feedback*. Trang review đã lưu có thể thuộc một khoá khác trong cùng chuyên ngành (Academic English: Writing) — không ảnh hưởng kết luận về markup peer review, nhưng cần user xác nhận khoá/bài đúng nếu muốn test `d2` trên đúng bài đó.
