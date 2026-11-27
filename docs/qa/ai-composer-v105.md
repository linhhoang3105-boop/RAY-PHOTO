# RAY AI Composer — v105

## Cách dùng

Trong Ảnh / Filter, mở **AI Composer**, chọn một trong chín phong cách. Mỗi lần phối tạo bốn phương án. **Phối lại** khám phá phương án khác; **Cường độ tổng** điều chỉnh 0–100%; giữ nút so sánh để xem trạng thái trước Composer. **Áp dụng** ghi một mốc chỉnh sửa. **Hủy thay đổi** trở về mốc đã áp dụng gần nhất, hoặc trạng thái trước Composer khi chưa áp dụng.

Mở từng thành phần để chỉnh thông số bằng thanh trượt, xem vùng tác động, đổi hình vùng, di chuyển, đổi cỡ hoặc xoay đường bao AI. Có thể tắt hoặc xóa riêng từng thành phần. Các lớp cũng xuất hiện trong Các bước của RAY. Xóa lớp đầu tiên trong Các bước vẫn mở lại và lưu được các lớp còn lại.

**Công thức AI của tôi** lưu thông số, trạng thái bật/tắt và hình học vùng trong IndexedDB riêng. Có xuất/nhập JSON. Khi dùng lại, chọn **Thích ứng với ảnh này** để phân tích lại và đặt vùng theo chủ thể mới, hoặc **Giữ vùng đã lưu**. Công thức không chứa ảnh nguồn hoặc mặt nạ AI raster. Công thức cá nhân cũ của RAY tiếp tục dùng kho và định dạng cũ.

## Kiến trúc

- `ai-composer-core.js`: phân tích ảnh gốc và tạo kế hoạch điều chỉnh; không tự render ảnh.
- `ai-composer-runtime.js`: điều phối giao dịch, bộ nhớ phân tích, hủy tác vụ cũ, bảo vệ chỉnh sửa bên ngoài và checkpoint.
- `ai-composer-recipes.js`: xác thực công thức phiên bản 1, lưu trên thiết bị và trao đổi JSON.
- `ai-composer-ui.js` / `ai-composer.css`: giao diện và adapter tới lớp hiệu ứng RAY.

Histogram, percentile, clipping, sáng chủ thể/hậu cảnh, màu chủ đạo, màu da, độ tương phản kết cấu và phân bố ánh sáng được đo từ ảnh gốc thu nhỏ. Composer tái sử dụng nhận diện RAY đã có, hoặc chạy mô hình phân đoạn/khuôn mặt hiện có trên ảnh tối đa 512 px. Vùng foreground được chuyển thành đường bao vector có giữ lỗ giữa tay/người. Nếu mô hình không dùng được, giao diện ghi rõ vùng ước lượng và giảm mức điều chỉnh vùng đó.

Đây là bộ điều phối thích ứng trên thiết bị, dùng mô hình thị giác có sẵn và thuật toán phân tích; không gọi LLM hoặc API AI trả phí. Mô hình lần đầu cần được tải/cache. Phân tích, phối, xem trước và lưu công thức tiếp tục chạy cục bộ khi tài nguyên đã có.

Preset được chấm điểm theo ảnh và phong cách. Các phương án kết hợp màu phim, cân bằng sáng/màu, sáng chủ thể, chiều sâu hậu cảnh, ánh sáng định hướng và chất phim bằng tham số của engine gốc. Thông số phụ thuộc từng ảnh; seed tạo biến thể có thể tái hiện. Tổng hạt phim được giới hạn theo phong cách, kết cấu và diện tích da, kể cả hạt nội tại của Thu Nhật. Không sửa thuật toán Thu Nhật hoặc bất kỳ preset gốc nào.

Mỗi preview dựng lại từ bản chụp trạng thái trước Composer. Phối lại thay nhóm lớp của Composer; không cộng dồn vào preview trước, kể cả sau Áp dụng. Strength 0 và so sánh phục hồi nguyên trạng thái trước phối. Xuất ảnh sử dụng lớp vector và đường xuất gốc của RAY ở độ phân giải nguồn; ảnh phân tích nhỏ không thay ảnh nguồn. Makeup/body chỉ chạy một lượt trong chuỗi lớp theo cơ chế render sẵn có.

Khi thích ứng công thức, mức sửa riêng của người dùng được giữ như delta so với kế hoạch trước; vùng chủ thể/hậu cảnh tự đặt lại theo ảnh mới. Thành phần bị xóa/tắt không tự quay lại. Vùng đã chỉnh thủ công được giữ theo lựa chọn của người dùng.

## Kiểm chứng

Bộ kiểm tra riêng của Composer bao gồm phân tích, các ảnh sáng/tối khác nhau, bốn phương án của cả chín phong cách, giới hạn hiệu ứng, vùng có lỗ, scale, thích ứng công thức, JSON/IndexedDB, giao dịch thất bại, hủy khi đổi ảnh, chỉnh sửa bên ngoài và các thao tác trên UI production bằng DOM fixture.

Kiểm tra render dùng chính engine native trong HTML và các adapter tone/light/scope/layers, không dùng bộ render thay thế. Có kiểm tra pixel trước/sau lưu JSON, dimensions, nguồn không đổi, cường độ 0, xóa/tắt lớp và số lượt Makeup/body. Kiểm tra UI bao gồm xoay vector theo tỷ lệ ảnh, công thức cũ thiếu tọa độ và xóa lớp đầu tiên bằng Các bước rồi mở lại một chạm.

Đã chạy trên ảnh thật 1280 × 960 bằng các mặt nạ production đã nhận diện trước. Natural, Cinematic, Golden Hour và Creative được xuất lại đầy đủ kích thước; SHA ảnh nguồn và pixel nguồn không đổi. Xem cả toàn cảnh và crop da/tóc để điều chỉnh ngân sách hạt. Ảnh người dùng và các artifact QA chỉ nằm trong thư mục scratch, không đưa vào website hoặc mã nguồn phát hành.

Engine inline và preset catalog giữ nguyên byte so với bản v104, commit `28244522862c4a38774df15bdffca82caab453e3`. SHA-256 inline engine: `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`.

Hai assertion cũ của `thu-nhat.test.cjs` đã thất bại ngay trên worktree v104 chưa sửa: so sánh danh sách chỉ loại Thu Nhật ở một phía, và fingerprint engine còn trỏ bản trước v104. Cập nhật phép so sánh đối xứng và ghim fingerprint đúng v104; không sửa engine để làm test đạt. Hồi quy bao gồm preset, Makeup, tóc, chỉnh dáng, ghép/xóa, lưu nháp và Photobooth.

Kết quả cuối: **685 kiểm tra đạt, 0 lỗi, 2 kiểm tra mô hình vá LaMa thật được bỏ qua theo điều kiện sẵn có của bộ test**. Có 57 kiểm tra riêng của Composer, gồm 9 kiểm tra UI production. `npm run build` thành công. Bản HTML portable nhúng đủ module/CSS mới, 80 script inline parse thành công và không còn phụ thuộc script/stylesheet cục bộ chưa nhúng.

## Giới hạn xác minh

Môi trường không có `cua_repl` nên chưa QA bằng trình duyệt hoặc iPhone/Safari thật. DOM fixture không xác nhận được bố cục, cử chỉ thực tế hoặc tốc độ trên điện thoại. Vùng AI có thể cần chỉnh lại khi chủ thể quá nhỏ, bị che hoặc mô hình phân đoạn nhận thiếu. Hướng sáng là ước lượng từ phân bố sáng của ảnh, không phải tái dựng ánh sáng 3D.
