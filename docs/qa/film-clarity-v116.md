# Màu phim Nắng Phố, Khử mờ và Chi tiết — v116

## Yêu cầu

1. Sửa module Preset, ưu tiên màu phim: dựng một màu phim theo cặp ảnh mẫu trước/sau của người dùng (phố nắng, áo len đen).
2. AI Composer phải cho ảnh thật nét và cứu sáng rõ ràng, theo hướng ảnh mẫu Threads của cảnh núi mây: mây trắng sạch có khối, núi tách lớp, mặt sáng rõ.

## Màu phim "Nắng Phố" (`rayNangPho`)

Cặp ảnh mẫu được căn khớp từng điểm ảnh (ảnh sau là ảnh trước thu nhỏ 0,978 lần, lệch 0 px). Đo trên OKLab, bỏ vùng mặt đã được chỉnh riêng:

- Đường tông: đen sâu, tông tối 0,1–0,4 giảm 0,04–0,09; tông trung giữ nguyên; trắng cuộn mềm tới khoảng L 0,944, không cháy bệt.
- Độ rực theo độ sáng: khoảng 0,8 ở tông trung, 0,5 ở vùng sáng và trời (trời nhạt trong).
- Quay hue: vàng-lục (90–150°) +8…+14° về lục lam, lam (270–300°) −9…−13° về lam ngọc; da và đỏ giữ hue.
- Da (hue 40–75°, độ rực vừa, đủ sáng) được giữ một nửa khỏi đường tông đè tối và giảm độ rực.

Engine `dist/darkroom/ray-film-looks.js` dựng màu thành bảng tra 3D 33³ rồi nội suy ba chiều, nên chạy nhanh và giống nhau ở bản xem trước lẫn bản xuất. `film-looks-adapter.js` gắn vào RAY như Thu Nhật: chạy trên điểm ảnh ảnh chụp trước bảng màu, ánh sáng, hạt, khung và dấu ngày. Bảng `LOOKS` cho phép thêm màu đo từ ảnh mẫu khác mà không sửa engine.

Preset **Nắng Phố** trong nhóm *Trầm & sâu* là `{rayNangPho:1, detail:.18}`, có thể chỉnh bằng Cường độ tổng (0–150% theo phạm vi engine), lưu vào Màu của tôi, chia sẻ mã màu và xem trong Các bước.

Sai lệch trung vị OKLab với ảnh mẫu: **0,075 → 0,028** (bản JS khớp mô hình đo trong 0,003). Phần còn lại chủ yếu là bước làm sáng mặt và làm mịn da của ảnh mẫu; trong RAY, việc này thuộc Makeup hoặc lớp cứu sáng mặt của AI Composer.

## Khử mờ (`dehaze`) và Chi tiết (`detail`)

`dist/darkroom/clarity-core.js` là engine JS thuần (Node, trình duyệt, worker); `clarity-adapter.js` gắn vào RAY và thêm hai thanh **Chi tiết** và **Khử mờ** ngay dưới Độ nét trong Chất phim.

- **Khử mờ**: đo kênh tối và màu sương trên lưới ≤256 ô, độ truyền tinh chỉnh bằng guided filter theo độ sáng từng điểm ảnh, nên viền người và núi không bị quầng. Trần độ truyền giữ mây và trời không bị kéo xám bẩn; vùng rất tối giữ chi tiết. Ám màu được cân theo từng dải sáng từ các ô gần trung tính (mây, sương, tường sáng). Ám máy thường nằm ở tông trung, ví dụ mây xám ngả tím, trong khi trắng nhất gần trung tính. Lệch quá mạnh như hoàng hôn hay đèn màu chỉ cân một phần. Có bù phơi sáng tông trung sau khử mờ.
- **Chi tiết**: hai dải tần trên kênh sáng. Dải mịn (σ ≈ 0,9·unit) cho nét, dải trung (σ ≈ 5,2·unit) cho độ rõ khối, với unit = W/1200 nên xem trước và xuất cùng một vẻ. Ngưỡng bỏ nhiễu đo từ chính ảnh và giới hạn mềm chống viền sáng. Xử lý theo dải 128 hàng nên ảnh 12MP chỉ thêm khoảng 34 MB bộ nhớ (đo trên Node).

Đo trên ảnh 12MP (Node): khử mờ khoảng 0,9 giây, chi tiết khoảng 1,0 giây.

## AI Composer: cứu sáng rõ ràng

Ba chế độ **Cứu ngược sáng**, **Phục hồi sáng & nét** và **Màu phim cứu sáng** giữ toàn bộ lớp cũ và thêm:

- Phân tích vùng hậu cảnh đo thêm kênh tối trung bình (`darkMean`) và độ rực (`chroma`). Độ "sương" = (darkMean − 0,20)·1,6 + (0,14 − chroma)·2. Ảnh núi mây mẫu đo được 0,56, ảnh phố nắng 0,17.
- Lớp **Bảo vệ/cân hậu cảnh** (ngoài chủ thể) nhận `dehaze` theo độ sương (Phục hồi: 0,30 + 0,55·sương; Ngược sáng: 0,22 + 0,55·sương, nhân hồ sơ phương án) và độ rực nhẹ theo độ sương.
- Lớp mới **Chi tiết toàn cảnh** (`clarity`) với `detail` 0,30 (ngược sáng) / 0,46 (phục hồi) nhân hồ sơ và ngân sách nhiễu. Lớp này đứng sau cứu sáng mặt và sau màu phim, trước lớp chi tiết chủ thể. Tắt, chỉnh, xóa riêng được.
- Công thức AI cũ chưa có `darkMean`/`chroma` vẫn mở và áp dụng được.

