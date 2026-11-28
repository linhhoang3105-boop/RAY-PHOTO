# Sáng riêng da và giữ sắc đen trang phục — v119

## Phạm vi

Nâng cấp công thức và nhận diện dùng trong AI Composer. Không thêm màu Bộ lọc, không sửa engine Tone/Clarity/Light/Scope/Selection/Makeup/tóc/Photobooth. Phân biệt bóng hỗn hợp v117/v118 với da tối đều, và với da tối sâu ở hoàng hôn.

## Điều phối

- Gate Core.needsPersonRefinement dùng chung cho UI/runtime: nhánh tối sâu có sẵn và nhánh tối đều đủ tin cậy, đo span mặt và độ lệch sáng với cảnh. Vẫn chỉ chọn theo điểm tối đa một lần mỗi ảnh, giữ kết quả ban đầu nếu lỗi hoặc nhận sai.
- Da tối đều dùng mức EV theo histogram/ánh sáng cảnh, tương phản nhẹ và ít Film Exposure để tránh nền xám. Phơi sáng phần mặt không áp đồng loạt cho áo đen.
- Với một người đã có mask theo điểm, da cổ/tay có vùng vector và phép đo riêng, giới hạn RGB riêng. Tay đã sáng không nhận mức EV của mặt tối. Lớp trang phục/màu thân/texture loại các vùng da này ra. Nhiều người không nhận vùng da toàn ảnh cộng chồng.
- Áo tối có đủ sắc độ được giữ đậm theo mức đen/span đo được. Vật liệu gần đen ít sắc độ chỉ được bù rất nhẹ, thay vì kéo thành mảng màu phẳng.
- Ảnh tối sâu dùng hai công cụ EV native, mỗi lớp không vượt 2; tổng trong khoảng trống màu đã đo, có dự phòng và ngân sách nhiễu. Không nâng nền xám bằng Film Exposure lớn. Mềm viền theo kích thước mặt giảm quầng; chỉnh ám màu có giới hạn, giữ điều khiển để sửa/tắt/xóa.
- Kết quả nhánh bóng hỗn hợp cũ (mặt có bóng tay, áo đen/logo trắng) giữ đúng thông số và pixel native. Tất cả 12 ID AI cũ/11 lựa chọn hiển thị và 90 màu Bộ lọc còn nguyên.

## Kiểm tra ảnh thật

Cặp ảnh núi mới: JPEG nguồn 624×468, đích 1024×768. Để so sánh, thu ảnh đích về 624×468 rồi căn khớp bằng 177/202 điểm inlier. Tương quan sáng mặt 0,971 cho thấy phần lớn cấu trúc đã có trong nguồn. Ảnh đích không tăng sáng cả người: da sáng hơn nhưng áo đen tối hơn. Các phép đo dưới đây dùng cùng ROI/mặt nạ đã căn chỉnh (độ sáng 0–255).

| Vùng | Nguồn | Đích | v118 | v119 |
| --- | ---: | ---: | ---: | ---: |
| Da nhận diện | 68,19 | 95,65 | 115,51 | 96,37 |
| Hộp mặt | 58,51 | 77,69 | 105,12 | 78,43 |
| Áo đen | 26,59 | 19,80 | 26,39 | 21,20 |

Sai lệch sáng mặt so với đích giảm 27,56→8,69; sai lệch RGB mặt 26,65→9,68. Sai lệch áo đen 7,66→2,47. Da/mặt không có kênh chạm 255. Cảnh gần kết quả v118, sai lệch núi 16,23→16,26; không thay một cảnh đang hợp lý để bù sáng người. Da v119 hơi đỏ hơn ảnh đích; ảnh đích vẫn mịn và có độ phân giải lớn hơn. Không coi tăng kích thước file là bằng chứng phục hồi chi tiết.

Ở ảnh hoàng hôn khó: vùng da nguồn trung bình 20,2 được nâng lên khoảng 73,2; trời 192,4 gần nguyên. Hai ảnh hoàng hôn vẫn còn hạt, bệt và ám màu ở vùng thiếu sáng sâu, ít kết cấu tóc/áo. Ảnh núi mờ rõ người/cảnh hơn nhưng giữ vân nhiễu gốc. Đây là phục hồi phần tín hiệu còn lại, không tái tạo chân dung sạch từ dữ liệu không có.

QA dùng đúng các engine RAY trên ảnh nguồn. Nhận diện CPU bằng model hiện có, helper UI thật kiểm tra vùng theo điểm từ landmark mũi; có sai khác nội suy Canvas/Pillow được ghi trong scratch. Ảnh, landmark, mask, ROI và kết quả không đưa vào repo/bản triển khai.

## Công thức và kiểm thử

Metadata extraSkin/clothing là dữ liệu có giới hạn, không có bitmap hoặc cấu trúc đệ quy. Marker bảo vệ xóa vẫn là 1; bỏ component Face/Extra khi ảnh mới không có người, giữ bước thủ công và các bước đã xóa. Bộ kiểm tra mới có nativepixel cho mặt/tay/áo, tay đã sáng, áo trắng, nhiều người, lưu/mở và giới hạn codec. Các fixture kiểm tra xóa bóng dùng phân bố bóng hỗn hợp thật sự; kiểm tra cứu mặt tối đều bảo vệ mức EV có tác động và nền xám thấp thay cho yêu cầu bắt buộc Film Exposure cao.

`npm test`: **839 bài, 837 đạt, 0 lỗi, 2 bỏ qua** (mô hình tùy chọn). Kiểm tra tone/Core/curation: 55/55; runtime/UI: 61/61. Build hosting, standalone và portable đều thành công. 200 tài nguyên public khớp nguồn ở cả hosting và portable; 87 script standalone hợp lệ và nhúng đủ bốn module AI mới. Bản đồ 40 nhóm module đủ đường dẫn nguồn; 41 file engine/preset/editor được bảo vệ giữ nguyên so với v118.

Native script SHA-256 vẫn là `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`; editor HTML vẫn là `2776dbb411b8057b8c4fd2c08ef34fa12730c6927a55f36a0c574aa67879aa08`. Tất cả 90 màu Bộ lọc giữ nguyên. Công thức cũ không tự đổi; dùng Tự phối ảnh/Phối lại để tạo công thức với điều phối v119.

Lượt này không chạy trình duyệt hoặc iPhone/Android thật; UI/runtime dùng harness và dựng ảnh bằng native renderer Node. Nguồn gốc ảnh đích không được suy đoán là tạo sinh.
