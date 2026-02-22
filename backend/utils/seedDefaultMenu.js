/**
 * Utility untuk seed kategori dan menu default ke tenant baru
 * Dipanggil otomatis saat setup tenant agar dashboard tidak kosong
 */

const seedDefaultMenu = async (tenantDB, tenantId) => {
  try {
    console.log('[SEED MENU] Memulai seeding kategori dan menu default...');

    // Load models
    const CategoryModel = tenantDB.model('Category', require('../models/Category').schema);
    const MenuItemModel = tenantDB.model('MenuItem', require('../models/MenuItem').schema);

    // Cek apakah sudah ada data
    const existingCategories = await CategoryModel.countDocuments();
    const existingMenuItems = await MenuItemModel.countDocuments();

    if (existingCategories > 0 || existingMenuItems > 0) {
      console.log('[SEED MENU] Data menu sudah ada, skip seeding');
      return {
        success: true,
        skipped: true,
        message: 'Data menu sudah ada'
      };
    }

    // Data kategori default
    const defaultCategories = [
      { id: 'cat-coffee', name: 'Kopi', emoji: '☕', order: 1 },
      { id: 'cat-noncoffee', name: 'Non Kopi', emoji: '🥤', order: 2 },
      { id: 'cat-food', name: 'Makanan', emoji: '🍔', order: 3 },
      { id: 'cat-snack', name: 'Snack', emoji: '🍪', order: 4 }
    ];

    // Insert kategori dengan tenantId
    const categories = await CategoryModel.insertMany(
      defaultCategories.map(cat => ({
        ...cat,
        tenantId: tenantId,
        createdAt: new Date()
      }))
    );

    console.log(`[SEED MENU] ✓ ${categories.length} kategori berhasil dibuat`);

    // Data menu default
    const defaultMenuItems = [
      // Kopi
      { id: 'menu-espresso', name: 'Espresso', categoryId: 'cat-coffee', price: 15000, description: 'Kopi espresso klasik' },
      { id: 'menu-americano', name: 'Americano', categoryId: 'cat-coffee', price: 18000, description: 'Espresso dengan air panas' },
      { id: 'menu-cappuccino', name: 'Cappuccino', categoryId: 'cat-coffee', price: 22000, description: 'Espresso dengan susu dan foam' },
      { id: 'menu-latte', name: 'Cafe Latte', categoryId: 'cat-coffee', price: 25000, description: 'Espresso dengan susu steamed' },
      
      // Non Kopi
      { id: 'menu-tea', name: 'Teh Manis', categoryId: 'cat-noncoffee', price: 8000, description: 'Teh manis segar' },
      { id: 'menu-juice', name: 'Jus Jeruk', categoryId: 'cat-noncoffee', price: 15000, description: 'Jus jeruk segar' },
      { id: 'menu-chocolate', name: 'Chocolate', categoryId: 'cat-noncoffee', price: 20000, description: 'Cokelat panas' },
      
      // Makanan
      { id: 'menu-sandwich', name: 'Sandwich', categoryId: 'cat-food', price: 25000, description: 'Sandwich isi ayam' },
      { id: 'menu-nasi-goreng', name: 'Nasi Goreng', categoryId: 'cat-food', price: 20000, description: 'Nasi goreng spesial' },
      
      // Snack
      { id: 'menu-fries', name: 'French Fries', categoryId: 'cat-snack', price: 15000, description: 'Kentang goreng crispy' },
      { id: 'menu-cookies', name: 'Cookies', categoryId: 'cat-snack', price: 10000, description: 'Cookies cokelat chip' }
    ];

    // Insert menu dengan tenantId
    const menuItems = await MenuItemModel.insertMany(
      defaultMenuItems.map(item => ({
        ...item,
        tenantId: tenantId,
        is_active: true,
        use_stock_check: false, // Default tidak cek stok untuk menu awal
        order: 0,
        label: 'none'
      }))
    );

    console.log(`[SEED MENU] ✓ ${menuItems.length} menu berhasil dibuat`);

    return {
      success: true,
      categoriesCount: categories.length,
      menuItemsCount: menuItems.length,
      message: 'Seeding menu default berhasil'
    };

  } catch (error) {
    console.error('[SEED MENU ERROR]', error);
    throw error;
  }
};

module.exports = { seedDefaultMenu };
