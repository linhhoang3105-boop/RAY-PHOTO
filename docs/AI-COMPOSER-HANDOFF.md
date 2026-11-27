# Tiếp tục phát triển RAY AI Composer

Mã nguồn AI nằm trong repo RAY PHOTO cùng các engine, model và kiểm thử của toàn bộ dự án. Claude hoặc một công cụ phát triển khác có thể tiếp tục sửa các file này bằng workflow Git thông thường; hướng dẫn chạy độc lập nằm trong [SOURCE-HANDOFF.md](SOURCE-HANDOFF.md).

## Phạm vi v117

Chỉ chỉnh công thức và giao diện AI Composer. Toàn bộ màu trong Bộ lọc thường, ID, thứ tự và thông số gốc của chúng được giữ nguyên. Engine pixel, Makeup, tóc, chỉnh dáng và Photobooth không được viết lại trong thay đổi này.

- Lựa chọn **Cứu ngược sáng** và **Phục hồi sáng & nét** được gộp trên giao diện thành **Cứu sáng & nét**, dùng ID `restore-detail`.
- `Core.styles` và `Core.STYLES` vẫn giữ các ID lịch sử, gồm `backlight`. UI dùng `Core.getVisibleStyles()` và thông tin alias; không xóa ID cũ khỏi validator công thức.
- Mở công thức cũ không thích ứng giữ nguyên ID và tham số đã lưu. Thao tác tự phối mới dùng lựa chọn hiển thị hiện hành; phối lại một công thức cũ vẫn giữ ID của công thức đó.
- Runtime chỉ gộp các phương án có cùng tác động: giữ thứ tự lớp, tham số, vị trí và các seed thực sự được engine sử dụng. Một phương án khác tham số hoặc khác chất ảnh ngẫu nhiên vẫn là lựa chọn riêng.

## File cần sửa

| File | Trách nhiệm |
| --- | --- |
| `dist/darkroom/ai-composer-core.js` | Phân tích ảnh, công thức thích ứng, bù sáng người, lựa chọn phong cách và tương thích khi áp sang ảnh khác |
| `dist/darkroom/ai-composer-runtime.js` | Trạng thái phiên, phân tích/nhận diện có cache, phương án, cường độ, so sánh và hoàn tác |
| `dist/darkroom/ai-composer-ui.js` | Lựa chọn hiển thị, alias cũ, thanh chỉnh, vùng và thao tác lưu/mở |
| `dist/darkroom/ai-composer-recipes.js` | Validator/codec/store công thức và các trường phân tích tùy chọn có giới hạn |
| `dist/darkroom/tone-core.js`, `adjust-scope-core.js`, `light-core.js` | Engine RAY hiện có được công thức gọi lại; không thêm một renderer riêng trong Composer |

Các file ở `dist/darkroom/` nêu trên là nguồn JavaScript có thể sửa trực tiếp. 29 phần nguồn editor gốc ở `source/editor/` tiếp tục được ghép theo manifest, không cần chuyển sang một bản HTML duy nhất để phát triển AI.

## Bù sáng người

Tình huống kiểm tra chính là mặt bị bóng bàn tay/tán cây trong khi hậu cảnh và logo áo đã sáng. Đo trung bình mặt thôi sẽ bỏ qua vùng tối sâu; tăng phơi sáng toàn người dễ làm áo đen bạc và vùng trắng cháy. Công thức cần dùng các vùng và công cụ tone hiện có để điều chỉnh riêng phần cần sáng, với giới hạn màu/vùng sáng và kiểm tra kết cấu da.

`personLightVersion` là dấu phiên bản phân tích tùy chọn để phân biệt công thức trước khi có bù sáng người với công thức mới mà người dùng đã chủ động xóa lớp bù sáng. Không tự thêm lại lớp họ đã xóa. Dữ liệu ảnh, mask raster và ảnh mẫu không đưa vào JSON công thức hoặc repo. Các trường đo bổ sung như `channelP95` phải có giới hạn và vẫn đọc được công thức cũ.

