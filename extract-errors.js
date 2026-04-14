const fs = require('fs');
const out = fs.readFileSync('C:\\Users\\liusen\\.local\\share\\opencode\\tool-output\\tool_d865eb769001V4ZF2oEJOLKfLk', 'utf8');
const lines = out.split('\n');
const errors = [];
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('AssertionError [ERR_ASSERTION]:')) {
    errors.push(lines[i].trim());
  }
}
fs.writeFileSync('get-shit-done-dh/errors.txt', errors.join('\n'));
console.log('Saved ' + errors.length + ' errors to errors.txt');
