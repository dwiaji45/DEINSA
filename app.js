// URL Web App GAS Anda setelah di-deploy (Pastikan URL ini yang terbaru!)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVUGRXk3b-JEBc86Gu_BZ4oep1CR6dMcISknFtSYrNJCMadYvGenMq-ZJPAlqFa73fLQ/exec';
let cart = [];

// Variabel Global untuk Kalkulasi
let currentOngkir = 0;
let subtotalCart = 0;
const beratPerItem = 500; // Asumsi berat pukul rata 500 gram per item
let activeOrderId = ""; // Untuk menyimpan ID pesanan sementara

// === TAHAP 1: SINKRONISASI PRODUK ===
document.addEventListener("DOMContentLoaded", () => {
    fetchProducts();
});

async function fetchProducts() {
    try {
        const response = await fetch(GAS_URL);
        const products = await response.json();
        
        // Sembunyikan Skeleton, Tampilkan Kontainer Asli
        document.getElementById('skeletonContainer').style.display = 'none';
        const productContainer = document.getElementById('productContainer');
        productContainer.style.display = 'grid';

        // Render Produk
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${product.GambarURL}" alt="${product.Nama}" loading="lazy">
                <div class="card-content">
                    <p class="card-title">${product.Nama}</p>
                    <p class="card-price">Rp ${parseInt(product.Harga).toLocaleString('id-ID')}</p>
                    <button class="btn-checkout" style="width: 100%;" onclick="addToCart('${product.Nama}', ${product.Harga})">Tambah ke Keranjang</button>
                </div>
            `;
            productContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Gagal mengambil data dari GAS:", error);
        alert("Terjadi kesalahan memuat katalog. Silakan refresh halaman.");
    }
}

function addToCart(nama, harga) {
    cart.push({ nama, harga });
    document.getElementById('cartCount').innerText = cart.length;
    // Simpan status keranjang sementara untuk mencegah kehilangan data jika dialihkan ke login
    localStorage.setItem('tempCart', JSON.stringify(cart));
}

// === TAHAP 2: VALIDASI AUTENTIKASI (MIDDLEWARE) ===
function handleCheckoutMiddleware() {
    if (cart.length === 0) {
        alert("Keranjang Anda masih kosong.");
        return;
    }

    const userToken = localStorage.getItem('user_token');
    
    if (!userToken) {
        // Redirect ke login jika belum ada token
        alert("Silakan masuk/login terlebih dahulu untuk melanjutkan.");
        window.location.href = 'login.html'; 
    } else {
        // Lanjut ke Kalkulasi & Finalisasi Modal
        processCheckout();
    }
}

// === TAHAP 3: KALKULASI & TAMPILAN MODAL CHECKOUT ===
function processCheckout() {
    subtotalCart = cart.reduce((sum, item) => sum + item.harga, 0);
    document.getElementById('subtotalDisplay').innerText = subtotalCart.toLocaleString('id-ID');
    document.getElementById('grandTotalDisplay').innerText = subtotalCart.toLocaleString('id-ID');
    
    // Render list barang di modal
    const cartList = document.getElementById('cartItemsList');
    cartList.innerHTML = cart.map(item => `<div>- ${item.nama} (Rp ${item.harga.toLocaleString('id-ID')})</div>`).join('');
    
    // Tampilkan Modal
    document.getElementById('checkoutModal').style.display = 'flex';
    
    // Tarik data Provinsi dari GAS saat modal dibuka pertama kali
    if(document.getElementById('provinsiSelect').options.length <= 1) {
        loadProvinces();
    }
}

function closeModal() {
    document.getElementById('checkoutModal').style.display = 'none';
}

// === FUNGSI RAJAONGKIR (VIA GAS PROXY) DENGAN ANTI-CACHE ===
async function loadProvinces() {
    document.getElementById('provinsiSelect').innerHTML = '<option>Memuat provinsi...</option>';
    try {
        const noCache = new Date().getTime();
        const response = await fetch(GAS_URL + '?action=provinces&t=' + noCache);
        const data = await response.json();
        
        // Pengecekan keamanan: Jika GAS belum di-deploy ulang, data.rajaongkir tidak akan ada
        if (!data.rajaongkir) {
            throw new Error("Format respons salah. Browser masih membaca cache lama atau GAS belum di-deploy sebagai 'New Version'.");
        }

        const provinces = data.rajaongkir.results;
        let html = '<option value="">Pilih Provinsi...</option>';
        provinces.forEach(prov => { html += `<option value="${prov.province_id}">${prov.province}</option>`; });
        document.getElementById('provinsiSelect').innerHTML = html;
    } catch(e) { 
        console.error("Error load province", e); 
        document.getElementById('provinsiSelect').innerHTML = '<option value="">Gagal memuat. Coba lagi.</option>';
        alert("Gagal memuat provinsi! Terjadi masalah cache atau URL GAS salah.");
    }
}

async function loadCities() {
    const provId = document.getElementById('provinsiSelect').value;
    const kotaSelect = document.getElementById('kotaSelect');
    
    if(!provId) { kotaSelect.disabled = true; return; }
    
    kotaSelect.disabled = false;
    kotaSelect.innerHTML = '<option>Memuat kota...</option>';
    
    try {
        const noCache = new Date().getTime();
        const response = await fetch(GAS_URL + `?action=cities&provId=${provId}&t=${noCache}`);
        const data = await response.json();
        const cities = data.rajaongkir.results;
        
        let html = '<option value="">Pilih Kota/Kabupaten...</option>';
        cities.forEach(city => { html += `<option value="${city.city_id}">${city.type} ${city.city_name}</option>`; });
        kotaSelect.innerHTML = html;
    } catch(e) { 
        console.error("Error load city", e); 
    }
}

function enableCourier() {
    if(document.getElementById('kotaSelect').value) {
        document.getElementById('kurirSelect').disabled = false;
    }
}

async function checkShippingCost() {
    const destId = document.getElementById('kotaSelect').value;
    const courier = document.getElementById('kurirSelect').value;
    const totalWeight = cart.length * beratPerItem; 
    
    if(!destId || !courier) return;

    const btnBayar = document.getElementById('btnBayarSekarang');
    btnBayar.innerText = "Menghitung Ongkir...";
    btnBayar.disabled = true;

    try {
        const noCache = new Date().getTime();
        const response = await fetch(GAS_URL + `?action=cost&destination=${destId}&weight=${totalWeight}&courier=${courier}&t=${noCache}`);
        const data = await response.json();
        
        // Mengambil tarif pertama (REG/Reguler)
        const costData = data.rajaongkir.results[0].costs[0]; 
        currentOngkir = costData.cost[0].value;
        const estHari = costData.cost[0].etd;
        
        document.getElementById('ongkirDisplay').innerText = currentOngkir.toLocaleString('id-ID') + ` (${estHari} hari)`;
        
        // Update Grand Total
        const grandTotal = subtotalCart + currentOngkir;
        document.getElementById('grandTotalDisplay').innerText = grandTotal.toLocaleString('id-ID');
        
        btnBayar.innerText = "PROSES PEMBAYARAN";
        btnBayar.disabled = false;
    } catch(e) { 
        console.error(e);
        alert("Gagal menghitung ongkir. Coba kurir lain.");
        btnBayar.innerText = "PROSES PEMBAYARAN";
        // Tombol dibiarkan disabled karena ongkir gagal dikalkulasi
    }
}

// === TAHAP 4: PEMBAYARAN QRIS & WHATSAPP ===
async function generatePaymentQRIS() {
    const alamat = document.getElementById('alamatLengkap').value;
    const kotaNama = document.getElementById('kotaSelect').options[document.getElementById('kotaSelect').selectedIndex].text;
    const provNama = document.getElementById('provinsiSelect').options[document.getElementById('provinsiSelect').selectedIndex].text;
    const grandTotal = subtotalCart + currentOngkir;

    if (!alamat || alamat.length < 10) {
        alert("Mohon isi alamat lengkap (minimal 10 karakter).");
        return;
    }

    // Tampilkan loading pada tombol
    const btn = document.getElementById('btnBayarSekarang');
    btn.innerText = "Menciptakan QRIS...";
    btn.disabled = true;

    const payload = {
        action: 'checkout',
        nama: localStorage.getItem('user_name') || 'Pelanggan',
        items: cart,
        total: grandTotal,
        alamat: `${alamat}, ${kotaNama}, ${provNama}`
    };

    try {
        // Kirim data ke GAS (doPost)
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if (result.status === 'success') {
            activeOrderId = result.orderId;
            // Tampilkan Gambar QRIS
            document.getElementById('qrisImage').src = result.qrisUrl;
            
            // Switch Tampilan Modal
            document.getElementById('checkoutFormStep').style.display = 'none';
            document.getElementById('qrisDisplaySection').style.display = 'block';
        } else {
            alert("Gagal membuat QRIS. Silakan coba lagi.");
            btn.innerText = "PROSES PEMBAYARAN";
            btn.disabled = false;
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Terjadi gangguan koneksi ke server.");
        btn.innerText = "PROSES PEMBAYARAN";
        btn.disabled = false;
    }
}

function finalizeToWA() {
    const grandTotal = subtotalCart + currentOngkir;
    const nomorAdmin = "6289686000405"; // GANTI DENGAN NOMOR WA ANDA
    
    let pesanWA = `*KONFIRMASI PEMBAYARAN DEINSA*\n`;
    pesanWA += `--------------------------------\n`;
    pesanWA += `Order ID: ${activeOrderId}\n`;
    pesanWA += `Nama: ${localStorage.getItem('user_name')}\n`;
    pesanWA += `Total: *Rp ${grandTotal.toLocaleString('id-ID')}*\n`;
    pesanWA += `Status: *Sudah Scan QRIS*\n\n`;
    pesanWA += `Mohon segera diproses ya Min. Terima kasih!`;

    window.open(`https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesanWA)}`, '_blank');
    
    // Selesai, reset keranjang
    cart = [];
    localStorage.removeItem('tempCart');
    document.getElementById('cartCount').innerText = 0;
    location.reload(); // Refresh halaman untuk membersihkan status
}
