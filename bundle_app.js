const fs = require('fs');
const path = require('path');

const lessonsDataPath = path.join(__dirname, 'lessons_data.js');
const appJsPath = path.join(__dirname, 'app.js');
const outputAppPath = path.join(__dirname, 'app.js'); // Перезаписываем app.js

// Читаем файлы
const lessonsDataContent = fs.readFileSync(lessonsDataPath, 'utf8');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Убираем старую логику загрузки, если она там есть, но лучше просто склеить грамотно.
// В app.js у нас уже есть логика использования lessonsData.
// Нам нужно просто вставить содержимое lessonsData.js в самое начало app.js.

// Но есть нюанс: lessonsData.js содержит "const lessonsData = { ... };"
// А app.js использует эту переменную.
// Если мы просто склеим файлы, всё будет работать.

const finalContent = lessonsDataContent + "\n\n" + appJsContent;

fs.writeFileSync(outputAppPath, finalContent, 'utf8');

console.log("✅ app.js has been bundled with content!");
