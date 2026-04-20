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
    const nomorAdmin = "6281234567890"; // Ganti dengan nomor WA Admin

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
