# Kiểm chứng nhuộm tóc v102

## Lỗi được sửa

Bộ nhuộm trước giữ gần nguyên độ sáng ảnh gốc và giới hạn độ phủ ở 90%, khiến tóc sáng chọn màu đen vẫn sáng, tóc tối chọn màu be vẫn tối. Mặt nạ đa lớp cũ xóa hoàn toàn xác suất tóc dưới 0.45 và tiếp tục ép cạnh tóc thấp hơn.

Bản sửa dùng mốc sáng có trọng số riêng cho từng người, đường cong sắc độ đơn điệu và màu trong không gian ánh sáng tuyến tính. Mẫu tóc có độ sáng 45 chọn be #bd9967 ở 100% từ [55,44,29] thành gần [189,153,103]; mẫu tóc sáng 210 chọn đen #24262b thành gần [36,38,43]. Đây là mẫu tổng hợp đồng nhất, không phải cam kết mọi pixel tóc phải giống ô màu. Sáng tối, bóng và mép hòa với nền vẫn khác ô màu.

## Nhận diện

Bổ sung hair_segmenter.tflite sau phân vùng đa lớp, theo thứ tự và đóng từng mô hình. Mặt nạ mềm được bảo vệ bằng nhận diện da/nền/quần áo, gắn với lõi tóc đã biết, mở rộng có giới hạn. Giữ nguyên byte của mặt nạ da và foreground. Trường hợp tóc chuyên dụng lỗi hoặc trả sai nhãn vẫn giữ bản đa lớp.

Thử ba ảnh thật bằng mô hình CPU đóng gói: chân dung tóc tối, chân dung tóc bạc và ảnh hai người với mèo. Diện tích phủ mềm tăng xấp xỉ 10.0%, 18.5% và 17.0% so với mặt nạ cũ. Đây là chỉ số chẩn đoán, không phải độ bao phủ so với nhãn tóc do người đánh dấu. Mô hình tóc đơn lẻ nhận nhầm lông mèo; bản kết hợp đã chặn phần đó.

Với ba màu be/đen/tím, alpha ảnh không đổi; không pixel da/nền có xác suất nhận diện >0.90 thay đổi RGB quá 3. Vùng lông mèo kiểm tra riêng gồm 28,000 pixel giữ nguyên toàn bộ. Các ảnh tham khảo và mặt nạ người dùng không được đưa vào tài nguyên website.

## Kiểm tra chức năng

Kiểm tra gồm màu bảng chọn trên tóc tối/sáng/bạc, giữ vân và bóng, mức 0, alpha, da, chủ thể khác, mép mềm, tải mô hình/đóng tài nguyên, nhãn tóc, fallback, chuyển worker bằng toString, cọ/tẩy, hoàn tác, xuất PNG, nháp và xoay ảnh. Kiểm tra xoay tóc với hai màu độc lập giữ đúng từng byte và không nới điều kiện cũ.

Build server và bản HTML độc lập được chạy trên nguồn đã cập nhật. Môi trường không cung cấp cua_repl để thử trình duyệt theo quy trình Sites, vì vậy chưa xác minh thao tác trên Safari/iPhone thật.

## Giới hạn

Không có mặt nạ chuẩn do người đánh dấu để đo độ nhạy từng sợi. Tóc rất mảnh hoặc cắt ngang mặt vẫn có thể sót; vùng giao nhau giữa hai người được giữ thận trọng. Bản nháp cũ dùng vùng nhận diện cũ cho đến khi bấm Nhận diện lại.
