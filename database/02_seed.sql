/* =====================================================================
   NPK-SHOP - DỮ LIỆU MẪU (SEED DATA)
   File 2/2: Chạy SAU file 01_schema.sql
   Có thể chạy lại nhiều lần: script xóa dữ liệu cũ rồi nạp lại từ đầu.
   Mật khẩu tất cả tài khoản demo: 123456
   ===================================================================== */
USE [NPK];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* ---------- 1. Xóa dữ liệu cũ (con -> cha) ---------- */
DELETE FROM DANH_GIA;
DELETE FROM VAN_CHUYEN;
DELETE FROM THANH_TOAN;
DELETE FROM CHI_TIET_DON_HANG;
DELETE FROM DON_HANG;
DELETE FROM CHI_TIET_GIO_HANG;
DELETE FROM GIO_HANG;
DELETE FROM MA_GIAM_GIA;
DELETE FROM SAN_PHAM;
DELETE FROM DANH_MUC;
DELETE FROM KHACH_HANG;
DELETE FROM NHAN_VIEN;
DELETE FROM QUAN_TRI_VIEN;
DELETE FROM NGUOI_DUNG;

/* Reset bộ đếm IDENTITY (chỉ reseed khi bảng đã từng có dữ liệu) */
DECLARE @t SYSNAME, @seed INT, @sql NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT OBJECT_NAME(object_id), CAST(seed_value AS INT) - 1
    FROM sys.identity_columns
    WHERE OBJECTPROPERTY(object_id, 'IsUserTable') = 1 AND last_value IS NOT NULL;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @seed;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DBCC CHECKIDENT (''' + @t + N''', RESEED, ' + CAST(@seed AS NVARCHAR(20)) + N') WITH NO_INFOMSGS;';
    EXEC (@sql);
    FETCH NEXT FROM cur INTO @t, @seed;
END
CLOSE cur; DEALLOCATE cur;

/* ---------- 2. NGƯỜI DÙNG ---------- */
SET IDENTITY_INSERT NGUOI_DUNG ON;
INSERT INTO NGUOI_DUNG (ma_nguoi_dung, ho_ten, email, mat_khau, so_dien_thoai, vai_tro, trang_thai, ngay_tao) VALUES
 (1,  N'Nguyễn Hữu Nghĩa',         'khachhang@eshop.vn',  '123456', '0987654321', 'KHACH_HANG', 1, DATEADD(DAY, -120, GETDATE())),
 (2,  N'Trần Quang Khải (NV Kho)',  'nhanvien@eshop.vn',   '123456', '0897654321', 'NHAN_VIEN',  1, DATEADD(DAY, -300, GETDATE())),
 (3,  N'Đặng Hồng Phúc',           'admin@eshop.vn',      '123456', '0789654321', 'ADMIN',      1, DATEADD(DAY, -365, GETDATE())),
 (4,  N'Hà Quang Việt',            'viet.ha@gmail.com',   '123456', '0912345678', 'KHACH_HANG', 1, DATEADD(DAY, -90,  GETDATE())),
 (5,  N'Đào Minh Thiện',           'thien.dao@gmail.com', '123456', '0903445566', 'KHACH_HANG', 1, DATEADD(DAY, -80,  GETDATE())),
 (6,  N'Trần Minh Quân',           'quan.tran@gmail.com', '123456', '0934111222', 'KHACH_HANG', 1, DATEADD(DAY, -70,  GETDATE())),
 (7,  N'Lê Thu Hà',                'ha.le@gmail.com',     '123456', '0945222333', 'KHACH_HANG', 1, DATEADD(DAY, -65,  GETDATE())),
 (8,  N'Phạm Hoàng Nam',           'nam.pham@gmail.com',  '123456', '0956333444', 'KHACH_HANG', 1, DATEADD(DAY, -60,  GETDATE())),
 (9,  N'Nguyễn Thảo Vy',           'vy.nguyen@gmail.com', '123456', '0967444555', 'KHACH_HANG', 1, DATEADD(DAY, -50,  GETDATE())),
 (10, N'Đặng Quốc Bảo',            'bao.dang@gmail.com',  '123456', '0978555666', 'KHACH_HANG', 1, DATEADD(DAY, -45,  GETDATE())),
 (11, N'Vũ Ngọc Ánh',              'anh.vu@gmail.com',    '123456', '0989666777', 'KHACH_HANG', 1, DATEADD(DAY, -40,  GETDATE())),
 (12, N'Lê Minh Tuấn (NV CSKH)',   'nhanvien2@eshop.vn',  '123456', '0868777888', 'NHAN_VIEN',  1, DATEADD(DAY, -200, GETDATE())),
 (13, N'Bùi Gia Huy',              'huy.bui@gmail.com',   '123456', '0399888999', 'KHACH_HANG', 0, DATEADD(DAY, -30,  GETDATE()));
