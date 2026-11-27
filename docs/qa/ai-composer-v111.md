# Bảng màu trời/cảnh riêng trong AI Composer — v111

## Vấn đề và phạm vi

v110 phối trung bình sáu thông số của các preset rồi giảm cường độ. Các màu gần trung tính hội tụ về một vùng nhỏ nên nhiều phong cách chỉ khác sáng tối/hạt. Trên ảnh núi cùng nguồn, độ khác màu Lab a/b có trọng số của Auto Beauty với Natural chỉ khoảng 0.23, với Soft Dream khoảng 0.28; sắc trời của nhiều phong cách hầu như trùng.

Nâng cấp ngay chín phong cách chỉnh màu trong bộ 12 phong cách hiện có, không thêm mục filter hoặc sửa các preset/engine gốc. Nền phối preset tiếp tục chỉnh được; lớp bảng màu sáng tạo theo vùng được điều phối bằng công cụ native và không bị giới hạn bởi trung bình thông số của các preset có sẵn. Ba chế độ cứu sáng đã kiểm chứng giữ chuỗi xử lý của v110.

## Phân vùng và phối công cụ

Module `ai-composer-regions.js` chạy trên thiết bị ở độ phân giải phân tích giới hạn. Vùng trời cần dấu hiệu màu xanh/lạnh và tính liên thông tới phần trên ảnh, không dùng một oval cố định. Vùng cảnh nhận màu cây, núi, đất; ảnh chân dung trong nhà có thể dùng mặt nạ nền thực đã loại chủ thể làm vùng cảnh chung. Người, tóc, da và vùng mặt được bảo vệ bằng nhận diện hiện có; khi thiếu mô hình còn có kiểm tra màu da/tóc tối thận trọng. Không gán trời chỉ vì có tường trắng hoặc một vật xanh riêng ở phía dưới ảnh.

Đây là vùng **ước lượng từ ảnh**, không phải mô hình phân lớp trời mới. Vùng có thể chưa bao hết hoặc nhận nhầm trong cảnh phức tạp; giao diện cho xem và sửa mặt nạ thực. Không khẳng định thay nền hoặc tạo ra chi tiết trời mới.

Mỗi hướng phong cách kết hợp bảng màu trời/cảnh, cân sáng, tương phản, nhiệt độ màu, sắc độ, ánh sáng màu cục bộ và hoàn thiện độ trong/độ nét từ các công cụ sẵn có. Màu cục bộ tác động kênh phơi sáng; không tô một lớp màu đặc lên ảnh. Các tham số thay theo màu/độ sáng/confidence của vùng. Ngân sách chi tiết và sáng phải giữ da, tóc, mây và hạn chế halo/nhiễu; không thêm hạt để giả cảm giác sắc nét.

## Chỉnh sửa và công thức

Lớp `palette-sky` và `palette-land` có thông số native, màu, cường độ và mặt nạ riêng. Người dùng có thể đổi màu/vị trí, tắt hoặc xóa một lớp mà giữ các lớp khác. Nền trộn màu preset v110 tiếp tục có các thanh tỷ lệ. Lưu công thức vẫn dùng schema v1 với trường `analysis.palette` tùy chọn, chỉ chứa số đo và vector giới hạn; không ảnh nguồn hoặc mặt nạ raster.

Thích ứng công thức sang ảnh khác phải tái định vị từng vùng cụ thể, giữ chỉnh sửa và lựa chọn xóa/tắt của người dùng. Khi ảnh mới không đủ dấu hiệu trời, bỏ tác động lớp trời cũ thay vì đặt mặt nạ trời cũ lên người hoặc vật khác. Phối lại luôn dựng từ baseline, không chồng hiệu ứng.

## Kiểm chứng

Đo sự khác biệt màu trên cùng ảnh, cùng độ phân giải và seed bằng kênh màu Lab a/b để tránh nhầm khác biệt độ sáng/hạt với bảng màu mới. So sánh trời, cảnh, da và các preset gốc; xem trực tiếp ảnh toàn cảnh/crop cùng độ nét mây/tóc/cây, không chỉ dựa vào hash pixel. Ảnh người dùng chỉ nằm trong scratch, không được đưa vào repository hoặc assets web.

