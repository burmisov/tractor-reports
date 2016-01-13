import schedule from 'node-schedule';
import updateReports from './updateReports';

const rule = new schedule.RecurrenceRule();
rule.minute = [5, 20, 35, 50];

export function run() {
  schedule.scheduleJob(rule, updateReports);
}
