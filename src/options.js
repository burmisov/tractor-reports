const optionNames = [
  'imapHost',
  'imapPort',
  'imapEmail',
  'imapPassword',
  'imapTlsEnabled',
];

const options = {};
export default options;

optionNames.forEach(optName => {
  options[optName] = process.env['TR_' + optName.toUpperCase()] || '<unset>';
});
