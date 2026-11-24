import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // null = backlog item ("pendencia"): no day yet - see normalizeBacklog in taskController
    date: { type: Date, default: null },
    startTime: { type: String, default: null }, // "HH:mm"
    endTime: { type: String, default: null }, // "HH:mm"
    allDay: { type: Boolean, default: false },
    isGoal: { type: Boolean, default: false },
    // 'year' goals live on Jan 1 UTC of their year and never show up in week/month queries
    goalPeriod: { type: String, enum: ['week', 'year'], default: 'week' },
    // Quick note pinned to a day (no time, no recurrence) - see normalizeTodo in taskController
    isTodo: { type: Boolean, default: false },
    // Set by the server only, when a backlog item gets a date ("Ficou pra tras" list)
    scheduledFromBacklog: { type: Boolean, default: false },
    // Year goal this task counts towards (non-recurring, non-goal tasks only)
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

    category: { type: String, default: '' },
    categoryColor: { type: String, default: '#6366f1' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    recurrence: {
      enabled: { type: Boolean, default: false },
      daysOfWeek: { type: [Number], default: [] }, // 0=Sun ... 6=Sat
      endDate: { type: Date, default: null },
      // Dates skipped by this series because that single occurrence was
      // "detached" into its own standalone Task (edited/deleted individually).
      excludedDates: { type: [Date], default: [] },
    },

    completed: { type: Boolean, default: false },
    completedDates: { type: [Date], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Task', taskSchema);
