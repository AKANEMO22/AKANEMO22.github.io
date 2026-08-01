# ADY Study Lab

Website học và kiểm tra bốn đề ADY201m gần nhất:

- SP26-FE — 18/04/2026
- FA25-FE — 18/11/2025
- SU25-FE — 31/07/2025
- FA24-RE — 20/11/2024

Mỗi đề có đúng 50 câu và giữ ảnh đính kèm gốc ở độ rộng 1920 px. Nội dung chữ
được OCR hai lượt, sau đó đối chiếu lại trước khi đưa vào ngân hàng câu hỏi.
File `ADY201m-4-de-anh-goc.zip` chứa toàn bộ 200 ảnh cùng bốn manifest SHA-256.

## Chạy trên localhost

Nhanh nhất: nhấp đúp `C:\Users\hachimi\Downloads\ôn\MO-ADY201m.bat`.

Hoặc chạy thủ công:

```powershell
cd "C:\Users\hachimi\Downloads\ôn\luyen-tap-50-cau"
npm run dev
```

Mở địa chỉ `Local` được in trong cửa sổ lệnh. Website lưu kỷ lục, số lượt làm và
tiến độ lộ trình bằng `localStorage`, không gửi dữ liệu học tập ra bên ngoài.

## Chế độ học

- **Học & xem giải thích:** mở sẵn đáp án, dịch câu hỏi và toàn bộ lựa chọn sang
  tiếng Việt, sau đó ưu tiên infographic, luồng suy luận, bản đồ đáp án màu và
  móc ghi nhớ ngắn. Phần giải thích dài được thu gọn trong “Đọc thêm khi cần”.
- **Kiểm tra:** giữ kín đáp án đến lúc nộp bài, có đồng hồ và bản đồ 50 câu.
- **Ảnh gốc:** mở ảnh độ phân giải cao để tự đối chiếu với OCR.
- **Độ trùng đề:** hiển thị phần trăm và từng cặp số câu trùng giữa sáu cặp đề.

## Kiểm tra dữ liệu và bản dựng

```powershell
npm test
```

Bộ kiểm tra xác nhận mỗi đề có 50 câu, ảnh nguồn tồn tại và đủ 200 bài học. Mỗi
bài học phải phân tích đúng số lựa chọn, có đúng một đáp án đúng, đủ ví dụ và
minh họa, đồng thời kiểm tra lại báo cáo trùng đề.

## Cấu trúc dữ liệu

- `data/exams/*.json`: câu hỏi đã chuẩn hóa và giải thích đáp án.
- `data/lessons/*.json`: 200 bản dịch và bài giảng chuyên sâu bằng tiếng Việt.
- `data/comparison.json`: số liệu và từng cặp câu trùng đã được agent kiểm tra.
- `data/ocr-raw/*.json`: kết quả OCR hai lượt để truy vết.
- `data/qa/*.md`: ghi chú đối chiếu và các điểm cần lưu ý.
- `public/exams/*/images`: 200 ảnh đính kèm gốc.
- `public/exams/*/manifest.csv`: kích thước, định dạng và SHA-256 của từng ảnh.

## SSG105

Tab `/ssg105` bổ sung phần SSG105 từ cùng bộ Google Slides. Deck có 507 slide; slide 377 là mốc môn học và 130 câu SSG105 nằm liên tục từ slide 378 đến 507.

- 130 ảnh nguồn PNG sạch 960 × 540 tại `public/ssg105/source`.
- Ba bộ luyện, mỗi bộ đúng 50 câu. Hai bộ đầu phủ 100 câu, bộ ba gồm 30 câu còn lại và 20 câu trọng tâm được lặp có chủ đích.
- Đáp án và lời giải lấy từ speaker notes; chín bản ghi thiếu trường được bổ sung bằng đối chiếu ảnh, OCR và kiểm tra đáp án độc lập. Dữ liệu gốc vẫn được giữ nguyên để truy vết.
- Trang có chế độ học có lời giải, chế độ kiểm tra, lưu kết quả cục bộ, thống kê câu được xếp lặp và gợi ý chủ đề nên ưu tiên.

Tạo lại dữ liệu và chạy bộ kiểm chứng riêng:

```powershell
npm run build:ssg105
npm run validate:ssg105
```

Báo cáo kiểm chứng nằm trong `data/ssg105/audit`; OCR độc lập bằng RapidOCR nằm tại `data/ssg105/ocr-raw/rapidocr.json`.