Trên ảnh núi mây của người dùng (chủ thể và mặt khoanh tay để thử), mây từ RGB (204,205,229) ngả tím về khoảng (203,203,213). Núi và ruộng bậc thang tách lớp; mặt sáng và nét hơn. Ảnh mẫu Threads còn có chi tiết tạo sinh và màu núi xanh lục mà công cụ cổ điển không tạo ra từ dữ liệu không có. Ảnh của người dùng và kết quả thử không đưa vào mã nguồn.

## Tương thích

- Engine nhúng gốc trong `dist/darkroom/index.html` giữ SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`. Ba thông số mới đi qua adapter như Thu Nhật.
- Thứ tự và pixel của mọi preset cũ không đổi (kiểm thử nạp đủ adapter mới). Nắng Phố đứng cuối nhóm *Trầm & sâu*.
- `rayNangPho`, `dehaze`, `detail` được thêm vào danh sách thông số của: lớp hiệu ứng, phạm vi trong/ngoài vùng, Cường độ tổng, công thức AI, công thức chia sẻ, mô tả lớp và giao diện lớp AI Composer.
- Service worker đổi cache `ray-photo-20261127-film-clarity-v116` và cache thêm bốn tệp mới.

## Kiểm chứng

- `test/film-clarity.test.cjs` (7 bài): mức 0 giữ nguyên điểm ảnh và alpha; khử mờ tăng tương phản vùng sương, giảm ám tím của mây, không tạo thêm điểm cháy; chi tiết tăng tương phản cạnh, vùng phẳng không đổi, không có vệt giữa các dải xử lý, nhiễu mịn được lọc; Nắng Phố (đen sâu, trắng cuộn mềm, lá ngả lục lam, da không bị đè tối, bảng 3D khớp công thức trực tiếp); adapter native; độ khử mờ theo độ sương và công thức AI lưu/mở lại, gồm công thức cũ. Bổ sung chín tổ hợp cảnh/vị trí sáng và mức Khử mờ để bảo vệ màu, vân và trần sáng.
- Kiểm thử cũ được nạp thêm adapter mới: pixel và thứ tự mọi preset cũ giữ nguyên; 13 kiểm thử dựng ảnh AI Composer (trời không bị đẩy sáng hay cháy, mặt và áo trắng được bảo vệ) đạt khi bật Khử mờ/Chi tiết; Cường độ tổng 0/20/80/100% với cả 90 màu, gồm Nắng Phố.
- Hồi quy toàn bộ `npm test` khi tích hợp Sites: **796 bài, 794 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa tùy chọn).
- Bản sửa ban đầu của Claude có báo cáo kiểm tra Chromium (Playwright) trên `npm run dev:local`: thanh Chi tiết và Khử mờ nằm sau Độ nét, nút Nắng Phố áp `{rayNangPho:1, detail:.18}`, không có lỗi JavaScript. Lượt tích hợp Sites này không chạy trình duyệt hoặc iPhone/Android thật.

## Hậu kiểm khi đưa lên Sites — 2026-11-27

Nguồn Claude được lấy từ commit `ea626ab8e92feed83fd232617ac551ca4ccacaab` trên nhánh `claude/inspiring-maxwell-oqbeiu`, dựa trên nguồn GitHub v115 `c0c2fcaee0d34d9f8d86b5884e2dd30f1735a82e`.

Đã sửa hai lỗi tái hiện được trước khi phát hành:

1. Khử mờ có thể đẩy kênh màu vùng sáng ấm lên 255, làm mất vân; phần bù phơi sáng dùng sai tâm khi tính trần màu. Bổ sung đường cuộn sáng đơn điệu với cùng hệ số RGB và tính giới hạn theo độ sáng sau bù. Kiểm thử giữ vân, hue và alpha, đồng thời không sinh thêm kênh cháy ở vùng nguồn chưa cháy.
2. Các lớp hoặc snapshot trước v116 thiếu `rayNangPho`, `dehaze`, `detail` nên thừa hưởng giá trị đang chỉnh, có thể khiến xuất ảnh khác preview đã cache. Khi dựng lớp cũ và mở/hoàn tác nháp cũ, ba giá trị thiếu được đưa về 0 trước khi áp thông số đã lưu. Metadata lớp cũ không bị viết lại. `test/clarity-compatibility.test.cjs` kiểm tra cả ba hiệu ứng, preview/xuất ảnh, nguồn ảnh bất biến và hoàn tác/làm lại/mở lại nháp.

`npm run build:native` và `npm run source:check` thành công. Native bridge và 29 phần JS lõi giữ nguyên nội dung; hash script nhúng vẫn là `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`. HTML editor có hash `2776dbb411b8057b8c4fd2c08ef34fa12730c6927a55f36a0c574aa67879aa08`, chỉ thêm khai báo nạp các engine/adapter mới ngoài khối script gốc.

Build hosting Sites, HTML standalone và frontend portable đều thành công. Standalone có 87 script classic được kiểm tra cú pháp; `build/web` có 200 file public khớp nguồn. Các engine đã sửa, session/layers, editor, service worker và metadata preset trong `dist/client` đều khớp từng byte với nguồn đã kiểm thử. Bundle backend có ba tham số mới của công thức chia sẻ. Bản đồ nguồn vẫn gồm 40 nhóm chức năng.
