/* =====================================================================
   NPK-SHOP - CƠ SỞ DỮ LIỆU SQL SERVER (T-SQL)
   File 1/2: Tạo Database + Bảng + Ràng buộc
   Chạy trong SSMS (F5) hoặc: npm run db:init
   ---------------------------------------------------------------------
   Đã sửa so với bản gốc:
   - AUTO_INCREMENT (MySQL)  -> IDENTITY(1,1) (SQL Server)
   - ENUM(...) (MySQL)       -> VARCHAR + CHECK (...)
   - TEXT / VARCHAR tiếng Việt -> NVARCHAR (lưu được dấu tiếng Việt)
   - Tạo bảng cha trước bảng con (NGUOI_DUNG, KHACH_HANG, NHAN_VIEN,
     DANH_MUC, SAN_PHAM ... trước DON_HANG) để khóa ngoại không lỗi
   - Bổ sung các bảng có trong ERD: NGUOI_DUNG, QUAN_TRI_VIEN, NHAN_VIEN,
     KHACH_HANG, DANH_MUC, SAN_PHAM, GIO_HANG, CHI_TIET_GIO_HANG, DANH_GIA
   - UNIQUE cho cột cho phép NULL (ma_van_don) dùng filtered index
   ===================================================================== */

IF DB_ID(N'NPK') IS NULL
    CREATE DATABASE NPK;
GO

USE [NPK];
GO

/* Xóa bảng cũ (theo thứ tự con -> cha) để có thể chạy lại script */
IF OBJECT_ID(N'dbo.DANH_GIA', N'U')          IS NOT NULL DROP TABLE dbo.DANH_GIA;
IF OBJECT_ID(N'dbo.VAN_CHUYEN', N'U')        IS NOT NULL DROP TABLE dbo.VAN_CHUYEN;
IF OBJECT_ID(N'dbo.THANH_TOAN', N'U')        IS NOT NULL DROP TABLE dbo.THANH_TOAN;
IF OBJECT_ID(N'dbo.CHI_TIET_DON_HANG', N'U') IS NOT NULL DROP TABLE dbo.CHI_TIET_DON_HANG;
IF OBJECT_ID(N'dbo.DON_HANG', N'U')          IS NOT NULL DROP TABLE dbo.DON_HANG;
IF OBJECT_ID(N'dbo.CHI_TIET_GIO_HANG', N'U') IS NOT NULL DROP TABLE dbo.CHI_TIET_GIO_HANG;
IF OBJECT_ID(N'dbo.GIO_HANG', N'U')          IS NOT NULL DROP TABLE dbo.GIO_HANG;
IF OBJECT_ID(N'dbo.MA_GIAM_GIA', N'U')       IS NOT NULL DROP TABLE dbo.MA_GIAM_GIA;
IF OBJECT_ID(N'dbo.SAN_PHAM', N'U')          IS NOT NULL DROP TABLE dbo.SAN_PHAM;
IF OBJECT_ID(N'dbo.DANH_MUC', N'U')          IS NOT NULL DROP TABLE dbo.DANH_MUC;
IF OBJECT_ID(N'dbo.KHACH_HANG', N'U')        IS NOT NULL DROP TABLE dbo.KHACH_HANG;
IF OBJECT_ID(N'dbo.NHAN_VIEN', N'U')         IS NOT NULL DROP TABLE dbo.NHAN_VIEN;
IF OBJECT_ID(N'dbo.QUAN_TRI_VIEN', N'U')     IS NOT NULL DROP TABLE dbo.QUAN_TRI_VIEN;
IF OBJECT_ID(N'dbo.NGUOI_DUNG', N'U')        IS NOT NULL DROP TABLE dbo.NGUOI_DUNG;
GO

