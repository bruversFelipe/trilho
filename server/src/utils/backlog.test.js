import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBacklog } from './backlog.js';

const TODAY = new Date(Date.UTC(2026, 10, 24));
const nov = (d) => new Date(Date.UTC(2026, 10, d));
const task = (id, over = {}) => ({ _id: id, date: null, completed: false, scheduledFromBacklog: false, createdAt: nov(1), ...over });
const ids = (list) => list.map((t) => t._id);

test('sem data e nao concluida vai pra pending, em ordem de criacao', () => {
  const { pending, overdue } = splitBacklog([task('b', { createdAt: nov(3) }), task('a', { createdAt: nov(2) })], TODAY);
  assert.deepEqual(ids(pending), ['a', 'b']);
  assert.deepEqual(overdue, []);
});

test('veio das pendencias, antes de hoje e nao concluida vai pra overdue, mais antiga primeiro', () => {
  const { pending, overdue } = splitBacklog([
    task('ontem', { date: nov(23), scheduledFromBacklog: true }),
    task('semana-passada', { date: nov(17), scheduledFromBacklog: true }),
  ], TODAY);
  assert.deepEqual(ids(overdue), ['semana-passada', 'ontem']);
  assert.deepEqual(pending, []);
});

test('hoje e futuro nao sao overdue', () => {
  const { overdue } = splitBacklog([
    task('hoje', { date: TODAY, scheduledFromBacklog: true }),
    task('amanha', { date: nov(25), scheduledFromBacklog: true }),
  ], TODAY);
  assert.deepEqual(overdue, []);
});

test('concluida nao entra em nenhuma lista', () => {
  const { pending, overdue } = splitBacklog([
    task('p', { completed: true }),
    task('o', { date: nov(20), scheduledFromBacklog: true, completed: true }),
  ], TODAY);
  assert.deepEqual([pending, overdue], [[], []]);
});

test('ToDo criado direto no dia nunca e overdue', () => {
  assert.deepEqual(splitBacklog([task('todo', { date: nov(20), isTodo: true })], TODAY).overdue, []);
});

test('nao muta a lista recebida', () => {
  const input = [task('b', { createdAt: nov(3) }), task('a', { createdAt: nov(2) })];
  splitBacklog(input, TODAY);
  assert.deepEqual(ids(input), ['b', 'a']);
});
