# Hồ sơ phát hành — RAY PHOTO

Tên gợi ý: **RAY PHOTO — Ảnh phim**
Mô tả ngắn: **Chỉnh màu phim, làm đẹp và tạo photobooth mang dấu ấn của riêng bạn.**

Mô tả: Một xưởng ảnh nhỏ trong điện thoại. Chọn một cuộn phim, chỉnh ánh sáng và chất giấy, làm đẹp hoặc chỉnh dáng theo ý thích. Ghép ảnh và video vào khung photobooth Linh Linh – Phố Cảng, sửa lời nhắn và lưu lại kỷ niệm. Ảnh được xử lý trên thiết bị. Không cần tạo tài khoản.

Privacy URL: https://pho-cang-photobooth.tenderdace128.chatgpt.site/privacy.html
Support URL: https://pho-cang-photobooth.tenderdace128.chatgpt.site/support.html
Icon 1024: dist/icons/icon-1024.png. Icon Google Play: dist/icons/icon-512.png.

## Việc chủ app cần hoàn tất

- Chọn mã định danh ứng dụng thuộc tài khoản, tên người/đơn vị phát hành và email hỗ trợ thật; thay trang hỗ trợ hiện tại trước nộp.
- Tạo hồ sơ Google Play Console / App Store Connect và chứng chỉ ký. Không chia sẻ mật khẩu hay khóa riêng trong chat.
- Biên dịch và kiểm thử trên Android/iPhone thật; chụp ảnh màn hình từ chính bản đã build, đủ kích thước kho yêu cầu. Không dùng hình minh họa thay cho ảnh chức năng thật.
- Kiểm tra lưu ảnh và video vào Photos, từ chối/cấp lại quyền; đóng app/mở lại album; chuyển nền; xoay video; chỉnh chữ; nhập nhiều tệp; video dài và thiếu dung lượng.
- Khai báo Data Safety / App Privacy theo bản build cuối cùng. Hiện không có đăng nhập, quảng cáo, phân tích hay gửi ảnh đến backend; album và nhận diện AI xử lý cục bộ. Kiểm tra SDK/phụ thuộc nếu thêm tính năng khác.
- Chọn phân loại nội dung và trả lời bảng câu hỏi thực tế; điền quyền sử dụng nội dung và thông tin nhà phát hành theo tài khoản thật.
- Android target API 36; iOS dùng Xcode theo yêu cầu hiện hành của Apple. Các yêu cầu có thể đổi, kiểm tra lại trước ngày nộp.
- TestFlight / internal testing trước production. Không có cam kết app được duyệt chỉ vì đóng gói thành WebView.

## Giới hạn đã biết

Bản native chưa chạy máy thật trong môi trường này. Chất lượng nhận diện da/tóc/dáng phụ thuộc ảnh; nên kiểm tra bằng ảnh chân dung/toàn thân rõ. Live Photo trên iPhone có thể chỉ được bộ chọn web đưa vào dưới dạng ảnh tĩnh; xuất Live Photo thành video để giữ chuyển động. Codec video tùy hệ điều hành; app giữ cơ chế fallback MP4/WebM và ảnh tĩnh, không hứa mọi MOV/HEVC đều giải mã được. Khung video hiện không thu âm. Trình duyệt iOS lưu qua Chia sẻ → Lưu ảnh/video hoặc nhấn giữ ảnh; bản native dùng Photos trực tiếp.

Tài liệu chính thức:
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/11926878