Khi thích ứng công thức trước `personLightVersion`, lớp `face-i` còn tồn tại và có baseline được chuyển sang đường cong sáng hiện hành, rồi cộng lại chênh lệch người dùng đã sửa so với baseline cũ. Giữ trạng thái tắt và các lớp đã xóa. Lớp cũ thiếu baseline được xử lý bảo thủ vì không thể phân biệt thông số tự động với chỉnh sửa thủ công; mở không thích ứng luôn giữ nguyên công thức.

Các phong cách AI có thể yêu cầu tìm khuôn mặt còn thiếu một lần cho mỗi ảnh; chuyển phong cách hoặc phối lại dùng kết quả đã cache. Khi không có nhận diện đủ tin cậy, không dựng một khuôn mặt cố định theo vị trí của ảnh mẫu.

## Kiểm chứng và phát hành

Chạy kiểm thử AI/runtime/UI, kiểm tra dựng ảnh qua engine thật, rồi chạy hồi quy chung trước khi phát hành. Cần xem ảnh kết quả thực tế để phát hiện quầng, bệt màu hoặc cháy kênh dù điểm trung bình độ sáng đã tăng đúng.

```sh
npm run source:check
node --test test/ai-composer*.test.cjs
npm test
npm run build:web
```

Website RAY hiện tại chạy trên Sites; push GitHub không tự triển khai website đó. Giữ bản mã nguồn và version phát hành khớp nhau, theo [GITHUB-HANDOFF.md](https://github.com/linhhoang3105-boop/RAY-PHOTO/blob/main/docs/GITHUB-HANDOFF.md) khi làm từ repo GitHub. Các bản ZIP nguồn phải đặt tên phiên bản mới, không ghi đè bản đã gửi trước đó.

## Người tối sâu trước trời sáng — v118

Nhận diện theo điểm dùng lại `RayRemoveAI.infer` riêng biệt, không gọi `segment()` dùng chung trạng thái hủy của công cụ Xóa vật. Runtime yêu cầu hook `refineRecognition` tối đa một lần mỗi ảnh; helper chỉ chạy khi có mặt đo được đủ tối, xác suất cao và lệch sáng với cảnh. Ảnh nhận diện dài tối đa 512 px. Khi có tối đa ba khuôn mặt, phải chọn thành công tất cả người rồi mới thay foreground; bất kỳ người nào thất bại thì giữ mask cũ. Không tự bỏ người đã sáng khỏi vùng bảo vệ.

`recovery.personGuided` là boolean tùy chọn được đặt khi vùng đã qua kiểm tra theo điểm mặt. Thân người chỉ nhận bù sáng mạnh khi cờ này đúng và các percentile đo được còn tối, không có áo trắng cần bảo vệ. Không đưa mask raster vào JSON. Mở công thức không thích ứng vẫn giữ tham số đã lưu; muốn tạo công thức theo thuật toán mới dùng Tự phối.

Thứ tự native được xác nhận trực tiếp: Tone áp trong `bodyWarp`, trước `buildLUT` (gồm Film Exposure). Với ảnh tối sâu, tăng EV có giới hạn rồi chỉ nâng đường cong phim rất ít; tránh nền xám làm mặt/thân trông như mảng tô. Phần bóng bổ sung giữ khoảng trống kênh màu còn lại. Khi nhận diện tóc gần như trống ở ảnh tối, không dùng oval dự phòng để tô sáng lên vùng tóc.

Công thức cảnh có kiểm tra histogram hai cụm sáng/tối để phân biệt chạng vạng với sương núi. Không hứa khôi phục chi tiết đã đen hoặc cháy hoàn toàn; kiểm tra ảnh thật và để người dùng điều chỉnh lại vùng/cường độ. Nguồn ảnh tham chiếu và kết quả chỉ nằm trong scratch.
