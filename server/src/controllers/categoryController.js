import Category from '../models/Category.js';

export async function listCategories(req, res) {
  const categories = await Category.find({ userId: req.userId }).sort({ name: 1 });
  res.json(categories);
}

export async function createCategory(req, res) {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const existing = await Category.findOne({ userId: req.userId, name: name.trim() });
  if (existing) return res.status(200).json(existing);

  const category = await Category.create({
    userId: req.userId,
    name: name.trim(),
    color: color || '#6366f1',
  });
  res.status(201).json(category);
}
