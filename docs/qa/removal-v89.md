# RAY PHOTO v89 — kiểm tra xóa vật và bảo vệ chủ thể

Ngày: 2026-11-15. Ảnh thử là `dist/assets/golden-hour.webp` đã có trong ứng dụng. Không đưa ảnh người dùng gửi vào mã nguồn hay bản công khai.

## Đã xác minh

- 59/59 bài kiểm tra trong remove-protection, remove, remove-quality, remove-apply, photo-edit, quality, preset-export-safety và region-paint đạt. Vùng xanh giữ nguyên từng byte khi cọ xóa đè qua, nới viền, dựng bản vá ở tỷ lệ không nguyên và khôi phục nháp/hoàn tác. Bản vá trước đó cũng bị cắt khỏi vùng xanh khi mở nháp có ảnh gốc.
- Giao diện cục bộ: tô vùng giữ trên người, tô vùng xóa chạm sang vùng giữ, bấm nút ✓ thật, hoàn tác/làm lại, lưu nháp và tải ảnh JPEG 1536 × 1024 (596390 byte). Ảnh `removal-v89-guard.jpg` là vùng thử bằng bút, không phải bằng chứng inference AI trong trình duyệt.
- MagicTouch float32 version 1, đúng tệp đóng gói: SHA-256 `e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25`, 6227884 byte. Chạy bằng MediaPipe Python 0.10.21 CPU trên ảnh 960 × 640, chạm (0.806, 0.61): đầu ra **một** confidence mask foreground, mức tại điểm chạm 1.0, vùng >=0.4 chiếm 4.6165% ảnh; khoảng 0.51 giây trên máy QA. `removal-v89-cpu-mask.png` lưu đúng kết quả mô hình này để kiểm thử đường đọc một kênh và chọn thành phần liên thông. Thời gian này không đại diện tốc độ điện thoại.
- PoseLandmarker Lite CPU, num_poses=6, min detection/presence=0.4: trả 2 mặt nạ, một phủ chủ thể (6.0921% ảnh ở ngưỡng 0.5), một rất nhỏ (0.0877%). Kết quả có thể nhận dư; cần xem lại vùng giữ. Không coi số mask là số người đúng tuyệt đối.
- Runtime AI chỉ tải mã/WASM/mô hình, không gửi ảnh tới máy chủ inference. Đồ thị đóng sau mỗi lượt; tác vụ worker hủy được. Trả lỗi ngắn và hướng dẫn bút giữ khi đồ họa AI không chạy.
- Build production Sites hoàn tất. HTML độc lập offline dựng được cùng mô hình và các module mới; chưa kiểm thử inference AI từ HTML đó trên điện thoại.

## Giới hạn còn lại

Trình duyệt QA không tạo được WebGL context cho MediaPipe, kể cả delegate CPU, nên chưa kiểm chứng inference trực tiếp qua trình duyệt hoặc iPhone thật. Đã kiểm chứng mô hình thật bằng CPU Python, API Web bằng bài kiểm tra và các thao tác bút/vá/xuất qua trình duyệt; các phần này không thay thế cho thử Safari thật.

Mô hình có thể chọn thiếu hoặc dư. Chỉ pixel trong vùng xanh được khóa; phải bổ sung vùng giữ nếu AI bỏ sót. Nếu tự nhận người lỗi và chưa có vùng giữ thủ công, thao tác xóa dừng lại với hướng dẫn, không âm thầm bỏ bảo vệ. Ảnh không có người có thể tắt Tự bảo vệ người.

Bộ vá vẫn tổng hợp từ nền còn lại trong ảnh. Bỏ trung bình nhiều mẫu giúp giữ kết cấu nguồn, nhưng mảng xóa lớn trên cây/hoa nhiều lớp vẫn có thể lộ mối nối hoặc lặp cảnh. Chưa đạt chất lượng Clean Up của iPhone. Ảnh JPEG đã xuất mất chi tiết cần quay lại ảnh gốc/nháp; vùng giữ không tạo lại chi tiết đã bị xóa khỏi một tệp phẳng.

Engine màu nội tuyến được đối chiếu SHA-256 với `source/engine-sha256.json`. Không đổi thứ tự hoặc thuật toán màu.