SET IDENTITY_INSERT NGUOI_DUNG OFF;

INSERT INTO QUAN_TRI_VIEN (ma_quan_tri) VALUES (3);

INSERT INTO NHAN_VIEN (ma_nhan_vien, ma_so_nhan_vien, bo_phan) VALUES
 (2,  'NV001', N'Kho vận'),
 (12, 'NV002', N'Chăm sóc khách hàng');

INSERT INTO KHACH_HANG (ma_khach_hang, dia_chi_giao_hang, diem_tich_luy, hang_thanh_vien) VALUES
 (1,  N'123 Đường Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh', 2450, N'Hạng Kim Cương'),
 (4,  N'88 Cầu Giấy, Hà Nội',                                       760,  N'Hạng Vàng'),
 (5,  N'12 Bạch Đằng, Hải Châu, Đà Nẵng',                           720,  N'Hạng Vàng'),
 (6,  N'45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',                        230,  N'Hạng Bạc'),
 (7,  N'210 Trần Hưng Đạo, Quận 5, TP. Hồ Chí Minh',                180,  N'Hạng Bạc'),
 (8,  N'9 Nguyễn Trãi, Thanh Xuân, Hà Nội',                         0,    N'Hạng Đồng'),
 (9,  N'77 Hùng Vương, Ninh Kiều, Cần Thơ',                         390,  N'Hạng Bạc'),
 (10, N'15 Lý Thường Kiệt, TP. Huế',                                750,  N'Hạng Vàng'),
 (11, N'102 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh',                   150,  N'Hạng Bạc'),
 (13, N'33 Phan Chu Trinh, Hoàn Kiếm, Hà Nội',                      0,    N'Hạng Đồng');

/* ---------- 3. DANH MỤC ---------- */
SET IDENTITY_INSERT DANH_MUC ON;
INSERT INTO DANH_MUC (ma_danh_muc, ten_danh_muc, mo_ta) VALUES
 (1, N'Âm thanh & Thiết bị đeo', N'Tai nghe, loa, đồng hồ và vòng đeo thông minh'),
 (2, N'Phụ kiện Máy tính',       N'Bàn phím, chuột, màn hình và phụ kiện PC'),
 (3, N'Balo & Tiện ích',         N'Balo laptop, giá đỡ và phụ kiện tiện ích');
SET IDENTITY_INSERT DANH_MUC OFF;

