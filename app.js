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

// === Генерация кнопок навигации ===
const nav = document.getElementById("lessons-nav");
files.forEach((name, index) => {
  const btn = document.createElement("button");

  const cleanName = name.replace(/^\d+\./, "").replace(".md", "");
  const title = cleanName.replace(/-/g, " ").trim();

  btn.textContent = `${index + 1}. ${title}`;
  btn.onclick = () => loadLesson(name);

  nav.appendChild(btn);
});

// === Подключаем markdown-парсер ===
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
script.onload = () => {
  console.log("✅ marked.js загружен");
  loadLesson(files[0]); // автоматически загружаем первую главу
};
document.head.appendChild(script);

// === Основная функция загрузки главы ===
async function loadLesson(filename) {
  const contentDiv = document.getElementById("content");
  contentDiv.innerHTML = `<p>Загрузка: ${filename}...</p>`;

  try {
    const url = basePath + encodeURIComponent(filename).replace(/%2F/g, "/");
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    let text = await res.text();

    // --- Исправление путей изображений ---
    text = text.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
      (match, alt, src) => {
        const cleanSrc = src.trim().replace(/^["']|["']$/g, "");
        return `![${alt}](${imageBase}${cleanSrc})`;
      });

    text = text.replace(/<img([^>]+)src=["']([^"']+)["']/gi,
      (match, attrs, src) => {
        let cleanSrc = src.trim().replace(/^["']|["']$/g, "");
        cleanSrc = cleanSrc.replace("../files/2023/Веб-версия Диплома/", "");
        cleanSrc = cleanSrc
          .replace(/^Изображения\/Images\//, "Изображения/")
          .replace(/^Images\//, "Изображения/")
          .replace("Chapter-", "Глава-");

        let fullSrc = cleanSrc;
        if (!cleanSrc.startsWith("http") && !cleanSrc.startsWith("data:")) {
          fullSrc = imageBase + cleanSrc.replace(/^Изображения\//, "");
        }

        console.log("🖼️ Подставлен путь:", fullSrc);
        return `<img${attrs}src="${fullSrc}"`;
      });

    // --- Поддержка цветных LaTeX-меток ---
    text = text.replace(
      /\$\\color\[RGB\]\{(\d+),(\d+),(\d+)\}([^$]+)\$/g,
      (m, r, g, b, inner) =>
        `<span style="color: rgb(${r},${g},${b}); font-weight:600;">${inner.trim()}</span>`
    );

    // --- Настройки Markdown ---
    marked.setOptions({
      mangle: false,
      headerIds: false,
      breaks: false,
    });

    contentDiv.innerHTML = marked.parse(text);

    if (window.MathJax) {
      MathJax.typesetPromise();
    }

  } catch (err) {
    contentDiv.innerHTML = `
      <h2 style="color:red;">Ошибка загрузки файла: ${filename}</h2>
      <pre>Error: ${err.message}</pre>`;
  }
}

// === Плавная прокрутка к навигации ===
document.querySelector(".primary")?.addEventListener("click", () => {
  const target = document.getElementById("lessons-nav");
  if (!target) return;

  const startY = window.scrollY;
  const targetY = target.getBoundingClientRect().top + window.scrollY - 15;
  const distance = targetY - startY;
  const duration = 800;
  let startTime = null;

  function animateScroll(currentTime) {
    if (!startTime) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = 0.5 * (1 - Math.cos(Math.PI * progress));
    window.scrollTo(0, startY + distance * ease);
    if (progress < 1) requestAnimationFrame(animateScroll);
  }

  requestAnimationFrame(animateScroll);
});

// === Переключение тёмной темы ===
const themeToggle = document.querySelector(".theme-toggle");
const body = document.body;

if (localStorage.getItem("theme") === "dark") {
  body.classList.add("dark");
  themeToggle.innerHTML = "🌞 Светлая";
} else {
  body.classList.remove("dark");
  themeToggle.innerHTML = "🌙 Тёмная";
}

themeToggle.addEventListener("click", () => {
  const isDark = body.classList.toggle("dark");

  if (isDark) {
    localStorage.setItem("theme", "dark");
    themeToggle.innerHTML = "🌞 Светлая";
  } else {
    localStorage.setItem("theme", "light");
    themeToggle.innerHTML = "🌙 Тёмная";
  }
});
