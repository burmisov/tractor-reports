import Datastore from 'nedb';
import path from 'path';

const db = {};
export default db;

const collections = ['reports', 'mail', 'status'];

collections.forEach(collectionName => {
  db[collectionName] = new Datastore({
    filename: path.resolve(process.cwd(), 'data', collectionName),
    autoload: true,
  });
});