/* ---------- 4. SẢN PHẨM ---------- */
SET IDENTITY_INSERT SAN_PHAM ON;
INSERT INTO SAN_PHAM (ma_san_pham, ma_danh_muc, ma_sku, ten_san_pham, gia_ban, so_luong_ton_kho, da_ban, hinh_anh, thong_so, mo_ta, ngay_tao) VALUES
 (1,  1, 'HP-ANC-01',   N'Tai nghe Bluetooth Chống ồn Pro ANC',         1290000, 42, 145, 'headphone', N'Chống ồn chủ động 42dB • Bluetooth 5.3 • Pin 36 giờ',          N'Âm thanh Hi-Res cân bằng, đệm tai protein siêu êm, hỗ trợ kết nối đa điểm mượt mà.', DATEADD(DAY, -100, GETDATE())),
 (2,  2, 'KB-MECH-87',  N'Bàn phím cơ Không dây RGB 87 phím',           1850000, 8,  74,  'keyboard',  N'3 chế độ kết nối • Switch Linear Hot-swap • Keycap PBT',        N'Cảm giác gõ đầm tay, chống ồn tốt cho văn phòng, pin 4000mAh dùng liên tục nhiều tuần.', DATEADD(DAY, -98, GETDATE())),
 (3,  2, 'MS-ERGO-02',  N'Chuột công thái học Silent Wireless',         790000,  26, 112, 'mouse',     N'DPI 4000 • Click giảm ồn 90% • Sạc nhanh Type-C',               N'Thiết kế nâng góc 57 độ giúp giảm mỏi cổ tay tối đa khi làm việc cường độ cao.', DATEADD(DAY, -96, GETDATE())),
 (4,  1, 'WT-FIT-S9',   N'Đồng hồ thông minh Emerald Watch S9',         3290000, 6,  53,  'watch',     N'Màn AMOLED 1.43" • Đo SpO2 & Nhịp tim • Chống nước 5ATM',      N'Theo dõi sức khỏe chuyên sâu, GPS độc lập và thời lượng pin lên đến 10 ngày.', DATEADD(DAY, -94, GETDATE())),
 (5,  3, 'BL-ECO-15',   N'Balo Laptop 15.6" Chống sốc EcoTech',         890000,  19, 88,  'backpack',  N'Chống thấm nước • Ngăn chống sốc 360° • Cổng sạc USB ngoài',    N'Chất liệu vải tái chế thân thiện môi trường, phân ngăn khoa học cho laptop và phụ kiện.', DATEADD(DAY, -92, GETDATE())),
 (6,  2, 'MN-UHD-27',   N'Màn hình Đồ họa OceanView 27" 4K IPS',        7490000, 9,  31,  'monitor',   N'4K UHD 3840x2160 • 99% sRGB • USB-C PD 65W',                   N'Hiển thị màu sắc chuẩn xác cho thiết kế và lập trình, chân đế công thái học xoay dọc linh hoạt.', DATEADD(DAY, -90, GETDATE())),
 (7,  1, 'SP-BASS-360', N'Loa Bluetooth Di động AquaSound 360',         1590000, 22, 67,  'speaker',   N'Công suất 30W • Kháng nước IPX7 • Pin 18 giờ',                 N'Âm thanh vòm 360 độ mạnh mẽ, thiết kế gọn nhẹ chống nước phù hợp cả trong nhà lẫn dã ngoại.', DATEADD(DAY, -88, GETDATE())),
 (8,  3, 'ST-ALU-PRO',  N'Giá đỡ Laptop Nhôm nguyên khối Xoay 360',     450000,  0,  109, 'stand',     N'Hợp kim nhôm CNC • Chịu tải 10kg • Tản nhiệt thoáng khí',      N'Điều chỉnh độ cao chuẩn tầm mắt, bảo vệ cột sống cổ và tăng hiệu quả tản nhiệt cho laptop.', DATEADD(DAY, -86, GETDATE())),
 (9,  1, 'EB-TWS-05',   N'Tai nghe True Wireless AirBeat 5',            990000,  35, 96,  'headphone', N'Bluetooth 5.3 • Chống ồn ENC • Pin tổng 30 giờ',               N'Thiết kế in-ear nhỏ gọn, kết nối nhanh, micro đàm thoại rõ ràng cho học tập và làm việc.', DATEADD(DAY, -60, GETDATE())),
 (10, 2, 'KB-LOW-75',   N'Bàn phím cơ Low-profile 75% Slim',            1490000, 14, 41,  'keyboard',  N'Layout 75% • Switch Low-profile • Bluetooth + 2.4G',           N'Mỏng nhẹ, phím bấm êm ái, kết nối đồng thời 3 thiết bị, phù hợp mang theo bên laptop.', DATEADD(DAY, -55, GETDATE())),
 (11, 2, 'MS-GAME-X1',  N'Chuột Gaming X1 Lightweight 59g',             650000,  30, 58,  'mouse',     N'Cảm biến 26000 DPI • Nặng 59g • Polling 1000Hz',               N'Trọng lượng siêu nhẹ, cảm biến chính xác cao, dây paracord mềm dành cho game thủ.', DATEADD(DAY, -50, GETDATE())),
 (12, 1, 'WT-BAND-7',   N'Vòng đeo tay thông minh FitBand 7',           890000,  40, 120, 'watch',     N'Màn AMOLED 1.62" • 120 chế độ thể thao • Pin 14 ngày',         N'Theo dõi giấc ngủ, nhịp tim, SpO2 liên tục, chống nước bơi lội 5ATM.', DATEADD(DAY, -45, GETDATE())),
 (13, 3, 'BL-TRV-20',   N'Balo du lịch đa năng TravelPro 20L',          1150000, 12, 27,  'backpack',  N'Dung tích 20L • Khóa chống trộm • Ngăn laptop 16"',           N'Mở rộng linh hoạt, quai đeo trợ lực, phù hợp công tác và du lịch ngắn ngày.', DATEADD(DAY, -40, GETDATE())),
 (14, 2, 'MN-GAM-24',   N'Màn hình Gaming 24" 165Hz IPS',               3990000, 7,  22,  'monitor',   N'Full HD 165Hz • 1ms GtG • HDR10 • FreeSync',                  N'Chuyển động mượt mà, màu sắc sống động, viền mỏng 3 cạnh phù hợp setup nhiều màn hình.', DATEADD(DAY, -30, GETDATE())),
 (15, 1, 'SP-MINI-10',  N'Loa mini Bluetooth PocketBeat 10W',           490000,  50, 140, 'speaker',   N'Công suất 10W • IPX5 • Pin 12 giờ',                            N'Nhỏ gọn bỏ túi, âm bass chắc, có dây treo tiện mang theo khi đi chơi.', DATEADD(DAY, -20, GETDATE())),
 (16, 3, 'ST-PHN-01',   N'Giá đỡ Điện thoại & Máy tính bảng gập gọn',   190000,  80, 210, 'stand',     N'Hợp kim nhôm • Gập gọn • Điều chỉnh 270°',                     N'Đế chống trượt chắc chắn, phù hợp học online, xem phim và gọi video.', DATEADD(DAY, -10, GETDATE()));
