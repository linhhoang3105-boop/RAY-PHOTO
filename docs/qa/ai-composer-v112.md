# AI Composer phối hài hòa toàn cảnh — v112

## Vấn đề và thay đổi

v111 gộp mây với trời, cây/đất/núi vào cảnh chung. Tăng màu trời có thể nhuộm cả mây; làm ấm cảnh có thể khiến cây vàng gắt. Các lựa chọn cùng phong cách chủ yếu đổi độ đậm. v112 điều phối một hướng màu/ánh sáng cho cả cảnh, ngay trong chín phong cách màu hiện có; không thêm catalog preset hoặc thay thuật toán công cụ gốc.

Vùng tổng hợp `sky`/`land` vẫn tương thích công thức cũ. Phân tích thêm các vùng tùy chọn `clouds` (mây sáng gần trung tính trong trời liên thông), `vegetation` (dấu hiệu lá xanh ngoài vùng bảo vệ), `terrain` (phần đất/núi còn lại). Tất cả dùng vector giới hạn và nhận diện người/da/tóc hiện có. Đây là ước lượng theo màu, không phải mô hình semantic mới: mây thấp tách rời, lá khô, kiến trúc xanh hoặc biên tóc mảnh có thể cần chỉnh tay. Không thêm màu vào vùng chưa đủ rõ.

Lớp trời trừ hình vùng mây; cây tách khỏi lớp địa hình. Mây nhận ít sắc ánh sáng chung, bù ám từ nền phim và giữ gần trung tính. Sắc lá, độ đậm, cân sáng hậu cảnh, bù màu chủ thể và hướng sáng cùng dựa trên hướng phối đã chọn. Màu/vùng/độ sáng/nhiễu gốc giới hạn cường độ thực tế. Bảng hướng là mục tiêu nghệ thuật; thông số thực tính theo từng ảnh, không sao chép một bộ số cố định. Trộn preset và engine native RAY tiếp tục hoạt động nguyên trạng.

Bốn phương án trong mỗi phong cách có tên theo hướng phối và đổi cả màu vùng lẫn quan hệ sáng chủ thể/cảnh. Ví dụ Natural: lam ngọc/lá xanh, nắng sớm/lá non, lam trời/rừng mát, mây ngọc/sage. Soft Dream: mây tím/sage, mây đào/xanh sương, hồng ngọc/rêu bạc, lam sữa/sage. Creative giữ bốn hướng khác nhau trong mỗi lượt, không bốc ngẫu nhiên trùng hướng. Phối lại luôn bắt đầu từ baseline gốc của Composer.

## Chỉnh sửa và tương thích

Các lớp `palette-clouds` và `palette-vegetation` dùng cùng thanh trượt, màu, mặt nạ, bật/tắt/xóa, Steps và lưu JSON/IndexedDB sẵn có. `palette-land` dùng địa hình khi tách được cây; ảnh toàn cây không nhận thêm lớp cảnh tổng trùng lên cây. Khi áp sang ảnh thiếu một vùng, bỏ lớp vùng ấy thay vì đặt mặt nạ cũ sai chỗ. Giữ xóa/tắt/chỉnh sửa của người dùng; cùng ảnh và công thức phải tái mở giống nhau. Không có ảnh nguồn hay raster mask trong công thức.

Ba chế độ Cứu ngược sáng, Phục hồi sáng & nét và Màu phim cứu sáng giữ chuỗi generation cũ. Độ trong/độ nét sau cùng, grain tự động bằng 0 trong chín phong cách màu, không dùng downsample blur. Các công cụ Makeup/tóc/body/background/remove/Photobooth và 89 preset gốc không sửa.

## Kiểm chứng

Hồi quy toàn bộ: **744 bài, 742 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa chuyên biệt). Các kiểm tra mới gồm vùng trời/mây/cây/địa hình riêng, bảo vệ người/da/tóc, công thức v1 với subregion tùy chọn, bốn hướng khác nhau, giữ chỉnh sửa/xóa/tắt, và render native thực. Kiểm tra native mới xác nhận sắc cây thay đổi ngoài nền phối preset, các phương án có độ khác màu cảnh chứ không chỉ đổi trời, lá giữ nhóm màu xanh, mây không có sắc tô quá mạnh và còn tương phản chi tiết. Lưu/mở ở cường độ 73% giữ pixel giống nhau.

Đã xem chín phong cách mặc định trên ảnh ngoài trời và 12 phương án Natural/Cinematic/Soft Dream trên ảnh núi, cùng một bản xuất Cinematic ở đúng **1085 × 723 px**. **22 trạng thái render** đối chiếu khớp công thức do source cuối sinh ra; ảnh gốc không đổi. Ảnh núi không có vùng cây đủ rõ nên không tạo lớp cây. Ảnh cây nhiều có các vùng cây, địa hình và mây riêng. Các kiểm tra màu trên hai ảnh là kiểm chứng có giới hạn, không bảo đảm mọi ảnh có sắc độ duy nhất hoặc phân vùng hoàn hảo.

**48 phương án** của ba chế độ cứu sáng khớp JSON với v111. **188 file dist khác** giữ byte; engine inline gốc giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`. Build thành công; bản chỉnh ảnh HTML v112 có 81 script inline parse thành công và không tham chiếu JS/CSS local rời. Đây là bundle chỉnh ảnh để tải riêng, không phải toàn bộ source repository.

Ảnh cá nhân chỉ dùng trong scratch, không kèm mã nguồn hoặc assets web. DOM/native Canvas không thay cho kiểm tra cử chỉ, bố cục và tốc độ trên iPhone thật; phiên này không có công cụ trình duyệt được hỗ trợ.
