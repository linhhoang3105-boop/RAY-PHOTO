# Nâng cấp phối màu và ánh sáng trong AI Composer — v110

## Phạm vi và nguyên nhân

Nâng cấp ngay 12 phong cách hiện có, không thêm phong cách, filter hoặc sửa preset gốc. Chín phong cách tổng thể dùng phối màu từ nhiều preset cùng điều chỉnh và ánh sáng theo ảnh. Ba phong cách cứu sáng đã kiểm chứng ở v109 giữ chuỗi xử lý cũ.

Soft Dream trước đây tự đặt `bgBlur` khoảng 0.055–0.09 và `soft` 0.025 vào lớp hậu cảnh. Engine gốc làm mờ bằng giảm kích thước trung gian `W / (6 + 34 * bgBlur)`, nên giá trị nhỏ vẫn khiến hậu cảnh 640 px chỉ còn khoảng 72 px rồi phóng lên. Đây là nguyên nhân cây và kiến trúc bị bệt rõ trên ảnh người dùng. Lớp preset, ánh sáng và kết cấu còn có thể cộng nhiều glow lên nhau.

Bản mới bỏ blur/soft/motion tự động khỏi Soft Dream; giữ nguyên công cụ mờ thủ công của RAY. Cảm giác mơ được tạo bằng ánh sáng vùng dịu, sắc độ, tương phản và mức glow có giới hạn. Không dùng tăng nét để che mất chi tiết do blur.

Native grain cũng có mức nền `8 + 54 * grain` khi lớn hơn ngưỡng bật, nên mức tự động 0.004 vẫn tạo nhiễu thấy được. Phối tự động nay dùng grain chính xác 0 cho Soft Dream, Auto Beauty, Natural, Editorial và Golden Hour; bốn phong cách có chủ ý chất phim tiếp tục có ngân sách hạt. Thuật toán hạt và thanh hạt thủ công giữ nguyên.

## Phối nhiều preset bằng công cụ sẵn có

Màu được phối từ hai preset có thông số màu rõ ràng trong danh mục hiện có; Creative AI tối đa ba, hoặc ít hơn khi danh mục không đủ. Chuẩn hóa tỷ lệ rồi phối sáu thông số `temp`, `tint`, `split`, `contrast`, `sat`, `lift` trước khi đưa vào LUT native một lần. Cách này tránh tích lũy nhiều lượt tương phản, phơi sáng và kết cấu của full preset. Các hiệu ứng quang học của preset không được nhập ngầm vào màu phối.

AI Composer vẫn phân tích ảnh trên thiết bị: histogram, thiếu/cháy sáng, độ đậm màu, ám màu, vùng chủ thể và hướng sáng. Các lớp cân sáng, chủ thể, hậu cảnh, ánh sáng và kết cấu dùng công cụ native riêng, chỉnh được. Bộ phối là thuật toán thích ứng kết hợp nhận diện hiện có, không gọi API trả phí hoặc tạo ảnh mới bằng mô hình sinh ảnh.

Từng nguồn có thanh tỷ lệ cùng thanh độ đậm màu phối. Thay tỷ lệ chỉ cộng chênh lệch màu phối mới/cũ vào lớp màu, giữ các chỉnh sửa native người dùng đã làm và không ảnh hưởng lớp khác. Tất cả tỷ lệ về 0 đưa đóng góp màu phối về 0; các bước điều chỉnh còn lại vẫn được giữ.

## Công thức và tương thích

Trường `component.mix` tùy chọn lưu version, strength và 1–3 nguồn với ID, tên, tỷ lệ và sáu thông số màu giới hạn. Không lưu ảnh, mask raster hoặc công cụ ngoài phạm vi. Công thức cũ thiếu mix tiếp tục mở nguyên vẹn.

Khi lưu/áp dụng công thức sang ảnh khác, giữ nguồn màu và tỷ lệ người dùng đã chọn; các lớp cân chỉnh, ánh sáng và vùng thích ứng theo ảnh mới. Mở lại từ Các bước sau khi đã áp dụng cường độ tổng thấp cần lưu độ đậm mix hiệu dụng theo cùng cường độ, tránh chỉnh tỷ lệ làm màu tăng đột ngột. Phối lại luôn dựng từ baseline, không chồng thêm nhóm.

