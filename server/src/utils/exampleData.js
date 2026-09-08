import Category from '../models/Category.js';
import Task from '../models/Task.js';
import { addDays, startOfWeek } from './date.js';

/** Gives a brand-new account two example categories and two example tasks in the
 * current week, so the calendar isn't empty on first login. */
export async function createExampleData(userId) {
  const categories = await Category.insertMany([
    { userId, name: 'Trabalho', color: '#6366f1' },
    { userId, name: 'Pessoal', color: '#22c55e' },
  ]);
  const [trabalho, pessoal] = categories;

  const weekStart = startOfWeek(new Date());
  function at(dayOffset, hours, minutes) {
    const d = addDays(weekStart, dayOffset);
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  }

  await Task.insertMany([
    {
      userId,
      title: 'Reuniao de equipe',
      description: 'Exemplo - pode editar ou excluir',
      date: at(1, 9, 30), // Monday 09:30
      startTime: '09:30',
      endTime: '10:00',
      category: trabalho.name,
      categoryColor: trabalho.color,
      categoryId: trabalho._id,
    },
    {
      userId,
      title: 'Treino',
      description: 'Exemplo - pode editar ou excluir',
      date: at(3, 18, 0), // Wednesday 18:00
      startTime: '18:00',
      endTime: '19:00',
      category: pessoal.name,
      categoryColor: pessoal.color,
      categoryId: pessoal._id,
    },
  ]);
}
