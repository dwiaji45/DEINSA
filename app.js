// URL Web App GAS Anda setelah di-deploy (Pastikan URL ini yang terbaru!)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVUGRXk3b-JEBc86Gu_BZ4oep1CR6dMcISknFtSYrNJCMadYvGenMq-ZJPAlqFa73fLQ/exec';
let cart = [];

// === TAHAP 1: SINKRONISASI PRODUK ===
document.addEventListener("DOMContentLoaded", () => {
    // Cek jika ada keranjang tersimpan di localStorage (misal setelah user diarahkan balik dari halaman login)
    const savedCart = localStorage.getItem('tempCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.innerText = cart.length;
        }
    }
    
    // Fetch produk HANYA jika elemen productContainer ada (mencegah error di halaman Home/Tentang Kami/Kontak)
    if (document.getElementById('productContainer')) {
        fetchProducts();
    }
});

async function fetchProducts() {
    try {
        const response = await fetch(GAS_URL);
        const products = await response.json();
        
        // Sembunyikan Skeleton, Tampilkan Kontainer Asli
        const skeletonContainer = document.getElementById('skeletonContainer');
        if (skeletonContainer) skeletonContainer.style.display = 'none';
        
        const productContainer = document.getElementById('productContainer');
        if (productContainer) {
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
        }

    } catch (error) {
        console.error("Gagal mengambil data dari GAS:", error);
        alert("Terjadi kesalahan memuat katalog. Silakan refresh halaman.");
    }
}

function addToCart(nama, harga) {
    cart.push({ nama, harga });
    
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.innerText = cart.length;
    }
    
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
        // Lanjut ke Checkout WhatsApp
        checkoutLangsungKeWA();
    }
}

// === TAHAP 3: CHECKOUT LANGSUNG KE WHATSAPP ===
function checkoutLangsungKeWA() {
    const subtotalCart = cart.reduce((sum, item) => sum + item.harga, 0);
    const nomorAdmin = "6289686000405"; // Nomor WhatsApp Admin DEINSA
    const userName = localStorage.getItem('user_name') || 'Pelanggan';
    
    let pesanWA = `*HALO DEINSA, SAYA MAU ORDER* 🛍️\n`;
    pesanWA += `--------------------------------\n`;
    pesanWA += `Nama: ${userName}\n\n`;
    pesanWA += `*Pesanan Saya:*\n`;
    
    cart.forEach((item, index) => {
        pesanWA += `${index + 1}. ${item.nama} - Rp ${item.harga.toLocaleString('id-ID')}\n`;
    });
    
    pesanWA += `--------------------------------\n`;
    pesanWA += `*Total Harga Barang: Rp ${subtotalCart.toLocaleString('id-ID')}*\n\n`;
    pesanWA += `Mohon dibantu cek ongkir dan total tagihannya ya Min. Terima kasih!`;

    // Buka WhatsApp di tab atau aplikasi baru
    window.open(`https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesanWA)}`, '_blank');
    
    // Selesai, reset keranjang
    cart = [];
    localStorage.removeItem('tempCart');
    
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.innerText = 0;
    }
}
