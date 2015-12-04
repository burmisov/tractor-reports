import schedule from 'node-schedule';
import updateReports from './updateReports';

export function run() {
  schedule.scheduleJob('0 5/35 * 1/1 * ? *', updateReports);
}
