import { CronJob } from 'cron';
import { Op } from 'sequelize';
import { Task, Submission, User, Reminder, StudentProfile, Class } from '../database.js';
import EmailService from './EmailService.js';

class ReminderService {
  start() {
    // Run every hour to check for upcoming deadlines
    new CronJob('0 * * * *', () => this.processReminders(), null, true);
    console.log('⏰ Reminder service started');
  }

  async processReminders() {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Find published tasks due in the next 24 hours
      const upcomingTasks = await Task.findAll({
        where: {
          status: 'published',
          due_date: { [Op.between]: [now, in24h] }
        },
        include: [{ model: Class, as: 'class', include: [{ model: StudentProfile, as: 'students', include: [{ model: User, as: 'user' }] }] }]
      });

      for (const task of upcomingTasks) {
        const hoursLeft = Math.round((new Date(task.due_date) - now) / (1000 * 60 * 60));
        const students = task.class?.students || [];

        for (const profile of students) {
          const user = profile.user;
          if (!user || user.status !== 'active') continue;

          // Check if already submitted
          const submitted = await Submission.findOne({
            where: { task_id: task.id, student_id: user.id, status: { [Op.in]: ['submitted', 'graded'] } }
          });
          if (submitted) continue;

          // Check if reminder already sent around this run window to avoid duplicates
          const alreadySent = await Reminder.findOne({
            where: {
              task_id: task.id,
              user_id: user.id,
              type: 'email',
              reminder_time: { [Op.between]: [new Date(now.getTime()), new Date(in24h.getTime())] },
              status: { [Op.in]: ['sent', 'pending'] }
            }
          });
          if (alreadySent) continue;


          // Send email reminder
          try {
            await EmailService.sendTaskReminder(user, task, hoursLeft);
            await Reminder.create({
              task_id: task.id,
              user_id: user.id,
              type: 'email',
              status: 'sent',
              sent_at: now,
              reminder_time: task.due_date
            });
          } catch (err) {
            console.error(`Failed to send reminder to ${user.email}:`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('Reminder processing error:', error.message);
    }
  }
}

export default new ReminderService();
