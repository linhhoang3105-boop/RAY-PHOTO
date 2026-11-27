const SLIDERS_COLOR = [
  ["temp","Nhiệt màu",-1,1],
  ["tint","Xanh lá · hồng",-1,1],
  ["split","Tách tông",-1,1],
  ["contrast","Tương phản",-1,1],
  ["sat","Độ rực",-1,1],
  ["lift","Đen bạc màu",0,1],
  ["filmExp","Film Exposure",0,1]
];
const SLIDERS_PRINT = [
  ["printClear","Nước ảnh trong veo",0,1],
  ["film","Phim tráng in",0,1],
  ["paper","Giấy ảnh",0,1],
  ["gloss","Bề mặt bóng",0,1],
  ["soft","Mềm chi tiết",0,1],
  ["ptex","Vân giấy",0,1]
];
const SLIDERS_FILM = [
  ["flash","Đèn flash",0,1],
  ["sharp","Độ nét",0,1],
  ["nang","Nắng",0,1],
  ["glow","Độ bóng",0,1],
  ["kinh","Bóng kính",0,1],
  ["halation","Quầng sáng",0,1],
  ["grain","Hạt phim",0,1],
  ["vignette","Tối góc",0,1],
  ["leak","Vệt sáng lọt",0,1],
  ["dust","Bụi & xước",0,1],
  ["ca","Lệch màu viền",0,1]
];
/* Độ mờ nền (bgBlur) có UI riêng ở khối "Vùng nét" — không nằm trong SLIDERS_FILM
   vì cần đồng bộ thêm với việc hiện/ẩn vòng lấy nét kéo-thả. */

