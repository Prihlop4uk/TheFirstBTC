// === Пути к файлам ===
const basePath = "files/2023/Веб-версия Диплома/";
const imageBase = basePath + "Изображения/";

// === Список глав ===
const files = [
  "10.Обложка-и-Благодарности.md",
  "11.Оглавление.md",
  "12.Почему-Биткойн.md",
  "13.Глава-1.md",
  "14.Глава-2.md",
  "15.Глава-3.md",
  "16.Глава-4.md",
  "17.Глава-5.md",
  "18.Глава-6.md",
  "19.Глава-7.md",
  "20.Глава-8.md",
  "21.Глава-9.md",
  "22.Глава-10.md",
  "23.Дополнительные-Ресурсы.md",
  "24.Глоссарий-(Словарь).md",
  "25.Почему-важно-знать-о-Биткойне.md"
];

// --- Генерация кнопок навигации с чистыми названиями и нумерацией ---
const nav = document.getElementById("lessons-nav");
files.forEach((name, index) => {
  const btn = document.createElement("button");

  // Убираем цифры и расширение .md из имени файла
  const cleanName = name.replace(/^\d+\./, "").replace(".md", "");

  // Заменяем дефисы на пробелы
  const title = cleanName.replace(/-/g, " ").trim();

  // Добавляем порядковый номер
  btn.textContent = `${index + 1}. ${title}`;

  // Действие при клике
  btn.onclick = () => loadLesson(name);

  nav.appendChild(btn);
});


// === Подключаем markdown-парсер ===
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
script.onload = () => {
  console.log("✅ marked.js загружен");
  loadLesson(files[0]); // загружаем первую главу
};
document.head.appendChild(script);

// === Основная функция загрузки главы ===
async function loadLesson(filename) {
  const contentDiv = document.getElementById("content");
  contentDiv.innerHTML = `<p>Загрузка: ${filename}...</p>`;

  try {
    // --- Загрузка Markdown-файла ---
    const url = basePath + encodeURIComponent(filename).replace(/%2F/g, "/");
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    let text = await res.text();

    // --- Исправляем пути в Markdown-изображениях ---
    text = text.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
      (match, alt, src) => {
        const cleanSrc = src.trim().replace(/^["']|["']$/g, "");
        return `![${alt}](${imageBase}${cleanSrc})`;
      });

    // --- Исправляем пути в HTML-тегах <img> ---
    text = text.replace(/<img([^>]+)src=["']([^"']+)["']/gi,
      (match, attrs, src) => {
        let cleanSrc = src.trim().replace(/^["']|["']$/g, "");

        // убираем лишний ../files/... из начала
        cleanSrc = cleanSrc.replace("../files/2023/Веб-версия Диплома/", "");

        // исправляем старые названия
        cleanSrc = cleanSrc
          .replace(/^Изображения\/Images\//, "Изображения/")
          .replace(/^Images\//, "Изображения/")
          .replace("Chapter-", "Глава-");

        // если путь не абсолютный и не внешний
        let fullSrc = cleanSrc;
        if (!cleanSrc.startsWith("http") && !cleanSrc.startsWith("data:")) {
          fullSrc = imageBase + cleanSrc.replace(/^Изображения\//, "");
        }

        console.log("🖼️ Подставлен путь:", fullSrc);
        return `<img${attrs}src="${fullSrc}"`;
      });

    // --- Эмулируем LaTeX-цвет через HTML ---
    text = text.replace(
      /\$\\color\[RGB\]\{(\d+),(\d+),(\d+)\}([^$]+)\$/g,
      (m, r, g, b, inner) => `<span style="color: rgb(${r},${g},${b}); font-weight:600;">${inner.trim()}</span>`
    );


    // --- Настройки Markdown ---
    marked.setOptions({
      mangle: false,
      headerIds: false,
      breaks: false,
    });

    // --- Рендер Markdown ---
    contentDiv.innerHTML = marked.parse(text);

    // --- MathJax обработка ---
    if (window.MathJax) {
      MathJax.typesetPromise();
    }

  } catch (err) {
    contentDiv.innerHTML = `
      <h2 style="color:red;">Ошибка загрузки файла: ${filename}</h2>
      <pre>Error: ${err.message}</pre>`;
  }
}
