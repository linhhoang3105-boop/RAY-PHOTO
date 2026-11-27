# RAY PHOTO v115 — kiểm chứng bàn giao nguồn

Ngày kiểm tra: 2026-11-27. Baseline trước khi tách nguồn: commit `4cb3d5c693509c1a24c2ba75184a64c115fb3a97` (v114).

## Phạm vi

- Tách lõi editor thành 29 file JavaScript, một file CSS và HTML template trong `source/editor/`.
- `source/module-map.json` mô tả 40 nhóm chức năng cùng các engine, adapter và thứ tự khởi tạo hiện có. Các engine đã độc lập giữ nguyên đường dẫn nguồn.
- Thêm trình ghép nguồn, server local, build frontend độc lập, cấu hình Worker/D1 portable và trình xuất ZIP nguồn có manifest SHA-256.
- Khai báo Canvas kiểm thử trong dependency của dự án; thay đường dẫn dependency riêng của môi trường cũ bằng import package thông thường. Fixture thứ tự preset thay việc cần lịch sử Git khi chạy kiểm thử từ ZIP.

## Bảo toàn runtime

Editor HTML được ghép lại giống từng byte với baseline v114:

```text
dist/darkroom/index.html SHA-256
3763d016a7dc26e24fa38f699d793e562463e541c90438ce8d5f3b0672e47c76

Native editor script SHA-256
9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d
```

Trong các file runtime được quản lý dưới `dist/`, chỉ khóa cache trong `sw.js` đổi sang v115. Không thay thuật toán Makeup, tóc, AI Composer, bộ lọc, chỉnh dáng, xóa/ghép nền hoặc Photobooth. Native bridge được build lại và giữ nguyên nội dung.

Các phần lõi vẫn được ghép theo thứ tự khai báo để giữ trạng thái chung và tương thích adapter. Đây là tách nguồn theo chức năng, chưa chuyển các phần lõi thành package ES module khởi động riêng biệt.

## Kiểm thử từ bản giải nén

Xuất ZIP validation, giải nén vào thư mục mới không có `.git`, xóa `CODEX_PRIMARY_RUNTIME_NODE_MODULES` và `NODE_PATH` khỏi môi trường chạy:

1. `npm ci` thành công; Canvas được lấy từ `node_modules` của chính dự án.
2. `npm test`: **787 kiểm thử, 785 đạt, 0 lỗi, 2 bỏ qua**. Hai kiểm thử mô hình tùy chọn không được bật trong lượt này.
3. `npm run build:web`: thành công, tạo 196 file tài nguyên public.
4. `npm run source:check`: thành công, HTML và script giữ checksum ở trên.
5. Server local: trang chính, editor và Photobooth trả HTTP 200; model tóc và WASM trả HEAD 200. Đường dẫn output server riêng không bị phục vụ công khai.
6. API chia sẻ trả HTTP 503 khi không cấu hình DB, đúng hợp đồng; không giả báo chia sẻ thành công.
7. Trình đóng gói chọn được nguồn qua `SOURCE-MANIFEST.json` khi không có Git, bỏ qua dependency và output build.

Build hosting Sites, build native bridge và xuất HTML standalone đã hoàn tất. Các kiểm thử đóng gói kiểm tra manifest, checksum, quyền file, từ chối ghi đè và loại file riêng tư.

## Giới hạn kiểm chứng

Lượt này không kiểm tra thao tác bằng trình duyệt hoặc thiết bị iPhone thật. Bản frontend độc lập cần backend/D1 riêng nếu dùng mã chia sẻ; source không bao gồm dữ liệu database, ảnh và nháp lưu trong trình duyệt người dùng. Không build ứng dụng Android/iOS hay phát hành lên kho ứng dụng trong lượt này.

Hướng dẫn chạy, đường dẫn từng module và quy trình xuất bản nguồn mới: [`docs/SOURCE-HANDOFF.md`](../SOURCE-HANDOFF.md).
