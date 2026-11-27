# Màu phim cứu sáng — v109

## Mục tiêu và phạm vi

Theo mẫu người dùng cung cấp, thêm màu phim rõ hơn cho cảnh núi, trời và cây, trong khi vẫn mở sáng người và giữ da tự nhiên. Đây là cách phối lấy cảm hứng từ các preset Fuji đã có trong RAY, không phải mô phỏng độc quyền hoặc chuyển màu tự động từ ảnh tham chiếu.

Phong cách `film-recovery` dùng lại chuỗi `backlight` v108 và thêm hai lớp màu native: `film-background` ở ngoài vùng chủ thể và `film-subject` ở trong vùng chủ thể, loại vùng mặt. Các thông số màu, tương phản, sáng tối, hạt, vùng và cường độ dùng cơ chế lớp hiện có. Không viết lại renderer/LUT, sửa preset Fuji, Makeup, tóc, chỉnh dáng, Photobooth hoặc các phong cách cũ.

Bốn phương án mặc định: Fuji trong, Fuji xanh, Fuji ấm và Fuji điện ảnh. Preset nền được chọn từ danh mục hiện có; mức màu còn phụ thuộc màu ảnh, điểm trung tính, tương phản và vùng sáng. Hạt và chi tiết có ngân sách riêng. Phối lại dùng seed mới trên cùng ảnh gốc, không cộng lớp lên kết quả trước.

Lớp cảnh dùng thêm công cụ phim tráng in `film` ở mức thích ứng khoảng 0.08–0.18 để tách sắc xanh trời/cây và tạo đường cong màu rõ hơn. Chất phim này chỉ nằm ở hậu cảnh; lớp chủ thể không thêm film, grain, soft hoặc blur. Native tone chạy trước LUT màu, vì vậy phải dành khoảng sáng cho nhiệt độ màu, tách tông và độ bão hòa trước khi tăng màu; không thể chỉ hạ highlight sau khi kênh màu đã chạm trần.

## Chỉnh sửa và lưu

Cứu sáng và màu phim là các lớp riêng. Người dùng có thể chỉnh thông số/vùng, tắt hoặc xóa riêng lớp màu mà vẫn giữ phục hồi sáng. Công thức tiếp tục dùng schema v1, không chứa ảnh nguồn hoặc mặt nạ raster; mở lại giữ các chỉnh sửa, và thích ứng ảnh mới tái định vị vùng đồng thời giữ các lựa chọn bật/tắt/xóa.

## Kiểm chứng

Kiểm tra core, recipe, runtime, DOM và engine native; đối chiếu đủ 11 phong cách cũ với commit v108 `5f2947c2e0ff785ae3c3fcd14d79909a49ec6d50`. Dùng hai ảnh thật đã có của người dùng trong scratch để so với chuỗi cứu sáng trung tính: màu cảnh, vùng tối trên người, mặt, áo trắng, tóc, chi tiết và highlight. Phân biệt gần trắng (kênh ≥250) với chạm trần (kênh =255).

Ảnh và dữ liệu nhận diện người dùng không đưa vào repository hoặc gói phát hành. Môi trường không có công cụ trình duyệt được hỗ trợ nên chưa kiểm tra cử chỉ, bố cục và tốc độ trên iPhone thật.

## Kết quả ảnh thật

Đã xem cả tám render ở 640 px (bốn phương án trên hai ảnh) và bản mặc định xuất đúng 1085 × 723 px. Kết quả có màu cảnh rõ hơn so với chuỗi cứu sáng trung tính v108; phương án xanh, ấm và điện ảnh khác nhau bằng pixel thực. Không thấy viền sáng quanh tóc hoặc các vệt màu neon trên người. Mây và áo trắng vẫn còn kết cấu; phần sáng nguyên gốc đã mất thông tin không được mô tả là tái tạo chi tiết mới.

- Ảnh núi: phương án mặc định tăng độ sáng vùng thân tối khoảng 40% ở preview và 41.2% ở bản xuất; ảnh ngoài trời khoảng 27.5% ở preview. Đây là số đo trên hai ảnh kiểm tra, không phải mức tăng cố định cho mọi ảnh.
- So với v108 cùng ảnh/seed, lớp phim mặc định làm màu hậu cảnh thay đổi trung bình 7.15/255 trên ảnh núi và 9.75/255 trên ảnh ngoài trời; khoảng 57% và 75% pixel hậu cảnh đổi hơn 5 mức RGB. Sai khác trung bình vùng da tương ứng chỉ 0.77/255 và 0.37/255. Các phương án khác còn có mức cứu sáng riêng nên không được diễn giải mọi thay đổi da là do lớp màu.
- Trong các ROI trời, mặt và áo đã đo, cả bốn phương án ở hai ảnh và bản xuất mặc định không có kênh màu chạm 255. Đây là kiểm tra vùng cụ thể, không khẳng định ảnh bất kỳ không thể có highlight chạm trần.
- JSON ở cường độ 73% lưu rồi mở lại cho pixel giống hệt. Nguồn và kích thước không đổi. UI/runtime kiểm tra được sửa/tắt/xóa lớp phim riêng, giữ lớp cứu sáng, 0%/so sánh đúng baseline và phối lại không chồng nhóm.
- 220 phương án của toàn bộ 11 phong cách trước giữ JSON giống hệt v108 trên hai phân tích ảnh thật và ba ảnh tổng hợp. Không thay đổi preset hoặc renderer gốc.
- Hồi quy đầy đủ: **719 bài, 717 đạt, 0 lỗi, 2 bỏ qua** (kiểm tra suy luận LaMa chuyên biệt). Trong đó core 26/26, UI/runtime 38/38 và recipe 15/15; kiểm tra native mới bảo vệ màu cảnh, mặt/áo, vùng trời màu, chỉnh saturation riêng và JSON/pixel roundtrip.
- Build web thành công, source/build trùng nhau. Bản HTML đóng gói có 80 script đã kiểm tra cú pháp và không còn phụ thuộc script/stylesheet cục bộ. 188 file phát hành ngoài năm file Composer/service worker thay đổi giữ nguyên từng byte so với v108; engine inline giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`.

Bằng chứng riêng: `/workspace/scratch/composer-v109-qa/final-{mountain,outdoor}-640/`, `final-mountain-1085/`, `roundtrip.json`, `final-qa.json`; ảnh người dùng không nằm trong assets. Core đã kiểm tra có SHA-256 `335ed143d2fd36181ad59e013ef5d0015141980bb0ae2a07c316481c31d209f0`.
