# Công thức AI và bù sáng khuôn mặt — v117

## Phạm vi

Chỉ nâng cấp AI Composer. Giữ nguyên toàn bộ 90 màu trong Bộ lọc thường, thứ tự/ID/thông số và thuật toán pixel. Không sửa Makeup, tóc, chỉnh dáng, Photobooth, nguồn editor hoặc engine tone/vùng chọn/ánh sáng.

## Công thức và giao diện

- Gộp lựa chọn giao diện Cứu ngược sáng và Phục hồi sáng & nét thành **Cứu sáng & nét** (`restore-detail`). Còn 11 lựa chọn hiển thị; cả 12 ID lịch sử, gồm `backlight`, tiếp tục mở/lưu/phối lại được. Màu phim cứu sáng giữ bảng màu Fuji và các lớp riêng.
- Chỉ gộp phương án có cùng tác động dựng ảnh. Tên, ID, metadata hoặc seed không dùng để dựng pixel không tạo thêm phương án trùng; tham số, thứ tự lớp, hình vùng và seed của hiệu ứng ngẫu nhiên được giữ.
- Mọi phong cách AI có thể yêu cầu tìm mặt còn thiếu một lần trên mỗi ảnh; phối lại dùng cache. Không đổi mô hình nhận diện.

## Bù sáng riêng phần da trong bóng

Dùng histogram vùng da, percentile tối/sáng và percentile kênh RGB của ảnh hiện hành. Tách đường bao da và phần da trong bóng thành vùng vector native có mềm viền; không ghi pixel/mask raster vào công thức. Một lớp dùng phơi sáng giới hạn theo khoảng trống kênh màu và Film Exposure của RAY; lớp bóng mở thêm vùng tối đo được. Hai lớp có tên, thanh chỉnh, vùng, bật/tắt/xóa và baseline độc lập. Tránh phơi sáng lớn sau đường cong gây bệt đỏ/xám.

Vùng trắng trên áo chặn việc bù Film Exposure/bóng/ánh sáng toàn người quá mức; mặt vẫn sáng riêng. Lớp Chi tiết và lớp chủ thể không tiếp tục chồng sáng/làm nét vào vùng mặt đang phục hồi. Công thức cảnh không đổi. Các vùng ước lượng vẫn có thể cần sửa khi tóc/tay che mặt hoặc da rất nhiễu.

## Thử qua engine thật

Ảnh người dùng được phân tích ở cạnh dài 256 px, chi tiết/nhận diện 512 px và dựng ở cạnh dài 960 px bằng chính chuỗi renderer RAY. Mô hình multiclass nhận da/tóc/người toàn ảnh; nhánh tìm mặt qua crop tóc hiện có tìm được một mặt sau khi toàn ảnh không tìm thấy. Không dùng tọa độ khoanh tay làm dữ liệu nhận diện sản phẩm. Ảnh, landmark, mask và kết quả thử chỉ giữ trong scratch, không đưa lên repo/bản xuất.

Độ sáng trung bình (0–255), đo cùng các vùng kiểm tra trên ảnh tham chiếu:

| Vùng | Ảnh nguồn | Công thức v117 |
| --- | ---: | ---: |
| Bóng dưới mắt/tóc | 33.0 | 106.7 |
| Má và mũi | 88.7 | 173.6 |
| Áo len đen | 44.6 | 45.2 |
| Tóc cạnh mặt | 29.2 | 29.7 |

Vùng da kiểm tra không có kênh chạm 255. Vân da/tóc gốc còn nhìn thấy, ranh giới vùng sáng được kiểm tra bằng ảnh thật. Đây là nâng sáng thông tin còn có, không tạo sinh chi tiết đã mất; kết quả chưa phải sao chép chính xác ảnh mục tiêu. Các chỉ số ở đây chỉ mô tả ảnh thử, không bảo đảm mọi ảnh.

## Lưu/mở và tiếp tục phát triển

Công thức cũ mở nguyên thông số khi chọn mở trực tiếp. Khi chọn thích ứng, vùng da/bóng được tái nhận diện; công thức trước v117 có baseline có thể nâng sang đường cong mặt mới mà giữ phần chỉnh tay và trạng thái tắt/xóa. Công thức thiếu baseline được xử lý bảo thủ. Marker `personLightVersion:1` ngăn thêm lại lớp mặt/bóng mà người dùng đã xóa. Không để lớp mặt tự động cũ trôi sang ảnh mới không có mặt. Schema thêm các trường tùy chọn có giới hạn; công thức cũ vẫn hợp lệ.

Hướng dẫn cho Claude hoặc người phát triển tiếp: [AI-COMPOSER-HANDOFF.md](../AI-COMPOSER-HANDOFF.md).

## Kiểm chứng

Hồi quy `npm test`: **810 bài, 808 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa tùy chọn). Build native, hosting Sites, frontend portable và standalone đều thành công. 200 file public khớp nguồn ở cả hai build; standalone có 87 script hợp lệ; bản đồ 40 nhóm module đủ file. Đối chiếu 41 file engine/preset/editor với v116 giữ nguyên byte, gồm cả 29 phần nguồn JS lõi.

Hash script native: `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`; hash HTML editor: `2776dbb411b8057b8c4fd2c08ef34fa12730c6927a55f36a0c574aa67879aa08`.

Kiểm tra cảnh có áo sáng/vải tối yêu cầu mặt tối sáng lên trên 1,6 lần, vải tối lệch dưới 6 mức sáng, áo sáng lệch dưới 8; đồng thời giữ kiểm tra nền, nhiễu đỏ và độ rõ vân. Tiêu chí này bảo vệ tương phản chất liệu, thay cho giả định mọi mảng quần áo tối cần tăng sáng hơn 20%. Cảnh toàn chủ thể thiếu sáng vẫn giữ kiểm tra bù sáng riêng.

Lượt này không chạy trình duyệt hoặc iPhone/Android thật. Kiểm tra giao diện bằng harness DOM/runtime và kiểm tra ảnh bằng native renderer trên Node.
