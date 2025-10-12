const { convert } = require('electron-icon-maker');

convert({
    input: './icon.svg',
    output: './icons',
    flatten: true
}).then(() => {
    console.log('Icon wurde erfolgreich erstellt!');
}); 