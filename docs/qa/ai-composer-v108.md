# Phối vùng sáng, màu và chi tiết bằng công cụ RAY — v108

## Chẩn đoán

v107 gần như chỉ cứu một vùng mặt nhỏ. Trên ảnh núi người dùng cung cấp, phương án mặc định chỉ làm 0.526% pixel toàn ảnh thay đổi trên 2 mức RGB; vùng thân tối và tóc gần như không được nâng. Hai chế độ khác nhau rất ít ở toàn ảnh. Trên ảnh ngoài trời, ba phương án ngược sáng được kiểm tra có pixel giống hệt nhau.

Nguyên nhân nằm trong điều phối: nhiều lớp nền/màu/ánh sáng bị đưa về 0, có mặt thì tắt mức sáng thân người, và lớp chi tiết chỉ dùng lượng sharpen nhỏ. Giao diện vẫn đếm các lớp không tác động. Cường độ 0 hoặc thấp cũng được giữ sang ảnh mới, khiến người dùng khó nhận ra hiệu ứng.

## Phạm vi cập nhật

Chỉ thay đổi bộ điều phối, công thức và UI Composer. Tái dùng các engine RAY hiện có cho sáng tối, phơi sáng, vùng màu, ánh sáng cục bộ, mặt nạ, độ trong và tăng nét. Không viết lại thuật toán render, preset màu phim, Makeup, tóc, chỉnh dáng hoặc Photobooth. Chín phong cách trước vẫn được đối chiếu kế hoạch và giữ nguyên.

Hai chế độ phục hồi được phối theo các vùng chủ thể, mặt, nền và hướng sáng, với công cụ phù hợp từng vùng. Vùng thân dùng đường cong phơi sáng phim `filmExp`, bù vùng tối nhẹ và bảo vệ vùng sáng; loại vùng mặt để không cộng dồn cứu sáng. Thử nghiệm dùng mức Vùng tối lớn đã làm lộ nhiễu màu trong JPEG gần đen, nên bản cuối dùng đường cong native có ngân sách thấp và kiểm tra riêng các pixel tối có ám màu. Cân màu vùng đo điểm gần trung tính, ánh sáng có màu dùng `toneLocal*`; lớp chi tiết chạy sau cùng bằng `printClear` và sharpen có giới hạn nhiễu. Không sửa thuật toán gốc, không khử nhòe học máy hoặc tạo chi tiết khuôn mặt mới.

Các thông số và vùng vẫn là lớp native có thể xem, di chuyển, sửa màu, bật/tắt/xóa và lưu công thức. Dữ liệu phân tích vùng sáng/màu được lưu dưới trường tùy chọn `analysis.recovery.zones` theo schema giới hạn; không lưu ảnh hoặc mặt nạ raster trong công thức. Công thức cũ tiếp tục mở được.

## Kiểm tra

So sánh bằng engine sản phẩm trên hai ảnh thật: ảnh núi/mây với mặt tối và áo trắng; ảnh người đứng ngoài trời với mặt đã đủ sáng và quần áo/tóc tối. Mặt nạ và khuôn mặt lấy từ mô hình production đã nhận diện trước. Các artifact nằm trong scratch, không đưa ảnh người dùng vào mã nguồn phát hành.

Kiểm tra cả toàn cảnh và crop chi tiết ở độ phân giải thực: vùng thân tối, tóc, mặt, áo trắng, nền sáng; clipping, tương phản cạnh, nhiễu, phạm vi thay đổi và khác biệt giữa các phương án/chế độ. Kiểm tra màu và vị trí vùng phải làm đổi pixel tại vùng tương ứng; tắt/xóa vùng chỉ bỏ thành phần đó. Lưu JSON rồi mở lại phải cho cùng kết quả native; thích ứng phải nhận diện lại vùng và giữ chỉnh sửa của người dùng.

