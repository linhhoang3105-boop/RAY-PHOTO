# RAY PHOTO · bản màu học trò 42

Gói này là **dự án Android đầy đủ để biên dịch và thử**, chưa phải AAB đã ký. Giữ mã gói `com.linhlinh.rayphoto` của bộ starter v37; tên hiển thị là RAY PHOTO. Bản Android dùng bộ lưu MediaStore riêng, thay cho tải tệp qua WebView. Có đủ Chỉnh ảnh, Photobooth, Kho ảnh, mô hình AI, phông và giấy phép đi kèm.

## Làm trên Windows

1. Giải nén vào thư mục không dấu, ví dụ `D:\RayPhoto`.
2. Cài Node.js 22.21.1 trở lên và Android Studio 2025.2.1 trở lên. Trong SDK Manager cài Android SDK Platform 36. Dùng Gradle JDK 21 trong Android Studio. Lần chuẩn bị đầu cần mạng để tải thư viện.
3. Chạy `01_CHUAN_BI_ANDROID.bat`. Lệnh này cài đúng phiên bản trong khóa phụ thuộc và đồng bộ tài nguyên Android.
4. Chạy `02_MO_ANDROID_STUDIO.bat`, đợi Gradle đồng bộ rồi Run trên điện thoại Android 10 trở lên. Thử mở ảnh, chỉnh chữ có dấu, áp dụng/hoàn tác, AI tóc, lưu JPEG/PNG vào thư viện, photobooth và mở lại nháp.
5. Trong Android Studio chọn **Build → Generate Signed Bundle / APK → Android App Bundle**. Tạo hoặc dùng upload key của chính bạn, cất khóa và mật khẩu an toàn. Không gửi khóa trong chat. AAB đã ký mới là tệp đưa vào Play Console.
6. Tải AAB lên luồng thử nghiệm của Play Console, thử trên thiết bị thật trước khi gửi xét duyệt công khai. Làm theo điều kiện thử nghiệm hiện trên tài khoản của bạn.

Khi thay mã nguồn web trong `dist`, chạy `03_DONG_BO_WEB.bat` rồi build lại. Không thay `dist/index.html` bằng bản HTML độc lập: app đầy đủ cần cả thư mục `dist` và lớp native.

## Bổ sung ở bản 42

- Máy ảnh số được đưa lên trước các nhóm màu phim; Trong veo, Ngọc Diệp, Trong xanh ở đầu nhóm.
- Hai màu miễn phí mới: Ngọc Diệp (trong trẻo, hồng đào) và Tan Học (ấm mật ong, bóng mềm, hạt mịn).
- 87 bộ lọc + chế độ Gốc. Màu cũ, ID bản nháp, makeup và khung viền của người dùng được giữ nguyên.

## Sửa ở bản 41

- Nút Thêm chữ mới luôn hiện khi cuộn; chọn Chữ sẽ trở về đầu bảng và mở ô nhập sau khi thêm.
- Bảng công cụ cho chữ/thay nền có chiều cao phù hợp hơn, vẫn kéo và thu gọn để xem ảnh lớn.
- Da/tóc/makeup được xử lý trên ảnh gốc trước khi ghép phông, giữ màu nền mới và người ghép độc lập.
- Phông mới có ảnh xem trước và thông báo đang dùng nền gốc, nền màu, ảnh hay trong suốt.

## Ghép người trước và sau

- Chọn người trong mục Ghép người. Dùng **Đưa ra trước / Đưa ra sau** để đổi thứ tự giữa các người ghép cùng phía.
- **Phía trước / Phía sau** đặt người ghép so với người trong ảnh gốc. Lần đầu ghép phía sau cần nhận diện người gốc; nếu đã có vùng tách nền thì dùng lại, không chạy AI thêm.
- Giữ nguyên ảnh gốc và thông số màu. Có thể hoàn tác/làm lại, đổi cỡ, lật, xoay, áp dụng tiếp hoặc mở lại nháp.

## Bản này đã kiểm tra đến đâu

- Bộ kiểm tra tự động: 182 bài đạt, gồm chữ tiếng Việt, màu riêng từng dòng, nghiêng/đậm, hoàn tác và nháp.
- Bố cục được kiểm tra trong trình duyệt với các khung điện thoại; ảnh được ưu tiên, dải bộ lọc nhỏ, bảng công cụ kéo cao/thu gọn; Áp dụng về ảnh sạch.
- Giữ đường xuất nguồn gốc đến 16 MP, có báo kích thước thực nếu phải giảm. Các lần Áp dụng không nén JPEG lại.
- Chưa biên dịch/chạy bản Android trong môi trường làm việc này: có Java 17 nhưng thiếu JDK 21 và Android SDK. Chưa có khóa ký, APK hay AAB. Không xem kiểm tra trình duyệt là kiểm tra native.
- AI da/tóc/người cần kiểm chứng trên máy thật có WebGL. Vùng tóc khó, ảnh tối hoặc mặt nhỏ có thể nhận diện sai. Xóa người/vá nền là sao chép vùng ảnh, không phải AI sinh lại cảnh bị che.

## Thông tin chuẩn bị cho cửa hàng

Tên: **RAY PHOTO — Ảnh phim**

Mô tả ngắn: **Màu phim, ánh sáng, trang điểm và photobooth cho khoảnh khắc của bạn.**

Mô tả gợi ý: RAY PHOTO là xưởng ảnh nhỏ của bạn. Chọn trong 87 màu phim và kỹ thuật số, chỉnh sáng tối toàn ảnh hoặc theo vùng, vẽ ánh sáng và thêm chất phim. Trang điểm, đổi màu tóc, chỉnh dáng, ghép người trước/sau hoặc thay phông theo ý thích. Thêm chữ với các phông tiếng Việt, màu sắc, đậm, nghiêng và góc xoay riêng. Tạo photobooth từ ảnh hoặc video, sửa lời nhắn trên khung và lưu kỷ niệm về máy. Ảnh được xử lý trên thiết bị; không cần tạo tài khoản.

- Privacy: https://pho-cang-photobooth.tenderdace128.chatgpt.site/privacy.html
- Hướng dẫn: https://pho-cang-photobooth.tenderdace128.chatgpt.site/support.html
- Biểu tượng: `CH_PLAY/icon-512.png`.
- Trước khi nộp, điền tên nhà phát hành và email hỗ trợ thật trong Play Console/trang hỗ trợ; khai Data safety theo bản build và các SDK thực tế. Chưa thêm thu phí, quảng cáo hay theo dõi trong bản này.
- Chụp ảnh màn hình từ bản Android đang chạy. Ảnh kiểm tra trình duyệt không đại diện cho kiểm thử trên điện thoại.

Tài liệu chính thức: https://capacitorjs.com/docs/getting-started/environment-setup và https://developer.android.com/studio/publish/app-signing .
