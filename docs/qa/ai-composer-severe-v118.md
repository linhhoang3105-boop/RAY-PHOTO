# Người ngược sáng nặng: khoanh vùng và bù sáng một chạm — v118

## Phạm vi

Nâng cấp AI Composer, không thêm màu Bộ lọc hay viết lại engine. Dùng **AI Composer → Cứu sáng & nét → Tự phối ảnh** để tạo công thức mới. Mỗi lớp và vùng vẫn sửa/tắt/xóa, so sánh và lưu như trước. Công thức đã lưu mở không thích ứng giữ nguyên thông số của nó.

## Nhận diện người

Ở ảnh tối sâu, multiclass có thể nhận lẫn lan can và đường chân trời vào người. Khi có mặt đủ tin cậy (confidence >0,7), trung bình mặt <0,22, percentile90 <0,40 và chênh sáng với cảnh >0,10, runtime yêu cầu tinh chỉnh vùng tối đa một lần mỗi ảnh.

UI dùng điểm mũi tự phát hiện cho `RayRemoveAI.infer` (Magic Touch đã có), ảnh nhận diện dài tối đa512px. API này tạo task riêng và đóng tài nguyên trong finally; không gọi wrapper dùng chung trạng thái hủy của công cụ Xóa vật. Có tối đa3 mặt thì chọn tất cả người rồi hợp vùng, kể cả người đã sáng. Phải qua kiểm tra điểm hạt, độ phủ mặt và diện tích thân; mọi người phải thành công. Lỗi/mask chỉ có mặt/nhiều hơn3 mặt thì giữ kết quả cũ. Không làm thay đổi pixel nguồn hoặc skin/hair maps.

Cờ tùy chọn `recovery.personGuided` chỉ đúng sau khi chấp nhận vùng mới; được kiểm tra kiểu boolean và lưu trong phân tích để thích ứng công thức nhất quán. Không lưu mask raster. Cờ này là điều kiện bắt buộc để bù sáng thân người mạnh, cùng percentile thân người còn tối và không có áo trắng cần bảo vệ.

## Công cụ được điều phối

- Mặt tối sâu dùng phơi sáng native có giới hạn kênh RGB, giảm mạnh Film Exposure và lớp nâng bóng để tránh nền xám. Lớp bóng bổ sung giữ lại khoảng trống màu sau mức EV chính.
- Thân người dùng tối đa1,4EV, giảm các mức nâng nền xám; giảm làm nét vùng đã nâng sáng để không phóng đại hạt phim. Không đủ nhận diện theo điểm thì không dùng mức bù mạnh này.
- Ở mặt tối mà mô hình tóc gần trống, dùng đường bao da nhận diện, không dùng oval dự phòng để làm sáng nhầm tóc.
- Histogram hai cụm sáng/tối phân biệt hoàng hôn với cảnh núi sương: giảm khử mờ/làm nét khi cảnh là bóng núi tối trước trời sáng, giữ gần nguyên độ sáng và sắc trời. Cảnh núi mờ vẫn dùng Khử mờ và Chi tiết hiện có ngoài người, với mức điều chỉnh theo ảnh.
- Nhánh cứu sáng hỗn hợp v117 giữ nguyên: fixture mặt có bóng tay/áo len đen/logo trắng khớp cả thông số lẫn pixel native. Không sửa Tone, Clarity, Light, Scope, Selection, Makeup, tóc hay Photobooth.

Thứ tự native: Tone chạy trong bodyWarp trước bảng màu/Film Exposure; lớp bóng kế tiếp xử lý ảnh sau lớp mặt. Chỉ tính toán tham số và vùng, không có renderer hoặc mô hình ảnh mới.

## Thử ba ảnh thực tế

Ba JPEG624×468 người dùng cung cấp: hai ảnh người gần như silhouette trước hoàng hôn và một ảnh núi sương. Mô hình phát hiện1 mặt ngay toàn ảnh ở cả3; Magic Touch dùng đúng điểm mặt tự động, không khoanh tay. Helper UI thật chấp nhận cả3 vùng và giữ skin/hair. Dựng bằng đúng các engine RAY ở kích thước nguồn624×468. Mô hình QA chạy CPU; sai khác nội suy Canvas/Pillow được ghi ngoài repo.

Độ sáng trung bình0–255, theo vùng AI nhận diện:

| Ảnh | Da trước / sau | Người trước / sau | Trời trước / sau |
| --- | ---: | ---: | ---: |
| 1 | 20.2 / 61.6 | 14.1 / 31.3 | 192.4 / 192.5 |
| 2 | 25.2 / 68.2 | 16.8 / 34.7 | 204.5 / 204.3 |
| 3 | 40.4 / 87.3 | 28.7 / 49.9 | 217.7 / 209.4 |

Các vùng da đo được không có kênh chạm255. Ở ảnh núi, độ trải sáng percentile90−10 trong ROI kiểm tra tăng khoảng153,6→158,8. Đây chỉ là phép đo trên ảnh thử; không phải bằng chứng khôi phục chi tiết đã mất. Ảnh hoàng hôn còn hạt, bệt màu và ít kết cấu tóc/áo do nguồn rất tối, nên mức cứu sáng được giới hạn. Chỉ nâng thông tin còn lại trong ảnh, không tái tạo chi tiết đã mất.

Ảnh, landmark, mask, điểm đo và kết quả thử đều giữ trong scratch, không đưa vào repo hoặc bản triển khai.

## Kiểm chứng

Hồi quy `npm test`: **827 bài, 825 đạt, 0 lỗi, 2 bỏ qua** (mô hình LaMa tùy chọn). Có kiểm tra vùng theo điểm trên cả3 ảnh, dựng ảnh qua engine thật, kết quả hỗn hợp v117 giữ nguyên pixel, cùng kiểm thử cache/hủy/đổi ảnh, công thức, scene và các module khác. Build native, hosting Sites, standalone và portable thành công. 200 tài nguyên public khớp nguồn ở cả hai build; 87 script standalone hợp lệ. Đối chiếu41 file preset/editor/engine với v117 giữ nguyên; bản đồ40 nhóm module đủ file. Hash script native `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`, hash HTML editor `2776dbb411b8057b8c4fd2c08ef34fa12730c6927a55f36a0c574aa67879aa08`.

Lượt này không chạy trình duyệt hoặc iPhone/Android thật. Kiểm tra UI/runtime bằng harness và ảnh bằng native renderer Node; suy luận tham chiếu dùng model đóng gói hiện có trên CPU.
