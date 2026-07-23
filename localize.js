const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'files/2023/Веб-версия Диплома');
const disclaimerLink = '\n\n> **Важно:** [Юридический отказ от ответственности](../../../../DISCLAIMER_RU.md)\n\n---\n\n';

// Функция для рекурсивного поиска файлов (хотя у нас плоская структура, на всякий случай)
function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* skip directories for now as images are deep inside */ 
        } else { 
            if (file.endsWith('.md') && !file.endsWith('README.md')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = getFiles(directoryPath);
let fullCourseContent = "# Полный курс «Мой первый Биткоин» (Версия для РФ)\n\n";

files.sort(); // Сортируем файлы, чтобы шли по порядку глав

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Вставка дисклеймера (если его нет)
    if (!content.includes('Юридический отказ от ответственности')) {
        // Вставляем после заголовка H1 или в начало
        const h1Match = content.match(/^# .*/m);
        if (h1Match) {
            content = content.replace(h1Match[0], h1Match[0] + disclaimerLink);
        } else {
            content = disclaimerLink + content;
        }
    }

    // 2. Замена валют (простая эвристика)
    // $100 -> 10 000 ₽ (курс ~100 для простоты счета в примерах)
    content = content.replace(/\$(\d+)/g, (match, p1) => {
        return `${parseInt(p1) * 100} ₽`;
    });
    
    // 100 dollars -> 10 000 рублей
    content = content.replace(/(\d+)\s+dollars/gi, (match, p1) => {
        return `${parseInt(p1) * 100} рублей`;
    });
    
    // 1 dollar -> 100 рублей
    content = content.replace(/1\s+dollar/gi, "100 рублей");
    
    // monopoly bill in 1 dollar -> купюра монополии в 100 рублей (примерно)
    // Но тут надо аккуратно, если речь про картинку. 
    // В тексте "купюру в 1 доллар США" -> "купюру в 100 рублей"
    content = content.replace(/купюру в 1 доллар/gi, "купюру в 100 рублей");
    content = content.replace(/купюра в 1 доллар/gi, "купюра в 100 рублей");
    
    // Сохраняем изменения в файл
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Processed ${path.basename(file)}`);

    // Добавляем в общий файл для печати
    // Корректируем пути к картинкам для общего файла (они относительные)
    // В оригинале: src="Images/..." или ![](Images/...)
    // Если full_course.md лежит в корне папки "Веб-версия Диплома", то пути правильные.
    // Если мы положим его выше, надо править. Положим его рядом с файлами.
    
    fullCourseContent += content + "\n\n<div style='page-break-after: always;'></div>\n\n";
});

// Сохраняем версию для печати
const printFile = path.join(directoryPath, 'Full_Course_Printable.md');
fs.writeFileSync(printFile, fullCourseContent, 'utf8');
console.log(`Created printable version at ${printFile}`);
