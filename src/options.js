const optionNames = [
  'imapHost',
  'imapPort',
  'imapEmail',
  'imapPassword',
  'imapTlsEnabled',
];

let optionsFileData;

try {
  optionsFileData = require('../options.json');
  module.exports = optionsFileData;
} catch (e) {
  const options = {};
  module.exports = options;

  optionNames.forEach(optName => {
    options[optName] = process.env['TR_' + optName.toUpperCase()] || '<unset>';
  });
}