Chưa có công cụ trình duyệt được hỗ trợ nên kiểm thử DOM và native-canvas không thay cho xác minh cử chỉ/bố cục/tốc độ trên iPhone thật.

## Kết quả phát hành

- Hồi quy đầy đủ: **739 bài, 737 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa chuyên biệt). Sau điều chỉnh riêng màu cảnh Vintage và rút gọn chữ trên card, chạy lại core 31/31, kiểm tra native phân tách màu/vùng và UI 18/18, đều đạt. Region/recipe có 24 bài đạt, bao gồm trời xanh tối, vùng trời toàn ảnh, đường chân trời, đồi xanh xa, thiếu mô hình và import vector sai.
- Đã xem chín phong cách mặc định trên hai ảnh thật ở 384 px, các trường hợp mục tiêu ở 640 px và Cinematic xuất đúng 1085 × 723 px. Tổng cộng 24 trạng thái render khớp source cuối; nguồn và kích thước giữ nguyên. JSON ở cường độ 73% cho pixel giống hệt.
- Độ khác màu Lab a/b có trọng số nhỏ nhất giữa hai phong cách là 4.54 trên ảnh núi và 6.07 trên ảnh ngoài trời, so với 0.23 của cặp gần nhau nhất đã đo ở v110. Đo kênh màu riêng để không tính khác biệt sáng tối/hạt là sáng tạo màu.
- So với 89 preset gốc ở cùng ảnh, khoảng cách màu trung bình tới preset gần nhất tăng từ 0.99 lên 7.47 ở ảnh núi và từ 1.46 lên 7.97 ở ảnh ngoài trời. Vintage được chỉnh riêng thành champagne/rêu bạc sau khi bản đầu còn gần preset cũ; mức gần nhất cuối là 3.09 và 3.87. Đây là phép đo trung bình vùng trên hai ảnh, không chứng minh mọi ảnh hoặc mọi pixel có màu duy nhất.
- Vùng trời mới bám theo độ sáng xanh đo từ phần trên ảnh và tính liên thông; bỏ ngưỡng thay đổi đột ngột theo một hàng ảnh. Ảnh núi giảm vùng trời nhận nhầm đồi xa từ khoảng 59% khung hình xuống khoảng 29%, đồng thời cảnh núi được phân vùng riêng. Mặt người ở các ROI không nhận tác động trực tiếp của lớp màu cảnh; một ít tóc mảnh ở biên có thể nằm trong vùng ước lượng.
- Xem ảnh/crop không thấy halo, ảnh cắt dán hoặc làm mờ cấu trúc. Độ tương phản cạnh tóc tuyệt đối khoảng 1.39 lần nguồn trên ảnh núi và 1.01–1.04 lần trên ảnh ngoài trời; cây khoảng 88–92% trong các vùng đã đổi sáng/màu, không có bước downsample/blur. Các ROI trời/mặt/áo được kiểm tra ở bản 640 px và bản xuất không chạm 255. Không khẳng định phục hồi chi tiết vốn không có trong nguồn.
- Toàn bộ 12 ID giữ nguyên; 48 phương án thuộc ba chế độ cứu sáng giống hệt v110 trên hai ảnh thật và hai ảnh tổng hợp. 187 file phát hành ngoài các file Composer/HTML/service worker đã thay đổi giữ nguyên từng byte; HTML chỉ thêm script vùng ảnh. Engine inline giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`.
- Build web và source khớp; HTML đóng gói kiểm tra cú pháp 81 script, không còn phụ thuộc script/stylesheet cục bộ. Service worker lưu module vùng ảnh để tái dùng offline. Không thêm API trả phí, mô hình AI hoặc preset vào danh mục.

Bằng chứng riêng: `/workspace/scratch/composer-v111-qa/final-qa.md`, `final-verified-{mountain,outdoor}/comparison.png`, `final-state-verification.json`, `roundtrip.json`; nhật ký `/workspace/scratch/ai-composer-v111-regression.log`. Core cuối `abdb4136efd54bd88ddb1e30e27c14e9071da514c467a78c9b871827eea9f7f1`, module vùng `d554d13c01721aec0ec0b8ddca0f8a071540eadcb1cc7e7961d1c58589a0138f`. Ảnh người dùng không có trong Git hoặc gói triển khai.