SET IDENTITY_INSERT SAN_PHAM OFF;

/* ---------- 5. MÃ GIẢM GIÁ ---------- */
SET IDENTITY_INSERT MA_GIAM_GIA ON;
INSERT INTO MA_GIAM_GIA (ma_giam_gia, ma_code, loai_giam, phan_tram_giam, so_tien_giam, giam_toi_da, don_toi_thieu, mo_ta, ngay_het_han, dang_hoat_dong) VALUES
 (1, 'GIAM100K',   'FIXED',   0,  100000, 100000, 300000,  N'Giảm 100.000đ cho đơn từ 300.000đ',          DATEADD(MONTH, 6, GETDATE()), 1),
 (2, 'SALE20',     'PERCENT', 20, 0,      300000, 0,       N'Giảm 20%, tối đa 300.000đ',                  DATEADD(MONTH, 6, GETDATE()), 1),
 (3, 'FREESHIP30', 'FIXED',   0,  30000,  30000,  500000,  N'Giảm 30.000đ (hỗ trợ phí ship) cho đơn từ 500.000đ', DATEADD(MONTH, 3, GETDATE()), 1),
 (4, 'NPK10',      'PERCENT', 10, 0,      150000, 1000000, N'Giảm 10%, tối đa 150.000đ cho đơn từ 1.000.000đ', DATEADD(MONTH, 2, GETDATE()), 1),
 (5, 'BLACKFRIDAY','PERCENT', 30, 0,      500000, 2000000, N'Đã hết hạn - Giảm 30% tối đa 500.000đ',      DATEADD(DAY, -5, GETDATE()), 1);
SET IDENTITY_INSERT MA_GIAM_GIA OFF;

/* ---------- 6. GIỎ HÀNG (khách 1 đang có sẵn 2 món trong giỏ) ---------- */
INSERT INTO GIO_HANG (ma_khach_hang, tong_tien) VALUES (1, 0), (4, 0), (5, 0), (6, 0), (7, 0), (8, 0), (9, 0), (10, 0), (11, 0), (13, 0);
INSERT INTO CHI_TIET_GIO_HANG (ma_gio_hang, ma_san_pham, so_luong, don_gia)
SELECT g.ma_gio_hang, v.sp, v.sl, s.gia_ban
FROM GIO_HANG g
CROSS JOIN (VALUES (7, 1), (16, 2)) v(sp, sl)
JOIN SAN_PHAM s ON s.ma_san_pham = v.sp
WHERE g.ma_khach_hang = 1;
UPDATE g SET tong_tien = ISNULL((SELECT SUM(so_luong * don_gia) FROM CHI_TIET_GIO_HANG c WHERE c.ma_gio_hang = g.ma_gio_hang), 0) FROM GIO_HANG g;

