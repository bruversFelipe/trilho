import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withProgress } from './goals.js';

const g1 = { _id: 'g1', title: 'Correr 10k' };
const g2 = { _id: 'g2', title: 'Ler 12 livros' };
const link = (id, goalId, completed, extra = {}) => ({ _id: id, goalId, completed, title: id, date: null, ...extra });

test('conta total e concluidas por meta', () => {
  const [a, b] = withProgress([g1, g2], [link('t1', 'g1', true), link('t2', 'g1', false), link('t3', 'g2', true)]);
  assert.deepEqual([a.linkedTotal, a.linkedDone, b.linkedTotal, b.linkedDone], [2, 1, 1, 1]);
});

test('meta sem tarefa ligada fica 0/0 com lista vazia', () => {
  const [a] = withProgress([g1], []);
  assert.deepEqual([a.linkedTotal, a.linkedDone, a.linkedTasks], [0, 0, []]);
});

test('compara ids como string (ObjectId x string) e ignora meta fora da lista', () => {
  const oid = { toString: () => 'g1' };
  const [a] = withProgress([{ _id: oid, title: 'x' }], [link('t1', 'g1', false), link('t9', 'outra', true)]);
  assert.equal(a.linkedTotal, 1);
});

test('linkedTasks leva so _id, title, completed e date, na ordem recebida', () => {
  const [a] = withProgress([g1], [link('t2', 'g1', true), link('t1', 'g1', false, { description: 'x', userId: 'u' })]);
  assert.deepEqual(a.linkedTasks, [
    { _id: 't2', title: 't2', completed: true, date: null },
    { _id: 't1', title: 't1', completed: false, date: null },
  ]);
});

test('usa toObject() quando a meta e documento Mongoose', () => {
  const [a] = withProgress([{ toObject: () => ({ _id: 'g1', title: 'Doc' }) }], [link('t1', 'g1', false)]);
  assert.deepEqual([a.title, a.linkedTotal], ['Doc', 1]);
});
