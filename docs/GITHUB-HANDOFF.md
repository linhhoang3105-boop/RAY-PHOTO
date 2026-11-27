# RAY PHOTO trên GitHub

Repo đích: https://github.com/linhhoang3105-boop/RAY-PHOTO

**Bản hiện hành: v118.** Một chạm khoanh người theo điểm mặt khi ngược sáng nặng, bù sáng riêng người và xử lý cảnh theo chạng vạng/sương núi. Giữ nguyên90 màu Bộ lọc, các engine và kết quả cứu sáng hỗn hợp v117. [Hướng dẫn sửa tiếp AI](AI-COMPOSER-HANDOFF.md).

Lần nhập nguồn v115 ban đầu bổ sung dự án đầy đủ từ nguồn RAY v115 đã phát hành, gồm 598 file nguồn/tài nguyên: editor, các engine chức năng, backend, mô hình AI, font, kiểm thử, cấu hình build và wrapper Android/iOS. Nguồn được đối chiếu với ZIP đã kiểm chứng SHA-256 `a49f66acd5a105088be27fdd99c3acb1416d28b6f04495a471432b8100113a3b`; commit nguồn RAY là `9c186b9f9d93356b10fbf7f3e3ec48f633766fbe`.

## Bắt đầu

Dùng Node.js từ 22.13 trở lên. Clone repo hoặc tải **Code → Download ZIP**, giải nén rồi mở terminal trong thư mục có `package.json`:

```sh
npm ci
npm run dev:local
```

Mở `http://localhost:4173`. Hướng dẫn đầy đủ, yêu cầu chạy kiểm thử và cấu hình backend nằm trong [SOURCE-HANDOFF.md](SOURCE-HANDOFF.md).

## Chọn đúng nguồn để sửa

- Lõi editor: 29 phần JavaScript cùng HTML template/CSS trong `source/editor/`.
- Các engine đã độc lập: theo đường dẫn trong `source/module-map.json`, phần lớn ở `dist/darkroom/`.
- Trang chính/Photobooth và tài nguyên public: `dist/`.
- Backend chia sẻ công thức: `server/`, `api-server/`.
- Xuất frontend cho hosting khác: `npm run build:web`, lấy output trong `build/web/`.

Hai file `index.html` và `RAY-PHOTO-v48.html` từng được tải lên gốc repo vẫn được giữ nguyên để tham khảo. Chúng không phải entry point của quy trình phát triển v115. Server local phục vụ app hiện hành từ `dist/`; sửa lõi trong `source/editor/` rồi chạy `npm run source:build` và các kiểm thử phù hợp.

Repo GitHub không tự triển khai lên website RAY đang chạy. Các quy trình GitHub Pages hoặc hosting khác cần được cấu hình riêng. API chia sẻ cần database riêng; ảnh/nháp trên thiết bị và dữ liệu database của website hiện hành không nằm trong mã nguồn.

## Kiểm chứng bản hiện hành

Bản v118: **827 bài,825 đạt,0 lỗi,2 bỏ qua** (mô hình tùy chọn). Ba ảnh tham chiếu nhận diện/khoanh người tự động; ảnh và mask không nằm trong repo. Build hosting/standalone/portable đã kiểm tra:200 tài nguyên public và87 script standalone. [Báo cáo v118](qa/ai-composer-severe-v118.md). Commit nguồn Sites:`e3e4700a9d13ef38449602afb864c9ea3e4e6855`. Tag nguồn riêng:`v118`.

## Kiểm chứng v117 trước đó

Bản v117: `npm test` có **810 bài, 808 đạt, 0 lỗi, 2 bỏ qua** (mô hình tùy chọn). Build hosting, standalone và portable đã kiểm tra; 200 tài nguyên public khớp nguồn. Có kiểm tra qua engine thật trên ảnh bóng tay che mặt; ảnh/mask thử không đưa vào repo. [Báo cáo v117](qa/ai-composer-person-v117.md). Commit nguồn Sites: `d5113c75e56770e794f856b800f8cfeef6616a76`.

Các module AI nằm trong `dist/darkroom/ai-composer-*.js`; Claude có thể tiếp tục sửa trực tiếp cùng repo. Nguồn v117 được gắn tag riêng, không ghi đè gói ZIP cũ.

## Kiểm chứng bản nhập trước

Bản v116 đã qua 796 kiểm thử: 794 đạt, 0 lỗi, 2 kiểm thử mô hình tùy chọn bỏ qua. 29 phần JS lõi và native bridge giữ nguyên nội dung; các engine Nắng Phố/Khử mờ/Chi tiết ở file độc lập. Bảo vệ vùng sáng, lớp cũ và nháp cũ được hậu kiểm khi đưa lên Sites. Báo cáo v116: [film-clarity-v116.md](qa/film-clarity-v116.md). Commit nguồn Sites cùng phiên bản: `0366c30b9a5b07dd2ec30b0474bbe667c4551b38`.