/* ===================== NGƯỜI DÙNG & KẾ THỪA ===================== */
CREATE TABLE NGUOI_DUNG (
    ma_nguoi_dung   INT IDENTITY(1,1) PRIMARY KEY,
    ho_ten          NVARCHAR(100) NOT NULL,
    email           VARCHAR(100)  NOT NULL UNIQUE,     -- dùng làm tên đăng nhập
    mat_khau        VARCHAR(255)  NOT NULL,
    so_dien_thoai   VARCHAR(15)   NULL,
    vai_tro         VARCHAR(20)   NOT NULL DEFAULT 'KHACH_HANG'
                    CHECK (vai_tro IN ('KHACH_HANG', 'NHAN_VIEN', 'ADMIN')),
    trang_thai      BIT           NOT NULL DEFAULT 1,  -- 1: hoạt động, 0: khóa
    ngay_tao        DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE QUAN_TRI_VIEN (
    ma_quan_tri     INT PRIMARY KEY,
    FOREIGN KEY (ma_quan_tri) REFERENCES NGUOI_DUNG(ma_nguoi_dung) ON DELETE CASCADE
);

CREATE TABLE NHAN_VIEN (
    ma_nhan_vien    INT PRIMARY KEY,                   -- = ma_nguoi_dung
    ma_so_nhan_vien VARCHAR(20)   NOT NULL UNIQUE,
    bo_phan         NVARCHAR(100) NULL,
    FOREIGN KEY (ma_nhan_vien) REFERENCES NGUOI_DUNG(ma_nguoi_dung) ON DELETE CASCADE
);

CREATE TABLE KHACH_HANG (
    ma_khach_hang     INT PRIMARY KEY,                 -- = ma_nguoi_dung
    dia_chi_giao_hang NVARCHAR(255) NULL,
    diem_tich_luy     INT           NOT NULL DEFAULT 0,
    hang_thanh_vien   NVARCHAR(50)  NOT NULL DEFAULT N'Hạng Đồng',
    FOREIGN KEY (ma_khach_hang) REFERENCES NGUOI_DUNG(ma_nguoi_dung) ON DELETE CASCADE
);

/* ===================== DANH MỤC & SẢN PHẨM ===================== */
CREATE TABLE DANH_MUC (
    ma_danh_muc  INT IDENTITY(1,1) PRIMARY KEY,
    ten_danh_muc NVARCHAR(100) NOT NULL UNIQUE,
    mo_ta        NVARCHAR(255) NULL
);

CREATE TABLE SAN_PHAM (
    ma_san_pham      INT IDENTITY(1,1) PRIMARY KEY,
    ma_danh_muc      INT            NOT NULL,
    ma_sku           VARCHAR(30)    NOT NULL UNIQUE,
    ten_san_pham     NVARCHAR(200)  NOT NULL,
    gia_ban          DECIMAL(14, 2) NOT NULL CHECK (gia_ban >= 0),
    so_luong_ton_kho INT            NOT NULL DEFAULT 0 CHECK (so_luong_ton_kho >= 0),
    da_ban           INT            NOT NULL DEFAULT 0,
    hinh_anh         VARCHAR(50)    NOT NULL DEFAULT 'headphone', -- mã icon SVG trên giao diện
    thong_so         NVARCHAR(255)  NULL,
    mo_ta            NVARCHAR(MAX)  NULL,
    dang_ban         BIT            NOT NULL DEFAULT 1,           -- 0 = đã xóa (xóa mềm, giữ lịch sử đơn)
    ngay_tao         DATETIME       NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ma_danh_muc) REFERENCES DANH_MUC(ma_danh_muc)
);

/* ===================== MÃ GIẢM GIÁ ===================== */
CREATE TABLE MA_GIAM_GIA (
    ma_giam_gia    INT IDENTITY(1,1) PRIMARY KEY,
    ma_code        VARCHAR(30)    NOT NULL UNIQUE,
    loai_giam      VARCHAR(10)    NOT NULL DEFAULT 'PERCENT'
                   CHECK (loai_giam IN ('PERCENT', 'FIXED')),
    phan_tram_giam DECIMAL(5, 2)  NOT NULL DEFAULT 0,   -- dùng khi loai_giam = PERCENT
    so_tien_giam   DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- dùng khi loai_giam = FIXED
    giam_toi_da    DECIMAL(12, 2) NOT NULL DEFAULT 0,
    don_toi_thieu  DECIMAL(12, 2) NOT NULL DEFAULT 0,
    mo_ta          NVARCHAR(255)  NULL,
    ngay_het_han   DATETIME       NOT NULL,
    dang_hoat_dong BIT            NOT NULL DEFAULT 1
);

/* ===================== GIỎ HÀNG ===================== */
CREATE TABLE GIO_HANG (
    ma_gio_hang   INT IDENTITY(1,1) PRIMARY KEY,
    ma_khach_hang INT NOT NULL UNIQUE,                 -- mỗi khách 1 giỏ (1-1)
    tong_tien     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    FOREIGN KEY (ma_khach_hang) REFERENCES KHACH_HANG(ma_khach_hang) ON DELETE CASCADE
);

CREATE TABLE CHI_TIET_GIO_HANG (
    ma_ct_gio_hang INT IDENTITY(1,1) PRIMARY KEY,
    ma_gio_hang    INT NOT NULL,
    ma_san_pham    INT NOT NULL,
    so_luong       INT NOT NULL CHECK (so_luong > 0),
    don_gia        DECIMAL(12, 2) NOT NULL,
    CONSTRAINT UQ_GIO_SP UNIQUE (ma_gio_hang, ma_san_pham),
    FOREIGN KEY (ma_gio_hang) REFERENCES GIO_HANG(ma_gio_hang) ON DELETE CASCADE,
    FOREIGN KEY (ma_san_pham) REFERENCES SAN_PHAM(ma_san_pham)
);

