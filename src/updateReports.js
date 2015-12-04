import db from './db';
import getNewReports from './getNewReports';

const debug = require('debug')('tr:updateReports.js');

export default async function updateReports() {
  debug('running updateReports');
  try {
    const today = getCurrentDate();
    const dbDay = await getCurrentDbDate();
    debug('today: %s, dbday: %s', today, dbDay);
    if (!datesEqual(today, dbDay)) {
      debug('clearing processed mail ids');
      await setCurrentDbDate(today);
      await clearMailJournal();
    }
    const processedMailIds = await getProcessedMailIds();
    debug('got %s processed mail ids', processedMailIds.length);
    const newReportCount = await getNewReports(processedMailIds);
  } catch (e) {
    throw e;
  }

  return newReportCount;
};

async function getCurrentDbDate() {
  return new Promise((resolve, reject) => {
    db.status.findOne({ name: 'currentDate' }, (err, doc) => {
      if (err) { return reject(err); }
      if (doc) {
        resolve(doc.dateValue);
      }
      resolve(null);
    });
  });
}

async function setCurrentDbDate(date) {
  return new Promise((resolve, reject) => {
    db.status.update(
      { name: 'currentDate' },
      { dateValue: date },
      { upsert: true },
      (err, doc) => {
        if (err) { return reject(err); }
        resolve(date);
      }
    );
  });
}

function datesEqual() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today;
}

function compareDates(date1, date2) {
  if (!(date1 || date2)) { return false; }
  return date1.getTime() === date2.getTime();
}

async function clearMailJournal() {
  return new Promise((resolve, reject) => {
    db.mail.remove({}, { multi: true }, (err, numRemoved) => {
      if (err) { return reject(err); }
      resolve(numRemoved);
    });
  });
}

async function getProcessedMailIds() {
  return new Promise((resolve, reject) => {
    db.mail.find({}, (err, docs) => {
      if (err) { return reject(err); }
      const mailUids = docs.map(mailDoc => mailDoc.mailUid);
      resolve(mailUids);
    });
  });
}
