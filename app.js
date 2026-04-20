// URL Web App GAS Anda setelah di-deploy
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVUGRXk3b-JEBc86Gu_BZ4oep1CR6dMcISknFtSYrNJCMadYvGenMq-ZJPAlqFa73fLQ/exec';
let cart = [];

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
            // Lazy loading diterapkan pada tag <img>
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
        // Lanjut ke Kalkulasi & Finalisasi
        processCheckout();
    }
}

// === TAHAP 3 & 4: KALKULASI, TRANSAKSI, DAN WA BRIDGE ===
function processCheckout() {
    // Pada skenario nyata, ini akan diarahkan ke halaman checkout/ringkasan
    // untuk menghitung ongkir via API RajaOngkir sebelum ke WA.
    
    let totalHarga = 0;
    let pesanWA = "Halo Admin DEINSA, saya ingin memesan:\n\n";
    
    cart.forEach((item, index) => {
        pesanWA += `${index + 1}. ${item.nama} - Rp ${item.harga.toLocaleString('id-ID')}\n`;
        totalHarga += item.harga;
    });

    pesanWA += `\n*Total Harga: Rp ${totalHarga.toLocaleString('id-ID')}*\n(Belum termasuk ongkir)\n\nMohon info ongkos kirim dan rekening pembayaran. Terima kasih.`;
    
    // Encode pesan untuk URL
    const encodedPesan = encodeURIComponent(pesanWA);
    const nomorAdmin = "6289686000405"; // Ganti dengan nomor WA Admin

    // Backup riwayat ke GAS (Background process)
    saveOrderHistory(cart, totalHarga);

    // Buka WhatsApp
    window.open(`https://wa.me/${nomorAdmin}?text=${encodedPesan}`, '_blank');
    
    // Kosongkan keranjang setelah checkout
    cart = [];
    localStorage.removeItem('tempCart');
    document.getElementById('cartCount').innerText = 0;
}

function saveOrderHistory(items, total) {
    // POST request ke GAS untuk backup data (Silent request)
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', // Penting agar tidak terblokir CORS pada GitHub Pages
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            orderId: 'ORD-' + Math.floor(Math.random() * 1000000),
            nama: localStorage.getItem('user_name') || 'Guest',
            items: items,
            total: total
        })
    }).catch(error => console.error("Gagal menyimpan riwayat:", error));
}
// Variabel global untuk ongkir
let currentOngkir = 0;
let subtotalCart = 0;
// Asumsi berat pukul rata 500 gram per item (Bisa disesuaikan nanti)
const beratPerItem = 500; 

// OVERRIDE: Ubah fungsi processCheckout yang lama agar membuka Modal
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

// === FUNGSI RAJAONGKIR (VIA GAS PROXY) ===

async function loadProvinces() {
    document.getElementById('provinsiSelect').innerHTML = '<option>Memuat provinsi...</option>';
    try {
        const response = await fetch(GAS_URL + '?action=provinces');
        const data = await response.json();
        const provinces = data.rajaongkir.results;
        
        let html = '<option value="">Pilih Provinsi...</option>';
        provinces.forEach(prov => { html += `<option value="${prov.province_id}">${prov.province}</option>`; });
        document.getElementById('provinsiSelect').innerHTML = html;
    } catch(e) { console.error("Error load province", e); }
}

async function loadCities() {
    const provId = document.getElementById('provinsiSelect').value;
    const kotaSelect = document.getElementById('kotaSelect');
    
    if(!provId) { kotaSelect.disabled = true; return; }
    
    kotaSelect.disabled = false;
    kotaSelect.innerHTML = '<option>Memuat kota...</option>';
    
    try {
        const response = await fetch(GAS_URL + `?action=cities&provId=${provId}`);
        const data = await response.json();
        const cities = data.rajaongkir.results;
        
        let html = '<option value="">Pilih Kota/Kabupaten...</option>';
        cities.forEach(city => { html += `<option value="${city.city_id}">${city.type} ${city.city_name}</option>`; });
        kotaSelect.innerHTML = html;
    } catch(e) { console.error("Error load city", e); }
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

    document.getElementById('ongkirLoading').style.display = 'block';
    document.getElementById('btnKirimWA').disabled = true;

    try {
        const response = await fetch(GAS_URL + `?action=cost&destination=${destId}&weight=${totalWeight}&courier=${courier}`);
        const data = await response.json();
        
        // Mengambil tarif pertama (REG/Reguler)
        const costData = data.rajaongkir.results[0].costs[0]; 
        currentOngkir = costData.cost[0].value;
        const estHari = costData.cost[0].etd;
        
        document.getElementById('ongkirDisplay').innerText = currentOngkir.toLocaleString('id-ID') + ` (${estHari} hari)`;
        
        // Update Grand Total
        const grandTotal = subtotalCart + currentOngkir;
        document.getElementById('grandTotalDisplay').innerText = grandTotal.toLocaleString('id-ID');
        
        document.getElementById('btnKirimWA').disabled = false;
    } catch(e) { 
        alert("Gagal menghitung ongkir. Coba kurir lain.");
    } finally {
        document.getElementById('ongkirLoading').style.display = 'none';
    }
}

// === FINALISASI PESANAN ===
function finalizeOrderWA() {
    const alamat = document.getElementById('alamatLengkap').value;
    const kotaNama = document.getElementById('kotaSelect').options[document.getElementById('kotaSelect').selectedIndex].text;
    const provNama = document.getElementById('provinsiSelect').options[document.getElementById('provinsiSelect').selectedIndex].text;
    const kurir = document.getElementById('kurirSelect').value.toUpperCase();
    const grandTotal = subtotalCart + currentOngkir;
    
    if(!alamat) { alert("Mohon lengkapi alamat jalan/detail!"); return; }

    const userName = localStorage.getItem('user_name') || 'Pelanggan';
    
    let pesanWA = `Halo Admin DEINSA, saya *${userName}* ingin memesan:\n\n`;
    cart.forEach((item, index) => {
        pesanWA += `${index + 1}. ${item.nama} - Rp ${item.harga.toLocaleString('id-ID')}\n`;
    });
    
    pesanWA += `\n*Subtotal: Rp ${subtotalCart.toLocaleString('id-ID')}*\n`;
    pesanWA += `*Ongkir (${kurir}): Rp ${currentOngkir.toLocaleString('id-ID')}*\n`;
    pesanWA += `*TOTAL BAYAR: Rp ${grandTotal.toLocaleString('id-ID')}*\n\n`;
    pesanWA += `*Alamat Pengiriman:*\n${alamat}\n${kotaNama}, ${provNama}\n\n`;
    pesanWA += `Mohon info rekening pembayaran. Terima kasih.`;
    
    const nomorAdmin = "6289686000405"; // Ganti Nomor Anda
    window.open(`https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesanWA)}`, '_blank');
    
    // Backup ke Sheet
    saveOrderHistory(cart, grandTotal);
    
    // Reset
    cart = [];
    localStorage.removeItem('tempCart');
    document.getElementById('cartCount').innerText = 0;
    closeModal();
}
