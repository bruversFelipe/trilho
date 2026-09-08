import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { createExampleData } from '../utils/exampleData.js';
import { slugify } from '../utils/slug.js';

function signToken(user) {
  // No expiresIn on purpose - the frontend keeps this in localStorage indefinitely.
  return jwt.sign({ sub: String(user._id), username: user.username }, process.env.JWT_SECRET);
}

function publicUser(user) {
  return { id: String(user._id), username: user.username, name: user.name };
}

// Lets the signup form check, as someone types their name, what username they'd
// get and whether it's free - before they ever submit.
export async function checkSlug(req, res) {
  const slug = slugify(req.query.name);
  if (!slug) {
    return res.json({ slug: '', available: false });
  }

  const existing = await User.findOne({ username: slug });
  res.json({ slug, available: !existing });
}

export async function register(req, res) {
  const { name, password } = req.body;
  if (!name?.trim() || !password) {
    return res.status(400).json({ error: 'nome e password sao obrigatorios' });
  }

  const slug = slugify(name);
  if (!slug) {
    return res.status(400).json({ error: 'nome invalido' });
  }

  // Re-check server-side regardless of what the live availability check said -
  // the username is derived, never taken as-is from the client.
  const existing = await User.findOne({ username: slug });
  if (existing) {
    return res.status(409).json({ error: 'Esse nome de usuario ja existe' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name: name.trim(), username: slug, passwordHash });

  await createExampleData(user._id);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'username e password sao obrigatorios' });
  }

  const user = await User.findOne({ username: username.trim().toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
}
