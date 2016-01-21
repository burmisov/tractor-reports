import express from 'express';
import path from 'path';
import db from './db';
import mkdirp from 'mkdirp';
import { run } from './runner';
import iisBaseUrl from 'iis-baseurl';
import updateReports from './updateReports';

const FILES_PATH = path.resolve(process.cwd(), 'data/files');
mkdirp.sync(FILES_PATH);

run();

const debug = require('debug')('tr:index.js');

const app = express();

app.use(iisBaseUrl());

app.get('/', (req, res) => {
  res.sendFile(path.resolve('src/index.html'));
});

app.post('/reports/reload', (req, res) => {
  updateReports().then(numUpdated => {
    res.json({ numUpdated });
  }).catch(err => {
    throw err;
  });
});

app.get('/reports/_all', (req, res) => {
  db.reports.find({}, (err, docs) => {
    if (err) { throw err; }
    res.json(docs);
  });
});

app.get('/reports/:truckId', (req, res) => {
  const truckName = req.params.truckId;
  db.reports.findOne({ truckName }, (err, doc) => {
    if (err || !doc) { return res.status(404).send('Нет данных'); } // TODO
    res.download(path.resolve(FILES_PATH, doc.fileName), doc.originalName);
  });
});

const port = process.env.PORT || 3000;

app.listen(port);
debug('Server listening on port %s', port);
