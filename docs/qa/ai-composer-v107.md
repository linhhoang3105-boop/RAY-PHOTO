# Đo sáng khuôn mặt và làm rõ chi tiết trong AI Composer — v107

## Vấn đề tái hiện

Ảnh người dùng cung cấp có kích thước 1085 × 723, người mặc áo trắng ngồi trước nền núi/mây rất sáng. Bản v106 dùng độ sáng trung bình cả người nên áo trắng làm giảm mức bù cho mặt tối. Một preset được Composer chọn còn có paper/gloss nội tại, trong khi hạt và highlight toàn ảnh làm kết quả kém rõ và mây bị xám.

Chạy lại bằng engine sản phẩm và các mô hình phân đoạn/khuôn mặt đã đóng gói: toàn cảnh không tìm mặt, bước thử lại quanh vùng tóc hiện có tìm được một mặt. Bản v106 chỉ nâng luma vùng mặt khoảng 6%, đồng thời hạ sáng mây nhiều. Chẩn đoán này dựa trên chính ảnh gốc, không dùng ảnh đã được app khác sửa làm đầu vào.

## Bổ sung

**Phục hồi sáng & nét** nằm sau Cứu ngược sáng trong Composer. Hai lựa chọn này dùng đo sáng riêng cho tối đa ba khuôn mặt, kết hợp mốc khuôn mặt và mặt nạ chủ thể RAY. Mỗi mặt có lớp riêng để sửa/tắt/xóa. Nếu chỉ tìm được ứng viên vùng da, mức xử lý nhẹ hơn và giao diện ghi rõ để người dùng kiểm tra.

Histogram toàn ảnh tiếp tục lấy từ bản phân tích 256 px như trước. Một bản tối đa 512 px dùng để đo sáng, tương phản cạnh và ước lượng nhiễu tại mặt; không thay ảnh gốc hoặc ảnh xuất. Chuyển sáng sRGB sang ánh sáng tuyến tính để tính EV, rồi điều phối các công cụ exposure/shadows/brightness/highlights/temp/tint có sẵn. Vùng mặt giao với chủ thể giúp tránh làm sáng mây hoặc áo bên cạnh. Áo trắng không còn quyết định mức cứu sáng của khuôn mặt.

Hai phong cách phục hồi không tự thêm grain, giấy/bóng ảnh in, flare hoặc Thu Nhật có kết cấu nội tại. Các thành phần vẫn hiện để người dùng tự chỉnh. Mức hạ highlight toàn ảnh được giới hạn nhỏ để giữ cảm giác sáng của mây. Phục hồi sáng & nét có lớp chi tiết riêng dùng bộ tăng nét gốc, giới hạn theo ước lượng nhiễu và chỉ tác động trong chủ thể. Các engine màu, tone, tăng nét, nhận diện, Makeup, tóc và Photobooth không bị viết lại.

Công thức phiên bản 1 bổ sung mã `restore-detail` và trường đo đạc `analysis.recovery` có tối đa ba bản ghi. Chỉ chứa hình học/độ sáng/chi tiết, không có ảnh, landmark hay mặt nạ raster. Validator giới hạn schema, số mặt, tọa độ và giá trị hữu hạn. Khi thích ứng sang ảnh khác, vùng mặt và vùng chi tiết được nhận diện lại; các bước xóa/tắt và mức sửa riêng vẫn được giữ. Không áp dụng mặt cũ lên vị trí khác khi ảnh mới không nhận ra mặt.

Nếu ảnh đã có mặt nạ AI từ một công cụ khác nhưng chưa có khuôn mặt, lựa chọn phục hồi bổ sung lượt nhận diện mặt một lần, kể cả đã phối phong cách thường trước đó. Lỗi mô hình vẫn giữ mặt nạ hữu ích sẵn có; không gọi lại liên tục mỗi lần phối. Các tác vụ đang chạy dùng cùng kết quả khi phù hợp và không ghi đè ảnh đã đổi.

## Nghiên cứu tham chiếu

[Adobe Lightroom: Masking](https://helpx.adobe.com/lightroom/desktop/edit-photos/masking.html) mô tả điều chỉnh riêng da, tóc, quần áo và độ sáng/chi tiết; đồng thời lưu ý nhiễu có thể rõ hơn khi nâng vùng tối. [Adobe Camera Raw: Sharpening and noise reduction](https://helpx.adobe.com/au/camera-raw/desktop/using/sharpening-noise-reduction-camera-raw.html) phân biệt tăng tương phản cạnh với giảm nhiễu và khuyến nghị xem ở 100%. RAY sử dụng các nguyên tắc điều chỉnh cục bộ và giới hạn tăng nét này với engine đang có; không suy đoán hoặc sao chép thuật toán độc quyền của app trong ảnh tham khảo.

## Kiểm chứng

Đã thử trên chính ảnh gốc cùng mặt nạ production ở kích thước preview 768 px và xuất lại 1085 × 723. Phương án mạnh được thêm guard cho vùng mặt có nguy cơ quá sáng: giảm 0.12 EV và hạ highlight cục bộ khi đo sáng cho thấy cần thiết. Kết quả cuối nâng luma vùng mặt 0.2424 → 0.4191; áo 0.5590 → 0.5580, mây 0.8088 → 0.8025, vùng trời sáng 0.9442 → 0.9367. Trong ROI mặt kiểm tra không còn kênh màu nào từ 250 trở lên. Kiểm tra crop mặt/tóc, viền, áo, mây và kết cấu ở 100%, không chỉ xem toàn cảnh thu nhỏ. Các số này là luma đo trên vùng thử, không phải điểm chất lượng thẩm mỹ.

Các kiểm tra native dùng cảnh áo trắng/mặt tối và mây sáng, ảnh nhiễu, cạnh/kết cấu có thật, mặt đã đủ sáng, nhiều vùng khuôn mặt, đổi ảnh và thích ứng công thức. Có kiểm tra JSON đầy đủ, không lưu raster, hiệu lực thanh 0%, chỉnh lớp khuôn mặt trong UI, nguồn bất biến và các phương án không cộng dồn. So sánh 108 kế hoạch của chín phong cách trước (không gồm Cứu ngược sáng được nâng cấp) giữ nguyên JSON so với v106.

Hồi quy toàn repository: 698 kiểm tra đạt, không lỗi; hai kiểm tra LaMa thật bỏ qua theo điều kiện sẵn có. Bộ runtime/UI sau bổ sung nhận diện mặt khi đã có cache đạt 33/33; bộ core/native cuối đạt 27/27. Build web, HTML portable và đối chiếu byte các engine gốc được kiểm tra trước phát hành.

Ảnh người dùng, kết quả nhận diện và artifact thử nghiệm nằm ngoài repository trong scratch; không đưa vào website hoặc mã nguồn phát hành.

## Giới hạn

Lớp chi tiết làm rõ cạnh/kết cấu còn trong nguồn. Không có mô hình khử nhòe học máy, siêu phân giải hoặc tái dựng mặt; chi tiết đã mất hoàn toàn do rung, nén hoặc cháy sáng không được cam kết phục hồi. Mặt trong ảnh này chỉ có vài chục pixel, nên độ mềm nguồn vẫn có thể thấy khi phóng lớn. Không thay khuôn mặt hoặc tạo mắt/mi/da mới.

Môi trường không có `cua_repl`, chưa QA trực tiếp trên trình duyệt/iPhone thật. Kiểm tra DOM không thay cho kiểm tra bố cục, cử chỉ hoặc tốc độ trên điện thoại.
