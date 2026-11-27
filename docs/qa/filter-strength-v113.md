# Cường độ tổng Bộ lọc — v113

## Hành vi

Bộ lọc thông thường trước đây không có thanh chỉnh cường độ. Nút Nhẹ là chế độ tối ưu xem trước, không làm giảm màu. Thêm thanh Cường độ tổng 0–100% ngay dưới hàng tên bộ lọc, bên ngoài AI Composer. Điều khiển tất cả 89 màu có sẵn, gồm Thu Nhật, và toàn bộ lớp của công thức Màu của tôi vừa chọn. Màu mới được thử ở mức đang dùng. Chọn Gốc hoặc đặt lại màu đưa thanh về 100% và vô hiệu khi không có màu cần chỉnh.

0% bỏ đóng góp của preset đang chọn; 100% là công thức native đầy đủ. Các lớp đã làm trước, chỉnh sáng độc lập, Makeup, tóc, body, hình/vị trí/mềm mép vùng, seed, hướng nắng, khung và chữ ngày không thuộc đóng góp màu sẽ giữ. Vùng trong/ngoài và mặt nạ của từng lớp vẫn dùng engine có sẵn.

## Kiến trúc

`filter-strength-core.js` giữ bản tham chiếu bất biến 100% của các biên độ hiệu ứng được preset sở hữu. Mỗi lần đổi phần trăm tính lại từ tham chiếu, tách chênh lệch chỉnh tay độc lập và giữ phần ấy khi thay mức. Cường độ lớp cá nhân chỉ trỏ đến đúng ID nhóm vừa thêm; không viết lại các lớp khác, không bật lại lớp tắt và không tạo lại lớp đã xóa. Các tham số như vị trí/hình vùng, góc, seed, kiểu, khung, bool và nhận diện không được nhân phần trăm.

Đây là phép điều phối biên độ thông số native, không cam kết mỗi pixel ở 50% là trung bình số học của ảnh 0% và 100%. Các engine có đường cong và ngưỡng riêng, ví dụ grain có sàn biên độ khi bật. Thuật toán màu, ánh sáng, grain/blur, Makeup và bộ preset gốc không sửa.

`filter-strength.js` cung cấp thanh chung và các hook chọn màu có sẵn/công thức cá nhân. Tham chiếu có giới hạn chỉ chứa tham số, lưu trong `P.rayFilterStrength` theo snapshot nháp/lịch sử sẵn có; không chứa pixel hay dữ liệu AI. Ghi mới bất biến để không sửa các snapshot cũ. Khi chuyển bước, metadata được xóa khỏi trạng thái P đã làm sạch; khi hoàn tác/khôi phục nháp, UI đọc lại đúng mức, gồm nháp cũ chưa có metadata. Thay ảnh nhưng giữ thông số hiện tại giữ luôn tham chiếu màu, tránh mất màu khi thay ở 0%.

Công thức tái sử dụng chỉ lưu thông số hiệu lực qua whitelist màu có sẵn, không chứa metadata riêng hay tham chiếu ảnh. AI Composer vẫn có tham chiếu và thanh riêng; so sánh/hủy Composer khôi phục đúng trạng thái Bộ lọc trước đó.

## Kiểm chứng

31 kiểm thử mục tiêu đạt: core độc lập, DOM của thanh bên ngoài Composer, cùng ảnh render qua engine native cho tất cả 89 preset, gồm Thu Nhật; so sánh chính xác 0%/100%, 20→80→20 không tích lũy, công thức nhiều lớp, lớp bị tắt/xóa, mặt nạ, hoàn tác, nháp ở 0%, đổi ảnh ở 0%, nháp cũ, JSON công thức và so sánh/hủy Composer. Pixel nguồn không đổi, kích thước render giữ nguyên.

Hồi quy toàn bộ: **760 bài, 758 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa chuyên biệt). Build thành công. Gói chỉnh ảnh HTML v113 có 83 script inline parse thành công, không còn script ngoài. Chín tệp runtime đã thay đổi/thêm đối chiếu byte với output build trước đóng gói. **187 file dist** khác, toàn bộ source Composer và catalog preset giữ nguyên; engine inline gốc giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`. Không có công cụ trình duyệt được hỗ trợ trong phiên này; DOM/native Canvas không thay cho thử cảm ứng và bố cục trên iPhone thật.
