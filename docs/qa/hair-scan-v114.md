# Nhận diện tóc ảnh nhiều người — v114

## Chẩn đoán

Ảnh người dùng là ảnh chụp màn hình RAY, bên trong là ảnh Reels có người đội mũ bên trái và người tóc đen phía trước. Dòng Đang tách vùng riêng cho từng người thuộc bước pose, vốn chạy sau multiclass/hair/face. Trước v114, tab Tóc cũng chờ pose hoàn tất mới công bố mặt nạ, nên một bước cơ thể phụ có thể khiến phần tóc vẫn hiển thị đang nhận diện. Một ảnh tĩnh không chứng minh thời gian kẹt hoặc lỗi suy luận pose thực tế trên máy.

Chạy mô hình TFLite CPU cục bộ trên vùng ảnh xem trước trích từ screenshot (348×757, không phải file gốc): nhận ra hai mặt, mặt nạ tóc của người phía trước liên tục. Kiểm chứng bằng engine matte và phân tóc native cho thấy người mặc định0 (bên trái, đội mũ) có ready.hair=false, còn người phía trước1 có ready.hair=true. Native beautyBuildPeople sắp mặt từ trái sang phải nên lựa chọn ban đầu có thể làm người dùng tưởng cả ảnh chưa có tóc.

ROI sạch của tóc trước có alpha trung bình khoảng94.8% ở đỉnh,82.3%/76.4% ở hai bên; vùng mũ, áo choàng và tường đo bằng0. Đây là số đo trên ảnh trích từ màn hình, không phải độ chính xác segmentation chuẩn hoặc cam kết mọi sợi tóc/file gốc. Hai mặt đủ lớn nên lần tinh chỉnh crop đầu xa không chạy ở ca này.

## Thay đổi

Chỉ sửa adapter beauty-runtime.js:

- Tab Tóc chạy segment,hair,face; mốc mặt phân quyền vùng tóc mà không bắt buộc pose. Tab Mày vẫn face-only; các mục Makeup đầy đủ vẫn dùng pose. Tinh chỉnh đầu xa, giới hạn bộ nhớ và giải phóng từng mô hình giữ nguyên.
- Sau native beautyAssignPeople, chỉ ở lượt quét tóc đầu tiên, cùng job/cùng nguồn, còn busy và vẫn ở tab Tóc, nếu người mặc định không có tóc, chọn khuôn mặt lớn nhất trong những người ready.hair. Cập nhật selected và con trỏ values; giữ nguyên mặt nạ và toàn bộ thiết lập từng người. Người đã có trước, lựa chọn rõ ràng của người dùng, nguồn/job mới hoặc thao tác sau quét không bị tự đổi.
- UI khi đang chọn người không có tóc nhưng người khác có tóc chỉ rõ số người cần chọn qua ảnh nhỏ, cập nhật khi trạng thái sẵn sàng đổi sau quét.

Không sửa mô hình, ngưỡng matte, mở rộng tóc, thuật toán nhuộm, engine inline, preset, AI Composer hay Cường độ tổng Bộ lọc v113. Mức nhuộm0 tiếp tục giữ màu gốc cho tới khi người dùng chọn màu và kéo thanh.

## Kiểm chứng

54 kiểm thử mục tiêu đạt, gồm14 kiểm thử trạng thái nhận diện/adapter. Các ca mới kiểm tra route theo tab, hai mặt với tóc chỉ ở người trước, giữ người sẵn có/đã chọn, chỉ tự chọn khi đúng job/nguồn/còn busy/tab, giải phóng worker/main/canvas và thông báo chọn đúng người. Các kiểm tra tóc còn lại bảo vệ quần áo, mũ, da, pet fur, vùng tóc yếu và quyền của từng người.

Replay adapter trình duyệt và các helper native với kết quả TFLite thực đã cache: lượt đầu chọn Người2 phía trước, ready.hair=true; lượt quét lại giữ lựa chọn Người1 được chọn trước và giá trị mày0.38. Hai lượt gọi segment/hair/face, không gọi pose, sáu mô hình được đóng; mặt nạ tóc và quyền sở hữu byte giống baseline. Sau khi nhuộm riêng người phía trước, các ROI bên trong mặt, áo, mũ và tường không đổi; alpha và ảnh nguồn giữ nguyên. Engine AI function.toString giữ SHA-256 `c6419c34e27b6eda4a31480cd3b979bb1751931612535c0ab4d95cd6ff9c19ea` như v113.

Hồi quy: **767 bài, 765 đạt, 0 lỗi, 2 bỏ qua** (suy luận LaMa chuyên biệt). Build thành công. **194 file dist** khác giữ nguyên; native inline engine vẫn SHA-256 `9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d`. Bundle chỉnh ảnh HTML v114 giữ riêng theo phiên bản. Ảnh cá nhân chỉ ở scratch, không đưa vào code hoặc assets web. Chưa đo suy luận WASM, cảm ứng hoặc thời gian trực tiếp trên iPhone; ảnh được kiểm tra là bản xem trước trích từ screenshot.
