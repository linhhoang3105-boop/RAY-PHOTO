# Sửa lỗi vùng tóc biến mất v103

## Tái hiện

Bản v102 chỉ mở rộng vùng tóc từ pixel đa lớp cũ trên 80/255. Khi mô hình đa lớp yếu ở toàn đầu, hàng đợi rỗng và bước lọc cuối xóa hết vùng tóc chuyên dụng, không trả lỗi. Tái hiện bằng ảnh chân dung đã làm mờ: mô hình tóc thật tìm được 8,497 pixel có xác suất >0.75 nhưng engine v102 trả mặt nạ toàn 0.

Ngoài ra, ảnh mặt nhỏ có vùng đa lớp dùng được nhưng bước chi tiết làm mất đủ pixel để khóa giao diện. Giao diện nhóm lại dùng ngưỡng khác bộ vẽ toàn ảnh, nên có trường hợp nút mở nhưng màu không lên. Sau khi chỉ quét mày, đổi sang Tóc không quét tự động và nhãn nút cũ không giải thích tóc chưa được quét.

## Sửa

Mô hình tóc rất chắc chắn và có bằng chứng tóc đa lớp vừa đủ được phép tạo lõi mới. Bảo vệ da/nền/quần áo và mở rộng có giới hạn vẫn giữ. Nhận diện chi tiết không dùng được giữ vùng đa lớp; quét lại cùng ảnh giữ vùng tóc cũ khi cần và hiện cảnh báo. Việc giữ chỉ áp dụng tóc, không thay da/foreground mới và không dùng dữ liệu ảnh khác.

Readiness tóc dựa vào diện tích alpha hữu dụng và mức chắc chắn tối thiểu; bộ vẽ dùng mặt nạ/chủ thể thay vì cờ toàn ảnh trong nháp. Nhãn quét tóc và hướng dẫn phân biệt rõ với quét mày. Không tự tải/chạy mô hình khi chỉ đổi tab. Cảnh báo mức tin cậy được đưa đến hai màn hình makeup.

## Xác minh

100 kiểm tra liên quan đạt, gồm runtime/worker, fallback, chủ thể, màu/vân tóc, chuyển tab, handler quét thật, khác ảnh, nháp, hoàn tác, xoay, ghép nền và xuất ảnh. Kiểm tra handler dùng chính đoạn script giao diện, không thay điều kiện để bỏ qua lỗi.

Dữ liệu từ hai mô hình CPU thật được chạy qua engine sản phẩm ở năm ảnh/trường hợp:

- Tóc tối, tóc bạc và nhóm có mèo giữ các kiểm tra bảo vệ da/nền/alpha. Vùng lông mèo 28,000 pixel không đổi.
- Ảnh mờ trước trả toàn 0; sau có 2,440 pixel tóc khác 0, 930 pixel trên 80/255 và cảnh báo tóc chưa chắc chắn. Mới phục hồi một phần, không tuyên bố nhận đủ toàn bộ mái tóc.
- Mặt nhỏ giữ đúng 548 pixel tóc khác 0/329 pixel lõi của vùng đa lớp và báo dùng lại vùng cũ.

Không đưa ảnh người dùng vào tài nguyên website. Build server và HTML độc lập được kiểm tra. Môi trường thiếu công cụ cua_repl cho QA theo quy trình Sites, nên chưa xác minh trên Safari/iPhone thật. Truy cập HTTP máy kiểm tra bị lớp CDN chặn tự động; điều này không được dùng làm bằng chứng rằng thiết bị người dùng gặp lỗi tải mô hình.
