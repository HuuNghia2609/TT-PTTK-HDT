/**
 * NPK-SHOP - Web server (Express) + REST API kết nối SQL Server (database NPK)
 * Chạy: npm start  ->  http://localhost:3000
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const crypto = require('crypto');
const express = require('express');
const { sql, getPool, runSqlFile, SERVER, DB_NAME, AUTH } = require('./db');

const app = express();
app.use(express.json({ limit: '1mb' }));
// Chỉ phục vụ file giao diện (không mở cả thư mục để tránh lộ .env / mã nguồn server)
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'npk-shop-secret';
const SHIPPING_FEES = { 'Giao Hàng Nhanh': 30000, 'Giao Hàng Tiết Kiệm': 25000 };
const PAYMENT_METHODS = ['COD', 'VNPAY', 'MOMO', 'THE_NGAN_HANG'];

/* ============================ TIỆN ÍCH ============================ */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '');
const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
const toISO = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : null);
const orderCode = (n) => 'DH' + n;
const parseOrderId = (s) => {
  const n = Number(String(s).replace(/^DH/i, ''));
  if (!Number.isInteger(n)) throw new HttpError(400, 'Mã đơn hàng không hợp lệ');
  return n;
};
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- Token đăng nhập (HMAC, không cần lưu session trên server) ---------- */
function signToken(userId) {
  const payload = `${userId}.${Date.now() + 7 * 24 * 3600 * 1000}`;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}
function verifyToken(token) {
  try {
    const [id, exp, sig] = Buffer.from(token, 'base64url').toString().split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(`${id}.${exp}`).digest('hex');
    if (!sig || sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    if (Number(exp) < Date.now()) return null;
    return Number(id);
  } catch { return null; }
}

/* ============================ TRUY VẤN DỮ LIỆU ============================ */
const USER_SELECT = `
  SELECT nd.ma_nguoi_dung, nd.ho_ten, nd.email, nd.so_dien_thoai, nd.vai_tro, nd.trang_thai,
         kh.dia_chi_giao_hang, kh.hang_thanh_vien, kh.diem_tich_luy,
         nv.bo_phan, CASE WHEN kh.ma_khach_hang IS NULL THEN 0 ELSE 1 END AS la_khach_hang
  FROM NGUOI_DUNG nd
  LEFT JOIN KHACH_HANG kh ON kh.ma_khach_hang = nd.ma_nguoi_dung
  LEFT JOIN NHAN_VIEN  nv ON nv.ma_nhan_vien  = nd.ma_nguoi_dung`;

function mapUser(r) {
  let tier = r.hang_thanh_vien;
  if (r.vai_tro === 'ADMIN') tier = 'Quản trị viên Hệ thống';
  else if (r.vai_tro === 'NHAN_VIEN') tier = r.bo_phan ? `Nhân viên ${r.bo_phan}` : 'Nhân viên Vận hành';
  return {
    id: r.ma_nguoi_dung,
    ho_ten: r.ho_ten,
    email: r.email,
    so_dien_thoai: r.so_dien_thoai || '',
    dia_chi: r.dia_chi_giao_hang || '',
    vai_tro: r.vai_tro,
    hang_thanh_vien: tier || 'Khách hàng',
    diem_tich_luy: r.diem_tich_luy || 0,
    trang_thai: !!r.trang_thai,
    isCustomer: !!r.la_khach_hang,
  };
}

async function getUserById(id) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`${USER_SELECT} WHERE nd.ma_nguoi_dung = @id`);
  return r.recordset[0] ? mapUser(r.recordset[0]) : null;
}

async function getCategories() {
  const pool = await getPool();
  const r = await pool.request().query('SELECT ten_danh_muc FROM DANH_MUC ORDER BY ma_danh_muc');
  return r.recordset.map((x) => x.ten_danh_muc);
}

async function getProducts() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT sp.*, dm.ten_danh_muc FROM SAN_PHAM sp
    JOIN DANH_MUC dm ON dm.ma_danh_muc = sp.ma_danh_muc
    WHERE sp.dang_ban = 1 ORDER BY sp.ma_san_pham`);
  return r.recordset.map((p) => ({
    id: p.ma_san_pham,
    sku: p.ma_sku,
    name: p.ten_san_pham,
    category: p.ten_danh_muc,
    price: Number(p.gia_ban),
    stock: p.so_luong_ton_kho,
    sold: p.da_ban,
    icon: p.hinh_anh,
    specs: p.thong_so || '',
    desc: p.mo_ta || '',
  }));
}

async function getReviews() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT dg.*, nd.ho_ten FROM DANH_GIA dg
    JOIN NGUOI_DUNG nd ON nd.ma_nguoi_dung = dg.ma_khach_hang
    ORDER BY dg.ngay_danh_gia DESC, dg.ma_danh_gia DESC`);
  return r.recordset.map((x) => ({
    id: x.ma_danh_gia,
    productId: x.ma_san_pham,
    userId: x.ma_khach_hang,
    userName: x.ho_ten,
    rating: x.so_sao,
    comment: x.noi_dung || '',
    date: fmtDate(x.ngay_danh_gia),
  }));
}

