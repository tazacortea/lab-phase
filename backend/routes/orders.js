const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');
const ORDERS_FILE = path.join(__dirname, '..', 'data', 'orders.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// POST /api/orders  { name, email, address, items: [{id, qty}] }
router.post('/', (req, res) => {
  const { name, email, address, items } = req.body;

  if (!name || !email || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informations de commande incomplètes.' });
  }

  const products = readJSON(PRODUCTS_FILE);
  let total = 0;
  const orderItems = [];

  for (const item of items) {
    const product = products.find(p => p.id === Number(item.id));
    if (!product) {
      return res.status(400).json({ error: `Produit ${item.id} introuvable.` });
    }
    if (product.stock < item.qty) {
      return res.status(400).json({ error: `Stock insuffisant pour "${product.name}".` });
    }
    total += product.price * item.qty;
    orderItems.push({ id: product.id, name: product.name, price: product.price, qty: item.qty });
  }

  // Décrémente le stock
  for (const item of items) {
    const product = products.find(p => p.id === Number(item.id));
    product.stock -= item.qty;
  }
  writeJSON(PRODUCTS_FILE, products);

  const orders = readJSON(ORDERS_FILE);
  const orderNumber = 'AT-' + Math.floor(10000 + Math.random() * 89999);
  const newOrder = {
    orderNumber,
    name,
    email,
    address,
    items: orderItems,
    total,
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);
  writeJSON(ORDERS_FILE, orders);

  res.status(201).json(newOrder);
});

// GET /api/orders/:orderNumber
router.get('/:orderNumber', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const order = orders.find(o => o.orderNumber === req.params.orderNumber);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  res.json(order);
});

module.exports = router;
