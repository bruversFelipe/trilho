import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    date: { type: Date, required: true },
    startTime: { type: String, default: null }, // "HH:mm"
    endTime: { type: String, default: null }, // "HH:mm"
    allDay: { type: Boolean, default: false },
    isGoal: { type: Boolean, default: false },

    category: { type: String, default: '' },
    categoryColor: { type: String, default: '#6366f1' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    recurrence: {
      enabled: { type: Boolean, default: false },
      daysOfWeek: { type: [Number], default: [] }, // 0=Sun ... 6=Sat
      endDate: { type: Date, default: null },
    },

    completed: { type: Boolean, default: false },
    completedDates: { type: [Date], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Task', taskSchema);