Cường độ 0/so sánh giữ trạng thái trước Composer; phối lại không tích lũy lớp. Cường độ mới cho ảnh mới mặc định 100%; chỉnh cùng ảnh và công thức đã lưu vẫn giữ mức người dùng chọn, kèm hiển thị rõ khi mức thấp hoặc 0.

## Kết quả bản phát hành

- Toàn bộ kiểm thử: 711 bài, **709 đạt, 0 lỗi, 2 bỏ qua** (kiểm tra suy luận LaMa chuyên biệt không thuộc thay đổi này). Core 24/24, render native 8/8, UI/runtime 36/36 và công thức 14/14 nằm trong lượt kiểm tra này.
- Đối chiếu `ccb0edbf20a0eccc2802ed92df802a0187e0b1f3`: 108 phương án thuộc chín phong cách khác giữ JSON giống hệt. 187 file phát hành ngoài sáu file Composer/service worker thay đổi giữ nguyên từng byte; engine inline có SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`.
- Hai ảnh thật ở preview 640 px: phương án ngược sáng mặc định tăng độ sáng vùng thân tối khoảng 40% trên ảnh núi và 28.6% trên ảnh ngoài trời. Chế độ phục hồi sáng & nét tăng tương ứng 31.2% và 24.6%; tương phản cạnh tóc sau chuẩn hóa độ sáng cao hơn chế độ ngược sáng khoảng 12% trên ảnh núi. Đây là đo lường ở hai ảnh kiểm tra, không phải cam kết cho mọi ảnh.
- Xuất native 1085 × 723 px: ảnh nguồn không đổi; ngược sáng nâng độ sáng trung bình vùng thân tối từ 0.0952 lên 0.1345 (+41.3%), phục hồi lên 0.1272 (+33.6%). Áo trắng từ 0.5590 lên khoảng 0.620–0.621, giữ vân lông và không có pixel kênh màu chạm 255 trong vùng áo/mặt mặc định.
- Xem toàn cảnh và crop không thấy viền sáng hoặc vệt màu neon của bản thử đầu. Kiểm tra vùng trời phân biệt rõ gần trắng (bất kỳ kênh ≥250) với chạm trần (kênh =255); hai chế độ mặc định không tạo pixel chạm trần trong vùng trời đã đo. Việc hạ highlight không phục hồi thông tin đã mất trong ảnh nguồn.
- Phương án mạnh “Sáng rõ chủ thể” và “Rõ chi tiết” đã xem riêng ở 384 px. Bản rõ chi tiết có một pixel đỏ chạm 255 trong 272 pixel vùng mặt (0.37%), không có pixel trắng cả ba kênh; nên vẫn có thể cần giảm cường độ trên ảnh tương phản mạnh.
- Lưu/mở lại công thức ở cường độ 73% cho render giống hệt từng pixel. Các kiểm thử xác minh đổi màu/vị trí vùng làm thay đổi pixel tương ứng, tắt/xóa riêng lớp và thích ứng vùng mới giữ chỉnh sửa người dùng.
- Build web thành công; bản HTML đóng gói kiểm tra cú pháp 80 script, không còn script hoặc stylesheet phụ thuộc đường dẫn cục bộ. Các file Composer trong bản build trùng với nguồn đã kiểm tra.

Bằng chứng ảnh thật và báo cáo đo được giữ riêng trong `/workspace/scratch/composer-v108-qa/`: `curve-mountain-640`, `curve-outdoor-640`, `final-mountain-1085`, `exact-highlights-640.json` và `curve-roundtrip.json`. Ảnh nguồn không được đưa vào Git hoặc gói triển khai. Nhật ký hồi quy: `/workspace/scratch/ai-composer-v108-regression.log`.

Môi trường không có `cua_repl`, nên chưa xác minh bố cục/cử chỉ và tốc độ trên iPhone thật. DOM fixture và native-canvas không thay cho kiểm tra thiết bị.
