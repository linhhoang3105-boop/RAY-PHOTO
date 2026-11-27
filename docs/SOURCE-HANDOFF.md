# Bàn giao mã nguồn RAY PHOTO — v115

Gói `RAY-PHOTO-source-v115.zip` là dự án đầy đủ để tiếp tục phát triển: mã JavaScript/TypeScript, HTML/CSS, backend chia sẻ công thức, cấu hình cơ sở dữ liệu, Android/iOS, kiểm thử, tài nguyên AI, font và giấy phép. Các module nguồn là file văn bản có thể sửa trực tiếp. Bản HTML một file chỉ là bản đóng gói trình chỉnh ảnh; ZIP nguồn mới là dự án để bàn giao.

## Chạy trên máy riêng

Cần Node.js từ 22.13 trở lên (khuyến nghị bản 22 LTS mới) và npm. Giải nén ZIP, mở terminal trong thư mục chứa `package.json`, rồi chạy:

```sh
npm ci
npm run source:build
npm run dev:local -- --port 4173
```

Mở `http://localhost:4173`. Trình chỉnh ảnh, AI cục bộ, Photobooth và kho công thức/nháp trên thiết bị hoạt động từ web local. Camera cần cấp quyền qua nút chụp ảnh. Ảnh/nháp cũ lưu trong trình duyệt của tên miền RAY không tự chuyển sang địa chỉ local; muốn mang ảnh đã chỉnh sang nơi khác cần xuất ảnh/nháp bằng chức năng của app.

Mã chia sẻ 8 số dùng backend và cơ sở dữ liệu. Server local trả thông báo dịch vụ chưa cấu hình cho các endpoint chia sẻ; các chức năng chỉnh ảnh và lưu công thức trên thiết bị dùng bình thường. Gói nguồn chứa toàn bộ code và SQL của phần chia sẻ, không chứa dữ liệu người dùng đang lưu trong database hoặc trình duyệt.

## Tìm đúng module để sửa

Danh sách máy đọc được nằm trong `source/module-map.json`. Nguồn lõi được tách vật lý trong `source/editor/`; các engine và adapter đã độc lập tiếp tục nằm tại những file chuyên biệt trong `dist/darkroom/`. `dist/` ở dự án này còn chứa các file nguồn tĩnh, tài nguyên AI và media, không chỉ có output đã biên dịch.

| Phần | File/thư mục nguồn cần mở |
| --- | --- |
| Lõi chỉnh ảnh cũ, renderer, trạng thái | `source/editor/manifest.json` và các phần JS được liệt kê trong đó |
| HTML/CSS nền của editor | `source/editor/index.template.html`, `source/editor/ui/base.css` |
| Bộ lọc, Thu Nhật, công thức cá nhân | `dist/darkroom/preset-catalog.js`, `preset-rules.mjs`, `my-presets.mjs`, `ray-preset-thu-nhat.js` và các adapter cùng nhóm |
| Cường độ tổng Bộ lọc | `dist/darkroom/filter-strength-core.js`, `filter-strength.js` |
| AI Composer | `dist/darkroom/ai-composer-*.js`, `ai-composer.css` |
| Nhận diện da/tóc, nhuộm tóc, chân mày | `dist/darkroom/beauty-runtime.js`, `hair-core.js`, `hair-editor.js`, `brow-core.js`, `brows.js` và phần Makeup trong `source/editor/` |
| Điều chỉnh sáng, ánh sáng màu, nắng | `dist/darkroom/tone-*.js`, `light-core.js`, `photo-controls.js`, `brush-*.js` |
| Mặt nạ và vùng điều chỉnh | `dist/darkroom/adjust-scope-*.js`, `region-paint-*.js`, `region-shape-*.js` |
| Chỉnh dáng, nhận diện cơ thể | `dist/darkroom/body-ai/` và các phần body trong `source/editor/` |
| Thay nền, ghép người, phối cảnh | `dist/darkroom/background-*.js`, `compose-*.js`, `people-editor.js` |
| Xóa người/vật, tái tạo nền | `dist/darkroom/remove-*.js`, `inpaint*.js` |
| Sticker, tách vật | `dist/darkroom/cutout-*.js`, `sticker-store.js` |
| Cắt/xoay, chữ, video | `dist/darkroom/photo-edit*.js`, `doodle-*.js`, `video-editor.js` |
| Lớp, lịch sử, nháp, công thức | `dist/darkroom/effect-layers.js`, `layer-*.mjs`, `session.js`, `edit-history.js`, `dist/album-store.js` |
| Preview, độ nét, giao diện điện thoại | `dist/darkroom/quality-*.js`, `preview-*.js`, `workspace-layout.js`, `editor-visibility.js`, `dist/editor-mobile.js` |
| Trang chính và album | `dist/index.html`, `studio.js`, `studio.css` |
| Photobooth | `dist/photobooth/index.html`, `dist/app.js`, `booth-*.js`, `buongtoi-lab.js`, `photo-beauty.js` |
| API chia sẻ, schema/migration | `server/preset-api.mjs`, `api-server/app/api/ray/[...path]/route.ts`, `api-server/drizzle/` |
| Chạy độc lập trên hosting khác | `scripts/build-web.mjs`, `server/portable-worker.mjs`, `wrangler.portable.jsonc` |
| Bridge và ứng dụng điện thoại | `native/`, `android/`, `ios/`, `capacitor.config.json` |
| Mô hình, WASM, font, ảnh/video mở đầu | `dist/vendor/`, `dist/fonts/`, `dist/assets/` |