## Kiểm tra

Dùng engine gốc và nhận diện đã có trên hai ảnh thật trong scratch; không lấy ảnh UI đã qua chỉnh sửa làm ảnh gốc để đo. Kiểm tra Soft Dream đủ bốn phương án, thêm các trường hợp Auto Beauty, Cinematic, Creative AI, xuất đúng kích thước nguồn và JSON/pixel roundtrip. So sánh kết cấu hậu cảnh, tóc, da, trời và mức ám màu, thay vì chỉ đếm khác biệt pixel. Ảnh người dùng không đưa vào repository hoặc assets phát hành.

Môi trường chưa có công cụ trình duyệt được hỗ trợ, nên kiểm tra DOM/native-canvas không thay thế xác minh cử chỉ, bố cục và tốc độ trên iPhone thật.

## Kết quả phát hành

- Hồi quy đầy đủ: **726 bài, 724 đạt, 0 lỗi, 2 bỏ qua** (kiểm tra suy luận LaMa chuyên biệt). Core 29/29, native Composer 11/11, UI/runtime 41/41 và recipe 16/16 nằm trong lượt kiểm tra này.
- Bốn phương án Soft Dream trên hai ảnh thật ở 640 px, thêm các render Auto Beauty, Cinematic và Creative AI, tổng cộng 15 trạng thái native của bản cuối đã đối chiếu. Giữ nguồn; không đưa ảnh QA vào web phát hành.
- Tương phản cạnh hậu cảnh chuẩn hóa theo độ sáng ở phương án mặc định còn khoảng 98% nguồn trên ảnh núi và 97% trên ảnh ngoài trời; bản cũ chỉ khoảng 32.5% và 6.4%. Vùng cây giữ khoảng 94–96% thay vì khoảng 1.2% ở bản blur cũ. Đây là số đo ở hai ảnh kiểm tra, không phải cam kết cho mọi ảnh.
- Xem toàn cảnh và bản xuất 1085 × 723 px: không thấy nền bệt, viền sáng/cắt dán hoặc hạt tự thêm trong Soft Dream. Trời, mặt và áo ở các ROI đã đo không có kênh chạm 255. Soft Dream chỉ bù sáng nhẹ; không mô tả nó là thay thế bộ cứu khuôn mặt ngược sáng chuyên biệt.
- Công thức 73% lưu rồi mở lại cho pixel giống hệt tại 384 × 256. Các kiểm tra chứng minh đổi tỷ lệ làm đổi pixel màu native, ánh sáng vùng có tác động, sửa màu thủ công và lớp khác được giữ. Trường hợp 73% áp dụng → chỉnh trong Các bước → mở lại 100% → đổi tỷ lệ giữ đúng độ đậm hiệu dụng.
- Toàn bộ 12 ID phong cách giữ nguyên; 48 phương án của ba chế độ cứu sáng giống hệt v109 trên hai ảnh thật và hai ảnh tổng hợp. 187 file phát hành ngoài sáu file Composer/service worker thay đổi giữ nguyên từng byte. Engine inline giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`.
- Build web thành công; các file Composer trong build khớp nguồn. HTML đóng gói kiểm tra cú pháp 80 script, không còn script/stylesheet phụ thuộc đường dẫn cục bộ. Header Composer dùng nền đặc để chữ của nút cuộn phía sau không xuyên qua; chưa kiểm chứng giao diện thực trên iPhone.

Bằng chứng riêng: `/workspace/scratch/composer-v110-qa/final-qa.md`, `final-{mountain,outdoor}-640/`, `final-mountain-1085/`, `roundtrip.json`, `final-state-verification.json`. Core đã kiểm chứng có SHA-256 `18f4d8ea39f04ad47fbd9903d0b14877748c2ef3e1c89496459250568ffe2da8`; nhật ký toàn bộ test `/workspace/scratch/ai-composer-v110-regression.log`.