function mapVoucher(v) {
  const fixed = v.loai_giam === 'FIXED';
  return {
    id: v.ma_giam_gia,
    code: v.ma_code,
    type: fixed ? 'fixed' : 'percent',
    value: fixed ? Number(v.so_tien_giam) : Number(v.phan_tram_giam),
    maxDiscount: Number(v.giam_toi_da),
    minOrder: Number(v.don_toi_thieu),
    desc: v.mo_ta || '',
    expiry: fmtDate(v.ngay_het_han),
    expired: v.ngay_het_han < new Date(),
  };
}

async function getVouchers(includeExpired = false) {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT * FROM MA_GIAM_GIA
    WHERE dang_hoat_dong = 1 ${includeExpired ? '' : 'AND ngay_het_han >= GETDATE()'}
    ORDER BY ma_giam_gia`);
  return r.recordset.map(mapVoucher);
}

async function getOrders(customerId = null) {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (customerId) { where = 'WHERE dh.ma_khach_hang = @kh'; req.input('kh', sql.Int, customerId); }
  const r = await req.query(`
    SELECT dh.*, tt.phuong_thuc, tt.trang_thai AS tt_trang_thai, tt.ma_giao_dich,
           vc.don_vi_van_chuyen, vc.ma_van_don, vc.phi_van_chuyen, vc.trang_thai AS vc_trang_thai,
           mg.ma_code, nv.ho_ten AS ten_nv_duyet
    FROM DON_HANG dh
    LEFT JOIN THANH_TOAN  tt ON tt.ma_don_hang = dh.ma_don_hang
    LEFT JOIN VAN_CHUYEN  vc ON vc.ma_don_hang = dh.ma_don_hang
    LEFT JOIN MA_GIAM_GIA mg ON mg.ma_giam_gia = dh.ma_giam_gia
    LEFT JOIN NGUOI_DUNG  nv ON nv.ma_nguoi_dung = dh.ma_nhan_vien_duyet
    ${where}
    ORDER BY dh.ngay_dat DESC, dh.ma_don_hang DESC`);
  const orders = r.recordset;
  if (orders.length === 0) return [];

  const ids = orders.map((o) => o.ma_don_hang).join(',');
  const items = await pool.request().query(
    `SELECT * FROM CHI_TIET_DON_HANG WHERE ma_don_hang IN (${ids}) ORDER BY ma_ct_don_hang`);
  const byOrder = {};
  for (const it of items.recordset) {
    (byOrder[it.ma_don_hang] = byOrder[it.ma_don_hang] || []).push({
      productId: it.ma_san_pham, name: it.ten_san_pham, qty: it.so_luong, price: Number(it.don_gia_mua),
    });
  }
  return orders.map((o) => ({
    id: orderCode(o.ma_don_hang),
    orderNo: o.ma_don_hang,
    userId: o.ma_khach_hang,
    customerName: o.ten_nguoi_nhan,
    phone: o.sdt_nguoi_nhan,
    address: o.dia_chi_giao,
    date: fmtDateTime(o.ngay_dat),
    dateISO: toISO(o.ngay_dat),
    items: byOrder[o.ma_don_hang] || [],
    shippingPartner: o.don_vi_van_chuyen || '',
    shippingFee: Number(o.phi_van_chuyen || 0),
    subtotal: Number(o.tong_tien_hang),
    discount: Number(o.tien_giam),
    totalAmount: Number(o.tong_thanh_toan),
    voucherCode: o.ma_code || '',
    paymentMethod: o.phuong_thuc || 'COD',
    paymentStatus: o.tt_trang_thai || '',
    transactionId: o.ma_giao_dich || '',
    status: o.trang_thai,
    trackingCode: o.ma_van_don || '',
    shippingStatus: o.vc_trang_thai || '',
    approvedBy: o.ten_nv_duyet || '',
  }));
}

async function getAccounts() {
  const pool = await getPool();
  const r = await pool.request().query(`${USER_SELECT} ORDER BY nd.ma_nguoi_dung`);
  return r.recordset.map(mapUser);
}

async function getCart(customerId) {
  const pool = await getPool();
  const r = await pool.request().input('kh', sql.Int, customerId).query(`
    SELECT ct.ma_san_pham, ct.so_luong FROM CHI_TIET_GIO_HANG ct
    JOIN GIO_HANG g ON g.ma_gio_hang = ct.ma_gio_hang
    JOIN SAN_PHAM sp ON sp.ma_san_pham = ct.ma_san_pham AND sp.dang_ban = 1
    WHERE g.ma_khach_hang = @kh ORDER BY ct.ma_ct_gio_hang`);
  return r.recordset.map((x) => ({ productId: x.ma_san_pham, quantity: x.so_luong }));
}

/* ============================ MIDDLEWARE XÁC THỰC ============================ */
const authOptional = wrap(async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.user = null;
  if (token) {
    const id = verifyToken(token);
    if (id) {
      const u = await getUserById(id);
      if (u && u.trang_thai) req.user = u;
    }
    if (!req.user) req.invalidToken = true;
  }
  next();
});
const requireAuth = (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'));
  next();
};
const requireStaff = (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Vui lòng đăng nhập.'));
  if (!['NHAN_VIEN', 'ADMIN'].includes(req.user.vai_tro)) return next(new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.'));
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Vui lòng đăng nhập.'));
  if (req.user.vai_tro !== 'ADMIN') return next(new HttpError(403, 'Chỉ Quản trị viên mới được thực hiện thao tác này.'));
  next();
};

app.use('/api', authOptional);

/* ============================ API: DỮ LIỆU TỔNG ============================ */
app.get('/api/health', wrap(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query('SELECT DB_NAME() AS db, @@SERVERNAME AS server, GETDATE() AS now');
  res.json({ ok: true, ...r.recordset[0] });
}));

app.get('/api/state', wrap(async (req, res) => {
  const u = req.user;
  const isStaff = u && ['NHAN_VIEN', 'ADMIN'].includes(u.vai_tro);
  const [categories, products, reviews, vouchers] = await Promise.all([
    getCategories(), getProducts(), getReviews(), getVouchers(),
  ]);
  const data = { categories, products, reviews, vouchers, user: u, invalidToken: !!req.invalidToken, orders: [], cart: [], accounts: [] };
  if (u) {
    data.orders = isStaff ? await getOrders() : await getOrders(u.id);
    if (u.isCustomer) data.cart = await getCart(u.id);
    if (u.vai_tro === 'ADMIN') {
      data.accounts = await getAccounts();
      data.allVouchers = await getVouchers(true);
    }
  }
  res.json(data);
}));

/* ============================ API: TÀI KHOẢN ============================ */
app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const pool = await getPool();
  const r = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query('SELECT ma_nguoi_dung, mat_khau FROM NGUOI_DUNG WHERE LOWER(email) = @email');
  const row = r.recordset[0];
  if (!row || row.mat_khau !== password) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác!');
  const user = await getUserById(row.ma_nguoi_dung);
  if (!user.trang_thai) throw new HttpError(403, 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ Quản trị viên.');
  if (req.body.staffOnly && !['NHAN_VIEN', 'ADMIN'].includes(user.vai_tro)) {
    throw new HttpError(403, 'Từ chối truy cập! Tài khoản Khách hàng không có quyền vào Cổng Quản lý.');
  }
  res.json({ token: signToken(user.id), user, cart: user.isCustomer ? await getCart(user.id) : [] });
}));

app.post('/api/auth/check-email', wrap(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('email', sql.VarChar(100), String(req.body.email || '').trim().toLowerCase())
    .query('SELECT COUNT(*) AS c FROM NGUOI_DUNG WHERE LOWER(email) = @email');
  res.json({ exists: r.recordset[0].c > 0 });
}));

async function createCustomer({ ho_ten, email, password, so_dien_thoai, dia_chi, hang = 'Hạng Đồng' }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ins = await new sql.Request(tx)
      .input('ho_ten', sql.NVarChar(100), ho_ten)
      .input('email', sql.VarChar(100), email)
      .input('mk', sql.VarChar(255), password)
      .input('sdt', sql.VarChar(15), so_dien_thoai || null)
      .query(`INSERT INTO NGUOI_DUNG (ho_ten, email, mat_khau, so_dien_thoai, vai_tro)
              OUTPUT INSERTED.ma_nguoi_dung VALUES (@ho_ten, @email, @mk, @sdt, 'KHACH_HANG')`);
    const id = ins.recordset[0].ma_nguoi_dung;
    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('dc', sql.NVarChar(255), dia_chi || null)
      .input('hang', sql.NVarChar(50), hang)
      .query(`INSERT INTO KHACH_HANG (ma_khach_hang, dia_chi_giao_hang, hang_thanh_vien) VALUES (@id, @dc, @hang);
              INSERT INTO GIO_HANG (ma_khach_hang) VALUES (@id);`);
    await tx.commit();
    return id;
  } catch (e) {
    await tx.rollback();
    if (e.number === 2627 || e.number === 2601) throw new HttpError(409, 'Email này đã được đăng ký trong hệ thống!');
    throw e;
  }
}

app.post('/api/auth/register', wrap(async (req, res) => {
  const b = req.body;
  const data = {
    ho_ten: String(b.ho_ten || '').trim(),
    email: String(b.email || '').trim().toLowerCase(),
    password: String(b.password || ''),
    so_dien_thoai: String(b.so_dien_thoai || '').trim(),
    dia_chi: String(b.dia_chi || '').trim(),
  };
  if (!data.ho_ten || !data.email || data.password.length < 6) throw new HttpError(400, 'Vui lòng nhập đủ thông tin (mật khẩu tối thiểu 6 ký tự).');
  const id = await createCustomer(data);
  res.json({ token: signToken(id), user: await getUserById(id), cart: [] });
}));

app.post('/api/auth/google', wrap(async (req, res) => {
  const email = 'google.user@eshop.vn';
  const pool = await getPool();
  const r = await pool.request().input('email', sql.VarChar(100), email).query('SELECT ma_nguoi_dung FROM NGUOI_DUNG WHERE email = @email');
  let id = r.recordset[0] && r.recordset[0].ma_nguoi_dung;
  if (!id) {
    id = await createCustomer({
      ho_ten: 'Khách hàng Google', email, password: 'social_login_' + crypto.randomBytes(6).toString('hex'),
      so_dien_thoai: '0908777666', dia_chi: '227 Nguyễn Văn Cừ, Quận 5, TP.HCM', hang: 'Hạng Bạc',
    });
  }
  const user = await getUserById(id);
  if (!user.trang_thai) throw new HttpError(403, 'Tài khoản này đang bị khóa.');
  res.json({ token: signToken(id), user, cart: await getCart(id) });
}));

/* ============================ API: GIỎ HÀNG ============================ */
app.put('/api/cart', requireAuth, wrap(async (req, res) => {
  if (!req.user.isCustomer) return res.json({ ok: true, cart: [] });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    let g = await new sql.Request(tx).input('kh', sql.Int, req.user.id).query('SELECT ma_gio_hang FROM GIO_HANG WHERE ma_khach_hang = @kh');
    let gioId = g.recordset[0] && g.recordset[0].ma_gio_hang;
    if (!gioId) {
      g = await new sql.Request(tx).input('kh', sql.Int, req.user.id).query('INSERT INTO GIO_HANG (ma_khach_hang) OUTPUT INSERTED.ma_gio_hang VALUES (@kh)');
      gioId = g.recordset[0].ma_gio_hang;
    }
    await new sql.Request(tx).input('g', sql.Int, gioId).query('DELETE FROM CHI_TIET_GIO_HANG WHERE ma_gio_hang = @g');
    const seen = new Set();
    for (const it of items) {
      const pid = Number(it.productId), qty = Number(it.quantity);
      if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty <= 0 || seen.has(pid)) continue;
      seen.add(pid);
      await new sql.Request(tx).input('g', sql.Int, gioId).input('sp', sql.Int, pid).input('sl', sql.Int, qty).query(`
        INSERT INTO CHI_TIET_GIO_HANG (ma_gio_hang, ma_san_pham, so_luong, don_gia)
        SELECT @g, ma_san_pham, @sl, gia_ban FROM SAN_PHAM WHERE ma_san_pham = @sp AND dang_ban = 1`);
    }
    await new sql.Request(tx).input('g', sql.Int, gioId).query(`
      UPDATE GIO_HANG SET tong_tien = ISNULL((SELECT SUM(so_luong * don_gia) FROM CHI_TIET_GIO_HANG WHERE ma_gio_hang = @g), 0)
      WHERE ma_gio_hang = @g`);
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
  res.json({ ok: true, cart: await getCart(req.user.id) });
}));

/* ============================ API: ĐÁNH GIÁ ============================ */
app.post('/api/reviews', requireAuth, wrap(async (req, res) => {
  if (!req.user.isCustomer) throw new HttpError(403, 'Chỉ tài khoản Khách hàng mới được gửi đánh giá.');
  const rating = Number(req.body.rating), productId = Number(req.body.productId);
  const comment = String(req.body.comment || '').trim();
  if (!(rating >= 1 && rating <= 5) || !comment) throw new HttpError(400, 'Vui lòng chọn số sao và nhập nhận xét.');
  const pool = await getPool();
  await pool.request()
    .input('kh', sql.Int, req.user.id).input('sp', sql.Int, productId)
    .input('sao', sql.Int, rating).input('nd', sql.NVarChar(1000), comment)
    .query('INSERT INTO DANH_GIA (ma_khach_hang, ma_san_pham, so_sao, noi_dung) VALUES (@kh, @sp, @sao, @nd)');
  res.json({ ok: true });
}));

/* ============================ API: ĐƠN HÀNG ============================ */
app.post('/api/orders', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  if (!u.isCustomer) throw new HttpError(403, 'Chỉ tài khoản Khách hàng mới được đặt hàng.');
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const address = String(req.body.address || '').trim();
  const shippingPartner = SHIPPING_FEES[req.body.shippingPartner] !== undefined ? req.body.shippingPartner : 'Giao Hàng Nhanh';
  const shippingFee = SHIPPING_FEES[shippingPartner];
  const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'COD';
  const voucherCode = String(req.body.voucherCode || '').trim().toUpperCase();
  if (!name || !phone || !address) throw new HttpError(400, 'Vui lòng nhập đầy đủ Họ tên, Số điện thoại và Địa chỉ nhận hàng.');

  // Gộp số lượng theo sản phẩm
  const qtyMap = new Map();
  for (const it of req.body.items || []) {
    const pid = Number(it.productId), q = Number(it.qty ?? it.quantity);
    if (Number.isInteger(pid) && Number.isInteger(q) && q > 0) qtyMap.set(pid, (qtyMap.get(pid) || 0) + q);
  }
  if (qtyMap.size === 0) throw new HttpError(400, 'Giỏ hàng của bạn đang trống.');

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // 1. Kiểm tra tồn kho (khóa dòng để tránh bán vượt)
    const lines = [];
    let subtotal = 0;
    for (const [pid, qty] of qtyMap) {
      const r = await new sql.Request(tx).input('id', sql.Int, pid).query(
        'SELECT ma_san_pham, ten_san_pham, gia_ban, so_luong_ton_kho FROM SAN_PHAM WITH (UPDLOCK, ROWLOCK) WHERE ma_san_pham = @id AND dang_ban = 1');
      const p = r.recordset[0];
      if (!p || p.so_luong_ton_kho < qty) {
        throw new HttpError(409, `Sản phẩm "${p ? p.ten_san_pham : '#' + pid}" vừa hết hàng hoặc không đủ số lượng tồn!`);
      }
      const price = Number(p.gia_ban);
      subtotal += price * qty;
      lines.push({ pid, qty, price, name: p.ten_san_pham });
    }

    // 2. Mã giảm giá
    let discount = 0, voucherId = null;
    if (voucherCode) {
      const vr = await new sql.Request(tx).input('c', sql.VarChar(30), voucherCode).query(
        'SELECT * FROM MA_GIAM_GIA WHERE ma_code = @c AND dang_hoat_dong = 1 AND ngay_het_han >= GETDATE()');
      const v = vr.recordset[0];
      if (!v) throw new HttpError(400, 'Mã giảm giá không tồn tại hoặc đã hết hạn.');
      if (subtotal < Number(v.don_toi_thieu)) throw new HttpError(400, `Mã ${v.ma_code} yêu cầu đơn tối thiểu ${Number(v.don_toi_thieu).toLocaleString('vi-VN')} đ.`);
      discount = v.loai_giam === 'FIXED'
        ? Number(v.so_tien_giam)
        : Math.min((subtotal * Number(v.phan_tram_giam)) / 100, Number(v.giam_toi_da));
      discount = Math.round(Math.min(discount, subtotal));
      voucherId = v.ma_giam_gia;
    }
    const total = Math.max(0, subtotal + shippingFee - discount);
    const status = paymentMethod === 'COD' ? 'CHO_XAC_NHAN' : 'DA_THANH_TOAN';

    // 3. Tạo đơn hàng
    const ins = await new sql.Request(tx)
      .input('kh', sql.Int, u.id).input('mg', sql.Int, voucherId)
      .input('tt', sql.VarChar(20), status)
      .input('ten', sql.NVarChar(100), name).input('sdt', sql.VarChar(15), phone)
      .input('dc', sql.NVarChar(500), address)
      .input('tienhang', sql.Decimal(14, 2), subtotal).input('giam', sql.Decimal(14, 2), discount)
      .input('tong', sql.Decimal(14, 2), total)
      .query(`INSERT INTO DON_HANG (ma_khach_hang, ma_giam_gia, trang_thai, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_giao, tong_tien_hang, tien_giam, tong_thanh_toan)
              OUTPUT INSERTED.ma_don_hang
              VALUES (@kh, @mg, @tt, @ten, @sdt, @dc, @tienhang, @giam, @tong)`);
    const orderId = ins.recordset[0].ma_don_hang;

    // 4. Chi tiết đơn + trừ kho + tăng đã bán
    for (const l of lines) {
      await new sql.Request(tx)
        .input('dh', sql.Int, orderId).input('sp', sql.Int, l.pid).input('ten', sql.NVarChar(200), l.name)
        .input('sl', sql.Int, l.qty).input('gia', sql.Decimal(12, 2), l.price)
        .query(`INSERT INTO CHI_TIET_DON_HANG (ma_don_hang, ma_san_pham, ten_san_pham, so_luong, don_gia_mua) VALUES (@dh, @sp, @ten, @sl, @gia);
                UPDATE SAN_PHAM SET so_luong_ton_kho = so_luong_ton_kho - @sl, da_ban = da_ban + @sl WHERE ma_san_pham = @sp;`);
    }

    // 5. Thanh toán + Vận chuyển
    const online = paymentMethod !== 'COD';
    await new sql.Request(tx)
      .input('dh', sql.Int, orderId).input('pt', sql.VarChar(20), paymentMethod)
      .input('tt', sql.VarChar(20), online ? 'THANH_CONG' : 'CHO_THANH_TOAN')
      .input('tien', sql.Decimal(14, 2), total)
      .input('gd', sql.VarChar(100), online ? `${paymentMethod}${Date.now()}` : null)
      .input('dvvc', sql.NVarChar(50), shippingPartner).input('phi', sql.Decimal(10, 2), shippingFee)
      .query(`INSERT INTO THANH_TOAN (ma_don_hang, phuong_thuc, trang_thai, so_tien, ma_giao_dich, ngay_thanh_toan)
              VALUES (@dh, @pt, @tt, @tien, @gd, CASE WHEN @tt = 'THANH_CONG' THEN GETDATE() END);
              INSERT INTO VAN_CHUYEN (ma_don_hang, don_vi_van_chuyen, phi_van_chuyen) VALUES (@dh, @dvvc, @phi);`);

    // 6. Làm trống giỏ hàng
    await new sql.Request(tx).input('kh', sql.Int, u.id).query(`
      DELETE ct FROM CHI_TIET_GIO_HANG ct JOIN GIO_HANG g ON g.ma_gio_hang = ct.ma_gio_hang WHERE g.ma_khach_hang = @kh;
      UPDATE GIO_HANG SET tong_tien = 0 WHERE ma_khach_hang = @kh;`);

    await tx.commit();
    res.json({ ok: true, orderId: orderCode(orderId) });
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}));

async function loadOrderForUpdate(tx, orderId) {
  const r = await new sql.Request(tx).input('id', sql.Int, orderId).query(`
    SELECT dh.*, vc.don_vi_van_chuyen, tt.phuong_thuc, tt.trang_thai AS tt_trang_thai
    FROM DON_HANG dh WITH (UPDLOCK)
    LEFT JOIN VAN_CHUYEN vc ON vc.ma_don_hang = dh.ma_don_hang
    LEFT JOIN THANH_TOAN tt ON tt.ma_don_hang = dh.ma_don_hang
    WHERE dh.ma_don_hang = @id`);
  if (!r.recordset[0]) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
  return r.recordset[0];
}

async function withTx(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

// Hủy đơn: Khách (chỉ đơn của mình, trạng thái Chờ xác nhận) hoặc Nhân viên/Admin
app.post('/api/orders/:id/cancel', requireAuth, wrap(async (req, res) => {
  const orderId = parseOrderId(req.params.id);
  const isStaff = ['NHAN_VIEN', 'ADMIN'].includes(req.user.vai_tro);
  await withTx(async (tx) => {
    const o = await loadOrderForUpdate(tx, orderId);
    if (!isStaff) {
      if (o.ma_khach_hang !== req.user.id) throw new HttpError(403, 'Bạn không thể hủy đơn hàng của người khác.');
      if (o.trang_thai !== 'CHO_XAC_NHAN') throw new HttpError(400, 'Chỉ được hủy đơn đang ở trạng thái Chờ xác nhận.');
    } else if (!['CHO_XAC_NHAN', 'DA_THANH_TOAN', 'DA_XAC_NHAN'].includes(o.trang_thai)) {
      throw new HttpError(400, 'Đơn hàng này không thể hủy ở trạng thái hiện tại.');
    }
    await new sql.Request(tx).input('id', sql.Int, orderId).query(`
      UPDATE sp SET sp.so_luong_ton_kho = sp.so_luong_ton_kho + ct.so_luong,
                    sp.da_ban = CASE WHEN sp.da_ban >= ct.so_luong THEN sp.da_ban - ct.so_luong ELSE 0 END
      FROM SAN_PHAM sp JOIN CHI_TIET_DON_HANG ct ON ct.ma_san_pham = sp.ma_san_pham
      WHERE ct.ma_don_hang = @id;
      UPDATE DON_HANG SET trang_thai = 'DA_HUY' WHERE ma_don_hang = @id;
      UPDATE THANH_TOAN SET trang_thai = CASE WHEN trang_thai = 'THANH_CONG' THEN 'HOAN_TIEN' ELSE 'THAT_BAI' END WHERE ma_don_hang = @id;
      UPDATE VAN_CHUYEN SET trang_thai = 'DA_HUY' WHERE ma_don_hang = @id;`);
  });
  res.json({ ok: true });
}));

// Duyệt & giao: sinh mã vận đơn
app.post('/api/orders/:id/ship', requireStaff, wrap(async (req, res) => {
  const orderId = parseOrderId(req.params.id);
  const tracking = await withTx(async (tx) => {
    const o = await loadOrderForUpdate(tx, orderId);
    if (!['CHO_XAC_NHAN', 'DA_THANH_TOAN', 'DA_XAC_NHAN'].includes(o.trang_thai)) throw new HttpError(400, 'Đơn hàng không ở trạng thái chờ duyệt.');
    const prefix = (o.don_vi_van_chuyen || '').includes('Tiết Kiệm') ? 'GHTK' : 'GHN';
    let code;
    for (let i = 0; i < 10; i++) {
      code = prefix + Math.floor(100000 + Math.random() * 899999);
      const dup = await new sql.Request(tx).input('c', sql.VarChar(50), code).query('SELECT 1 AS x FROM VAN_CHUYEN WHERE ma_van_don = @c');
      if (!dup.recordset.length) break;
    }
    const nv = await new sql.Request(tx).input('u', sql.Int, req.user.id).query('SELECT ma_nhan_vien FROM NHAN_VIEN WHERE ma_nhan_vien = @u');
    await new sql.Request(tx)
      .input('id', sql.Int, orderId).input('c', sql.VarChar(50), code)
      .input('nv', sql.Int, nv.recordset[0] ? req.user.id : null)
      .query(`UPDATE DON_HANG SET trang_thai = 'DANG_GIAO', ma_nhan_vien_duyet = @nv WHERE ma_don_hang = @id;
              UPDATE VAN_CHUYEN SET ma_van_don = @c, trang_thai = 'DANG_VAN_CHUYEN' WHERE ma_don_hang = @id;`);
    return code;
  });
  res.json({ ok: true, trackingCode: tracking });
}));

// Hoàn thành đơn
app.post('/api/orders/:id/complete', requireStaff, wrap(async (req, res) => {
  const orderId = parseOrderId(req.params.id);
  await withTx(async (tx) => {
    const o = await loadOrderForUpdate(tx, orderId);
    if (o.trang_thai !== 'DANG_GIAO') throw new HttpError(400, 'Chỉ hoàn thành được đơn đang giao.');
    await new sql.Request(tx).input('id', sql.Int, orderId).input('kh', sql.Int, o.ma_khach_hang)
      .input('diem', sql.Int, Math.floor(Number(o.tong_thanh_toan) / 10000))
      .query(`UPDATE DON_HANG SET trang_thai = 'HOAN_THANH' WHERE ma_don_hang = @id;
              UPDATE VAN_CHUYEN SET trang_thai = 'DA_GIAO' WHERE ma_don_hang = @id;
              UPDATE THANH_TOAN SET trang_thai = 'THANH_CONG', ngay_thanh_toan = ISNULL(ngay_thanh_toan, GETDATE())
                WHERE ma_don_hang = @id AND trang_thai = 'CHO_THANH_TOAN';
              UPDATE KHACH_HANG SET diem_tich_luy = diem_tich_luy + @diem WHERE ma_khach_hang = @kh;`);
  });
  res.json({ ok: true });
}));

/* ============================ API: SẢN PHẨM (Nhân viên + Admin) ============================ */
async function getCategoryId(tx, name) {
  const r = await new sql.Request(tx).input('n', sql.NVarChar(100), name).query('SELECT ma_danh_muc FROM DANH_MUC WHERE ten_danh_muc = @n');
  if (r.recordset[0]) return r.recordset[0].ma_danh_muc;
  const ins = await new sql.Request(tx).input('n', sql.NVarChar(100), name).query('INSERT INTO DANH_MUC (ten_danh_muc) OUTPUT INSERTED.ma_danh_muc VALUES (@n)');
  return ins.recordset[0].ma_danh_muc;
}

function readProductBody(b) {
  const p = {
    name: String(b.name || '').trim(),
    sku: String(b.sku || '').trim().toUpperCase(),
    category: String(b.category || '').trim(),
    price: Number(b.price),
    stock: Number(b.stock),
    icon: String(b.icon || 'headphone'),
    desc: String(b.desc || '').trim(),
    specs: b.specs !== undefined ? String(b.specs).trim() : null,
  };
  if (!p.name || !p.sku || !p.category || !p.desc || !(p.price >= 0) || !Number.isInteger(p.stock) || p.stock < 0) {
    throw new HttpError(400, 'Lỗi E1: Vui lòng nhập đầy đủ và hợp lệ tất cả trường bắt buộc (*)!');
  }
  return p;
}

function productRequest(tx, p) {
  return new sql.Request(tx)
    .input('ten', sql.NVarChar(200), p.name).input('sku', sql.VarChar(30), p.sku)
    .input('gia', sql.Decimal(14, 2), p.price).input('ton', sql.Int, p.stock)
    .input('icon', sql.VarChar(50), p.icon).input('mota', sql.NVarChar(sql.MAX), p.desc)
    .input('ts', sql.NVarChar(255), p.specs);
}

function skuError(e) {
  if (e.number === 2627 || e.number === 2601) return new HttpError(409, 'Mã SKU này đã tồn tại, vui lòng chọn mã khác!');
  return e;
}

app.post('/api/products', requireStaff, wrap(async (req, res) => {
  const p = readProductBody(req.body);
  try {
    await withTx(async (tx) => {
      const dm = await getCategoryId(tx, p.category);
      await productRequest(tx, p).input('dm', sql.Int, dm).query(`
        INSERT INTO SAN_PHAM (ma_danh_muc, ma_sku, ten_san_pham, gia_ban, so_luong_ton_kho, hinh_anh, thong_so, mo_ta)
        VALUES (@dm, @sku, @ten, @gia, @ton, @icon, ISNULL(@ts, N'Hàng chính hãng • Bảo hành tiêu chuẩn 12 tháng'), @mota)`);
    });
  } catch (e) { throw skuError(e); }
  res.json({ ok: true });
}));

app.put('/api/products/:id', requireStaff, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const p = readProductBody(req.body);
  try {
    await withTx(async (tx) => {
      const dm = await getCategoryId(tx, p.category);
      const r = await productRequest(tx, p).input('dm', sql.Int, dm).input('id', sql.Int, id).query(`
        UPDATE SAN_PHAM SET ma_danh_muc = @dm, ma_sku = @sku, ten_san_pham = @ten, gia_ban = @gia,
               so_luong_ton_kho = @ton, hinh_anh = @icon, mo_ta = @mota, thong_so = ISNULL(@ts, thong_so)
        WHERE ma_san_pham = @id AND dang_ban = 1`);
      if (!r.rowsAffected[0]) throw new HttpError(404, 'Không tìm thấy sản phẩm.');
    });
  } catch (e) { throw skuError(e); }
  res.json({ ok: true });
}));

// Xóa mềm: giữ lại lịch sử đơn hàng đã mua sản phẩm này
app.delete('/api/products/:id', requireStaff, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await withTx(async (tx) => {
    await new sql.Request(tx).input('id', sql.Int, id).query(`
      DELETE FROM CHI_TIET_GIO_HANG WHERE ma_san_pham = @id;
      UPDATE SAN_PHAM SET dang_ban = 0, ma_sku = LEFT(ma_sku + '#DEL' + CAST(@id AS VARCHAR(10)), 30) WHERE ma_san_pham = @id;`);
  });
  res.json({ ok: true });
}));

/* ============================ API: VOUCHER (Admin) ============================ */
app.post('/api/vouchers', requireAdmin, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const type = req.body.type === 'percent' ? 'PERCENT' : 'FIXED';
  const value = Number(req.body.value), maxDiscount = Number(req.body.maxDiscount || 0);
  const minOrder = Number(req.body.minOrder || 0);
  if (!code || !(value > 0) || (type === 'PERCENT' && value > 100)) throw new HttpError(400, 'Thông tin voucher không hợp lệ.');
  const fmt = (n) => Number(n).toLocaleString('vi-VN') + ' đ';
  const desc = type === 'FIXED' ? `Giảm ${fmt(value)}` : `Giảm ${value}%, tối đa ${fmt(maxDiscount)}`;
  const pool = await getPool();
  try {
    await pool.request()
      .input('c', sql.VarChar(30), code).input('loai', sql.VarChar(10), type)
      .input('pt', sql.Decimal(5, 2), type === 'PERCENT' ? value : 0)
      .input('tien', sql.Decimal(12, 2), type === 'FIXED' ? value : 0)
      .input('max', sql.Decimal(12, 2), type === 'FIXED' ? (maxDiscount || value) : maxDiscount)
      .input('min', sql.Decimal(12, 2), minOrder)
      .input('mota', sql.NVarChar(255), desc)
      .query(`INSERT INTO MA_GIAM_GIA (ma_code, loai_giam, phan_tram_giam, so_tien_giam, giam_toi_da, don_toi_thieu, mo_ta, ngay_het_han)
              VALUES (@c, @loai, @pt, @tien, @max, @min, @mota, DATEADD(MONTH, 6, GETDATE()))`);
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) throw new HttpError(409, 'Mã voucher này đã tồn tại!');
    throw e;
  }
  res.json({ ok: true });
}));

app.delete('/api/vouchers/:code', requireAdmin, wrap(async (req, res) => {
  const pool = await getPool();
  await pool.request().input('c', sql.VarChar(30), String(req.params.code).toUpperCase())
    .query('DELETE FROM MA_GIAM_GIA WHERE ma_code = @c');
  res.json({ ok: true });
}));

/* ============================ API: QUẢN LÝ TÀI KHOẢN (Admin) ============================ */
app.post('/api/accounts/:id/toggle', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'Không thể tự khóa tài khoản đang đăng nhập.');
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    UPDATE NGUOI_DUNG SET trang_thai = 1 - trang_thai OUTPUT INSERTED.trang_thai, INSERTED.email WHERE ma_nguoi_dung = @id`);
  if (!r.recordset[0]) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  res.json({ ok: true, trang_thai: !!r.recordset[0].trang_thai, email: r.recordset[0].email });
}));

// Khôi phục dữ liệu mẫu: chạy lại database/02_seed.sql
app.post('/api/admin/reset', requireAdmin, wrap(async (req, res) => {
  await runSqlFile(path.join(__dirname, 'database', '02_seed.sql'), 'master');
  res.json({ ok: true });
}));

/* ============================ XỬ LÝ LỖI ============================ */
app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[API ERROR]', err);
  const message = status >= 500 ? `Lỗi máy chủ / CSDL: ${err.message}` : err.message;
  res.status(status).json({ message });
});

app.listen(PORT, async () => {
  console.log(`\n NPK-SHOP đang chạy tại: http://localhost:${PORT}`);
  console.log(`   Trang quản lý:         http://localhost:${PORT}/#admin`);
  console.log(` SQL Server: ${SERVER} | Database: ${DB_NAME} | Auth: ${AUTH}`);
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT COUNT(*) AS c FROM SAN_PHAM');
    console.log(` Kết nối CSDL thành công (${r.recordset[0].c} sản phẩm).\n`);
  } catch (e) {
    console.error(` KHÔNG kết nối được CSDL: ${e.message}`);
    console.error(' -> Kiểm tra file .env và chạy "npm run db:init" để tạo database.\n');
  }
});