Photobooth dùng `<base href="../">`; các file `app.js` và `booth-*` được lấy từ `dist/`, không phải trong thư mục `dist/photobooth/`.

`source/buong-toi-original.html`, `source/rolls.literal.js` và `source/engine-sha256.json` là tư liệu baseline lịch sử để đối chiếu. Nguồn editor hiện hành là `source/editor/`; checksum cũ không đại diện cho toàn bộ app mới.

## Cách ghép và kiểm tra

`source/editor/manifest.json` ghi thứ tự các phần nguồn. `scripts/assemble-source.mjs` ghép chúng thành `dist/darkroom/index.html` mà không thêm wrapper, đổi thuật toán hoặc đổi thứ tự thực thi. Cách này giữ các biến trạng thái dùng chung, engine/preset cũ, adapter, lịch sử và định dạng nháp hiện có. Các file này là đơn vị nguồn theo chức năng; chúng chưa phải package ES module chạy tách khỏi trạng thái editor.

Khi sửa một phần lõi, sửa file ở `source/editor/`, sau đó:

```sh
npm run source:build
npm run source:check
npm test
```

Bộ hồi quy đầy đủ cần Git, Python3, FFmpeg và ffprobe trong PATH. Canvas kiểm thử được khai báo trong dependency dự án và cài qua `npm ci`; không cần đường dẫn hoặc biến môi trường của Codex. Git chỉ dùng để tạo repository tạm trong kiểm tra đóng gói; gói source giải nén không cần có lịch sử `.git`.

`source:check` chỉ kiểm tra đồng bộ, không ghi đè file. Khi sửa các engine/adapter đã độc lập tại `dist/darkroom/`, file đó được dùng trực tiếp. Chạy build để tạo lại các file được sinh tự động như `layer-inspector.js`, `preset-bases.mjs` và metadata preset. Nguồn của bridge native là `native/native-bridge.js`.

Luồng hosting Sites đầy đủ còn dùng dependency riêng trong `api-server/` (lockfile pnpm); cài bằng `npx pnpm@11.25.0 install --frozen-lockfile --dir api-server` nếu làm việc với backend đó. Local và `build:web` chỉ cần dependency root.

Các lệnh `npm run dev`, `npm run build`, đóng gói HTML và `npm run build:native` đều ghép nguồn editor trước khi sử dụng. `npm test` kiểm tra nguồn đã ghép rồi chạy hồi quy. Bộ kiểm tra hiện có một số checksum cố định để bảo vệ thuật toán gốc; thay thuật toán có chủ đích cần cập nhật kiểm chứng tương ứng.

## Đưa sang hosting khác

Để xuất frontend độc lập, chạy:

```sh
npm run build:web
```

Đưa nội dung `build/web/` lên root của hosting tĩnh có HTTPS. Thư mục này gồm trang chính, editor, Photobooth, module, model, WASM, font, PWA và media. Chức năng chia sẻ mã cần backend riêng; chỉnh ảnh và lưu trên thiết bị hoạt động trên frontend.

Để dùng Cloudflare Workers cùng D1, gói có `server/portable-worker.mjs` và `wrangler.portable.jsonc`. Worker này dùng lại `server/preset-api.mjs`, không phụ thuộc lớp hosting Sites của ChatGPT. Quy trình cấu hình:

1. Tạo database D1 cho bản triển khai mới bằng tài khoản hosting của bạn.
2. Điền ID database đó vào cấu hình portable, giữ binding `DB` và binding tài nguyên `ASSETS`.
3. Áp dụng SQL migration trong `api-server/drizzle/` cho database vừa tạo.
4. Build frontend bằng `npm run build:web`, rồi triển khai Worker với cấu hình portable.

`.openai/hosting.json` và `api-server/` vẫn giữ luồng build của website RAY đang chạy trên Sites. Cấu hình portable phục vụ một bản triển khai độc lập. Các API/module xử lý ảnh không yêu cầu API AI trả phí.

## Android và iOS

Từ gói nguồn đầy đủ:

```sh
npm ci
npm run native:sync
npm run android
# Hoặc trên macOS có Xcode:
npm run ios
```

Cần Android Studio/SDK cho Android; cần macOS/Xcode cho iOS. Gói nguồn không kèm khóa ký, keystore hoặc tài khoản phát hành. Các archive/bản APK đã xuất trước đó vẫn là phiên bản riêng, không bị cập nhật tự động theo source mới.

## Xuất lại một bản nguồn mới

Có Python3 để tạo/kiểm tra ZIP bằng thư viện chuẩn:

```sh
npm run source:zip -- --version v116 --output exports/RAY-PHOTO-source-v116.zip
node scripts/package-source.mjs --verify exports/RAY-PHOTO-source-v116.zip
```

Khi còn dùng Git, đưa file mới vào index bằng `git add` trước khi xuất; script lấy danh sách file được quản lý trong Git. Sau khi giải nén ở nơi khác không có Git, script dùng manifest và duyệt các thư mục nguồn để đóng gói tiếp.

Tên version và đường dẫn có thể thay theo bản đang sửa. Script mặc định từ chối ghi đè ZIP đã có. Gói có `SOURCE-MANIFEST.json` với danh sách file, kích thước và SHA-256 để kiểm tra đầy đủ dữ liệu; không kèm `node_modules`, cache, build tạm, database riêng, `.git`, biến môi trường hoặc khóa ký. Các thư viện bên thứ ba, mô hình và font giữ giấy phép đi kèm.
