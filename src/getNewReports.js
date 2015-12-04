import db from './db';
import imaps from 'imap-simple';
import options from './options';
import path from 'path';

const FILES_PATH = path.resolve(process.cwd(), 'data/files');

const config = {
  imap: {
    user: options.imapEmail,
    password: options.imapPassword,
    host: options.imapHost,
    port: options.imapPort,
    tls: Boolean(options.imapTlsEnabled),
    authTimeout: 3000,
  },
};

export default async function getNewReports(mailIdsToSkip) {
  return imaps.connect(config).then((connection) => {
    return connection.openBox('INBOX');
  }).then(() => {
    const today = new Date();
    const todayISOString = yesterday.toISOString();
    const searchCriteria = ['UNSEEN', ['SINCE', todayISOString]];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], struct: true };
    return connection.search(searchCriteria, fetchOptions);
  }).then(messages => {
    const newMessages = messages.filter(message => mailIdsToSkip.indexOf(message.uid) === -1);

    const newUids = newMessages.map(message => message.uid);
    await storeProcessedMailIds(newUids);

    function downloadAttachment(message, part) {
      return connection.getPartData(message, part).then((partData) => {
        console.log(part.disposition.params.filename + ': got ' + partData.length + ' bytes');
        connection.addMessageLabel(message.attributes.uid, 'downloaded');
      });
    }

    const attachments = [];

    messages.forEach(function (message) {
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
    return Promise.all(attachments.map(att => processAttachment(att)));
  }).then((reports) => {
    return reports.length;
  }).catch(err => {
    console.error(err);
    throw err;
  });
}

function processAttachment(attachment) {
  return new Promise((resolve, reject) => {
    const newfileName = uuid.v4();
    fs.writeFile(path.resolve(FILES_PATH, newfileName), attachment.data, (err) => {
      if (err) { return reject(err); }
      const truckName = truckNameFromAttachmentName(attachment.filename);
      db.reports.update(
        { truckName },
        {
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
    const docs = ids.map(id => { mailUid: id });
    db.mail.insert(docs, err => {
      if (err) { return reject(err); }
      resolve();
    };
  });
}