/* ---------- 7. ĐƠN HÀNG ---------- */
SET IDENTITY_INSERT DON_HANG ON;
INSERT INTO DON_HANG (ma_don_hang, ma_khach_hang, ma_nhan_vien_duyet, ma_giam_gia, ngay_dat, trang_thai, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_giao, tong_tien_hang, tien_giam, tong_thanh_toan) VALUES
 (1042, 1,  NULL, 1,    DATEADD(MINUTE, -45,    GETDATE()), 'DA_THANH_TOAN', N'Nguyễn Hữu Nghĩa', '0987654321', N'123 Đường Nguyễn Văn Cừ, P.4, Q.5, TP.HCM', 2080000, 100000, 2010000),
 (1041, 1,  NULL, NULL, DATEADD(MINUTE, -120,   GETDATE()), 'CHO_XAC_NHAN',  N'Nguyễn Hữu Nghĩa', '0987654321', N'123 Đường Nguyễn Văn Cừ, P.4, Q.5, TP.HCM', 890000,  0,      915000),
 (1040, 4,  2,    NULL, DATEADD(HOUR,   -26,    GETDATE()), 'DANG_GIAO',     N'Hà Quang Việt',    '0912345678', N'88 Cầu Giấy, Hà Nội',                       3290000, 0,      3320000),
 (1039, 5,  2,    2,    DATEADD(HOUR,   -50,    GETDATE()), 'HOAN_THANH',    N'Đào Minh Thiện',   '0903445566', N'12 Bạch Đằng, Hải Châu, Đà Nẵng',           7490000, 300000, 7220000),
 (1038, 6,  12,   NULL, DATEADD(DAY,    -3,     GETDATE()), 'HOAN_THANH',    N'Trần Minh Quân',   '0934111222', N'45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',        2270000, 0,      2295000),
 (1037, 7,  2,    1,    DATEADD(DAY,    -5,     GETDATE()), 'HOAN_THANH',    N'Lê Thu Hà',        '0945222333', N'210 Trần Hưng Đạo, Quận 5, TP. Hồ Chí Minh',1850000, 100000, 1780000),
 (1036, 8,  NULL, NULL, DATEADD(DAY,    -6,     GETDATE()), 'DA_HUY',        N'Phạm Hoàng Nam',   '0956333444', N'9 Nguyễn Trãi, Thanh Xuân, Hà Nội',         1580000, 0,      1605000),
 (1035, 9,  12,   2,    DATEADD(DAY,    -9,     GETDATE()), 'HOAN_THANH',    N'Nguyễn Thảo Vy',   '0967444555', N'77 Hùng Vương, Ninh Kiều, Cần Thơ',         4180000, 300000, 3910000),
 (1034, 10, 2,    NULL, DATEADD(DAY,    -14,    GETDATE()), 'HOAN_THANH',    N'Đặng Quốc Bảo',    '0978555666', N'15 Lý Thường Kiệt, TP. Huế',                7490000, 0,      7520000),
 (1033, 11, 12,   1,    DATEADD(DAY,    -20,    GETDATE()), 'HOAN_THANH',    N'Vũ Ngọc Ánh',      '0989666777', N'102 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh',   1590000, 100000, 1515000),
 (1032, 1,  2,    NULL, DATEADD(DAY,    -35,    GETDATE()), 'HOAN_THANH',    N'Nguyễn Hữu Nghĩa', '0987654321', N'123 Đường Nguyễn Văn Cừ, P.4, Q.5, TP.HCM', 1890000, 0,      1920000),
 (1031, 4,  12,   2,    DATEADD(DAY,    -60,    GETDATE()), 'HOAN_THANH',    N'Hà Quang Việt',    '0912345678', N'88 Cầu Giấy, Hà Nội',                       4640000, 300000, 4370000);
SET IDENTITY_INSERT DON_HANG OFF;

