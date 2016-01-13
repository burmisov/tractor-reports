import db from './db';
import fs from 'fs';
import path from 'path';
import async from 'async';

const FILES_PATH = path.resolve(process.cwd(), 'data/files');

export default async function removeUnusedFiles() {
  return new Promise((resolve, reject) => {
    db.reports.find({}, (err, docs) => {
      if (err) { throw err; }
      const excludeList = docs.map(doc => doc.fileName);
      fs.readdir(FILES_PATH, (err, files) => {
        if (err) { throw err; }
        const filesToDelete = files.filter(
          file => excludeList.indexOf(file) === -1
        );
        async.eachSeries(
          filesToDelete,
          (file, next) => { fs.unlink(path.resolve(FILES_PATH, file), next); },
          (err) => {
            if (err) { throw err; }
            console.log('removed unused files');
            resolve();
          }
        );
      });
    });
  });
}
