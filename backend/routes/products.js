const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'products.json');

function readProducts() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// GET /api/products?cat=Bois&q=vase
router.get('/', (req, res) => {
  let products = readProducts();
  const { cat, q } = req.query;

  if (cat && cat !== 'Tout') {
    products = products.filter(p => p.cat === cat);
  }
  if (q) {
    const query = q.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(query));
  }
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  res.json(product);
});

module.exports = router;