INSERT INTO CHI_TIET_DON_HANG (ma_don_hang, ma_san_pham, ten_san_pham, so_luong, don_gia_mua) VALUES
 (1042, 1,  N'Tai nghe Bluetooth Chống ồn Pro ANC',      1, 1290000),
 (1042, 3,  N'Chuột công thái học Silent Wireless',      1, 790000),
 (1041, 5,  N'Balo Laptop 15.6" Chống sốc EcoTech',      1, 890000),
 (1040, 4,  N'Đồng hồ thông minh Emerald Watch S9',      1, 3290000),
 (1039, 6,  N'Màn hình Đồ họa OceanView 27" 4K IPS',     1, 7490000),
 (1038, 1,  N'Tai nghe Bluetooth Chống ồn Pro ANC',      1, 1290000),
 (1038, 15, N'Loa mini Bluetooth PocketBeat 10W',        2, 490000),
 (1037, 2,  N'Bàn phím cơ Không dây RGB 87 phím',        1, 1850000),
 (1036, 3,  N'Chuột công thái học Silent Wireless',      2, 790000),
 (1035, 4,  N'Đồng hồ thông minh Emerald Watch S9',      1, 3290000),
 (1035, 12, N'Vòng đeo tay thông minh FitBand 7',        1, 890000),
 (1034, 6,  N'Màn hình Đồ họa OceanView 27" 4K IPS',     1, 7490000),
 (1033, 7,  N'Loa Bluetooth Di động AquaSound 360',      1, 1590000),
 (1032, 8,  N'Giá đỡ Laptop Nhôm nguyên khối Xoay 360',  2, 450000),
 (1032, 9,  N'Tai nghe True Wireless AirBeat 5',         1, 990000),
 (1031, 14, N'Màn hình Gaming 24" 165Hz IPS',            1, 3990000),
 (1031, 11, N'Chuột Gaming X1 Lightweight 59g',          1, 650000);

INSERT INTO THANH_TOAN (ma_don_hang, phuong_thuc, trang_thai, so_tien, ma_giao_dich, ngay_thanh_toan) VALUES
 (1042, 'VNPAY', 'THANH_CONG',     2010000, 'VNP14290042', DATEADD(MINUTE, -45, GETDATE())),
 (1041, 'COD',   'CHO_THANH_TOAN', 915000,  NULL,          NULL),
 (1040, 'MOMO',  'THANH_CONG',     3320000, 'MM88120040',  DATEADD(HOUR, -26, GETDATE())),
 (1039, 'VNPAY', 'THANH_CONG',     7220000, 'VNP14290039', DATEADD(HOUR, -50, GETDATE())),
 (1038, 'COD',   'THANH_CONG',     2295000, NULL,          DATEADD(DAY, -1, GETDATE())),
 (1037, 'MOMO',  'THANH_CONG',     1780000, 'MM88120037',  DATEADD(DAY, -5, GETDATE())),
 (1036, 'COD',   'THAT_BAI',       1605000, NULL,          NULL),
 (1035, 'VNPAY', 'THANH_CONG',     3910000, 'VNP14290035', DATEADD(DAY, -9, GETDATE())),
 (1034, 'VNPAY', 'THANH_CONG',     7520000, 'VNP14290034', DATEADD(DAY, -14, GETDATE())),
 (1033, 'COD',   'THANH_CONG',     1515000, NULL,          DATEADD(DAY, -17, GETDATE())),
 (1032, 'MOMO',  'THANH_CONG',     1920000, 'MM88120032',  DATEADD(DAY, -35, GETDATE())),
 (1031, 'VNPAY', 'THANH_CONG',     4370000, 'VNP14290031', DATEADD(DAY, -60, GETDATE()));

INSERT INTO VAN_CHUYEN (ma_don_hang, don_vi_van_chuyen, ma_van_don, phi_van_chuyen, trang_thai) VALUES
 (1042, N'Giao Hàng Nhanh',     NULL,         30000, 'CHO_LAY_HANG'),
 (1041, N'Giao Hàng Tiết Kiệm', NULL,         25000, 'CHO_LAY_HANG'),
 (1040, N'Giao Hàng Nhanh',     'GHN839201',  30000, 'DANG_VAN_CHUYEN'),
 (1039, N'Giao Hàng Nhanh',     'GHN551209',  30000, 'DA_GIAO'),
 (1038, N'Giao Hàng Tiết Kiệm', 'GHTK118822', 25000, 'DA_GIAO'),
 (1037, N'Giao Hàng Nhanh',     'GHN772310',  30000, 'DA_GIAO'),
 (1036, N'Giao Hàng Tiết Kiệm', NULL,         25000, 'DA_HUY'),
 (1035, N'Giao Hàng Nhanh',     'GHN330198',  30000, 'DA_GIAO'),
 (1034, N'Giao Hàng Nhanh',     'GHN901234',  30000, 'DA_GIAO'),
 (1033, N'Giao Hàng Tiết Kiệm', 'GHTK554433', 25000, 'DA_GIAO'),
 (1032, N'Giao Hàng Nhanh',     'GHN112233',  30000, 'DA_GIAO'),
 (1031, N'Giao Hàng Nhanh',     'GHN445566',  30000, 'DA_GIAO');

