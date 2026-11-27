# RAY PHOTO — xưởng ảnh phim

**Bản nguồn đầy đủ v118 trên GitHub.** Chạy dự án bằng `npm ci` rồi `npm run dev:local`. Nguồn editor hiện hành nằm trong `source/editor/`; các engine và module còn lại được chỉ rõ trong [bản đồ module](source/module-map.json). Hai file HTML đã có ở gốc repo được giữ làm bản cũ. [Hướng dẫn riêng cho repo GitHub](docs/GITHUB-HANDOFF.md).

Website hiện tại: [RAY PHOTO](https://pho-cang-photobooth.linhhoang3105.chatgpt.site). Việc cập nhật website cần phát hành qua Sites như mô tả trong hướng dẫn GitHub.

Bản tích hợp trình chỉnh ảnh RAY PHOTO và photobooth Linh Linh – Phố Cảng. Giao diện film tối/ấm, bốn khu Khám phá / Buồng ảnh / Photobooth / Album.

## Một chạm với người ngược sáng nặng — v118

**AI Composer → Cứu sáng & nét → Tự phối ảnh** nhận thêm trường hợp người tối sâu trước trời sáng. AI dùng khuôn mặt làm điểm tự động cho công cụ chọn vật hiện có để khoanh người, giữ riêng cảnh/lan can; bù sáng người bằng công cụ RAY, giảm nâng nền xám và giữ màu trời hoàng hôn. Cảnh núi mờ sương được khử mờ riêng; cảnh chạng vạng không nhận cùng mức khử mờ/làm nét như ban ngày.

Từng lớp và vùng vẫn chỉnh, tắt/xóa và lưu công thức được. Nếu vùng người chưa đủ tin cậy, giữ nhận diện ban đầu và không tăng sáng thân người mạnh. Ảnh đen mất sắc độ hoặc nhiễu nặng chỉ phục hồi được phần thông tin còn lại. Không thay đổi các màu Bộ lọc, engine gốc hoặc kết quả cứu sáng hỗn hợp của v117. [Kiểm chứng v118](docs/qa/ai-composer-severe-v118.md).

## Công thức AI và bù sáng khuôn mặt — v117

AI Composer gộp hai lựa chọn cứu sáng gần nhau thành **Cứu sáng & nét**. Danh sách hiển thị dùng `getVisibleStyles()`; các ID phong cách cũ vẫn được giữ để mở, sửa và dùng lại công thức đã lưu. Các phương án có cùng tác động được gộp lại; khác biệt tên hoặc metadata không tạo thêm một lựa chọn giống ảnh.

Công thức AI ưu tiên bù sáng riêng vùng mặt bị bóng tay hoặc ngược sáng, đo cả vùng tối và khoảng trống vùng sáng. Màu cảnh và các engine gốc tiếp tục được dùng; áo đen và vùng trắng trên người được bảo vệ khỏi mở sáng toàn thân không cần thiết. Các màu trong **Bộ lọc** giữ nguyên. [Bàn giao phần AI cho lần sửa tiếp](docs/AI-COMPOSER-HANDOFF.md) · [Kiểm chứng v117](docs/qa/ai-composer-person-v117.md).

## Màu phim Nắng Phố, Khử mờ và Chi tiết — v116

**Ảnh → Bộ lọc → Trầm & sâu → Nắng Phố** là màu phim đo từ cặp ảnh mẫu trước/sau: đen sâu, tông trung giữ nguyên, trắng cuộn mềm, màu dịu, trời nhạt trong, lá vàng-lục ngả lục lam, trời ngả lam ngọc. Da được giữ khỏi bị đè tối. Engine mới `ray-film-looks.js` dựng màu bằng bảng tra 3D, có thể thêm các màu đo từ ảnh mẫu khác. Cường độ tổng, Màu của tôi và mã chia sẻ dùng được như các màu khác.

Trong **Chất phim**, ngay dưới Độ nét, có hai thanh mới. **Chi tiết** làm nét hai dải tần theo độ phân giải, có bỏ nhiễu và chống viền. **Khử mờ** bỏ lớp sương bằng kênh tối và guided filter, đồng thời cân ám màu theo màu mây/sương.

Trong **AI Composer**, *Cứu ngược sáng*, *Phục hồi sáng & nét* và *Màu phim cứu sáng* tự đo độ sương của hậu cảnh để khử mờ ngoài chủ thể, và thêm lớp **Chi tiết toàn cảnh**. Cả hai đều chỉnh, tắt hoặc xóa riêng được, và công thức cũ vẫn mở được. Engine nhúng gốc không đổi; các thông số mới đi qua adapter như Thu Nhật. [Đo đạc và kiểm chứng v116](docs/qa/film-clarity-v116.md).

## Mã nguồn theo module và bàn giao dự án — v115

Nguồn lõi editor đã tách thành các phần JS theo chức năng, HTML template và CSS trong **source/editor/**. Các module Bộ lọc, AI Composer, Makeup/tóc, Body, ánh sáng, vùng chọn, xóa/vá nền, sticker, Photobooth, lịch sử/nháp, server và native có trong **source/module-map.json**. Bộ ghép giữ thuật toán và kết quả runtime như bản trước.

**[Hướng dẫn chạy và chuyển dự án](docs/SOURCE-HANDOFF.md)** · **[Bản đồ module](source/module-map.json)**. Chạy local: `npm ci` rồi `npm run dev:local`. Xuất frontend cho hosting khác: `npm run build:web`. Gói ZIP nguồn đầy đủ gồm cả code, mô hình, tài nguyên, backend, kiểm thử và wrapper Android/iOS; giữ các phiên bản cũ riêng biệt.

## Nhận diện tóc trong ảnh nhiều người — v114

Trong **Makeup → Tóc**, lượt quét dùng da/tóc và mốc mặt để nhận diện từng vùng tóc; kết quả được trả ngay sau các bước này, không cần chờ tách cơ thể. Luồng Makeup đầy đủ vẫn có bước tách người như trước. Ở lượt quét tóc đầu tiên, nếu người mặc định không có vùng tóc mà người khác có, app chọn người có tóc nhận diện và khuôn mặt lớn nhất; các lượt quét sau giữ người đã chọn và thông số đã chỉnh.

Nếu đang chọn người không có vùng tóc nhưng người khác đã nhận diện được, giao diện chỉ rõ Người cần chọn qua ảnh nhỏ. **Độ phủ màu tóc 0** là cường độ nhuộm, không phải số đo tóc AI nhận được. [Phân tích và kiểm chứng v114](docs/qa/hair-scan-v114.md).

## Cường độ tổng cho Bộ lọc — v113

Trong **Ảnh → Bộ lọc**, thanh **Cường độ tổng** dưới tên bộ lọc chỉnh độ đậm 0–100% cho toàn bộ màu có sẵn và nhóm lớp của **Màu của tôi** đang chọn. 0% tắt tác động riêng của màu ấy, 100% giữ đúng công thức đầy đủ; các lớp trước đó, Makeup, tóc, chỉnh dáng và chỉnh sáng độc lập vẫn giữ. Mức đang chọn được dùng khi thử màu khác. Nút **Nhẹ** tiếp tục chỉ điều chỉnh tốc độ xem ảnh.

Thanh này độc lập với cường độ của AI Composer. Kéo nhiều lần không cộng dồn; hoàn tác và nháp giữ tham chiếu 100%, kể cả khi lưu ở 0%. Công thức cá nhân lưu các thông số hiệu lực đã chọn. [Phạm vi và kiểm chứng v113](docs/qa/filter-strength-v113.md).

## Phối hài hòa toàn cảnh — v112

Trong **Ảnh → Filter → AI Composer**, chín phong cách màu nay điều phối trời, mây, cây cối, địa hình và sáng chủ thể theo cùng một hướng. Bốn phương án đổi cả bảng màu cảnh lẫn phân bổ ánh sáng, ví dụ Natural có lam ngọc/lá xanh, nắng sớm/lá non, lam trời/rừng mát và mây ngọc/sage. Mây có lớp riêng gần trung tính để giữ chuyển sáng; cây có màu và độ đậm riêng, không đi chung với đất/núi. Vùng được ước lượng từ ảnh và nhận diện sẵn có, có thể cần sửa lại ở cảnh phức tạp.

Từng lớp vẫn đổi màu, chỉnh thanh trượt, xem vùng, tắt/xóa và lưu công thức được. Công thức cũ tiếp tục dùng được; thích ứng ảnh khác tái xác định vùng thay vì áp lại mặt nạ cũ. Giữ 12 phong cách, toàn bộ preset và engine gốc, ba chế độ cứu sáng, Makeup, tóc, chỉnh dáng và Photobooth. [Phạm vi và kiểm chứng v112](docs/qa/ai-composer-v112.md).

## RAY AI Composer — v111

**AI Composer** nằm đầu mục **Ảnh / Filter**, giữ nguyên mười hai phong cách. Chín phong cách màu kết hợp nền màu phối từ preset RAY với bảng màu trời/cảnh riêng, điều chỉnh tương phản, nhiệt độ, đường cong sáng và ánh sáng cục bộ theo ảnh. Các vùng trời/cảnh được ước lượng bằng màu, vị trí, tính liên thông và mặt nạ bảo vệ người/tóc/da; khi thiếu dấu hiệu trời, không tạo lớp trời giả. Mỗi phong cách có hướng sắc độ riêng như xanh ngọc, cobalt, lavender/đào, hổ phách hoặc màu điện ảnh, thay vì chỉ trộn các màu gần nhau. Có thanh tỷ lệ màu nền, màu vùng, cường độ và thông số native; từng lớp/vùng vẫn sửa, tắt hoặc xóa riêng được. Hoàn thiện độ trong/độ nét theo nhiễu, giữ kết cấu và bỏ hạt tự động trong các phong cách màu được nâng cấp. **Cứu ngược sáng**, **Phục hồi sáng & nét** và **Màu phim cứu sáng** giữ chuỗi xử lý đã kiểm chứng. Mỗi phong cách có bốn phương án, phối lại, cường độ 0–100% và so sánh trước/sau. Lưu đầy đủ thông số/vùng vào **Công thức AI của tôi**, xuất/nhập JSON hoặc thích ứng vùng khi dùng sang ảnh khác. Xử lý trên thiết bị, không dùng API AI trả phí; lần đầu cần tải mô hình nhận diện. [Kiến trúc](docs/qa/ai-composer-v105.md) · [Phối vùng sáng/màu v108](docs/qa/ai-composer-v108.md) · [Màu phim cứu sáng v109](docs/qa/ai-composer-v109.md) · [Trộn màu và Soft Dream v110](docs/qa/ai-composer-v110.md) · [Bảng màu trời/cảnh riêng và kiểm chứng v111](docs/qa/ai-composer-v111.md).

## Tách vật, tranh và tạo sticker — v99

Trong **Thay nền** hoặc **Ghép / sticker**, bấm **Tách vật / Tạo sticker**. Chạm người, đồ vật hay thú cưng để giữ lại bằng AI; **AI thêm / bớt**, **Bút giữ / Bút bỏ** sửa từng phần. **Chấm góc → Khép vùng** giữ các cạnh thẳng của tranh, khung ảnh hoặc vật có góc nghiêng. Có xem sticker trên nền ô trong suốt, mềm mép và hoàn tác.

**Tách nền ảnh này** dùng vùng chọn làm chủ thể để thay nền. **Ghép vào ảnh** thêm một lớp di chuyển, xoay, đổi cỡ độc lập. **Lưu sticker** giữ PNG trong kho riêng trên thiết bị, dùng lại qua nút Ghép; xóa khỏi kho không xóa lớp đã ghép hoặc nháp. **Lưu PNG** xuất riêng chủ thể, cắt gọn phần trong suốt, giữ pixel nguồn ở độ phân giải gốc và không kèm nền mới, khung/phim hay chữ. Trên iPhone có nút Chia sẻ · Lưu ảnh sau khi PNG sẵn sàng. [Chi tiết kiểm tra](docs/qa/object-stickers-v99.md).

## Kéo, xoay và căn bàn / ghế ngay trên ảnh — v98

Trong **Thay nền**, kéo người để di chuyển; tay **Xoay** đổi góc và tay **Đổi cỡ** chỉ phóng/thu. Hai ngón vừa kéo, vừa xoay và đổi cỡ. **Dựng thẳng** sửa góc lệch. Các thao tác giữ điểm tựa khi đã chọn, vẫn sửa được sau hoàn tác hoặc mở nháp.

**Đặt điểm tựa** → chạm mặt ghế hoặc mép bàn để dựng người thẳng tại đó → **Vật che người** để chọn phần ghế/bàn nằm phía trước. Khi tùy chọn che dưới điểm tựa bật, AI không lấy lưng ghế phía trên che mất người; bút vẫn sửa được từng phần. Bảng đặt người lên trước, cài đặt nền và phối cảnh thu gọn; bảng công cụ trên điện thoại cao hơn nhưng không cắt ảnh. Ảnh nửa người giữ dáng có sẵn, không tạo thêm chân hoặc tư thế ngồi. [Chi tiết kiểm tra](docs/qa/direct-placement-v98.md).

## Xóa đúng lớp ảnh đang thấy — v97

Trong **Xóa người / vật**, chạm vào cảnh đã thay nền/ghép người sẽ chọn đúng lớp đang hiển thị. Vật thuộc nền mới được nhận diện và vá trên nền mới; xóa phần người đã ghép sẽ để lộ nền phía sau, giữ các lớp người khác. Có menu chọn lớp khi cần. Vùng chọn và bản vá bám tọa độ riêng của lớp, kể cả khi kéo/phóng nền hoặc xoay/nghiêng người; lưu nháp và hoàn tác giữ các lớp riêng.

AI xem thêm vùng cận vật để cải thiện đường viền. **AI thêm phần sót / AI bỏ phần thừa** sửa vùng chọn trước khi bấm ✓. Phần AI tái tạo nền có bước hòa màu nhẹ từ nền sạch ngoài mép; chỉ áp dụng khi giảm chênh màu, giữ chi tiết AI và không trộn lại vật đã xóa. Không thay bằng vá nhanh khi AI gặp lỗi. [Kiểm tra và giới hạn](docs/qa/removal-v97.md).

## Phối cảnh và đặt người vào ghế / bàn — v96

**Thay nền → Nghiêng theo không gian** có Nghiêng trái / phải, Ngả gần / xa và Xoay trong ảnh. **Đặt vào ghế / bàn** cho phép chạm vị trí phần dưới người tựa vào; đổi cỡ, xoay, lật hoặc nghiêng vẫn giữ điểm tựa ấy. Viền chọn, tay đổi cỡ, nét mờ, mặt nạ sửa người, bóng và bản xuất dùng cùng phép chiếu phối cảnh. Chọn cạnh trước ghế/bàn để che phần dưới; bút Bỏ vùng che sửa được khi AI chọn cả lưng ghế cần nằm sau người.

Chạm bình thường trong Di chuyển người không còn ẩn người hoặc đổi thứ tự trước/sau vật. **Chạm để ẩn / hiện** là chế độ riêng; nút Ẩn người / Hiện người vẫn có sẵn. Đổi ảnh trở về chế độ di chuyển. Đây là chỉnh phối cảnh phần người có sẵn, không tạo tư thế cơ thể hoặc chân mới từ ảnh nửa người. [Kiểm tra và giới hạn](docs/qa/background-perspective-v96.md).

## Xóa tiếp phần sót và giữ kết quả trước — v95

Xóa vùng chọn khi đang sửa bản vá sẽ bắt đầu vùng mới, giữ phần đã xóa. Bấm Vá lại sau khi tô thêm dùng nét mới thay vì bỏ qua nó. Khi tái tạo lại bản vá, RAY giữ toàn bộ phạm vi đã xóa, kể cả khi mặt nạ chọn cũ bị thay hoặc không còn đầy đủ. Vùng đã vá cũng không bị tự nhận nhầm thành quần áo/người cần giữ rồi chặn lượt xóa tiếp; vùng giữ do người dùng chủ động chọn vẫn được ưu tiên.

Nhận diện khuôn mặt bổ sung các người bị mô hình toàn thân bỏ sót trong ảnh cận mặt/góc thấp. Vùng giữ tự động lấp lỗ kín do nhận diện thiếu. AI không dùng pixel người được giữ để dựng lại người vừa xóa; ảnh xuất chỉ đổi vùng xóa. 100 kiểm tra liên quan đạt. Đã chạy hai lượt xóa thật trên ảnh người dùng cung cấp bằng mô hình đóng gói; ảnh và kết quả thử giữ ngoài mã nguồn/bản triển khai. Nền và viền vẫn cần xem lại, chưa coi là chất lượng iPhone/Xingtu. [Chi tiết kiểm tra](docs/qa/removal-v95.md).

## Giữ bản xóa, chạm ẩn / hiện và cuộn bảng chỉnh — v94

Sửa lỗi vùng tự bảo vệ người của lượt mới cắt mất bản vá cũ, làm người đã xóa hiện lại. Vùng giữ tự động chỉ áp dụng trong lần xóa đang làm; vùng giữ do người dùng chủ động chọn vẫn có thể phục hồi ảnh gốc. Điểm chạm xác định người cần xóa; các người khác được nhận diện đều được bảo vệ, kể cả khi vùng vật nhận dư. Bổ sung phần người rời nhau qua vật che bằng dữ liệu ứng viên và mặt nạ người. Vùng AI mới có một viền mở rộng nhìn thấy được để lấy tóc bay / mép áo; Bớt vùng chọn vẫn cắt được phần thừa. Chọn thêm khi sửa bản xóa hợp với vùng cũ, giữ các phần đã chọn.

Trong **Thay nền**, chạm người để ẩn, chạm lại nét mờ hoặc **Hiện người** để khôi phục; kéo để di chuyển. Chọn vật ở ảnh nền bằng AI cho người đứng sau vật. Mỗi vùng vật được giữ riêng để chạm bật / tắt; có **Người ở trước / Sau vùng vật đã chọn**. Ẩn người ẩn cả bóng, giữ ảnh nguồn, mặt nạ, lịch sử và nháp. Nét mờ chỉ là hướng dẫn, không xuất vào ảnh.

Cuộn bảng công cụ không dừng lượt làm nét đang chờ. Thu / mở bảng giữ bộ đệm ảnh đủ nét và căn lại viền, bút, vùng chọn theo kích thước đang xem. Bản HTML cũng nhúng đủ hai module dựng cảnh mới. [Kết quả và giới hạn kiểm tra](docs/qa/removal-v94.md).

## AI chọn vật và khóa người cần giữ — v89

Trong Xóa người có **AI chạm vật / người để xóa**, **AI chạm chủ thể để giữ**, bút thêm/bớt vùng giữ và tự bảo vệ người không được chọn. MagicTouch được đóng gói cùng runtime MediaPipe 0.10.21; ảnh chỉ xử lý trên thiết bị. AI chọn vùng đỏ để xem lại, không tự xóa ngay. Vùng xanh được loại khỏi cả vùng đích sau nới viền và nguồn lấy mẫu; khi mở nháp còn ảnh gốc, thêm vùng giữ cũng phục hồi phần chủ thể bị bản vá trước che lên. Cần xem và sửa vùng AI vì có thể bỏ sót tóc, tay hoặc nhận dư.

Bản vá mới lấy một mẫu kết cấu thật ở độ phân giải nguồn thay cho trung bình nhiều kết cấu khác nhau. Nới viền mặc định của thao tác mới về 0,4%. Không thay preset, engine màu, module tóc hoặc bản vá đã lưu. Mặt nạ AI và bút giữ đi cùng nháp, hoàn tác và xoay/cắt ảnh.

59 kiểm tra liên quan đạt. Trình duyệt đã thử bút giữ, vùng đỏ chạm vùng xanh, áp dụng, hoàn tác/làm lại, lưu nháp và tải JPEG 1536 × 1024. Mô hình MagicTouch thật chạy CPU trên ảnh golden-hour nhận đúng chủ thể; kiểm tra này phát hiện và đã sửa cách đọc đầu ra một kênh foreground. Trình duyệt QA thiếu WebGL nên chưa xác minh inference AI trực tiếp trong trình duyệt hoặc Safari/iPhone thật. Cảnh cây/hoa khi xóa mảng lớn vẫn có thể lộ mảng ghép; đây chưa phải bộ vá tạo sinh tương đương iPhone. [Chi tiết kiểm tra](docs/qa/removal-v89.md) · [Vùng đỏ/xanh thử bằng bút](docs/qa/removal-v89-guard.jpg).

## Xóa người: nối nền và hòa sáng tối — v88

Bộ vá mới tìm dịch chuyển nền liền mạch bằng cả đường biên và độ biến thiên màu; khi không có nguồn khớp đủ tốt, giữ bộ ghép mảng cũ. Bù chênh màu theo biên, cân lại mảng sáng/tối lớn trong vùng ghép và hòa các mối nối từ pixel ảnh nguồn. Không trộn lại pixel người bị xóa hoặc phóng lớn ô RGB xem trước. Nới vùng mặc định cho thao tác mới từ 0,4% lên 0,6%; nháp cũ giữ thông số và bản vá cũ. Mẫu nền do người dùng chỉ định vẫn giới hạn nguồn và không bị tự đổi theo màu xung quanh. Bản đồ nguồn và trường bù màu chỉ dùng trong tác vụ, không đưa thêm vào nháp.

43 kiểm tra liên quan đạt, gồm nền chuyển sáng, đường gạch ngang/dọc, kết cấu tần số cao ở bản xuất gốc, biên đục hoàn toàn, người khác bị loại khỏi nguồn lấy mẫu, sửa/thử lại, dừng tác vụ, nháp và cắt/xoay. Bộ kiểm tra có nền gốc đối chiếu cho sai số màu trung bình giảm 3,852 → 0,001 trên nền chuyển sáng và 11,476 → 0,409 trên nền gạch; đây là ảnh tổng hợp, không phải thước đo chất lượng trên mọi ảnh thật. [Đối chiếu ảnh có cây/hoa](docs/qa/removal-v88-comparison.png). Trình duyệt đã khôi phục nháp có vùng khoanh, xóa bằng ✓, hoàn tác/làm lại và tải ảnh 1536 × 1024; [ảnh kiểm chứng](docs/qa/removal-v88-ui.jpg).

Build production đạt; checksum engine màu nội tuyến giữ nguyên. Chưa thử iPhone/Safari thật. Bộ vá vẫn lấy cảnh từ ảnh hiện có; vùng lớn hoặc kiến trúc phức tạp có thể còn vết và cần đổi nền mẫu/thu nhỏ vùng. Không sử dụng hay tuyên bố tương đương mô hình tạo sinh Clean Up của Apple.

## Thêm preset Thu Nhật — v87

Thêm Thu Nhật vào nhóm Nóng – lạnh bằng nguyên bản thuật toán người dùng cung cấp (`ray-preset-thu-nhat.js`, SHA-256 `f0abfbf2c8c745ed88b6d48021e06911bbf0a86f699924518c0e58c535feee6f`). Có lớp, cường độ 0–150, trong/ngoài vùng, lưu công thức và xuất ảnh gốc. Không thay pixel hoặc thứ tự của 88 lựa chọn cũ, không sửa engine nội tuyến.

42 kiểm tra liên quan đạt. Trình duyệt đã chọn màu, đổi Trong/Ngoài, áp lớp, sửa cường độ 100 → 65, và xuất ảnh 1536 × 1024. [Ảnh kiểm chứng](docs/qa/thu-nhat-v87.jpg). Chưa thử Safari/iPhone thật.

## Giữ nguyên thanh vùng khi chuyển công cụ — v86

Bộ lọc / Điều chỉnh / Nắng dùng đúng một thanh Trong vùng / Ngoài vùng / Vẽ vùng / Ghép nét và một hàng hình dạng. Giữ các phần tử gốc trong preset-dock khi chuyển mục; ẩn riêng danh sách màu ở Điều chỉnh/Nắng. Bỏ bộ nút lặp trong bảng điều chỉnh. Thông số vùng nằm trong nút ⚙, mở tại chỗ, có giới hạn chiều cao và không tự chuyển mục. Không thay cách dựng màu/mặt nạ hoặc thông số ảnh.

45 kiểm tra liên quan đạt. Trình duyệt đã kiểm tra 1000 × 790 và 390 × 820: thanh và hàng hình dạng đều chỉ có một, là cùng phần tử trước/sau đổi ba mục; vùng chữ nhật, phạm vi và tọa độ giữ nguyên; mở/đóng thông số và Chỉ viền vẫn dùng được. [Ảnh kiểm chứng](docs/qa/single-toolbar-v86.png). Chưa thử iPhone/Safari thật.

## Phạm vi dùng chung trong Điều chỉnh và Nắng — v85

Thanh Toàn ảnh / Trong vùng / Ngoài vùng, chọn hình và vẽ vùng nằm ngay đầu bảng Điều chỉnh và Nắng, dùng cùng vùng của Bộ lọc. Bấm chỉnh hình giữ nguyên mục công cụ đang mở. Sáng/tối vùng mới dùng một mặt nạ duy nhất, không nhân mềm viền hai lần; Không viền / Chỉ viền dùng lại công thức hình học cũ. Các lớp vùng cũ vẫn giữ cách dựng trước đây. Nắng giữ tùy chọn oval riêng trong mục thu gọn để không thay đổi nháp cũ.

45 kiểm tra liên quan đạt, gồm pixel các hiệu ứng trong/ngoài, viền/không viền, nét vẽ, độ mềm viền bổ sung nhau, lớp/nháp và công thức cũ. Trong trình duyệt 390 × 820 đã thử Cơ bản, Sáng/tối vùng, Nắng, đổi hình/đổi phía, Chỉ viền, khôi phục snapshot và Apply rồi mở chỉnh tiếp. [Ảnh giao diện](docs/qa/shared-region-v85.png). Giữ nguyên checksum engine màu inline; chưa thử Safari/iPhone thật.

## Tô vùng rồi bấm ✓ để xóa — v84

Nút ✓ trong Xóa người chạy vá vùng đã tô trước, rồi mới giữ kết quả và thu công cụ. Lỗi hoặc vùng chưa khép giữ nguyên vùng chọn; chuyển ảnh trong lúc xử lý không xác nhận nhầm ảnh mới. Không có vùng chọn mới thì không tạo lại bản vá. Các công cụ khác giữ luồng ✓ cũ. Kiểm tra hành động Apply thật với pixel xóa, thất bại, đổi tài liệu và không có vùng mới; chạy lại kiểm tra xóa người và chỉnh dáng.

## Xóa người/vật và tái tạo cảnh — v83

Thêm **Khoanh kín vùng xóa** cạnh bút tô/tẩy: kéo vòng quanh vật rồi thả tay, hoặc chạm từng điểm và **Khép vùng xóa**. Vùng đỏ cho thấy toàn bộ phần sẽ bị thay; cần chọn cả tóc, tay, chân và bóng. **Sửa vùng đã xóa** mở lại mặt nạ để bổ sung, rồi thay thế bản vá cũ sau khi thành công. Thử lại hoặc sửa không lấy bản vá cũ làm nền mẫu.

Bộ ghép nền ưu tiên kết cấu sạch gần chỗ xóa, hạn chế kéo màu bầu trời hoặc chi tiết xa vào tiền cảnh. Ghép ở 960 px (Nhẹ: 640 px), nhưng bản vá cuối lấy pixel từ ảnh nguồn ở kích thước gốc, thay vì phóng lớn ô RGB nhỏ. Sao chép theo từng dải pixel tránh hàng nghìn lệnh vẽ và bộ đệm ảnh tạm; viền đã chọn thay hoàn toàn, không trộn lại màu người cũ. Mặt nạ người đã nhận diện, nếu có, được loại khỏi nguồn lấy mẫu. Vùng bản vá lớn hơn 4 triệu pixel báo chia nhỏ trước khi cấp phát. Nháp cũ, hoàn tác, xoay/cắt, engine màu và các công cụ khác giữ nguyên.

38 kiểm tra liên quan đạt, gồm chi tiết nguồn, viền không sót màu, bảo vệ người khác, vùng kín/tẩy, sửa thay bản vá, lưu lịch sử, tỷ lệ ảnh không nguyên và nguồn mẫu gần. Trong trình duyệt 390 × 820 đã khoanh kín người trên ảnh mẫu công khai, xóa, mở lại/tô thêm, thay bản vá từ 335 × 490 thành 365 × 573 mà số bản vá vẫn là 1, hoàn tác/làm lại, ✓, lưu và tải lại nháp. Đã xuất ảnh giữ 1536 × 1024. [Ảnh kiểm chứng](docs/qa/removal-v83.png). Chưa thử Safari/iPhone thật. Đây là tái tạo từ nền còn lại, không thể xác định chính xác cảnh bị che; đường kiến trúc và vùng lớn vẫn có thể cần chọn nền mẫu hoặc chia vùng.

## Xác nhận giữ bước Chỉnh dáng — v82

Nút ✓ chấp nhận bản xem AI và kết thúc thao tác thanh kéo trước khi chụp nháp, tắt khung Đặt vị trí và tạm nghỉ bút, vẫn để công cụ chỉnh tiếp. Chỉ sau khi nháp lưu thành công mới báo **Đã giữ chỉnh dáng. Có thể chỉnh tiếp; bấm Lưu ảnh để tải về.** Lỗi bộ nhớ giữ thông báo lỗi, không hiện xác nhận thành công. Xác nhận của tài liệu/bước cũ không ghi đè trạng thái khi người dùng đã chuyển ảnh hoặc chỉnh tiếp. Không thay engine màu, bộ nắn ảnh, nét vàng hoặc luồng ✓ của công cụ màu.

71 kiểm tra liên quan đạt. Trong trình duyệt 390 × 820, thông số eo +55 được giữ trước/sau ✓ và sau tải lại/khôi phục nháp; bản dựng độc lập 1536 × 1024 trùng SHA-256 từng pixel. Đã thử lỗi ghi nháp, thử lại thành công và xuất ảnh giữ kích thước gốc. Chưa kiểm tra Safari/iPhone thật.

## Vẽ minh họa và tô trong / ngoài hình — v80

Thêm **Vẽ** trong thanh công cụ và **Vẽ nét lên ảnh** ngay trong Ghép nét. Nét tự do, thẳng và cong hiện bằng màu đã chọn trên ảnh xuất; nét hở/chấm vẽ được mắt, mũi và chi tiết nhỏ. Ghép các đầu nét hoặc Khép hình để tạo đường bao bất kỳ, chọn/kéo cả hình hoặc Uốn nét để sửa từng phần. Có thể lấy lại đường vùng đã vẽ và thêm oval, chữ nhật, tam giác làm điểm bắt đầu. Mỗi nét/hình có màu, độ dày, độ rõ riêng; hình kín có màu tô, độ đậm và Tô trong / Tô ngoài riêng. Bút Tô màu ưu tiên hình kín, không bị các nét mắt/mũi bên trong chặn.

**Preset trong hình / Preset ngoài hình** đưa đường bao được chọn vào đúng hệ vùng hiện có, dùng cho preset có sẵn, công thức nhiều lớp và các thanh chỉnh màu/ánh sáng. Nét minh họa độc lập với công thức màu, không bị nhuộm lại hoặc nhân bản qua từng lớp. Nháp tài liệu giữ đủ vector/màu; hoàn tác/làm lại, cắt/xoay/lật, dấu tích và mở lại công cụ giữ được nét. Xuất vẽ ở kích thước nguồn, không lấy pixel từ bản xem trước. Nét minh họa không được nhét vào công thức màu dùng cho ảnh khác; đường bao chuyển thành vùng thì vẫn lưu cùng công thức như trước.

89 kiểm tra liên quan đạt, gồm pixel nét hở/chấm, tô trong/ngoài bổ sung nhau, mặt nạ dùng chung, vector/style qua lịch sử và JSON nháp, dữ liệu lỗi/giới hạn, remap cắt/xoay/lật và tỉ lệ preview/export. Trình duyệt 390 × 800 đã vẽ/ghép đường bao mèo, nét chấm và cong; thử màu nét, màu tô, tô trong/ngoài, preset đen trắng trong/ngoài, uốn hình, dấu tích rồi mở Vẽ tiếp và tải lại/khôi phục nháp. Xuất ảnh mẫu giữ 1536 × 1024. Chưa kiểm tra Safari/iPhone thật. Checksum script engine màu gốc giữ nguyên.

## Dễ tìm To/nhỏ và Bè/thon — v79

Tab Từng vùng đổi nhãn thành **To/nhỏ · Bè/thon**. Ba thanh To/nhỏ, Ngang bè–thon và Dọc dài–ngắn nằm ngay dưới ô chọn bộ phận. Các thanh dùng lại đúng phần tử và sự kiện cũ; giữ thang đo, dữ liệu nháp, lịch sử và bộ nắn ảnh. Trên điện thoại, nhãn/giá trị và thanh kéo cùng một hàng, bỏ khoảng trống của bố cục cũ để giữ nguyên diện tích ảnh xem trước và chiều cao bảng công cụ.

Bút sửa vùng, thu/nới khung và các nút đặt vị trí nằm trong mục **Sửa khung & bút vùng** bên dưới. Đóng mục này thì bút vùng nghỉ để không giữ lớp bắt chạm khi người dùng không còn thấy nút bút.

70 kiểm tra liên quan đạt. Trình duyệt đã kiểm tra tại 390 × 780 và 340 × 660, kéo thanh ngang đổi pixel, hoàn tác về thông số cũ, đổi bộ phận/chỉnh bắp tay, mở/đóng bút vùng. Không thay engine màu. Chưa kiểm thử iPhone thật.

## Giữ bước chỉnh dáng rồi nắn tiếp — v78

Trong Chỉnh dáng, nút ✓ chung giữ bước và lưu nháp nhưng tiếp tục hiện công cụ, tạm nghỉ bút để không nắn nhầm. Nút trên ảnh và nút Xong nét chuyển thành **Chỉnh tiếp nét**; chạm để mở lại đúng nét vàng đã giữ trong chế độ Uốn nét. Có thể tiếp tục kéo nét cũ hoặc chọn Vẽ tự do / Nét thẳng để thêm nét. Công cụ màu giữ luồng xem kết quả hiện có.

67 kiểm tra liên quan đạt, gồm chạy chính hàm Áp dụng của phiên chỉnh sửa, ba vòng áp dụng/chỉnh tiếp/kéo bằng pointer thật, giữ nguyên pixel lúc tạm nghỉ và mở lại, lịch sử, nháp, viền AI, lớp màu và kích thước hiển thị. Trình duyệt tại chiều rộng 390 px đã thử vẽ → kéo nắn → ✓ vàng → chỉnh tiếp → kéo tiếp → ✓, hoàn tác/làm lại, lưu nháp, tải lại/khôi phục rồi chỉnh tiếp nét cũ. Bài thử dùng ảnh lưới tạo tại chỗ; chưa kiểm tra trên iPhone thật. Giữ nguyên engine màu và dữ liệu nét của nháp cũ.

## Kéo viền vàng nắn ảnh và giữ bằng ✓ — v77

Sửa nguyên nhân kéo viền rồi bấm ✓ không đổi ảnh: thao tác cũ chỉ sửa mặt nạ nhận diện. **Nắn theo viền** giờ kéo trực tiếp pixel vùng sát viền vàng, xem kết quả ngay và giữ bằng ✓. **Sửa nhận diện**, Thêm vùng và Bớt vùng giữ chức năng sửa mặt nạ riêng. Không tự chạy lại nắn toàn thân sau quét. Nét nhận diện của nháp cũ giữ nguyên nghĩa; chỉ nét mới có cờ reshape mới nắn ảnh.

Viền hiển thị theo đúng biến dạng. Các nét viền và Bút nét dùng chung một lần lấy mẫu có giới hạn gradient; giữ kích thước nguồn, hoàn tác/làm lại, dữ liệu riêng từng người, nháp và phép cắt/xoay/lật. Cache lớp màu nhận biết thay đổi viền để ảnh vẫn cập nhật sau khi đã áp preset. Không thay script engine màu hoặc preset.

115 kiểm tra liên quan đạt, gồm thao tác pointer kéo viền qua bộ điều khiển thật, so pixel giữa hai chế độ, ✓/kết quả/hoàn tác/làm lại/nháp, ghép Bút nét, ảnh xuất, cache lớp màu, tọa độ preview/export và cắt/xoay/lật. Trong trình duyệt, kéo viền đổi 1.333 pixel cục bộ trên ảnh thử 600 × 800; ✓ giữ kết quả, hoàn tác về 0 pixel đổi, làm lại khôi phục 1.333 pixel đổi; ảnh xuất giữ 600 × 800 và tải lại/khôi phục nháp còn nét đã nắn. Mặt nạ nhận diện trong phép thử là tổng hợp, không thay kiểm thử AI trên iPhone thật. HTML độc lập dựng thành công và checksum engine màu gốc giữ nguyên.

## Lưu công thức nhiều nét và nhiều lớp — v72

Sửa giới hạn 32 KB dùng chung khiến chỉ bốn lớp có vùng vẽ đã bị từ chối khi Lưu công thức. Lưu/sửa/dùng lại trên thiết bị có ngân sách riêng 16 MiB; mã chia sẻ có ngân sách 1 MiB và kiểm tra riêng ở cả client/server. Lưu công thức trên máy không phụ thuộc việc tạo mã. Giữ đầy đủ lớp, điểm vẽ và tọa độ gốc; chỉ bỏ các trường bằng giá trị mặc định khi chụp công thức, khôi phục bằng đúng bộ mặc định hiện có lúc áp dụng. Không làm tròn, giảm điểm hay đổi renderer. Nháp ảnh vẫn được giữ trước khi lưu công thức.

46 kiểm tra liên quan đạt: lưu và đọc lại bốn lớp với nét dài hơn trần cũ; lưu 32 lớp lớn hơn ngân sách chia sẻ nhưng vẫn dùng trên máy; chia sẻ/nhập lại công thức chi tiết qua SQLite; từ chối request quá lớn mà không ghi bản dở; đối chiếu pixel trước/sau tối giản công thức cho toàn bộ màu có sẵn và vùng vẽ nhiều lớp.

## Chọn hình vùng ngay trên dải bộ lọc — v71

Khi chọn Trong vùng hoặc Ngoài vùng, hiện ngay một hàng sáu nút có biểu tượng và tên: Oval, Chữ nhật, Tia sáng, Cong, Thẳng, Vẽ tự do. Chạm đổi hình ngay trong Bộ lọc hoặc Cơ bản, giữ vị trí/cỡ/vùng đang dùng và cập nhật màu đang chỉnh. Hình được chọn nổi vàng và đồng bộ với lựa chọn trong Hình dạng & vị trí vùng. Toàn ảnh ẩn hàng này để giữ ảnh lớn; các thông số và renderer màu không thay đổi.

## Bút vẽ vùng tự do — v70

Nút **Vẽ vùng** nằm cùng Toàn ảnh / Trong vùng / Ngoài vùng ở Bộ lọc và Cơ bản. Tô vùng bằng đầu bút có cỡ tùy chỉnh, Khoanh vùng lấy phần trong đường bao khép kín, Tẩy vùng bỏ phần thừa/tạo lỗ; hỗ trợ nhiều vùng rời nhau, mềm viền, bỏ nét cuối, xóa vùng và Xong vẽ. Nét đứt đi theo biên thật của vùng và không xuất lên ảnh. Chỉ mặt ảnh bắt sự kiện vẽ, bảng công cụ vẫn cuộn được. Viền/bút vùng chỉ hiện khi chọn Bộ lọc hoặc Cơ bản/Tất cả, nhường thao tác ảnh cho các công cụ có tay chỉnh riêng; vùng vẫn tác động khi chuyển nhóm thông số.

Vùng vẽ dùng chung cho mọi thông số ảnh trong hệ phạm vi hiện có: preset có sẵn, Màu của tôi nhiều lớp, cơ bản, nhóm màu, chất phim, ánh sáng và hiệu ứng ảnh. Chọn màu trước hoặc sau khi vẽ đều được. Nét tọa độ chuẩn hóa đi cùng lớp, hoàn tác, nháp, cắt/xoay/lật và công thức lưu/chia sẻ; không chứa ảnh hoặc dữ liệu nhận diện. Giới hạn công thức dùng lại vẫn áp dụng. Mặt nạ dựng theo kích thước ảnh, có bộ đệm giới hạn và tái sử dụng phần nét cũ khi kéo; ảnh xuất dùng nguyên nguồn. 50 kiểm tra liên quan đạt; script renderer màu gốc giữ nguyên checksum.

## Sửa Trong / Ngoài sau khi chọn màu tự lưu — v68

Màu trong Màu của tôi giữ liên kết với bước đang chỉnh cho đến Áp dụng. Đổi Trong/Ngoài, vị trí, kích cỡ, góc và mềm viền cập nhật ngay các lớp vừa nạp. Vùng riêng đã có trong công thức được giữ và giao với vùng mới; Toàn ảnh bỏ giới hạn mới. Áp dụng giữ màu, không tạo lớp trống; chọn bộ lọc khác bắt đầu bước riêng. Dữ liệu này đi cùng hoàn tác, nháp, công thức dùng lại và cắt/xoay/lật. 39 kiểm tra liên quan đạt; inline engine giữ nguyên checksum. Trình duyệt không truy cập được tuyến xem thử cục bộ; kiểm tra giao diện trên bản đã triển khai.

## Phạm vi Trong / Ngoài cho màu và mọi điều chỉnh ảnh (05/11/2026)

Mặc định vẫn Toàn ảnh. Cả dải Bộ lọc và Cơ bản có Toàn ảnh / Trong vùng / Ngoài vùng; phạm vi dùng cho các thanh cơ bản, nhóm màu, chất phim và các hiệu ứng ảnh của bước đang chỉnh. Chọn vùng lấy lại hình Sáng/tối vùng hoặc đặt Oval, Chữ nhật, Tia sáng, Đường cong, Đường thẳng; có kéo vị trí/đổi cỡ/xoay, tọa độ, mềm viền, độ cong và dày nét. Phạm vi có hình học riêng để di chuyển nó không kéo các vùng sáng/tối cũ theo.

Mỗi lớp giữ riêng phạm vi trong lịch sử, nháp và công thức chia sẻ; Áp dụng bắt đầu lớp mới ở Toàn ảnh. Công thức cũ có thể dùng phạm vi đang chọn, công thức đã lưu vùng riêng giữ nguyên vùng của từng lớp. Xoay/cắt/lật remap cả vùng đang chỉnh và lớp đã giữ. Bản cũ vẫn mở mặc định Toàn ảnh.

Không thay công thức hay script renderer màu gốc: lớp phủ vùng kết hợp kết quả đã chỉnh với bản trung tính dùng đúng renderer đó. Phần không chọn khớp từng pixel với trước bước điều chỉnh; giữ alpha và khung. Đệm trung tính xem trước có giới hạn 2 MP; xuất dựng độc lập từ ảnh gốc và trộn từng dải 64 hàng để hạn chế bộ nhớ tạm. Kiểm thử đầy đủ thông số, trong/ngoài bổ sung nhau, hình học preview/export, lớp/nháp/công thức, cache và lỗi dựng ảnh.

## Bút sửa viền vàng và cuộn công cụ (05/11/2026)

AI cơ thể có **Sửa viền AI**: Uốn viền kéo trực tiếp đường vàng, Thêm vùng / Bớt vùng tô để sửa phần nhận diện thiếu hoặc dính tay/nền, thanh cỡ bút và nút Xong viền ngay trên ảnh. Viền sửa là dữ liệu nhận diện, không vẽ lên ảnh xuất và không tự làm biến dạng ảnh; nó được dùng lại khi đo và xem trước dáng. Mỗi người có nét riêng, hỗ trợ Hoàn tác/Làm lại, bỏ nét cuối, viền AI ban đầu và lưu nháp. Dữ liệu gốc của mô hình vẫn được giữ. Tọa độ bút khớp cả khi ảnh đã chỉnh dáng; nét theo thao tác xoay/cắt/lật.

Bảng công cụ cuộn dọc riêng, có nút ↑/↓ và hỗ trợ bàn phím. Ô chọn người không còn ghim che phần AI; cập nhật lại tab đang mở không kéo bảng về đầu. Menu lớp trên điện thoại giới hạn chiều cao theo vùng ảnh và tự cuộn bên trong. Không thay renderer màu/preset/template. Kiểm tra tự động gồm kéo bút qua sự kiện pointer thật của bộ điều khiển, thay đổi mặt nạ/độ rộng đo, history/nháp và tọa độ ảnh. Trình duyệt kiểm tra từ xa không mở được đồ họa AI; chưa thử trực tiếp trên iPhone thật.

## Cập nhật 05/11/2026 — màu, vùng chỉnh và lưu tệp

Giữ nguyên toàn bộ công thức preset, ID đã lưu/chia sẻ, thứ tự xử lý lớp và template. Danh mục hiển thị theo Trong & dịu / Nóng–lạnh / Xanh & đất / Pastel & sương / Trầm & sâu / Ánh sáng / Đơn sắc; luân phiên tông ấm và mát trong nhóm, Màu của tôi vẫn ở đầu và có nút lọc nhóm trên dải preset. Cơ bản gom các thanh Màu và Chất phim, dùng đúng thanh `sat` của engine với nhãn Độ bão hòa; Tự động cân bằng sáng tối có mức giới hạn và Hoàn tác.

Đường sáng cong/thẳng dùng độ lan Gaussian và nhạt dần hai đầu khi tăng Mềm viền; mức 0 vẫn giữ nét rõ. Khung eo/bụng dựa trên vai–hông, thêm bảo vệ tay theo mốc tư thế; bút nhỏ thu/nới vùng cùng nút dịch/đổi cỡ khung và thu/nới theo phần trăm. Nét sửa được giữ trong lịch sử, nháp và đi theo thao tác xoay/cắt ảnh.

Kho ảnh chỉ giữ metadata trong danh sách, phân trang 24 tệp, đọc nguồn/lịch sử khi mở tệp. Sửa tiếp dùng lại ID nháp; lưu một kết quả không đổi cập nhật cùng bản xuất thay vì nhân bản. Giao dịch bị hủy báo lỗi thay vì treo, lỗi đầy bộ nhớ vẫn cho tải kết quả về máy. Xuất video khởi động phát/âm thanh trong thao tác Lưu, có kết quả xem trước và nút tải/chia sẻ từ lần bấm mới; giữ video gốc và trạng thái chỉnh sau xuất.

304 kiểm tra tự động đạt; build Sites và đóng gói HTML độc lập hoàn tất. SHA-256 script màu gốc vẫn `1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63`. Chưa kiểm thử trực tiếp trên iPhone thật.

Kiểm tra trên web: mở được nháp từ bản 63 qua bản 64, xuất lại JPEG 1536 × 1024 trùng từng byte với bản cũ; lưu lặp cùng kết quả không thêm bản sao. Bút vùng có thể hoàn tác/làm lại và lưu cùng nháp. Đã xuất/tải video chỉnh màu có âm thanh. Lượt hoàn thiện tiếp theo loại nút Màu/Chất phim rỗng, đặt lớp bút dưới thanh Hoàn tác và ngăn tạo nháp từ khung PNG trung gian của video. Bộ ghi tính cả thời gian khởi động trong đoạn xuất, không dựng dư khung sau hạn; MP4 có âm thanh yêu cầu H.264/AAC, máy không có bộ mã hóa phù hợp dùng WebM và hiển thị đúng định dạng. Lưu lại cùng nội dung nhưng khác định dạng giữ cả hai tệp.

## Dùng ngay

Web: https://pho-cang-photobooth.linhhoang3105.chatgpt.site

Mở ảnh → chọn màu/làm đẹp/chỉnh dáng → Lưu ảnh hoặc Đưa vào photobooth. Photobooth hỗ trợ ảnh, GIF, video; từng ô có bộ lọc, xoay 90°/180°, lật, cắt và thời gian riêng. Chữ trong template sửa/xóa được. Album lưu bản xuất trong bộ nhớ của app/trình duyệt; hãy lưu thêm vào Ảnh để giữ lâu dài. Xóa dữ liệu app/trình duyệt sẽ xóa album cục bộ.

## Khung ảnh và hiệu năng áp preset (31/10/2026 · v56)

Tất cả công cụ giữ kích thước hiển thị ảnh theo khung còn trống, tách khỏi số pixel của canvas xem trước; trước đây chỉ Chỉnh dáng làm việc này. Thu/mở bảng hoặc Áp dụng làm mới bộ đệm theo diện tích mới, tránh ảnh tiếp tục bé hoặc bị kéo lớn từ bộ đệm cũ. Bảng công cụ mặc định thấp hơn, vẫn kéo/mở rộng và cuộn được; mẫu, lớp màu, vùng chỉnh và công cụ cũ được giữ.

Không tự dựng 12–16 MP sau mỗi lần đổi preset nữa. Bản xem nhanh có cạnh dài tối đa 1024 px trên điện thoại (800 px ở chế độ Nhẹ); bước làm rõ dùng vùng hiển thị và mật độ điểm ảnh, tối đa 1,6 MP hoặc 0,9 MP khi Nhẹ. Giữ nguồn gốc riêng cho xuất, giới hạn 16 MP và đường dự phòng bộ nhớ cũ không đổi. Các lớp đã giữ có bộ nhớ đệm riêng cho bản xem trước, tối đa ba mục/3 MP; xuất vẫn dựng độc lập từ nguồn. Thay ảnh, vùng chỉnh hoặc mặt nạ không dùng lại bộ đệm cũ. Trong lúc xuất, dừng tinh chỉnh và ảnh mẫu, giải phóng bộ đệm; sau xuất giữ ảnh đã dựng thay vì tự thay bằng bản xem nhỏ hơn.

Ảnh mẫu preset dùng nguồn tối đa 800 px (560 px khi Nhẹ), chỉ dựng khi đang mở Bộ lọc và người dùng đã ngừng thao tác; ưu tiên ảnh chính, AI và xuất. Máy màu inline và tham số preset không đổi. Vi hạt của bản xem tính ở kích thước màn hình có thể khác bản xuất; ảnh xuất không lấy pixel từ bản xem trước.

Kiểm tra: tái hiện trước sửa ở khung web 402×662, ảnh còn 127,5×170 px khi mở Chữ sau một lớp Ngõ nắng; lượt dựng 3024×4032 trong trình duyệt khoảng 1,4 giây. Kiểm tra riêng ảnh chi tiết 3024×4032: bước làm rõ dùng 844×1125 (giảm 92,2% pixel xử lý); JPEG xuất vẫn 3024×4032, không hạ kích thước/dự phòng; pixel trước nén khớp bản dựng độc lập từ nguồn với cùng Ngõ nắng. SHA-256 inline vẫn `1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63`. 264 kiểm tra tự động đạt, gồm bộ đệm lớp, pixel xuất, thay vùng/mặt nạ, giữ ảnh gốc, mật độ màn hình khi mở rộng vùng xem và tạm dừng khi xuất. Trình duyệt kiểm thử chặn tải lại trang sau sửa bởi chính sách URL; chưa xác nhận lại bố cục cuối bằng trình duyệt, chưa thử Safari/iPhone thật.

## Giữ viền AI trong nháp và xử lý quét lỗi (31/10/2026 · v55)

Nháp giữ kết quả nhận diện, mặt nạ người, vùng áp dụng, mục tiêu, mức thay đổi, trạng thái viền và mục Chỉnh dáng đang mở. Mặt nạ được nén không mất dữ liệu nếu có lợi, chỉ lưu một lần ngoài lịch sử chỉnh; mở lại kiểm tra đúng tệp gốc và kích thước rồi khôi phục viền, không di chuyển các vòng đã chỉnh. Nháp cũ hoặc dữ liệu nhận diện không hợp lệ vẫn giữ ảnh và chỉnh sửa; có thể quét lại để tạo viền.

Nút chính dùng viền còn hợp lệ để xem trước. **Quét lại AI** là lựa chọn riêng khi muốn nhận diện mới. Khi quét lại, kết quả nhận diện cũ được xóa trước; quét lỗi/rỗng không được báo thành công bằng dữ liệu cũ, không xóa biến dạng đã giữ. Thông báo phân biệt lỗi tải, quá thời gian và lỗi khởi tạo đồ họa; khuôn mặt nhận được không đồng nghĩa đã tìm được toàn thân. **Lưu nháp** giữ cả bước chỉnh dáng còn đang xem trước; Quay lại vẫn khôi phục bước trước đó.

257 bài kiểm tra tự động đạt, gồm nén/khôi phục chính xác mặt nạ, đo đoạn chi sau khôi phục, tệp khác/kích thước khác, dữ liệu cache lỗi, quét lại lỗi/rỗng, hủy khi thay ảnh, nút xem trước dùng lại viền và Lưu nháp giữ đúng pixel/Hoàn tác. Kiểm tra UI 390×844: nhận đủ 11/11 vùng bằng kết quả mô hình CPU của ảnh mẫu, lưu riêng cẳng tay trái ở 65%/Cân đối nhẹ, bỏ hoàn toàn bộ cấp kết quả mẫu rồi tải lại/mở nháp vẫn có viền và lựa chọn đó; xem trước không cần chạy mô hình. Đã thử lỗi quét thực trong trình duyệt cloud thiếu WebGL. Bộ cấp kết quả CPU và nhãn kiểm thử chỉ nằm ngoài mã phát hành; chưa kiểm tra Safari/iPhone thật.

## AI tay/chân và viền dáng mục tiêu (31/10/2026 · v54)

Sửa riêng Chỉnh dáng. Giữ máy màu inline, toàn bộ 19 mã vùng cũ, công cụ tay, các mẫu mặt và biến dạng an toàn; thêm Cẳng tay trái/phải thành 21 vùng. AI toàn thân gồm eo, bụng, hông, bắp tay, cẳng tay, đùi và bắp chân; có chọn Hai tay/Hai chân hoặc từng đoạn riêng. Tay co/giao nhau giữ quan hệ vai–khuỷu–cổ tay; vùng thiếu mốc, ra ngoài ảnh hoặc không tách được viền không được báo là đã đo rõ.

Dùng chính mô hình Pose Landmarker Lite 0.10.21 đã đóng gói, CPU/worker và đường dự phòng cũ; bật đầu ra mặt nạ người. Việc đo tay/chân dùng chiều dài đoạn chi, không bắt buộc có khuôn mặt. Các đường đo đi vuông góc trong tọa độ pixel ảnh, đúng cả khi mặt nạ và ảnh khác tỷ lệ. Tên và trạng thái từng vùng có trong Kết quả nhận diện.

Quét AI & xem trước dáng thay đổi ảnh xem trước; Áp dụng/Lưu mới giữ thay đổi vào các vùng BODY. Vàng là dáng trước bước này, ngà nét đứt là đích dự kiến, được chiếu qua cùng phép biến dạng an toàn. Viền nằm ở giao diện, tự ẩn ở màn hình kết quả và không nằm trong ảnh xuất. Chuyển sang chỉnh từng vùng giữ dáng đã xem trước; Hoàn tác và nháp giữ các vùng mới. V55 lưu thêm dữ liệu viền vào nháp cục bộ để mở lại không phải quét mới.

Kiểm tra: 247 bài tự động đạt; thêm các ca thiếu đầu, tay co/giao nhau, ảnh/mặt nạ khác tỷ lệ, vùng bị che, hình học viền, xem trước–Áp dụng khớp pixel, chỉnh một đoạn và Hoàn tác. Mô hình CPU 0.10.21 chạy trên [ảnh pose mẫu của MediaPipe](https://storage.googleapis.com/mediapipe-assets/pose.jpg) trả 1 tư thế, 0 mặt, 1 mặt nạ 1000×667; bộ đo mới đo đủ 11/11 vùng. Đã thử UI 390 px bằng kết quả mô hình này, sau một lớp Ngày trong, chỉnh riêng cẳng tay, Áp dụng ẩn viền, xuất 1000×667 và mở lại nháp đúng vùng. Trình duyệt cloud không tạo được WebGL nên phần UI dùng kết quả mô hình CPU với nhãn kiểm thử rõ ràng; không có bộ giả lập trong mã phát hành. Chưa kiểm tra trực tiếp Safari/iPhone thật.

## Photobooth dễ xem và preset cho video (30/10/2026)

Photobooth giữ bản xem trước cạnh bảng chỉnh trên máy tính, phía trên trên điện thoại. Bảng có hai mục Ảnh & video / Khung & chữ và cuộn riêng; nút xuất luôn hiện. Đổi khung, bố cục hoặc chữ xem được kết quả ngay, không phải kéo đến cuối trang. Kích thước canvas xuất giữ nguyên.

Trình màu phim nhận thêm video qua Mở ảnh/video hoặc kéo thả. Có phát/dừng, kéo thời gian, chọn đầu/cuối đoạn (tối đa 60 giây), cạnh dài 1080/720 không phóng lớn nguồn nhỏ, và tùy chọn giữ âm thanh. Xuất bằng MediaRecorder, ưu tiên MP4 rồi WebM theo trình duyệt, tên tệp theo định dạng thực. Dựng theo thời gian thực ở 15 fps mục tiêu; máy yếu có thể đạt ít khung hình hơn. Giữ trang mở khi xuất. Các lớp màu, điều chỉnh và nắng dùng chính máy màu cũ trên từng khung; các công cụ xử lý người/ảnh tĩnh chỉ hiện cho ảnh. Video gốc, đoạn cắt và màu được giữ trong nháp cục bộ; Chỉnh video này mở nháp gốc khi còn nháp. Có thể đưa video màu sang Photobooth (video Photobooth vẫn không có âm thanh như trước).

235 kiểm tra tự động đạt. Đã kiểm tra video tổng hợp 320×240 có âm thanh: chọn Đen trắng, cắt 0,4–2,4 giây, xuất MP4 1,97 giây với các khung chuyển động và âm thanh Opus thực; Sepia 0,5–2,5 giây xuất 2,03 giây. Đổi lại ảnh khôi phục các công cụ ảnh. Photobooth đổi sang Tem thư, cuộn xuống sửa chữ mà bản in vẫn hiện, PNG xuất đúng 900×1632. Kiểm tra trình duyệt ở chiều rộng 390 px và máy tính; chưa kiểm tra thiết bị iPhone/Safari thật. Script máy ảnh inline giữ nguyên SHA-256 `1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63`.

## Chỉnh dáng gọn và giữ khung xem (30/10/2026)

Chỉnh dáng có ba mục Từng vùng / AI cơ thể / AI mặt. Mục thủ công dùng một bộ chọn vùng và ba thanh To/nhỏ, Ngang, Dọc; Đẩy, xoay và độ mềm nằm trong phần mở rộng. AI cơ thể chọn toàn thân hoặc đúng một vùng; chỉ các vùng được chọn và đo đủ mới được chỉnh. Dùng chung Áp dụng và Quay lại của phiên chỉnh, giữ các công cụ tỷ lệ trong phần tham khảo tùy chọn. Khung vùng giữ khi kéo thanh thủ công; mốc mặt ẩn sau Áp dụng. Chỉ đổi bố cục và phạm vi lựa chọn, giữ máy màu và các thuật toán biến dạng cũ.

Ảnh trong Chỉnh dáng khớp khung theo diện tích thực còn lại, độc lập với số pixel của canvas xem trước. Thu/mở bảng và Áp dụng không thu nhỏ ảnh gốc hoặc đổi kích thước xuất. Nháp cũ tiếp tục dùng cấu trúc và lịch sử cũ.

## Đồng bộ tên hiệu ứng trên web (30/10/2026)

Đổi nốt 11 nhãn máy ảnh/phim: SRT 101 → Mơ chiều, Industar 50 → Rêu nắng, AE → Nắng lụa, FXS → Hồng sương, GRX → Phố lặng, CCD → Ngày trong, FX400 → Lá non, P400 → Lụa hồng, E100 → Ráng hạ, H400 → Mây ngọc và Toy D → Kẹo nắng. Giữ các tên đã đổi trước đó. Trang chủ, dải bộ lọc, lớp màu, chi tiết công thức cũ và bộ lọc Photobooth dùng tên thống nhất. Mã preset, tham số, nhóm, thứ tự, nháp và mã chia sẻ giữ nguyên. Bộ dựng tự đồng bộ tên trang chủ với danh mục để tránh sót khi xuất bản; cập nhật cache tài nguyên để tải tên mới.

## Bỏ Premium trên web (30/10/2026)

Mọi công cụ, xuất ảnh và công thức đều miễn phí. Bỏ hộp mở khóa, giá và kiểm tra quyền trả phí; lưu ảnh luôn dựng đầy đủ các hiệu ứng hiện có. Mã 8 chữ số giữ nguyên thông số ảnh in và bút ánh sáng cho cả người tạo lẫn người nhập, kể cả nháp/công thức cũ. Giữ bảo vệ phiên chia sẻ, kiểm tra dữ liệu và giới hạn yêu cầu. Không đổi máy màu, preset, chỉnh dáng hay Photobooth.

## Bản chốt chữ và bố cục chuẩn bị Android (v39)

Ảnh là vùng chính. Dải màu phim nhỏ bên dưới giữ tên nhóm; chín công cụ nằm trên một hàng có thể vuốt ngang. Bảng công cụ mặc định gọn hơn, có tay kéo để đổi chiều cao, chạm mở/thu gọn và dùng phím mũi tên. Thay đổi này chỉ đổi bố cục, không đổi ảnh nguồn hay lịch sử. Áp dụng ẩn bảng và tay chỉnh để xem ảnh lớn. Màn hình thấp nằm ngang đưa công cụ sang cạnh ảnh.

Mục Chữ có 10 kiểu trong ba nhóm. Thêm Montserrat, Playfair Display, Cormorant Garamond và Patrick Hand, có thẻ xem mẫu; giữ Be Vietnam, Noto Serif, Máy chữ, Dancing Script, Mali và Lora. Đậm/Nghiêng độc lập với góc xoay. Thêm tám màu nhanh và nhập mã màu tùy chọn, xem mẫu trên nền tương phản. Các dòng giữ phông/màu/kiểu riêng qua Áp dụng, hoàn tác và nháp. Bảy tệp WOFF2 mới tăng 686.340 byte, giữ đủ ký tự tiếng Việt/Latin và giấy phép OFL; Patrick Hand và Dancing Script dùng nghiêng tổng hợp khi chọn italic. Không sửa máy màu.

168/168 kiểm tra tự động đạt, gồm phông mới và màu riêng từng dòng. Đã thử giao diện 360×800, 390×844 và 844×390, phông mới, nghiêng, màu tự nhập/màu nhanh, hoàn tác/làm lại, thay ảnh, nháp và Áp dụng về ảnh lớn. App xuất ảnh 682×1024 đúng nguồn thử; HTML đã tải JPEG 682×1024 có Playfair Display italic và màu kem. Máy màu inline giữ SHA-256 1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63.

Xem hướng dẫn Android tại ANDROID-QUICKSTART.md; scripts/package-android.py xuất dự án đầy đủ với mã gói com.linhlinh.rayphoto được giữ từ starter trước. Có MediaStore để lưu JPEG/PNG/video; không dùng bản HTML đơn để thay app tích hợp. Môi trường thiếu Android SDK/JDK 21 nên chưa có APK/AAB đã biên dịch hoặc ký. Phải kiểm tra bản native trên điện thoại thật trước khi nộp.

## Giữ chi tiết vùng tóc khi xoay/cắt (v38)

Sửa lưới mặt nạ AI không vuông: xoay 90° đổi đúng chiều rộng/cao, cắt ảnh chỉ giữ các mẫu nằm trong khung. Trước đây vẫn giữ kích thước lưới cũ, nên xoay rồi xoay ngược có thể mất mẫu ở mép tóc/da. Áp dụng đồng thời cho tóc, da, vùng tách nền, người và quyền sở hữu từng người. Không đổi mô hình AI, thuật toán pha màu tóc, máy màu hay giới hạn xuất của v37.

166/166 kiểm tra tự động đạt. Ba kiểm tra mới xác nhận giữ từng mẫu qua xoay ngược, cắt đúng mẫu và màu tóc riêng hai người có pixel mép giống hệt khi đổi thứ tự nhuộm/xoay. Trình duyệt đã thử áp dụng Hồng mơ → xoay → hoàn tác → mở lại nháp → làm lại → xoay ngược → lưu; ảnh kết quả có kích thước tự nhiên 4032×3024. Đây là dữ liệu mặt nạ kiểm thử; độ chính xác nhận diện AI thực tế vẫn cần kiểm chứng trên điện thoại có WebGL.

## Kiểm tra độ nét và màu tóc (v37)

**Lỗi xuất ảnh đã sửa:** nút lưu ở app trước đây luôn chọn cạnh dài 2048 và trần 4 MP, kể cả khi chọn Gốc; PNG ở app có đường giới hạn tương tự. App và HTML nay dùng chung đường xuất từ nguồn gốc, theo Gốc/2048/1600/1080, không dùng canvas xem trước. Gốc giữ nguyên ảnh đến 16 MP; ảnh lớn hơn hiển thị rõ kích thước dự kiến do giới hạn bộ nhớ. Có ba lần thử có giới hạn nếu dựng/mã hóa lỗi, báo kích thước thực khi phải giảm. Không phóng ảnh nhỏ lên. JPEG mức .96; PNG giữ alpha. Bản HTML iOS vẫn mở ảnh data URL khi lưu vào Ảnh, đọc cùng Blob đã xuất và không nén JPEG thêm lần nữa. Có làm mượt chất lượng cao khi cần thu nhỏ và không giải phóng/ghi đè ảnh nguồn. Kết quả hiện số pixel thực. Phần ảnh không qua JPEG sau mỗi Áp dụng.

**Nhuộm tóc:** adapter riêng đổi sắc trong ánh sáng tuyến tính, giữ độ sáng tương phản từng sợi; không nâng tóc đen bằng một mức sáng nền cố định. Giữ vùng sáng, alpha, phần ngoài mask, bảo vệ vùng da và quyền sở hữu tóc theo người. Mức 0 khôi phục ảnh gốc. Máy màu, preset và module chỉnh dáng giữ độc lập. Không đổi mô hình phân vùng. Thông báo khi không có mặt đã sửa để nói rõ chỉ đổi vùng da/tóc AI đã tìm được. Nhận diện mặt dùng ngưỡng .5 và thêm tối đa một lần nhìn kỹ vùng tóc; các mốc được quy về đúng ảnh gốc, không tải thêm mô hình.

**Kết quả kiểm tra:** 163/163 bài tự động đạt (chạy với hai tiến trình kiểm thử); app hiển thị file 4032×3024 thật sau Lưu ảnh. HTML tải xuống JPEG 4032×3024 (1.064.886 byte), mức 1080 cho JPEG 1080×810, và PNG RGBA 240×400 có alpha 0–255. Trên ảnh biểu đồ tổng hợp, sai số sáng trung bình vùng vạch mảnh khoảng 0,37/255; tỉ số tương phản cạnh so với nguồn 1,0007, không coi đó là thước đo chất lượng của mọi ảnh. Tất cả ảnh kiểm thử nằm ngoài gói phát hành. Máy màu inline vẫn cùng SHA-256 với nguồn gốc.

**Giới hạn:** trình duyệt cloud thiếu WebGL, nên chưa xác nhận được nhận diện/tách tóc thực tế trên ảnh người gửi; thuật toán pha màu được kiểm tra với mask kiểm thử về vùng tác động, chi tiết và nhiều người. Khuôn mặt nhỏ/bị che và tóc lẫn nền vẫn có thể nhận diện sai. Không dùng kết quả mock để khẳng định chất lượng AI. Cần thử lại AI trên iPhone/Android thật. Native chỉ đồng bộ mã, chưa ký/biên dịch/chạy trên máy thật. Hạt phim, mềm chi tiết, quầng sáng và mờ là hiệu ứng có chủ ý; không tự tắt thiết lập người dùng.

## Chữ thơ và chữ nghiêng (v36)

Trong **Chữ → Kiểu chữ** có thêm Mây viết tay (Dancing Script), Thư tay (Mali) và Thi ca (Lora). Phông được đóng gói tại máy cùng giấy phép OFL; cả ba có đầy đủ chữ cái/dấu tiếng Việt. Có Đậm/Nghiêng ngay dưới lựa chọn phông và một dòng xem mẫu. Chữ nghiêng độc lập với góc xoay, giữ riêng theo khối chữ; các bản nháp cũ mặc định chữ đứng. Lora/Mali/Noto Serif/Be Vietnam dùng mặt italic; Dancing Script dùng độ nghiêng tổng hợp của trình duyệt. Chờ tải phông trước khi xuất để giữ đúng kiểu; đã sửa tên họ phông caption khớp với CSS đóng gói. Bộ phông mới nén WOFF2 tăng khoảng 497 KB; bản HTML nhúng đủ phông và giấy phép. Không sửa máy màu.

30 kiểm tra liên quan đạt: kiểu phông cho nét chữ khác nhau, chữ nghiêng đổi pixel độc lập với xoay, giữ kiểu qua hoàn tác/bản nháp, cùng kiểm tra ghép và hình học ảnh. Bản web được thử ở 390 px: ba lựa chọn phông, bật/tắt nghiêng, hoàn tác/làm lại và mở lại nháp. HTML xuất JPEG 1536×1024 giữ phông Lora italic và dấu tiếng Việt. Native chỉ đồng bộ mã, chưa chạy trên thiết bị thật.

## Xóa người, vá nền và đổi cỡ người ghép (v35)

**Xóa người → Tô vùng xóa → Xóa & vá nền** tìm mảng nền sạch để lấp vùng đã chọn ngay trên thiết bị. Có cỡ bút, nới vùng, bớt vùng chọn, bỏ nét, chọn nền mẫu, vá lại, bỏ bản vá cuối và dừng tác vụ. Bản vá nằm trước màu phim, nền mới và người ghép; Quay lại/Làm lại, Hủy bước, bản nháp và xoay/cắt/lật giữ đúng vị trí. Có nút Ghép người mới để chuyển tiếp. Giữ tối đa 16 bản vá; xử lý trong worker ở cạnh dài 720 px (512 px khi bật xem trước nhẹ), giới hạn vùng chọn và giải phóng bộ nhớ đệm. Không thêm mô hình hay gửi ảnh lên máy chủ.

Đây là **vá nền thử nghiệm bằng sao chép mảng ảnh**, không phải AI sinh nền và không khôi phục chính xác phần cảnh bị che. Nền trơn dễ hơn; vùng lớn, hoa/cỏ chi tiết, chữ và đường kiến trúc có thể lặp hoặc lệch. Chọn nền mẫu, chia nhỏ vùng xóa hoặc hoàn tác khi kết quả chưa phù hợp.

**Ghép người** có tay kéo ↗ ở góc lớp đang chọn để phóng to/thu nhỏ trực tiếp, giữ tỉ lệ và tâm kể cả khi người đang xoay. Thanh kích thước đưa lên gần đầu công cụ, có nút Thu nhỏ/Phóng to, phạm vi 5–300%, mỗi người giữ riêng. Kéo giữa lớp để di chuyển; phím +/− trên tay kéo cũng đổi cỡ. Áp dụng ẩn các tay chỉnh để xem ảnh sạch.

81 kiểm tra liên quan đạt, gồm vùng vá, biên, nền mẫu, hủy tác vụ, tính bất biến, lịch sử/bản nháp, hình học sau xoay/cắt và đổi cỡ người khi xoay. Máy màu gốc giữ nguyên checksum. Đã thử trên trình duyệt 390 px: kéo góc thu 55% xuống 37%, hoàn tác/làm lại, xoay 30° và kéo phóng lên 52%, xóa người gốc và ghép giữ riêng lớp mới. Đã tải lại nháp ở web và HTML, giữ 57%/30° cùng bản vá; JPEG xuất 1536×1024 có đủ lớp người và nền đã vá. Đã sửa khóa bộ nhớ đệm để lớp ảnh vừa giải mã hiện ngay khi khôi phục nháp. Native được đồng bộ mã; chưa ký/biên dịch/chạy trên điện thoại thật.

## Ghép người và xoay/cắt/lật (v34)

**Ghép người** là công cụ riêng. Thêm tối đa 4 lớp từ ảnh khác: PNG trong suốt ghép ngay; ảnh thường có Tách người bằng AI hoặc bút Xóa nền người/Khôi phục. Kéo từng lớp trực tiếp, đổi kích thước/góc/độ hiện, lật, đưa về giữa, đổi thứ tự, ẩn hoặc xóa. Bút có cỡ, mềm viền và bỏ nét cuối, chỉ tác động mặt nạ người đang chọn. Màu phim đi qua cả ảnh nền và người ghép; chữ/khung/dấu ngày vẫn ghép một lần. Nền trong suốt hợp alpha của ảnh và các lớp người. Ảnh người giải mã tối đa 1536 px, mask tối đa 768 px; giới hạn cache và giải phóng lớp xóa. AI dùng lại mô hình hiện có, không gửi ảnh lên máy chủ; các tác vụ AI chạy lần lượt.

**Điều chỉnh → Cơ bản → Xoay, cắt & lật** có xoay trái/phải 90°, lật ngang/dọc, khung cắt kéo và đổi cỡ, tỉ lệ tự do/Gốc/1:1/4:5/3:4/9:16/16:9, Hủy cắt và Về khung ảnh gốc. Giữ file gốc cùng ma trận hình học trong bản nháp, dựng từ nguồn gốc; không lưu/nạp lại JPEG sau từng lần xoay. Lịch sử khôi phục khung, lớp người và các thiết lập. Điểm/đường sáng, vùng, mask, mốc trang điểm và chữ chuyển theo hệ tọa độ ảnh mới. Khung và dấu ngày tính lại trên khung ảnh hiện tại. Cắt là lưới pixel nên tỉ lệ có thể lệch dưới một pixel.

71 kiểm tra liên quan đạt, gồm 8 kiểm tra mới về xoay 4 lần/lật 2 lần trùng byte nguồn, cắt sau xoay đúng pixel, tỉ lệ, tọa độ lớp và mask, lịch sử và Blob, lớp người giữ alpha/aspect, hợp alpha PNG. Trình duyệt 390 px: xoay 1536×1024 thành 1024×1536, Undo/Redo, lật/cắt thành 737×922, kéo/đổi cỡ người PNG xuống 35%, góc −12°, ẩn rồi Undo, xóa bằng bút riêng rồi bỏ nét, Áp dụng ảnh sạch, lưu/tải lại/khôi phục đúng hình học và người. Bản HTML mở cùng nháp và xuất JPEG 737×922; 28.686 pixel xanh của lớp người chuyển sang đơn sắc khi chọn Đen trắng, xác nhận lớp người cũng qua máy màu. Đã kiểm tra Về khung ảnh gốc phục hồi kích thước gốc. Mẫu PNG kiểm thử tổng hợp không đóng gói trong app. Script máy màu gốc giữ nguyên checksum.

Giới hạn: AI trên ảnh người nhập đã thử và vẫn báo thiếu GPU service/WebGL trong trình duyệt cloud, nên chưa xác nhận chất lượng tách người/tóc trên điện thoại thật. PNG có sẵn alpha, bút thủ công, ghép lớp, xoay/cắt/lật và xuất file đã kiểm tra. Native đồng bộ mã, chưa ký/biên dịch/chạy trên thiết bị thật.

## Thay nền và chữ trên ảnh (v33)

**Thay nền** nằm riêng ở hàng công cụ chính. Xóa nền ảnh người dùng lại mô hình phân vùng có sẵn, lấy toàn bộ tóc/da/quần áo/phụ kiện, không tải thêm mô hình. Có nút Dừng AI; thay ảnh dừng công việc cũ. AI chạy trên thiết bị, không gửi ảnh lên máy chủ. Bút Xóa / Khôi phục sửa mép hoặc xóa thủ công khi AI không khả dụng, với cỡ bút, mềm viền và bỏ nét cuối. Có Trong suốt (PNG), bảng màu/tùy chọn màu và ảnh nền tải lên; phóng nền và kéo trực tiếp để căn phần cần giữ. Tắt thay nền và Khôi phục nền gốc luôn có sẵn. Nền mới đi qua chuỗi màu phim hiện có.

**Chữ** thêm tối đa 12 khối chữ tiếng Việt nhiều dòng; ba nhóm phông, cỡ, góc, màu, đậm, bóng, viền và độ hiện. Kéo chữ trực tiếp trên ảnh hoặc dùng phím mũi tên. Chữ là nội dung canvas thuần, không thực thi HTML. Áp dụng đưa về ảnh lớn sạch; mở Chỉnh tiếp vẫn sửa được nội dung và vị trí. Quay lại / Làm lại, Hủy bước và bản nháp giữ dữ liệu chữ, mặt nạ và ảnh nền. Đổi ảnh nguồn bắt đầu dữ liệu ghép mới. Mask tối đa 768 px, ảnh nền giải mã tối đa 2048 px; giữ blob nguồn để mở nháp; giới hạn cache để giảm bộ nhớ.

Kiểm tra v33: 63 bài kiểm tra liên quan đến mày, vùng sáng/tối, bút, lớp, kéo, lịch sử, ghép ảnh và runtime mô hình đạt. Trình duyệt 390 px: kéo chữ lên 145 px/ngang 12 px, thay font và góc, thêm/xóa chữ, Áp dụng xem ảnh sạch, lưu nháp/tải lại/mở lại giữ đúng chữ và vị trí. Đã xóa một dải bằng bút, khôi phục/bỏ nét, ghép nền màu, tải ảnh nền, phóng 1.5× và kéo, tải lại khôi phục đúng nền. Bản HTML mở cùng bản nháp và xuất được PNG RGBA 800×1200 (alpha 0–255, 293.490 pixel trong suốt) và JPEG 800×1200 (nền mới đúng màu, phần ảnh giữ nguyên). Xuất JPEG có chữ tiếng Việt 1536×1024. Inline máy màu vẫn trùng checksum bản gốc.

Giới hạn kiểm chứng: nút AI đã thử nhưng trình duyệt cloud báo thiếu GPU service/WebGL, nên chưa xác nhận chất lượng tách tóc/người trên thiết bị thực. Bút thủ công và ghép/xuất đã xác nhận. Cần kiểm thử AI trên iPhone/Android thật trước phát hành Store; native chỉ đồng bộ mã nguồn, chưa ký/biên dịch AAB/IPA.

## Phim mở đầu (v20)

V25: nén lại bằng H.264 Constrained Baseline, 24 fps, yuv420p, fast-start, keyframe tối đa 5 giây. Vẫn 20 giây và kích thước 512×908 / 910×512. Dọc: 3.155.885 → 429.098 byte; ngang: 2.671.911 → 353.374 byte; tổng giảm 86,57%. SSIM toàn video sau đồng bộ 24 fps/timebase: 0,991403 và 0,992374. Đã kiểm tra hai khung hình cạnh nhau, chữ rõ và màu gần bản gốc. Bản nén có mất dữ liệu; không tuyên bố hai video giống hệt từng pixel. Báo cáo tại source/intro-compression.json. Video/poster, phát tự động, bỏ qua, phát lại và range cache giữ nguyên.

Hai video quảng bá do chủ app cung cấp được dùng theo hướng màn hình: bản 512×908 khi màn hình dọc, bản 910×512 khi màn hình ngang. Mỗi video dài 20 giây, không có tiếng; bản V20 chỉ chuyển metadata MP4, bản V25 đã nén lại như thông số trên. Video vừa khung, không cắt chữ.

Phim tự phát ở đầu phiên, hết phim tự vào app. **Bỏ qua** hoặc chạm vào phim để vào ngay; có **Tạm dừng / Tiếp tục**. Tải lại trang trong cùng phiên không phát lại. **Về RAY PHOTO → Xem phim mở đầu** xem lại bất cứ lúc nào. Khi người dùng bật giảm chuyển động hoặc trình duyệt chặn tự phát, hiện ảnh tĩnh và nút xem; lỗi tải hoặc đứng hình quá 8 giây sẽ vào app. Đổi hướng màn hình giữ thời điểm đang xem. Các thao tác này không sửa ảnh, bản nháp hay lịch sử.

Video và ảnh chờ đi kèm bản web/native. Service worker lưu hai video và trả đúng byte range cho trình phát MP4 khi dùng cache. HTML độc lập v20 nhúng cả hai video, khoảng 11 MB. Đã kiểm tra tự phát, tạm dừng/tiếp tục, bỏ qua, hết phim, tải lại cùng phiên, xem lại, bản dọc 390 px và HTML độc lập trong trình duyệt; 6 bài kiểm tra về bộ điều khiển và MP4 range đạt. Các khung hình giải mã giống video nguồn và máy màu gốc không đổi. Chưa kiểm tra phim trên iPhone/Android thật.

## Chỉnh từng bước và bản nháp (v17)

V32: thêm cặp nút **Tắt / Bật vệt nắng** và **Ẩn / Hiện khung chỉnh** ngay dưới hàng Tròn / Dải nắng / Oval, trước thanh Kích cỡ vệt nắng. Đồng bộ với nút ở đầu mục; tắt vệt cũng ẩn các tay chỉnh, giữ hình dạng/góc/vị trí, không đổi các lớp đã Áp dụng. Quay lại khôi phục cả cường độ và trạng thái tay chỉnh trước khi tắt. Giữ nguyên máy màu.

V31: bấm **Nắng** hoặc chọn Nắng tỏa / Vệt nắng để bật ngay mức 35% khi hiệu ứng đang bằng 0; có nút bật/tắt riêng. Tay chỉnh ẩn mặc định. Chạm hoặc kéo bất cứ đâu trong ảnh để đặt nguồn nắng/vệt; **Hiện tay chỉnh · kéo / xoay** mở đường bao mảnh, tâm chỉ 10 px và các nút thao tác có vùng chạm 34 px. Ẩn tay chỉnh giữ nguyên ánh sáng. Nắng tỏa có Tròn / Oval, dài-rộng và góc oval riêng; góc nguồn nắng và bốn góc cố định vẫn hoạt động. Vệt có Tròn / Oval / Dải, đặt vị trí, đổi cỡ và xoay trực tiếp; màu Vàng/Cam/Đỏ, sắc độ và phép lên màu cũ được giữ.

Oval của Sáng/tối vùng, Vùng nét và giới hạn Trong/Ngoài vòng đều xoay được, có nút ↻ và thanh góc. Vùng nét dùng Góc vòng chọn; Sáng/tối vùng có Góc vùng sáng cho cả oval. Xoay có tác dụng lên vùng xử lý thật trong ảnh xuất. Nút xoay tránh hàng Ngày/So sánh ở đầu ảnh. Sau Áp dụng vẫn về ảnh lớn sạch; nháp/lịch sử giữ hình học từng lớp.

**Sáng/tối vùng** có hai nút ngay đầu bảng: Tắt hiệu ứng / Bật lại hiệu ứng và Ẩn khung chỉnh / Hiện khung chỉnh. Tắt bỏ xử lý cục bộ và ẩn hình hướng dẫn, giữ vị trí/góc/cường độ để bật lại; không tắt bộ lọc, nắng hay bút đang dùng. Chọn hình mới, gợi ý tia/bóng hoặc đổi thanh cường độ sẽ bật lại vùng. Quay lại/làm lại giữ trạng thái bật/tắt; vùng đang tắt không tạo lớp hiệu ứng rỗng.

Kiểm tra V31: 50 kiểm tra bút/tông/lớp/lịch sử/pointer/touch và hình học nắng đạt. Gồm nắng oval/vệt oval 0°–90°, mặt nạ trong/ngoài xoay, mờ nền và chuyển động chừa oval nghiêng, và bản nắng gốc không đổi pixel khi hình học mặc định. Trong trình duyệt 390×844 đã bật nắng ngay ở 35% không có vòng che ảnh, kéo nguồn sáng, xoay nắng oval 94°, xoay vùng áp dụng −86°, thêm dải nắng 93°, ẩn tay chỉnh rồi Áp dụng hai lớp. HTML độc lập mở lại nháp hai lớp và xuất JPEG. Máy màu gốc vẫn giữ nguyên checksum; chưa thử trên điện thoại thật.

V30: **Điều chỉnh → Bút ánh sáng** cho phép tô sáng hoặc tối tự do bằng chuột/ngón tay. Thanh Sáng / tối bút từ −2 đến +2 EV, cỡ bút 1,5–50% cạnh ngắn và mềm viền 0–100%. Có Tô vùng / Tẩy vùng, Làm sáng / Làm tối, Xem vùng tô, Bỏ nét cuối và Xóa vùng tô. Nét kéo nhanh nối liên tục theo khoảng cách tới đoạn thẳng; các nét trong cùng một vùng không cộng sáng lặp theo số sự kiện. Áp dụng giữ một lớp sáng/tối riêng, trả về ảnh lớn sạch rồi có thể chỉnh tiếp vùng khác. Hoàn tác/làm lại, nháp và bản xuất giữ nguyên đường vẽ; thay ảnh xóa vùng bút cũ. Không dùng mô hình AI hay tải ảnh lên máy chủ cho bút.

Nét bút lưu thành tọa độ tỷ lệ và bản ghi bất biến; mask có cạnh dài tối đa 768 px, chỉ giữ một mask trong bộ nhớ đệm. Lớp bút áp lên ảnh trong adapter tông, không sửa máy màu phim gốc, kích thước xuất, khung hay dấu ngày. Khi không tô hoặc cường độ bằng 0, bỏ qua hoàn toàn. Không đem mặt nạ hướng dẫn vào ảnh lưu.

Kiểm tra V30: 41 kiểm tra bút/tông/lớp/lịch sử/pointer/touch đạt. Đã tô hai nét, đổi sáng thành tối, tẩy một đoạn, xem vùng tô, Bỏ nét cuối/Undo/Redo, Áp dụng hai lớp độc lập và khôi phục sau tải lại trong trình duyệt 390×800. Ảnh dọc tăng từ 221×332 px khi chỉnh lên 380×570 px khi Áp dụng; bút và bảng chỉnh ẩn. Bản HTML độc lập mở nháp và xuất JPEG 800×1200: ngoài vùng RGB (80,95,100), vùng tối (57,68,72), đoạn đã tẩy (80,95,100), vùng sáng (111,131,138). Thay ảnh đưa nét về rỗng. Chưa thử trên điện thoại thật.

V29: sau **Áp dụng**, trình chỉnh chuyển sang xem kết quả: ẩn vòng/tia/tay kéo của vùng sáng, Nắng, Makeup và Chỉnh dáng, thu bảng điều khiển, giữ hàng công cụ chính và nút **Chỉnh tiếp**. Chọn lại công cụ bất kỳ hoặc Chỉnh tiếp mở bảng tại đúng mục đang dùng. Các nhãn lớp chuyển vào bên trong vùng cuộn có chiều cao cố định nên thêm lớp không lấy chiều cao của ảnh. Không sửa kích thước ảnh xuất hay máy màu. Trạng thái xem kết quả lưu cùng bản nháp; nháp cũ vẫn mở được.

Kiểm tra V29: 32 kiểm tra xử lý vùng/lớp, lịch sử, mày và pointer/touch đạt. Bản web lồng trong khung 390×744: ảnh dọc tăng từ khoảng 180×271 px khi chỉnh lên 345×518 px sau Áp dụng; thêm lớp thứ hai giữ đúng 345×518 px. Mở Chỉnh tiếp trở về cùng 180×271 px trước đó dù số lớp tăng; các khung/tay xoay và bảng chỉnh ẩn ở chế độ xem. Đã thử tải lại/khôi phục hai lớp vẫn hiện ảnh lớn, chuyển Makeup mở lại bảng và Undo/Redo giữ lớp. Chưa thử trên iPhone thật.

V28: **Sáng/tối vùng** thêm ba hình dạng Vòng tròn / Chữ nhật / Tia sáng. Chữ nhật xoay tạo mảng sáng hoặc bóng cửa; Tia sáng thu hẹp một đầu, loe ở đuôi, có chuyển mềm theo rìa và hai đầu. Kéo thân để đặt vị trí, kéo nút ↻ để xoay, kéo chấm góc để đổi kích cỡ theo các trục đã xoay; tay kéo đổi sang góc/cạnh còn thấy được khi vùng tràn ra ngoài ảnh. Có Góc vùng sáng ±180°, ±15°, Đảo tia, dài/rộng riêng, Mềm viền và Sắc ấm vùng. Gợi ý Tia nắng xiên / Bóng cửa tạo trạng thái có thể chỉnh tiếp. Mỗi lớp đã giữ có hình học, góc, sắc ấm và cường độ riêng; lớp mới không đổi lớp trước. Vòng dùng ở Vùng nét/Nắng vẫn giữ hình tròn/oval cũ. Ảnh tham khảo không trở thành tài nguyên trong app.

Kiểm tra V28: 42 kiểm tra tự động đạt, bao gồm vùng chữ nhật xoay, tia có đầu hẹp/đuôi rộng, vùng ngoài được bảo vệ, sắc ấm chỉ trong mask, hình học nhất quán giữa preview/xuất, kéo đổi cỡ theo trục xoay và replay độc lập nhiều lớp. Trình duyệt khổ 390×844: xoay trực tiếp −25° → 70°, kéo cạnh tăng rộng 32% → 49% mà chiều dài giữ 150%, kéo vị trí, chồng hai lớp, Undo/Redo và khôi phục bản nháp. Chuyển sang Nắng trả vòng chọn về oval cũ. Bản HTML xuất JPEG 1200×800 có hình chữ nhật nghiêng 35°: tâm và điểm dọc trục sáng RGB (111,131,138), điểm ngoài vùng giữ nguyên (80,95,100). Chưa thử trên điện thoại thật.

V27: mục Điều chỉnh mở mặc định ở **Cơ bản**, gồm Phơi sáng (−2 đến +2 EV), Độ sáng, Tương phản, Vùng sáng, Vùng tối, Điểm trắng, Điểm đen và Đặt lại cơ bản. Tương phản dùng chính thanh và phép tính cũ; bộ lọc và script xử lý màu gốc giữ nguyên. Các điều chỉnh mới mặc định bằng 0 và bỏ qua hoàn toàn khi không dùng. Chỉnh tông chạy sau làm đẹp/chỉnh dáng, trước màu phim/ánh sáng/khung/dấu ngày; không gây dựng lại mask làm mịn da theo mỗi lần đổi phơi sáng và không tạo thêm canvas toàn ảnh.

**Sáng/tối vùng** dùng vòng F có sẵn, kéo vị trí và chấm góc để đổi cỡ, hoặc dùng Cỡ vòng chọn. Có Trong vòng / Ngoài vòng, Phơi sáng vùng âm/dương, Độ sáng vùng âm/dương, Mềm viền, ẩn/hiện vòng, đưa về giữa và xóa hiệu chỉnh vùng. Vòng không phủ tối nền trong khi chỉnh để thấy đúng kết quả. Các vùng đã Áp dụng lưu hình học/cường độ riêng: có thể làm sáng một chỗ, giữ lại rồi làm tối chỗ khác. Quay lại/Làm lại, bản nháp và JPEG giữ cả chuỗi vùng. Bản nháp cũ thiếu các trường mới mặc định về 0; lớp cũ không nhận nhầm phơi sáng đang chỉnh. Mục điều chỉnh đang mở cũng được lưu trong nháp.

Kiểm tra V27: 37 kiểm tra tự động đạt, gồm stop phơi sáng trên ánh sáng tuyến tính, dải vùng sáng/vùng tối, bảo vệ ngoài vùng/alpha, feather liên tục, tỷ lệ xem trước/xuất, hai vùng sáng/tối chồng với màu phim và khôi phục nháp. Trình duyệt 390×844: chỉnh Cơ bản, kéo vòng trái/phải, giữ một vùng sáng và một vùng tối, Undo/Redo, tải lại/khôi phục giữ ba lớp và mở lại đúng mục Sáng/tối vùng. Chuyển Makeup ẩn cả hai khối điều chỉnh mới. Bản HTML xuất JPEG 1200×800 từ xem trước 720 px: tâm vùng +1 EV tăng sáng, pixel ngoài vòng giữ đúng RGB (80,95,100); khung và dấu ngày không nhận hiệu chỉnh sáng/tối. Có kiểm tra lớp cũ thiếu trường tông mới không bị áp phơi sáng hiện tại hai lần. Chưa thử trên điện thoại thật.

V26: giảm tải làm mày. Quét trong mục Mày chỉ nạp mô hình khuôn mặt, không nạp thêm mô hình da/tóc/cơ thể. Khi quét đầy đủ, mỗi mô hình được đóng trước khi mở mô hình kế tiếp; worker và mô hình chính được giải phóng sau khi quét. Xem trước Nhẹ thu ảnh nhận diện xuống tối đa 768 px; nguồn xuất không đổi. Kéo/đổi dáng mày không hủy bộ mask mặt dùng chung, tránh dựng lại mặt và làm mịn mỗi lần kéo. Chuyển mục makeup chỉ cuộn bảng điều khiển, không kéo cả trang.

Bản nháp tự giữ sau khi dừng chỉnh, trước khi quét AI và khi trang bị ẩn; bỏ qua ghi trùng phiên bản. Sau tải lại trong cùng phiên, nút **Tiếp tục chỉnh ảnh** mở bản nháp đã lưu thành công; không tự ghi đè ảnh mới. Dáng mày, vị trí từng bên, độ đậm, mục makeup, lịch sử và các lớp màu được khôi phục. Phần thay đổi cuối cùng chưa kịp lưu có thể mất nếu hệ điều hành đóng tiến trình. Bản nháp vẫn nằm trên thiết bị.

Kiểm tra V26: 28 kiểm tra tự động đạt, gồm bốn ca vòng đời mô hình với mô hình giả lập (chỉ một mô hình sống tại một thời điểm, đóng cả khi inference lỗi, dữ liệu mặt/mask vẫn dùng được). Đã thử bản HTML trong khung 390×844: Nắng mật → Áp dụng → Cong nhẹ → độ đậm 35 → kéo mày → Undo/Redo → lưu nháp → tải lại → Tiếp tục chỉnh ảnh, giữ cả lớp màu và thông số mày. JPEG sau khôi phục vẫn 1536×1024 khi xem trước Nhẹ chỉ 720 px. Mã xử lý màu gốc không đổi. Chưa tái hiện được lỗi văng trên điện thoại thật; nhận diện AI thật không kiểm chứng được trong trình duyệt thử do không có WebGL.

V25: đổi 13 tên bộ lọc theo bộ tên RAY PHOTO: Nắng cũ, Hiên nhà, Gió sớm, Hồng mơ, Khoảng trời, Sương lam, Nắng mật, Ngày vàng, Phố lên đèn, Mảnh nhớ, Vườn sau mưa, Chiều nghiêng, Bóng lá. Đổi cả catalog trang chủ và tên trùng trong photobooth/makeup phụ; nhãn khung thành Ảnh lấy liền. ID, nhóm và công thức màu giữ nguyên. Các lớp trong bản nháp cũ hiện tên mới mà không sửa dữ liệu lịch sử.

**Nhẹ** nằm cạnh nút tìm bộ lọc. Tự bật nếu có tín hiệu RAM ≤4 GB, CPU ≤4 luồng hoặc Save Data; thiết bị không cung cấp tín hiệu vẫn chỉnh tay được. Chế độ nhẹ dựng xem trước tối đa 720 px, giảm số pixel cần xử lý và bỏ backdrop blur của thanh nổi. Tắt để xem trước theo mức cũ. Lựa chọn được nhớ trên thiết bị. Khi đổi ảnh, đổi chế độ hoặc đổi kích thước, canvas xem trước/thumbnail cũ được giải phóng; bitmap nguồn cũ đóng sau khi mở ảnh mới thành công. Ảnh gốc và các thiết lập/lớp không đổi; xuất ảnh vẫn dùng nguồn gốc và mức xuất đã chọn.

35 kiểm tra tự động đạt. Trên trình duyệt: hai video nén phát được đúng 20 giây, đúng chiều; xem trước nhẹ 720×480, tắt về 900×600 ở khung 390 px, bật lại và mở nháp vẫn giữ lớp Nắng mật. Xuất JPEG từ nguồn 1536×1024 vẫn được 1536×1024 khi xem trước chỉ 720 px. Script máy màu gốc không đổi. Chưa thử trên máy cũ thật; không cam kết mọi thiết bị cũ chạy cùng tốc độ.

V24: nút **Nắng** gom cả **Nắng tỏa** và **Vệt nắng · Tròn / Dải**. Hai kiểu đều chọn được bốn góc cố định. Vệt nắng giữ chế độ ngẫu nhiên một trong bốn góc và nút đổi góc, kéo tay, tròn/dải, cỡ, góc dải, màu và sắc độ gốc; thêm nút màu Vàng/Cam/Đỏ để chọn nhanh. Cả hai vẫn có giới hạn Trong vòng/Ngoài vòng. Không bỏ chức năng cũ hoặc đổi phép dựng màu/nắng gốc.

**Áp dụng** giữ hiệu ứng màu/ánh sáng/chất phim thành một lớp và đưa các thanh cường độ về 0 để chồng lớp tiếp theo. Ảnh vẫn giữ lớp cũ; dải nhỏ ghi các lớp đã áp dụng. Có thể giữ màu phim, thêm vệt tròn, thêm dải màu khác hoặc đổi thêm bộ lọc, rồi tiếp tục Makeup/Chỉnh dáng và chỉ xuất ảnh cuối cùng. Makeup và chỉnh dáng giữ thiết lập riêng, được tính một lần trước chuỗi màu theo thứ tự của máy ảnh gốc; không bị nhân lặp qua từng lớp. Khung/dấu ngày chỉ ghép một lần, dùng thiết lập hiện tại. Quay lại/Làm lại và bản nháp giữ cả chuỗi lớp. Áp dụng không tạo thêm một mốc Undo có hình ảnh giống hệt; không nạp lại JPEG hoặc thay ảnh gốc bằng bản xem trước.

Kiểm tra V24: 21 bài kiểm tra đạt, gồm pixel màu phim + nắng tròn + dải cam, makeup đầu vào một lần, viền một lần, Undo/Redo và tuần tự hóa bản nháp. Đã thử trên trình duyệt 390 px và bản HTML độc lập: Spotmatic → Áp dụng → Nắng tỏa → Áp dụng → dải cam → Áp dụng → Makeup chân mày 35; tải lại rồi mở nháp giữ ba lớp và mức trang điểm. Xuất JPEG 1536×1024 thành công ở bản HTML mở trực tiếp. Script máy ảnh gốc không đổi. Chưa thử trên iPhone/Android thật.

V23: **Nắng** là nút riêng ở hàng công cụ chính, giữa Điều chỉnh và Makeup. Thanh Cường độ nắng chuyển hẳn khỏi Chất phim; Độ rực nắng chuyển khỏi Vệt nắng sang cùng công cụ Nắng. Giữ vòng vàng kéo tâm/đổi độ lan, Cố định trên/Tự kéo vị trí, vùng Trong vòng/Ngoài vòng và phép dựng nắng gốc. **Góc nắng** có thanh −180° đến 180°, nút xoay ±15° và 0° từ trên. Góc đổi vị trí nguồn sáng quanh ảnh bằng chính tọa độ nắng cũ, nên xem trước, xuất ảnh, Undo/Redo và bản nháp dùng chung kết quả. Kéo tâm nắng cũng cập nhật số góc. Không thêm lớp ánh sáng mới hoặc xoay một vòng tròn vô hiệu.

Đã kiểm tra giao diện 390 px: nút Nắng ở hàng chính; thanh nắng không còn trong Điều chỉnh; góc 15°→90°→Undo 15°; kéo tâm −30 px/+35 px cập nhật góc; độ lan 75→80; Ngoài vòng hiện vòng giới hạn. 17 bài kiểm tra hình học nắng, kéo pointer/touch, mày, dấu ngày và lịch sử đạt. Script xử lý ảnh gốc không đổi. Chưa thử trên iPhone/Android thật.

V22: tăng cỡ chữ nhãn điều chỉnh, tên nhóm màu, tên màu, nút và điều hướng trên điện thoại. Nút **Mở ảnh / Thay ảnh** hiện rõ chữ và dùng input chọn tệp trực tiếp; thay ảnh được từ mọi công cụ, giữ bản nháp của ảnh trước trong nền, không chờ xuất JPEG. Bản nháp giữ ảnh gốc, thiết lập và lịch sử, mở lại tại Kho ảnh → Bản nháp.

**Điều chỉnh → Nắng** có vòng vàng: kéo tâm để đặt vị trí, kéo chấm trên vòng để đổi độ lan; nút Đặt nắng giữa ảnh đưa tâm vào giữa. Vòng nét đứt vẫn điều khiển Trong vòng / Ngoài vòng như trước. Vòng vàng chỉ là tay chỉnh trên màn hình, không in lên ảnh. Dùng lại phép dựng nắng gốc và lưu vị trí/cỡ trong lịch sử/bản nháp.

Khung tách khỏi preset: khi chưa tự chọn viền, mọi màu đều không viền; khi đã chọn viền, đổi màu giữ viền đó. Không sửa các giá trị màu hay máy màu gốc. Đã thử Spotmatic / Polaroid / Đen trắng không tự thêm viền, đổi màu giữ viền tự chọn, kéo tâm 40 px ngang / 50 px dọc, đổi cỡ 75→96, Undo/Redo và thay ảnh A→B rồi mở lại bản nháp A với nắng 40/cỡ 96/lịch sử. 14 bài kiểm tra mày/ngày/lịch sử/pointer/touch đạt. Kiểm tra giao diện và thao tác trong trình duyệt ở 390 px; chưa thử trên iPhone/Android thật.

V21: tên nhóm nằm ngay trên các ô màu nhỏ: Ống kính đời cũ / Máy & phim / Hồng Kông / Châu Á / Ánh sáng / Máy ảnh số / Khác; Gốc có ô riêng. Giữ tên và thành viên nhóm của bản gốc. Tên nhóm bám ở mép dải khi vuốt ngang; tìm được cả tên màu lẫn tên nhóm. Chọn kết quả tìm kiếm sẽ trở lại đầy đủ các nhóm. Có 85 bộ lọc phim và Gốc; không đổi tham số hoặc máy màu.

Chọn màu phim → **Áp dụng** để giữ bước đó → chuyển sang Makeup hoặc Chỉnh dáng. **Hủy bước** khôi phục thiết lập lúc bắt đầu công cụ; ↶ / ↷ quay lại và làm lại qua các công cụ. Giữ **So sánh** để xem ảnh ban đầu. Các bước được lưu dưới dạng thiết lập trên ảnh gốc, không xuất rồi nạp lại ảnh JPEG nên không chồng bộ lọc hoặc mất chất lượng sau mỗi bước.

**Lưu nháp** giữ ảnh gốc, các thiết lập từng người, vị trí chỉnh và tối đa 80 mốc lịch sử trong IndexedDB. **Kho ảnh → Bản nháp** mở lại để chỉnh tiếp, kể cả sau khi tải lại trang. App cũng tự lưu nháp khi thay đổi. Chỉ bấm **Lưu ảnh** khi muốn tạo ảnh hoàn chỉnh. Bản xuất liên kết với bản nháp, nút Chỉnh ảnh này sẽ mở lại ảnh gốc và thiết lập khi còn bản nháp.

**Makeup → Mày** có 7 dáng vẽ bằng canvas: Tự nhiên, Mày ngang, Cong nhẹ, Cánh cung, Sắc nét, Mày mảnh, Tơi sợi; thêm Giữ nguyên để bỏ dáng. Có độ đậm, màu, độ dày, độ dài, nâng/hạ và góc. AI gắn dáng theo mốc mày của từng người; khi không nhận diện được, dùng Đặt vị trí mày thủ công và kéo hai nhãn trên ảnh. Không có ảnh người dùng hoặc ảnh chụp màn hình tham khảo trong các mẫu mày.

V18: chọn dáng mày là hiện ngay hai tay kéo Mày trái / Mày phải; kéo riêng từng bên để đặt lại vị trí, kể cả sau khi AI đã nhận diện. Các độ lệch được lưu riêng theo người, cùng bản nháp và lịch sử. Tay kéo hỗ trợ cả phím mũi tên (Shift để di chuyển nhanh hơn).

V19: tay kéo mày hỗ trợ cả Pointer Events và Touch Events, tránh cuộn trang trong lúc kéo; có hai thanh Lên / xuống riêng cho từng bên. Mục Nắng và Vệt nắng đều có Tắt / Ngoài vòng / Trong vòng. Ba nơi này và Vùng nét dùng chung `P.rgAtmos` và vòng `F`; đổi ở đâu cũng đồng bộ, không tạo hai vùng mâu thuẫn. Vòng được kéo, đổi cỡ, và các tâm nắng/vệt nắng được đặt theo phần ảnh thật (tính đúng cả khi có viền Polaroid). Các thao tác giữ được lịch sử và bản nháp.

**Điều chỉnh** có hàng chọn đầy đủ Màu / Chất phim / Ảnh in / Lấp lánh / Vùng nét / Nắng / Vệt nắng / Khung / Kích thước / Dấu ngày; vuốt ngang để xem hết. Tất cả giữ cách cuộn cũ. Nắng và Vệt nắng có thanh cường độ ngay trong mục, dùng lại các xử lý gốc. **Dấu ngày → Cỡ dấu ngày** chỉnh 40–240%; nút **Ngày ✓ / Ngày ×** trên ảnh bật/tắt ngay ở mọi công cụ. Cỡ ngày giữ lề phải và lề dưới; ảnh gốc và máy màu không đổi.

Tạo thêm một file HTML độc lập để dùng trình chỉnh ảnh:

```sh
node scripts/build-standalone.mjs /absolute/path/RAY-PHOTO-v37.html
```

File có sẵn mã chỉnh ảnh, phông chữ, mẫu mày và lưu/mở nháp. AI tải mô hình khi dùng lần đầu và cần trình duyệt hỗ trợ WebGL; ảnh xử lý tại máy. Có thể thêm `--offline` để nhúng cả mô hình AI (file lớn hơn khoảng 50 MB). Bản HTML chỉ gồm trình chỉnh ảnh; website chính có thêm Photobooth và Kho ảnh.

Kiểm tra bổ sung v18: 10 bài kiểm tra về mày/lịch sử/ngày đạt; đã kéo mày bằng con trỏ trong trình duyệt, thử các nhóm hiệu chỉnh ở khổ 390 px, và xuất ba JPEG 1200×900 với ngày 50%, ngày 150%, không ngày. So với file không ngày, vùng dấu ngày đo được lần lượt khoảng 136×26 và 409×76 px. Quay lại khôi phục trạng thái ngày và mức 150% đúng. Không thêm ảnh tham khảo của người dùng vào app hoặc HTML.

Kiểm tra v19: 14 bài kiểm tra mày/lịch sử/ngày và xử lý pointer/touch đạt. Trong trình duyệt đã kéo mày lên 50 px, xuống 75 px, bên kia giữ nguyên; Hủy bước khôi phục đúng vị trí. Đã kéo vòng sáng, đổi cỡ, kiểm tra giao diện 390 px và HTML độc lập. Bốn JPEG kiểm thử Nắng/Vệt nắng trong/ngoài vòng cho thấy vùng cần bảo vệ gần như không đổi, trong khi vùng nhận hiệu ứng đổi rõ; dữ liệu kiểm tra lấy từ ảnh lưới tổng hợp. Touch Events được kiểm tra bằng mô phỏng sự kiện; chưa xác minh trên iPhone thật.

## Chạy và chỉnh mã

Cần Node.js 22 trở lên. Thư mục `dist` là web tĩnh, chạy bằng HTTP/HTTPS; không mở index bằng file://.

```sh
npm ci
npm run native:sync
```

`dist/index.html` là trang chính. `dist/darkroom/index.html` chứa nguyên script của index(2).html đã cung cấp; adapter tách tại `app-bridge.js`. Bản nguyên gốc tại `source/buong-toi-original.html`; checksum tại `source/engine-sha256.json`. Có 85 bộ lọc phim và 1 chế độ Gốc; trang chủ giới thiệu 6 preset. Các mô hình MediaPipe nằm trong `dist/vendor/mediapipe`, không gửi ảnh lên dịch vụ AI.

## Android

Cài Android Studio, SDK 36 và JDK theo yêu cầu Capacitor 8. Android tối thiểu 10 (API 29). Sau npm ci/native:sync:

```sh
npx cap open android
```

Chạy thử trên thiết bị; Build → Generate Signed App Bundle / APK → Android App Bundle. Tạo và tự giữ upload key của chủ app, không đưa khóa vào mã nguồn. Mã đăng ký plugin BuongToiMedia nằm trong MainActivity; plugin lưu ảnh/video bằng MediaStore vào Pictures/RAY PHOTO hoặc Movies/RAY PHOTO, không cần quyền đọc toàn bộ ảnh.

## iOS

Cần máy Mac và Xcode 26 trở lên, Apple Developer để phát hành. Sau npm ci/native:sync:

```sh
npx cap open ios
```

Chọn Team và bundle identifier thuộc tài khoản của bạn, chạy iPhone thật, Product → Archive → Distribute App → App Store Connect. SceneDelegate đăng ký plugin BuongToiMedia, xin quyền chỉ thêm ảnh vào Photos khi lưu. Không có tài khoản Apple/khóa ký trong gói này.

## Trước khi nộp kho

Đọc `STORE-RELEASE.md`. Đây là mã nguồn web và hai dự án native đã đồng bộ, CHƯA phải AAB/IPA đã ký hay app đã được duyệt. Môi trường xây dựng hiện tại không có Android SDK/Xcode nên chưa biên dịch và chạy plugin native trên máy thật. Phải kiểm thử lưu ảnh/video, quyền camera/Photos, các định dạng HEIC/MOV của máy thật, chế độ offline và các trang thông tin trước phát hành. Việc duyệt thuộc Google/Apple.

Đổi applicationId/bundle identifier `vn.buongtoi.studio` nếu tên này không thuộc bạn trước bản phát hành đầu tiên. Cập nhật tên và liên hệ nhà phát hành trên trang hỗ trợ, hồ sơ Store và chính sách quyền riêng tư; không dùng thông tin giả. Ảnh hero là hình minh họa AI; icon là thiết kế aperture riêng của dự án.

## Kiểm tra tự động

V62: sửa chất lượng xuất Photobooth động. Khung hình nguồn được lấy đủ độ phân giải cho từng ô, gồm crop/zoom/xoay, thay vì giải mã 480 px rồi phóng lớn. Màu/beauty khi xuất dùng đúng cỡ cần thiết; trả bộ đệm về mức xem trước sau khi hoàn tất hoặc hủy. Mặc định cạnh dài 1920 px; thêm 2560, giữ 1080/720; hiển thị kích thước tệp thật. Bộ ghi dùng bitrate theo số pixel và tốc độ mục tiêu, ưu tiên chi tiết, để trình duyệt chọn mức H.264 phù hợp, và trừ thời gian dựng khỏi nhịp chờ. Video mẫu đã gửi có 512 × 682 px; tăng cỡ tệp đó không tạo lại chi tiết đã mất, cần xuất lại từ nguồn gốc. 296 kiểm tra chung đạt trước điều chỉnh cuối về tính bitrate sau khung đầu. Tham khảo chuẩn [bitrate là gợi ý cho bộ mã hóa](https://www.w3.org/TR/mediastream-recording/) và [ưu tiên chi tiết](https://www.w3.org/TR/mst-content-hint/).

V63: kiểm tra tệp thật của V62 xác nhận 1440 × 1920 và 1920 × 2560 nhưng phát hiện nhịp video thấp do seek từng khung và phần giữ hình cuối có thể bị hụt khi dừng ghi ngay. Khi xuất Photobooth, video chạy bằng bộ giải mã gốc; chỉ seek để đồng bộ lại hoặc qua ranh giới cắt/lặp. Ảnh PNG và xem trước vẫn lấy đúng thời điểm riêng. Bộ ghi chờ khung canvas cuối được chuyển vào bộ mã hóa trước khi dừng; mọi video nguồn được tạm dừng và trả bộ đệm về mức xem trước sau xuất hoặc hủy. 298/298 kiểm tra đạt; build Sites hoàn tất. Chưa thử trên iPhone thật.

V61: chỉ mở rộng Sáng/tối vùng: đường cong có độ uốn hai phía, đường thẳng, độ dày nét, độ đậm hiệu ứng về 0, mềm viền hoặc nét rõ, không viền/chỉ viền cho vùng kín, màu ánh sáng tùy chọn bằng ô màu/mã hex và cường độ màu riêng. Các trường mới đi cùng lớp, hoàn tác, nháp và xuất; nét giữ kích thước và hướng khi xoay/lật/cắt. Đã so 54 cấu hình vùng cũ trước/sau, pixel trùng hoàn toàn; inline color engine giữ checksum. Các kiểm tra hình học, màu, alpha, lớp và khôi phục nháp đạt. Xem thử cục bộ hiện không mở được kết nối; kiểm tra bản live sau triển khai.

V60: hoàn thiện độ bền của chỉnh dáng. Mỗi lần quét chỉ mở một mô hình tại một thời điểm; sao chép kết quả và đóng đồ thị trước khi mở mô hình kế tiếp, kể cả khi inference lỗi. Giữ bộ đệm mô hình để quét lại không tải lại tệp. Nếu quét lại cùng ảnh bị lỗi, rỗng hoặc chỉ còn khuôn mặt, giữ nguyên người đang chọn và viền cơ thể hợp lệ trước đó, đồng thời ghi rõ cảnh báo. Không khôi phục nhận diện của ảnh cũ sau khi thay ảnh. Từng vùng ghi rõ bộ phận cần đặt tay và hướng dẫn đặt lại vòng theo người đang chọn. 284/284 kiểm tra tự động đạt, gồm đối chiếu pixel sau quét lỗi, quản lý vòng đời mô hình và các chức năng cũ; bản HTML độc lập dựng thành công, checksum inline engine không đổi. Chưa kiểm thử Safari/iPhone thật; phiên kiểm tra giao diện cục bộ lần này bị giới hạn truy cập của môi trường.

V59: Chỉnh dáng nhận tối đa 6 người; bộ chọn người nằm chung phía trên các công cụ và bám khi cuộn. Mỗi người giữ riêng vùng, thanh chỉnh và lịch sử; quét lại giữ định danh theo vị trí đầu/thân. Khi có mặt nạ riêng rõ ràng, ảnh nhóm dùng AI cơ thể cho người đang chọn và khôi phục pixel của người lân cận trong vùng bị ảnh hưởng. Nháp giữ cả định danh nhận diện và các bộ chỉnh; xoay/cắt ảnh chuyển đúng các bán kính dùng đơn vị chiều cao ảnh. Đã qua 278 kiểm tra chung, sau đó 41 kiểm tra liên quan cho các sửa cuối. Mô hình Lite đóng gói nhận đúng 2 người/2 mặt nạ trên CPU; từ chính dữ liệu đó đã thử giao diện: người 1 −12%, người 2 −5%, đổi người/hoàn tác/làm lại/đặt lại/lưu nháp/tải lại, xuất 2000 × 667. Trình duyệt QA không cấp WebGL nên chưa xác minh quét trực tiếp trong trình duyệt hoặc trên iPhone thật. [Ảnh kiểm chứng giao diện từ nháp nhận diện CPU](docs/qa/body-people-v59.jpg).

V58: sửa bản xem trước dùng chung cho mọi preset. Khi thu nhỏ, hạt được tính theo tỷ lệ ảnh xuất, ảnh được thu theo nhiều bước để giảm răng cưa; chế độ Nhẹ chỉ giảm tải lúc thao tác và trả lại cùng độ nét khi dừng. Khôi phục việc tinh chỉnh ảnh khi quay lại từ thanh trình duyệt. Giữ nguyên thông số preset và inline color engine. Đã đối chiếu 87 preset + Gốc, ảnh thử 12 MP, bật/tắt lớp, bản HTML độc lập và 271 kiểm tra. Hai tệp JPEG 3024 × 4032 xuất từ cùng nháp trước/sau sửa có cùng SHA-256 `8804dda3d18044eb6bdee3d9fb4df745a0d8d1e0457f85136826d2e908d9697c`. [Ảnh so sánh bản xem trước](docs/qa/quality-v58.jpg). Chưa thử trực tiếp trên iPhone thật.

V57: màn chỉnh ảnh trên điện thoại dùng thanh đầu gọn, nút ✓ cùng hàng công cụ và menu ⋯ cho lớp màu/ngày/nháp. Thanh điều hướng chính được thay bằng đường về Khám phá và menu Kho ảnh/Photobooth. Các nút gốc được chuyển vị trí để giữ sự kiện và trạng thái; trở về vị trí cũ khi màn hình rộng hơn 760 px. Trên cùng ảnh dọc trong vùng web 402 × 662, canvas khi chọn preset tăng từ 225 × 300 lên 326 × 435 CSS px; khi xem kết quả đạt 394 × 525. Đã thử menu ở 340 px, bố cục máy tính ở 1000 px, áp dụng/ẩn lớp/hoàn tác/lưu nháp và khôi phục; 264/264 kiểm tra đạt. [Ảnh kiểm chứng bằng ảnh thử nét](docs/qa/mobile-v57.jpg). Chưa kiểm thử trực tiếp Safari trên iPhone thật.

Các bài kiểm tra canvas dùng @napi-rs/canvas của môi trường phát triển. `node --test test/*.test.cjs` kiểm tra video/MP4, xoay từng ô, template, makeup, mày và lịch sử. V17: 63/63 bài kiểm tra đạt; đã thử trong trình duyệt áp dụng màu → mày thủ công → undo/redo/hủy → lưu nháp → tải lại → mở lại → xuất JPEG. AI nhận diện chưa kiểm tra được trong trình duyệt thử nghiệm vì môi trường không cấp WebGL; cần thử trên iPhone/Android thật. Inline engine vẫn giống bản gốc trong source.

## Kho ảnh và phông tiếng Việt

Kho ảnh của bạn lưu ảnh tải lên, video và bản chỉnh sửa trong IndexedDB trên thiết bị. Có lọc/tìm theo tên, chỉnh tiếp và dùng lại trong Photobooth. Tên ứng dụng là RAY PHOTO; khóa lưu trữ cũ được giữ để không làm mất ảnh đang có. Phông Noto Serif và Be Vietnam Pro được đóng gói trong dist/fonts, gồm cả giấy phép OFL, để tránh lỗi dấu do phông máy người dùng.


## Viền vàng độc lập và bút nét chỉnh dáng — v73

- Quét AI lần đầu và quét lại chỉ nhận diện, hiện viền vàng. Xem trước AI vẫn có khi người dùng chủ động chọn mức hoặc bấm nút xem trước. Sửa viền không gọi lại nắn toàn thân.
- Kéo sát viền vàng để uốn vùng nhận diện; thêm/bớt vùng vẫn giữ. Lần kéo mới lấy mẫu trực tiếp từ mặt nạ trước thao tác, tránh nhòe/co viền theo tần suất sự kiện chạm. Các nháp viền cũ vẫn đọc được.
- Tab **Bút nét** và nút ngay trên ảnh: vẽ tự do hoặc nét thẳng, nhiều nét hở/rời; vẽ đơn thuần không làm đổi ảnh. Chạm chọn rồi kéo uốn một đoạn, hoặc dùng mũi tên dịch cả nét. Có phạm vi tác động, mức 0–100%, đặt lại và xóa riêng từng nét. Dùng được khi chưa quét AI.
- Vector nét chỉnh dáng tách khỏi mặt nạ màu và sửa viền AI. Có hoàn tác/làm lại, nháp, khôi phục, xoay/lật/cắt, lưu ảnh gốc. Đường vàng/ngà là lớp giao diện, không xuất vào ảnh.
- Lưới dịch chuyển có giới hạn gradient để tránh gập ảnh. Ảnh được lấy mẫu một lần cho toàn bộ nét; không thu kích thước nguồn hoặc nén lại sau từng thao tác. Cache lớp màu theo cả trạng thái nét.
- Kiểm tra: nét hở không tự biến dạng; kéo thật qua các sự kiện chạm và mũi tên; Undo/Redo/nháp/xóa; Jacobian dương với nét giao nhau; tọa độ xem trước/xuất, xoay/lật/cắt; tương thích viền và các bộ lọc hiện có. Script engine màu gốc giữ nguyên SHA-256 `1f4941954da45f1745d7771be990f345defbe5d65995e2375f4405291fef4b63`.

## Ghép nét thành vùng tùy ý — v74

- **Bộ lọc / Điều chỉnh → Ghép nét** mở bảng vẽ dưới ảnh. Nối nét Tự do, Thẳng và Cong thành đường bao bất kỳ, hoặc thêm Oval, Chữ nhật, Tam giác và các nét có sẵn. Mỗi hình có thể chọn lại để uốn nét, di chuyển, đổi cỡ, xoay hoặc xóa riêng; hình trước được giữ khi thêm hình mới.
- **Lấy nét đã vẽ** tận dụng nét vùng đã tô hoặc sao chép nét đang hiển thị ở Chỉnh dáng. Nút **Dùng nét làm vùng Trong / Ngoài** trong Bút nét mở thẳng phần ghép hình. Việc sao chép không thay đổi nét hoặc hiệu chỉnh dáng gốc.
- **Khép hình** hoặc **Xong vẽ** tạo vùng kín; nét đang vẽ dở không áp hiệu ứng. **Trong / Ngoài** dùng chung vùng cho preset, màu phim, các thanh cơ bản và ánh sáng theo cơ chế phạm vi hiện có. Nhiều hình được hợp thành vùng; bút tẩy vẫn tạo được khoảng trống. Viền nét đứt chỉ là hướng dẫn trên giao diện.
- Các đường bao, kể cả nét chưa khép, giữ được trong lớp, hoàn tác, bản nháp, công thức và các phép xoay/lật/cắt. Giữ giới hạn vector cũ và checksum engine màu gốc; không thu nhỏ hay nén lại ảnh để ghép nét.
- Kiểm tra: 84 bài liên quan đạt (mặt nạ trong/ngoài, ghép và sửa nét, con trỏ giao diện, nét Chỉnh dáng, công thức/API, lớp, xoay/lật/cắt). Trong trình duyệt đã ghép hình đầu mèo bằng nét cong và thẳng, áp Đen trắng ở trong rồi ngoài hình, lưu nháp, tải lại và khôi phục đúng hình/preset. Bản HTML độc lập dựng thành công. Chưa thử trực tiếp trên iPhone thật.

## Xem và sửa thông số của từng lớp màu — v75

- Bấm tên lớp mở bảng giá trị đã giữ: Cơ bản, Nhóm màu, Chất phim, ánh sáng, ảnh in và các hiệu chỉnh vùng. Có giá trị cụ thể theo thang thanh chỉnh, preset gốc, khác biệt so với preset gốc, phạm vi trong/ngoài và nút hiện cả thông số 0. Tên nhóm “Tất cả” cũ hiển thị thành “Điều chỉnh”; dữ liệu cũ giữ nguyên.
- Nút ◉ riêng để ẩn/hiện, × để bỏ lớp. **Chỉnh thông số → Lưu thông số lớp** cập nhật đúng vị trí lớp đang chọn, giữ nguyên mặt nạ, thứ tự, trạng thái ẩn/hiện và các lớp khác. Hủy sửa không đổi ảnh; Hoàn tác/Làm lại dùng lịch sử hiện có.
- Lưu công thức và Màu của tôi cũng cho mở từng lớp để xem bảng giá trị. Công thức giữ đủ các thanh Cơ bản/Nhóm màu/Chất phim; mức 0 hoặc mặc định được khôi phục đúng khi áp lại. Nét bút ánh sáng và công cụ riêng của ảnh tiếp tục giữ trong nháp đầy đủ theo cơ chế hiện có.
- Kiểm tra 44 bài liên quan đạt, gồm thay giá trị một lớp, pixel trước/sau và Hoàn tác/Làm lại, vòng lưu/đọc đủ thanh cơ bản/chất phim, vùng lồng và dữ liệu công thức lớn. Trình duyệt đã sửa Phơi sáng +0.65 EV, Độ sáng −12, Nhiệt màu +34, Bão hòa +16, Hạt phim +24 trên lớp Ngõ nắng rồi lưu công thức, mở bảng công thức và xác nhận đúng các giá trị. Giữ nguyên script engine màu gốc.

## Bảng thông số tải riêng và hiện giá trị dưới tên lớp — v76

- Bảng thông số dùng một script đóng gói riêng, tải đồng bộ sau hệ thống lớp. Không phụ thuộc việc mô-đun Màu của tôi tải thành công hoặc khởi tạo xong. Nếu script không tải được, nút báo lỗi rõ ràng thay vì im lặng.
- Mỗi tên lớp có thêm dòng giá trị tóm tắt, ưu tiên các thanh khác preset gốc. Bấm tên vẫn mở đủ bảng và sửa đúng lớp. Dùng cùng cơ chế cho màu phim, Cơ bản, Chất phim, Sáng/tối vùng, Nắng, ảnh in và Bút ánh sáng.
- Kiểm tra 21 bài liên quan đạt. Bài kiểm tra chạy chính bundle giao diện trong môi trường không có Màu của tôi, mở/sửa lớp màu và mở các lớp Điều chỉnh, Sáng/tối vùng, Nắng, Bút ánh sáng. Trong trình duyệt cũng đã bỏ hẳn mô-đun công thức khỏi trang thử, khôi phục nháp, mở lớp màu, thêm/mở Cơ bản +0.4 EV và lớp Chữ nhật · Tối với −0.8 EV / Độ sáng vùng −6. Trang thử chỉ nằm trong thư mục preview bị bỏ qua, không đưa vào bản phát hành. Đã thử menu ⋯ ở bố cục hẹp; chưa thử iPhone thật.
- Cache web đổi phiên bản; tab đã mở từ trước cần lưu nháp rồi tải lại để chạy mã mới. Không xóa hay đổi khóa lưu màu/nháp. HTML độc lập dựng thành công và engine màu gốc giữ nguyên checksum.

## Xóa nét dài trên ảnh lớn — v90

- Sửa lỗi báo vùng xóa quá lớn khi nét tô chéo hoặc nhiều vùng rời có khung bao trên 4 triệu pixel. Bản vá lớn chỉ giữ các ô 512 × 512 có phần được chọn, giới hạn theo dung lượng ô thực tế thay vì cả khung bao. Đọc nền nguồn theo ô với cache giới hạn, giữ chi tiết gốc khi xuất ảnh.
- Các ô vẫn thuộc một bản vá: hoàn tác, sửa vùng, vá lại, nháp và xoay/lật/cắt dùng cùng trạng thái hiện có. Bản vá cũ tiếp tục mở được. Canh ranh giới ô theo pixel đầu ra để xem trên điện thoại không hở đường nối. Vùng xanh và giới hạn vùng chọn quá rộng tiếp tục có hiệu lực.
- 64 kiểm tra liên quan đạt, gồm nét chéo trên ảnh 3200 × 2400, chi tiết nhỏ và vùng giữ nguyên từng pixel, cache, nháp, hoàn tác, sửa bản vá, xoay/cắt, tỷ lệ lẻ và xem trước 390 px. Build Sites thành công. Công cụ duyệt thử của Sites không có trong phiên này; chưa kiểm tra trình duyệt hoặc iPhone thật. Cache web đổi phiên bản, giữ nguyên dữ liệu nháp.

## AI tái tạo nền sau khi xóa — v91

- Bản web mặc định dùng mô hình LaMa để dựng lại nền theo ngữ cảnh, thay cho việc chỉ vá từ mẫu lân cận. **Vá nền nhanh** vẫn là lựa chọn riêng. Nháp có bản vá cũ có thể chọn **AI tái tạo nền → Tái tạo lại** để thay đúng bản vá từ ảnh gốc và vùng chọn đã lưu.
- Mô hình INT8 và ONNX Runtime Web chạy trong worker trên thiết bị, không gửi ảnh lên máy chủ. Tải khoảng 75 MB khi dùng lần đầu, lưu cache khi trình duyệt cho phép; giao diện báo tiến trình, thời gian chờ và có Dừng xử lý. Lỗi không âm thầm đổi sang vá nhanh hoặc xóa vùng chọn. Vùng xanh, phần ảnh ngoài vùng xóa, nháp, sửa bản vá và hoàn tác dùng cơ chế hiện có.
- 88 kiểm tra liên quan và một kiểm tra mô hình thật bằng đúng WASM đóng gói đạt. Cảnh thanh sắt mô phỏng giảm sai số kênh trung bình từ 12.506 xuống 3.885; pixel ngoài vùng xóa không đổi. Build Sites thành công. Chưa thử inference trong trình duyệt/iPhone thật; không tuyên bố chất lượng ngang Apple Clean Up. Chi tiết và giới hạn tại `docs/qa/removal-v91.md`. Bản HTML mở trực tiếp giữ Vá nền nhanh.

## Biết chắc lượt xóa đã chạy AI — v92

- Sửa việc chạm chọn nền mẫu tự đổi từ AI sang vá nhanh. Nền mẫu chỉ hiện khi tự chọn **Vá nền nhanh**; chọn AI giữ đúng chế độ đó. Kết quả AI phải có dấu xác nhận từ đường inference, không chấp nhận dữ liệu của bộ vá nhanh thay thế.
- Màn hình kết quả trên điện thoại hiện **AI đã tái tạo nền**, **Vá nhanh · chưa chạy AI**, hoặc số vùng thuộc từng loại nếu ảnh đã sửa nhiều lần. Nhãn căn cứ bản vá đã lưu, không căn cứ nút AI đang được chọn. Bản vá cũ chưa đủ dữ liệu được ghi rõ chưa xác minh.
- Nút **Dùng AI** trên kết quả tạo lại vùng vá cuối từ ảnh gốc và lựa chọn còn trong nháp. Đợi AI thành công mới áp dụng/lưu; lỗi hoặc đổi ảnh không xác nhận nhầm kết quả. Thanh công cụ điện thoại hiện tiến trình và nút Dừng trong lúc xử lý.
- 102 kiểm tra liên quan đạt; CSS, build Sites và đóng gói HTML đạt. Mô hình và tài nguyên neural giữ nguyên v91; chưa kiểm tra trực tiếp Safari/iPhone. Không coi ảnh chụp kết quả hoặc thời gian xử lý là bằng chứng chắc chắn chế độ nào đã chạy trên một thiết bị.

## V100 · Photobooth ảnh / GIF / Live Photo / video (18/11/2026)

Chạm một ô ngay trên bản in để chọn hoặc thêm tệp; kéo để căn nội dung, chụm hai ngón hoặc cuộn chuột để phóng. Có nút Phóng ô / Xem cả khung, Mở rộng trên điện thoại, Về giữa và đổi với ô trước/sau. Kéo thả tệp vào đúng ô để thay riêng ô đó. Bảng công cụ ưu tiên khoảnh khắc, cắt đoạn và vị trí; camera, màu/hiệu ứng vẫn dùng các bộ xử lý sẵn có. Phát/dừng và thanh thời gian luôn cạnh khung, phần lưu luôn hiện.

Với Live Photo trong trình duyệt, dùng Ảnh → ⋯ → Lưu thành video rồi chọn video đó ở mục Live Photo. Nếu xuất bản gốc kèm đúng một ảnh HEIC/JPG và MOV cùng tên, có thể chọn cả hai: chuyển động chiếm một ô, tự lặp. Không ghép cặp MP4 hoặc các tên trùng gây mơ hồ. Không khôi phục chuyển động từ một ảnh tĩnh được bộ chọn web cung cấp. Video xuất vẫn không có âm thanh; định dạng MP4/WebM theo hỗ trợ trình duyệt.

Kiểm tra: 58 ca Photobooth/media/core/design đạt; chạy lại 43 ca controller/media sau sửa cuối về cử chỉ và thời gian đều đạt. Trình duyệt Chrome thử ảnh + GIF + video, chọn ô trên khung, phóng ô, kéo ảnh tĩnh trong ô, thay riêng ô và giao diện 390 × 844 qua iframe. MP4 thật 476 × 720, H.264, 2,073 giây; khung nguồn video và GIF thay đổi theo thời gian trong khi ô ảnh tĩnh giữ nguyên. Chưa thử Safari/iPhone thật hoặc tệp HEVC từ máy thật.

## V101 · Photobooth có ảnh lớn như bộ lọc (18/11/2026)

Trên điện thoại, Photobooth dùng thanh đầu 48 px và đường về Khám phá như trình màu phim. Ảnh chiếm vùng chính ngay khi mở; công cụ thu gọn bên dưới. Bấm tab hoặc thanh nắm để mở bảng, kéo thanh nắm / dùng phím mũi tên để chỉnh chiều cao, thu xuống để xem ảnh lớn. Thêm tệp, phát chuyển động và Phóng ô ở thanh nhỏ cạnh ảnh; thời gian chi tiết nằm trong bảng công cụ. Máy tính dùng bảng chỉnh hẹp hơn (340 px).

Đối chiếu trực tiếp trong hai màn 390 × 844: cùng tỉ lệ ảnh 3:4, Photobooth hiển thị 382 × 509,33 px và bộ lọc 382 × 509 px. Đã mở / đóng bảng công cụ, kiểm tra chiều cao tối đa 280 px, đổi khung Báo Hello và chuẩn bị PNG thành công. Chỉ đổi bố cục và tương tác bảng công cụ, giữ nguyên bộ dựng ảnh và video, tệp xuất và các công cụ chỉnh ảnh khác.


## Nhuộm tóc theo sắc độ và nhận diện tóc con — v102

- Màu nhuộm thay đổi cả sắc độ sáng/tối theo màu đã chọn, dùng mốc sáng riêng cho từng người và giữ tương phản sợi tóc. Mức 100% không còn giữ lại 10% màu cũ; mức 0 giữ nguyên ảnh. Màu không đổi khi xoay ảnh.
- Bổ sung mô hình tóc chuyên dụng đã đóng gói sẵn, giữ mép mềm và đuôi tóc. Kết hợp nhận diện da/nền/quần áo và giới hạn vùng bổ sung quanh tóc chắc chắn để tránh nhuộm nhầm lông thú/vật nền. Nhận diện lỗi vẫn giữ vùng tóc trước đó.
- Trong ảnh nhóm, phần tóc dài liên thông với đúng một chủ thể được giữ cùng màu; vùng giao nhau giữa hai mái tóc không bị gán bừa. Hai màn hình makeup dùng cùng bộ nhận diện và nhuộm tóc; cọ/tẩy và hoàn tác ở màn hình makeup vẫn hoạt động.
- Bản HTML độc lập giữ mô hình tóc mới; bản offline nhúng mô hình đó. Website đổi phiên bản cache để tải mã mới. Bản nháp cũ cần bấm **Nhận diện lại** để cập nhật vùng tóc.
- Kiểm chứng và giới hạn tại `docs/qa/hair-v102.md`. Không cam kết nhận đủ mọi sợi tóc; tóc cực mảnh cắt ngang da còn có thể bị bỏ sót.


## Sửa trạng thái không nhận diện tóc — v103

- Sửa trường hợp mô hình tóc chuyên dụng tìm được tóc nhưng bộ lọc cuối xóa hết vì mô hình đa lớp không có lõi đủ mạnh. Hai mô hình đồng thuận có thể tạo lõi mới, vẫn giữ bảo vệ da/nền và giới hạn vùng mở rộng.
- Kết quả tóc chi tiết trống hoặc tụt khả năng sử dụng giữ vùng đa lớp trước đó và báo rõ. Quét lại trên cùng ảnh không xóa vùng tóc đang dùng khi lần mới thất bại; chỉ giữ tóc, không ghi đè da/nền mới. Không lấy vùng tóc từ ảnh khác.
- Tóc có mép mềm và tóc nhỏ trong ảnh nhóm không còn bị khóa bởi các ngưỡng không thống nhất. Bộ nhuộm không phụ thuộc cờ sẵn sàng toàn ảnh bị cũ trong bản nháp.
- Chuyển từ quét mày sang Tóc hiện rõ nút **AI · Nhận diện tóc** và hướng dẫn quét, không tự chạy nhận diện. Cảnh báo tóc chưa rõ/giữ vùng cũ hiện ở cả hai màn hình makeup.
- 100 kiểm tra liên quan đạt. Thử lại dữ liệu từ mô hình CPU thật trên năm trường hợp, gồm tóc tối, tóc bạc, nhóm có mèo, ảnh mờ và mặt nhỏ. Xem `docs/qa/hair-recognition-v103.md` về lỗi, bằng chứng và giới hạn.


## Tóc tối và tóc ở xa — v104

- Sửa mảng đen lớn còn nguyên dù vùng tóc đã được AI nhận đúng: bỏ ngưỡng sáng tuyệt đối trong bộ nhuộm, dùng đường cong sắc độ liên tục đang có để màu vào cả tóc tối. Giữ pixel đen thật, alpha và tương phản sợi tóc.
- Sau khi tìm được mặt nhỏ, AI quét riêng đầu/vai ở tối đa 512 px để tìm tóc hai bên và phần đuôi, rồi ghép đúng về ảnh. Tối đa ba vùng; mô hình da/nền và tóc chạy lần lượt, đóng tài nguyên khi xong. Chỉ bổ sung tóc, không thay mặt nạ da/foreground; lỗi tùy chọn vẫn giữ vùng cũ.
- Thử trực tiếp ảnh người dùng có tay che trán, nhân vật nhỏ giữa cảnh cây: diện tích alpha tóc tăng khoảng 28.7% ở ảnh 1280 và 27.2% ở chế độ 768. Màu nâu 55%/100%, tím và be được thử với các vùng tay/áo/cây giữ nguyên. Không đưa ảnh người dùng lên website.
- 105 kiểm tra liên quan đạt; bằng chứng và giới hạn tại `docs/qa/hair-head-detail-v104.md`.
