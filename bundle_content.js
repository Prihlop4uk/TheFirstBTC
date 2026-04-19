const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'files/2023/Веб-версия Диплома');
const outputFile = path.join(__dirname, 'lessons_data.js');

function getFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            // skip
        } else { 
            if (file.endsWith('.md') && !file.endsWith('README.md') && !file.endsWith('Full_Course_Printable.md')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = getFiles(directoryPath);
const data = {};

files.forEach(file => {
    const filename = path.basename(file);
    let content = fs.readFileSync(file, 'utf8');
    data[filename] = content;
    console.log(`Packed: ${filename}`);
});

const jsContent = `const lessonsData = ${JSON.stringify(data, null, 2)};`;
fs.writeFileSync(outputFile, jsContent, 'utf8');

console.log(`\n✅ Created bundle: ${outputFile}`);
console.log(`Total lessons: ${Object.keys(data).length}`);