/* ---------- 8. ĐÁNH GIÁ ---------- */
INSERT INTO DANH_GIA (ma_khach_hang, ma_san_pham, so_sao, noi_dung, ngay_danh_gia) VALUES
 (6,  1,  5, N'Chống ồn rất tốt, đeo lâu không đau tai, giao hàng siêu nhanh.',              DATEADD(DAY, -2,  GETDATE())),
 (7,  2,  5, N'Phím gõ êm, kết nối không dây ổn định cả Mac lẫn Windows.',                    DATEADD(DAY, -4,  GETDATE())),
 (8,  3,  4, N'Chuột cầm vừa tay, click im ru rất thích.',                                     DATEADD(DAY, -6,  GETDATE())),
 (9,  4,  5, N'Màn hình sắc nét, pin trâu dùng hơn tuần mới phải sạc.',                       DATEADD(DAY, -8,  GETDATE())),
 (10, 6,  5, N'Màn 4K nét căng, cắm dây Type-C vừa xuất hình vừa sạc laptop quá tiện.',        DATEADD(DAY, -12, GETDATE())),
 (11, 7,  4, N'Bass ấm, mang đi cắm trại nghe rất đã.',                                        DATEADD(DAY, -16, GETDATE())),
 (1,  9,  4, N'Tai nghe nhỏ gọn, pin ổn, giá hợp lý cho sinh viên.',                           DATEADD(DAY, -30, GETDATE())),
 (1,  8,  5, N'Giá đỡ chắc chắn, nhôm dày, laptop mát hẳn.',                                   DATEADD(DAY, -30, GETDATE())),
 (4,  14, 5, N'165Hz chơi game mượt, màu đẹp so với tầm giá.',                                 DATEADD(DAY, -55, GETDATE())),
 (4,  11, 4, N'Chuột siêu nhẹ, dây mềm, cảm biến chính xác.',                                  DATEADD(DAY, -55, GETDATE())),
 (5,  6,  4, N'Màn hình đẹp, đóng gói cẩn thận. Chân đế hơi nặng.',                            DATEADD(DAY, -1,  GETDATE())),
 (9,  12, 5, N'Vòng đeo đo giấc ngủ chính xác, pin gần 2 tuần.',                               DATEADD(DAY, -7,  GETDATE())),
 (6,  15, 4, N'Loa nhỏ mà kêu to, đáng tiền.',                                                 DATEADD(DAY, -2,  GETDATE()));

COMMIT TRANSACTION;
GO

/* Kiểm tra nhanh số dòng mỗi bảng */
SELECT 'NGUOI_DUNG' AS bang, COUNT(*) AS so_dong FROM NGUOI_DUNG UNION ALL
SELECT 'KHACH_HANG', COUNT(*) FROM KHACH_HANG UNION ALL
SELECT 'NHAN_VIEN', COUNT(*) FROM NHAN_VIEN UNION ALL
SELECT 'QUAN_TRI_VIEN', COUNT(*) FROM QUAN_TRI_VIEN UNION ALL
SELECT 'DANH_MUC', COUNT(*) FROM DANH_MUC UNION ALL
SELECT 'SAN_PHAM', COUNT(*) FROM SAN_PHAM UNION ALL
SELECT 'MA_GIAM_GIA', COUNT(*) FROM MA_GIAM_GIA UNION ALL
SELECT 'GIO_HANG', COUNT(*) FROM GIO_HANG UNION ALL
SELECT 'CHI_TIET_GIO_HANG', COUNT(*) FROM CHI_TIET_GIO_HANG UNION ALL
SELECT 'DON_HANG', COUNT(*) FROM DON_HANG UNION ALL
SELECT 'CHI_TIET_DON_HANG', COUNT(*) FROM CHI_TIET_DON_HANG UNION ALL
SELECT 'THANH_TOAN', COUNT(*) FROM THANH_TOAN UNION ALL
SELECT 'VAN_CHUYEN', COUNT(*) FROM VAN_CHUYEN UNION ALL
SELECT 'DANH_GIA', COUNT(*) FROM DANH_GIA;
GO
