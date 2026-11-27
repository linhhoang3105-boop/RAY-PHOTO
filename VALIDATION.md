# Kiểm tra bản tích hợp

- 55/55 bài kiểm tra canvas, video, mẫu và makeup chạy thành công với Node test runner tuần tự.
- Inline JavaScript của editor được đối chiếu nguyên văn với source/buong-toi-original.html; không đổi thuật toán. 86 preset được trích từ bản gốc.
- Browser kiểm tra: mở ảnh WEBP, chọn Gold 200, xuất JPEG thực, tải JPEG thành công, chuyển ảnh đã chỉnh vào photobooth, album hiển thị bản xuất.
- Kiểm tra cú pháp JavaScript; Capacitor sync Android/iOS thành công.
- Toàn bộ đường dẫn PWA precache tồn tại. Mô hình AI được đóng gói cục bộ.
- Chưa biên dịch Android/iOS vì môi trường không có SDK/Xcode; chưa chạy plugin lưu Photos trên thiết bị thật. Chưa ký AAB/IPA, chưa nộp kho.
- Bài makeup bất đồng bộ từng bị timeout khi chạy tất cả suite song song; chạy riêng và bộ suite tuần tự đều qua.

## Giao diện 25/10/2026

- Chính tả/nhãn người dùng: Trang điểm (Makeup), Photobooth, Chỉnh dáng, Màu phim; đổi Film Exposure thành Phơi sáng phim ở lớp giao diện.
- Browser kiểm tra desktop và viewport rộng 390px: trang chủ, Makeup, Chỉnh dáng và Photobooth. Các nút mở đúng nhóm công cụ; trang điểm/chỉnh dáng có tiêu đề và hướng dẫn riêng.
- Đồng bộ nền than chì, chữ vàng/trắng cho cả trình chỉnh ảnh và photobooth; màu thật của template/ảnh được giữ.
- CSS qua parser esbuild, JavaScript qua node --check; ID HTML không trùng. Script gốc vẫn giữ nguyên văn.
- Tìm nguồn tham khảo và đối chiếu tại DESIGN-REVIEW.md. Không tuyên bố độc quyền thiết kế.

## RAY PHOTO — phông và kho ảnh

- Phông Noto Serif thường/nghiêng và Be Vietnam Pro 400/500/600 đóng gói WOFF2 cục bộ; kiểm tra cmap đủ 102 ký tự đặc thù tiếng Việt ở từng tệp. Giảm tracking âm, kiểm tra tiêu đề “Chất phim”, “Chất riêng”, “Bốn cách”, “Kho ảnh của bạn”.
- Số lượng từ dữ liệu thật: 85 preset không bao gồm id goc (86 cấu hình tổng); Photobooth 9 preset + Gốc.
- Kiểm tra trình duyệt thực: thêm WEBP vào kho → mở ảnh → chỉnh Gold 200 → lưu JPEG tên ray-photo → quay lại kho thấy hai tệp gốc/đã chỉnh → tải lại trang vẫn có hai tệp; lọc Đã chỉnh còn đúng 1 tệp; tìm không khớp hiện hướng dẫn.
- Kiểm tra màn hình 390px: RAY PHOTO và Kho ảnh, không tràn tiêu đề hay dấu rời. Chưa chạy Windows/iPhone thật trong môi trường này.
- Thay tên hiển thị web/PWA/Android/iOS thành RAY PHOTO, giữ nguyên ID/khóa dữ liệu.

## RAY PHOTO — vùng ảnh lớn, dải lọc nhỏ (v16)

- Gộp màn chỉnh ảnh về một header Mở / Photobooth / Lưu; ẩn các header và nút lưu lặp trong editor nhúng. Nhãn RAY PHOTO có dòng “by Linh Linh”.
- Ảnh giữ đúng tỉ lệ, tận dụng vùng còn lại; 86 lựa chọn nằm trong dải cuộn ngang, ô nhỏ 60px trên mobile. Ảnh thu nhỏ dùng renderer gốc, chỉ dựng khi gần vùng nhìn; trạng thái chỉnh ảnh được khôi phục sau từng lần dựng thumbnail.
- Bảng Điều chỉnh / Makeup / Chỉnh dáng mở riêng bên dưới, nút Xong trở lại dải lọc; tìm màu xong tự đóng ô tìm kiếm. Dấu ngày và đổi hạt vẫn truy cập được.
- Browser QA ở khung 390×780 và 320×640: ảnh ngang hiển thị rộng 380px; ảnh dọc 3:4 hiển thị 278.39×371.19px trên khung nhỏ. Kiểm tra chọn Gold 200, thay Nhiệt màu, mở Makeup, chọn vùng Eo và hiện vòng chỉnh dáng.
- Browser trang trực tiếp: xuất và tải JPEG thật 1536×1024 (482,931 byte), xác minh giải mã bằng Pillow; chuyển ảnh đã chỉnh vào ô 1 của Photobooth thành công. Sự kiện download không được trả ở harness iframe lồng; cùng nút ở trang trực tiếp tải thành công.
- JavaScript qua parser Node, hai stylesheet qua esbuild; script xử lý gốc vẫn khớp nguyên văn và SHA256 1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63.
- Kiểm tra mobile bằng viewport trong trình duyệt; chưa phải kiểm thử trên iPhone/Android thật.
