# Nguồn RAY PHOTO

- `editor/`: nguồn lõi editor hiện hành, tách thành phần JavaScript, HTML template và CSS; thứ tự trong `editor/manifest.json`.
- `module-map.json`: bản đồ các module của toàn bộ web và đường dẫn đến từng file nguồn chuyên biệt.
- Các file baseline cũ tại đây phục vụ đối chiếu lịch sử, không phải entrypoint chạy app hiện tại.

Xem [hướng dẫn bàn giao và chạy dự án](../docs/SOURCE-HANDOFF.md). Lệnh ghép: `npm run source:build`; kiểm tra đồng bộ: `npm run source:check`. Các engine và adapter đã độc lập trong `dist/darkroom/`, trang chính, Photobooth, server và native tiếp tục có file nguồn riêng theo bản đồ module.
