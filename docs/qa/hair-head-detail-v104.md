# Tóc ở xa và mảng tóc tối v104

## Chẩn đoán trên ảnh báo lỗi

Người dùng cung cấp ảnh gốc 1280 × 960: người đứng giữa cảnh núi/cây, tay che trán. Tái hiện bằng các mô hình đóng gói thật, chạy CPU cục bộ.

Có hai vấn đề độc lập:

1. Quét toàn cảnh bỏ một phần tóc cạnh mặt/đuôi tóc. FaceLandmarker toàn ảnh không tìm mặt; bước thử lại quanh tóc tìm được mặt. Trước v104 chưa tận dụng mặt vừa tìm được để quét kỹ mái tóc.
2. Nhiều pixel tóc được nhận diện trên 200/255 nhưng vẫn gần đen sau nhuộm. Ví dụ pixel [3,2,20] có mặt nạ 254/255; ngưỡng bóng tối tuyệt đối chặn mức sáng dưới 0.002–0.02, tạo mảng trông như bỏ sót. Bỏ ngưỡng này; đường cong theo độ sáng tương đối vẫn giữ đen thật và thứ tự sáng tối.

## Sửa và giới hạn tài nguyên

Chỉ quét thêm cho mặt nhỏ có mốc hợp lệ. Tối đa ba khung đầu/vai, cạnh dài tối đa 512 px, gộp các khung trùng. Một mô hình đa lớp chạy lần lượt các khung rồi đóng; một mô hình tóc tiếp tục chạy lần lượt rồi đóng. Tính lại bảo vệ da/nền/quần áo trong khung, không dùng lại cổng phân loại yếu của toàn cảnh.

Chiếu mặt nạ tóc về hệ tọa độ toàn ảnh bằng tâm pixel và nội suy bilinear, hòa mép khung, chỉ bổ sung vào tóc đang có. Không sửa byte của mặt nạ da/foreground. Lỗi mô hình, kết quả hoặc canvas không được làm mất vùng cũ; tài nguyên được giải phóng và có cảnh báo. Bước mày chỉ nhận diện mặt không chạy quét tóc.

## Kiểm chứng

105 kiểm tra liên quan đạt, gồm chiếu mặt nạ đúng vị trí, giữ vùng ngoài khung, bảo vệ da, đóng mô hình/kết quả/canvas, giới hạn số khung, worker serialization, màu tóc tối, alpha, pixel đen thật, tương phản, xoay đúng từng byte, người độc lập, nháp, hoàn tác, ghép nền và xuất ảnh.

Trên chính ảnh báo lỗi, chạy cùng đường xử lý engine sản phẩm và mô hình CPU trên các crop do engine tạo:

- 1280 × 960: quét mặt ban đầu không tìm được; thử lại 691 × 688 tìm được một mặt; crop tóc thực tế 434 × 512. Diện tích alpha tóc 6023.72 → 7749.70 pixel, tăng 28.66%.
- 768 × 576: thử lại mặt tìm được một mặt; crop tóc 426 × 512. Diện tích alpha 2146.43 → 2729.20, tăng 27.15%.
- Thử màu nâu #794437 ở 55% và 100%, tím #6b466e và be #bd9967. Các vùng tay, thân áo và cây kiểm tra riêng giữ đúng từng pixel ở cả hai độ phân giải.
- Ảnh nhóm có mèo và chân dung tóc bạc được thử lại; vùng lông mèo 28,000 pixel vẫn không đổi.

Không đưa ảnh tham khảo hoặc ảnh người dùng vào tài nguyên phát hành. Các tỷ lệ trên là diện tích alpha, không phải tỷ lệ nhận đúng theo mặt nạ chuẩn do người đánh dấu.

## Giới hạn

Tóc cực mảnh, bị che hoặc pixel đen đã mất hết chi tiết vẫn có thể thiếu/giữ tối; không tuyên bố nhận đủ 100% sợi tóc. Môi trường không có cua_repl để QA trình duyệt theo quy trình Sites; chưa thử trên iPhone/Safari thật.