/* ===================== ĐƠN HÀNG ===================== */
CREATE TABLE DON_HANG (
    ma_don_hang        INT IDENTITY(1001,1) PRIMARY KEY,   -- hiển thị: 'DH' + ma_don_hang
    ma_khach_hang      INT NOT NULL,
    ma_nhan_vien_duyet INT NULL,
    ma_giam_gia        INT NULL,
    ngay_dat           DATETIME NOT NULL DEFAULT GETDATE(),
    trang_thai         VARCHAR(20) NOT NULL DEFAULT 'CHO_XAC_NHAN'
                       CHECK (trang_thai IN ('CHO_XAC_NHAN', 'DA_THANH_TOAN', 'DA_XAC_NHAN',
                                             'DANG_GIAO', 'HOAN_THANH', 'DA_HUY')),
    ten_nguoi_nhan     NVARCHAR(100) NOT NULL,
    sdt_nguoi_nhan     VARCHAR(15)   NOT NULL,
    dia_chi_giao       NVARCHAR(500) NOT NULL,
    tong_tien_hang     DECIMAL(14, 2) NOT NULL,
    tien_giam          DECIMAL(14, 2) NOT NULL DEFAULT 0,
    tong_thanh_toan    DECIMAL(14, 2) NOT NULL,
    FOREIGN KEY (ma_khach_hang)      REFERENCES KHACH_HANG(ma_khach_hang),
    FOREIGN KEY (ma_nhan_vien_duyet) REFERENCES NHAN_VIEN(ma_nhan_vien),
    FOREIGN KEY (ma_giam_gia)        REFERENCES MA_GIAM_GIA(ma_giam_gia) ON DELETE SET NULL
);

CREATE TABLE CHI_TIET_DON_HANG (
    ma_ct_don_hang INT IDENTITY(1,1) PRIMARY KEY,
    ma_don_hang    INT NOT NULL,
    ma_san_pham    INT NOT NULL,
    ten_san_pham   NVARCHAR(200) NOT NULL,             -- lưu tên tại thời điểm mua
    so_luong       INT NOT NULL CHECK (so_luong > 0),
    don_gia_mua    DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (ma_don_hang) REFERENCES DON_HANG(ma_don_hang) ON DELETE CASCADE,
    FOREIGN KEY (ma_san_pham) REFERENCES SAN_PHAM(ma_san_pham)
);

CREATE TABLE THANH_TOAN (
    ma_thanh_toan   INT IDENTITY(1,1) PRIMARY KEY,
    ma_don_hang     INT NOT NULL UNIQUE,
    phuong_thuc     VARCHAR(20) NOT NULL
                    CHECK (phuong_thuc IN ('COD', 'VNPAY', 'MOMO', 'THE_NGAN_HANG')),
    trang_thai      VARCHAR(20) NOT NULL DEFAULT 'CHO_THANH_TOAN'
                    CHECK (trang_thai IN ('CHO_THANH_TOAN', 'THANH_CONG', 'THAT_BAI', 'HOAN_TIEN')),
    so_tien         DECIMAL(14, 2) NOT NULL,
    ma_giao_dich    VARCHAR(100) NULL,
    ngay_thanh_toan DATETIME NULL,
    FOREIGN KEY (ma_don_hang) REFERENCES DON_HANG(ma_don_hang) ON DELETE CASCADE
);

CREATE TABLE VAN_CHUYEN (
    ma_van_chuyen     INT IDENTITY(1,1) PRIMARY KEY,
    ma_don_hang       INT NOT NULL UNIQUE,
    don_vi_van_chuyen NVARCHAR(50) NOT NULL,
    ma_van_don        VARCHAR(50) NULL,
    phi_van_chuyen    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    trang_thai        VARCHAR(50) NOT NULL DEFAULT 'CHO_LAY_HANG',
    FOREIGN KEY (ma_don_hang) REFERENCES DON_HANG(ma_don_hang) ON DELETE CASCADE
);
-- UNIQUE nhưng cho phép nhiều dòng NULL (đơn chưa có mã vận đơn)
CREATE UNIQUE INDEX UX_VAN_CHUYEN_MA_VAN_DON ON VAN_CHUYEN(ma_van_don) WHERE ma_van_don IS NOT NULL;

/* ===================== ĐÁNH GIÁ ===================== */
CREATE TABLE DANH_GIA (
    ma_danh_gia   INT IDENTITY(1,1) PRIMARY KEY,
    ma_khach_hang INT NOT NULL,
    ma_san_pham   INT NOT NULL,
    so_sao        INT NOT NULL CHECK (so_sao BETWEEN 1 AND 5),
    noi_dung      NVARCHAR(1000) NULL,
    ngay_danh_gia DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ma_khach_hang) REFERENCES KHACH_HANG(ma_khach_hang) ON DELETE CASCADE,
    FOREIGN KEY (ma_san_pham)   REFERENCES SAN_PHAM(ma_san_pham) ON DELETE CASCADE
);
GO
