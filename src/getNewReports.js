import db from './db';
import imaps from 'imap-simple';
import options from './options';
import path from 'path';
import uuid from 'uuid';
import async from 'async';

const debug = require('debug')('tr:getNewReports.js');

const FILES_PATH = path.resolve(process.cwd(), 'data/files');

const config = {
  imap: {
    user: options.imapEmail,
    password: options.imapPassword,
    host: options.imapHost,
    port: options.imapPort,
    tls: Boolean(options.imapTlsEnabled),
    authTimeout: 10 * 1000,
  },
};

export default async function getNewReports(mailIdsToSkip) {
  if (!mailIdsToSkip) { mailIdsToSkip = []; }
  debug('running getNewReports with %s ids to skip');

  let connection;
  let newMailIds;
  let result;

  debug('connecting to mailbox');
  return imaps.connect(config).then((_connection) => {
    debug('opening inbox');
    connection = _connection;
    return connection.openBox('INBOX');
  }).then(() => {
    const today = new Date();
    const todayISOString = today.toISOString();
    // ? const searchCriteria = ['UNSEEN', ['SINCE', todayISOString]];
    const searchCriteria = [['SINCE', todayISOString]];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], struct: true };
    debug('searching for mail');
    return connection.search(searchCriteria, fetchOptions);
  }).then(messages => {
    debug('got %s messages', messages.length);
    const newMessages = messages.filter(message => mailIdsToSkip.indexOf(message.attributes.uid) === -1);

    debug('%s new messages', newMessages.length);
    newMailIds = newMessages.map(message => message.attributes.uid);

    function downloadAttachment(message, part) {
      return connection.getPartData(message, part).then((partData) => {
        debug(part.disposition.params.filename + ': got ' + partData.length + ' bytes');
        connection.addMessageLabel(message.attributes.uid, 'downloaded');
      });
    }

    let attachments = [];

    messages.forEach(function (message) {
      debug('processing message %s', message.attributes.uid);
      const parts = imaps.getParts(message.attributes.struct);
      attachments = attachments.concat(parts.filter((part) => {
        return part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT';
      }).map(function (part) {
        // retrieve the attachments only of the messages with attachments
        if (part.encoding.toUpperCase() === 'BASE64') { part.encoding = 'BASE64' }
        return connection.getPartData(message, part).then((partData) => {
          return {
            filename: part.disposition.params.filename,
            data: partData,
          };
        });
      }));
    });

    return Promise.all(attachments);
  }).then(attachments => {
    debug('got %s attachments. processing..', attachments.length);
    return Promise.all(attachments.map(att => processAttachment(att)));
  }).then((reports) => {
    return Promise.resolve(reports.length);
  }).then(numReports => {
    result = numReports;
    debug('storing processed mail ids');
    return storeProcessedMailIds(newMailIds);
  }).then(() => {
    debug('done, resolving');
    return Promise.resolve(result);
  }).catch(err => {
    console.error(err);
    throw err;
  });
}

function processAttachment(attachment) {
  debug('procesing attachment %s', attachment.filename);
  return new Promise((resolve, reject) => {
    const newfileName = uuid.v4();
    debug('writing file %s for %s', newfileName, attachment.filename);
    fs.writeFile(path.resolve(FILES_PATH, newfileName), attachment.data, (err) => {
      if (err) { return reject(err); }
      const truckName = truckNameFromAttachmentName(attachment.filename);
      debug('stroring report data for %s', truckName);
      db.reports.update(
        { truckName },
        {
          truckName,
          fileName: newfileName,
          originalName: attachment.filename,
        },
        { upsert: true },
        (err) => {
          if (err) { return reject(err); }
          resolve();
        }
      );
    });
  });
};

function truckNameFromAttachmentName(name) {
  return name.slice(0,2) + name.slice(3,5);
}

function storeProcessedMailIds(ids) {
  return new Promise((resolve, reject) => {
    const docs = ids.map(id => { return { mailUid: id }; });
    async.map(
      docs,
      (doc, done) => {
        db.mail.insert(doc, done);
      },
      (err) => {
        if (err) { return reject(err); }
        resolve();
      }
    );
  });
}
