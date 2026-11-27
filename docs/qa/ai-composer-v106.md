# AI Composer ở đầu Filter và Cứu ngược sáng — v106

## Giao diện

Nút AI Composer có hàng riêng ở đầu mục Ảnh / Filter, trước tiêu đề, tìm kiếm và các preset. Nút có nhãn phụ cho biết chức năng tự phối màu/ánh sáng và có Cứu ngược sáng. Không còn phụ thuộc vào khoảng trống cuối thanh tiêu đề vốn bị chật hoặc ẩn trên điện thoại nằm ngang. Mở Composer đặt bảng chỉnh về đầu; đóng lại vẫn giữ các preset cũ bên dưới. Giao diện phong cách trên màn hình rộng dùng hai hàng để giữ nhãn dễ đọc.

## Ngược sáng

Trước v106, các phong cách đã tính chênh sáng chủ thể/hậu cảnh và bù sáng vùng chủ thể. v106 thêm lựa chọn riêng **Cứu ngược sáng** (`backlight`), nằm sau Auto Beauty; giữ nguyên thứ tự tương đối của chín phong cách trước.

Phong cách mới dùng độ sáng chủ thể, nền, histogram, highlight và vùng AI để tính mức xử lý cho mỗi ảnh. Ánh sáng chủ thể được bù cục bộ mạnh hơn khi người tối hơn nền; vùng sáng của nền được hạ riêng. Màu phim dùng mức nhẹ, giới hạn hạt, không tự thêm nắng/flare vào cảnh cần cứu sáng. Khi chỉ có vùng ước lượng, mức bù được giảm để tránh sáng sai vùng. Bốn phương án vẫn chỉnh, tắt/xóa riêng thành phần, đổi cường độ và lưu/thích ứng công thức như các phong cách khác.

Chỉ bổ sung điều phối và mã phong cách trong công thức phiên bản 1; không sửa engine render, thuật toán tone/light, preset catalog, Makeup, tóc hoặc Photobooth. Công thức phiên bản 1 của chín phong cách cũ tiếp tục đọc được.

## Xác minh

Kiểm tra UI production bằng DOM fixture xác nhận Composer đứng đầu Filter, không làm mất thanh preset, bấm Cứu ngược sáng tạo bốn phương án và lưu lại đúng mã phong cách. Các kiểm tra trước/sau, mức 0, không cộng dồn, hoàn tác, xóa từng thành phần và mở lại công thức sau xóa lớp tiếp tục chạy.

Các kiểm tra core và native render bao phủ cả mười phong cách, dùng chính engine ảnh có sẵn. Cảnh ngược sáng tương phản cao được kiểm tra riêng cho sáng chủ thể và bảo vệ nền; bộ nhận diện/mặt nạ không bị thay bằng tác vụ tạo ảnh. Không thể tái tạo chi tiết đã mất hoàn toàn trong vùng ảnh cháy trắng hoặc đen tuyệt đối.

154 kiểm tra liên quan đạt, không lỗi hoặc bỏ qua; gồm Composer, tone/light, lớp/preset, preview, Makeup, tóc và bố cục công cụ. Bộ kiểm tra tập trung sau thay đổi đo sáng da đạt 34/34. So sánh độc lập 108 phương án (3 cảnh × 9 phong cách cũ × 4 lựa chọn) xác nhận JSON kế hoạch giống hệt v105, commit `aaebcb7b19a4df8a460f68503e83ce0938969d33`.

Ảnh thật 480 × 360 được thử cùng các mặt nạ production đã có. Trong cảnh này mặt vốn đủ sáng, chế độ không nâng mặt mạnh chỉ vì áo tối; kết quả giảm nhẹ nền và không lộ viền quanh tóc. Pixel/byte nguồn không đổi. Artifact ở scratch, không đưa ảnh người dùng vào bản phát hành. Build web và bản HTML portable thành công.

Môi trường không có `cua_repl`, nên chưa xác minh trực quan bố cục và cử chỉ trên trình duyệt/iPhone thật. DOM fixture xác minh thứ tự và hành vi, không thay cho kiểm tra thiết bị.
