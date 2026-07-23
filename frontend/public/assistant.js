// ===== Сатоши — чат-помощник с базой ответов =====
(function () {
  const launcher = document.getElementById('chat-launcher');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close');
  const messages = document.getElementById('chat-messages');
  const chips = document.getElementById('chat-chips');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-text');
  const badge = launcher?.querySelector('span.bg-emerald-500');
  if (!launcher || !panel) return;

  // База знаний: ключевые слова -> ответ
  const KB = [
    { id: 'price', label: 'Сколько стоит?', keys: ['цена', 'стоит', 'стоимость', 'сколько денег', 'оплат', 'платно', 'руб', 'дорого', 'бесплат'],
      answer: 'Стоимость зависит от формата (онлайн/офлайн) и размера группы. Оставьте заявку — менеджер расскажет про актуальные цены и ближайший набор. Нажмите «Записаться на курс» ниже 👇', cta: true },
    { id: 'duration', label: 'Сколько длится курс?', keys: ['длит', 'сколько недел', 'продолжит', 'как долго', 'сколько времени', 'сколько занятий'],
      answer: 'Курс идёт 10 недель — по одному занятию в неделю. Ритм спокойный, с постепенным усложнением и практикой на каждом занятии.' },
    { id: 'age', label: 'Для какого возраста?', keys: ['возраст', 'лет', 'сколько лет', 'младше', 'старше', 'подходит ли', 'ребёнку', 'ребенку'],
      answer: 'Курс рассчитан на детей 9–16 лет. Материал адаптируется под возраст группы: сложные темы объясняем через игры и примеры из жизни. Никаких предварительных знаний не нужно.' },
    { id: 'format', label: 'Онлайн или офлайн?', keys: ['формат', 'онлайн', 'офлайн', 'очно', 'дистанц', 'где проход', 'как проход'],
      answer: 'Возможны оба формата — онлайн и офлайн. Подстраиваемся под группу и удобное вам расписание. Практика есть в любом формате.' },
    { id: 'invest', label: 'Это инвестиции?', keys: ['инвест', 'заработ', 'купить биткоин', 'вложить', 'трейд', 'спекул', 'обогат'],
      answer: 'Нет. Это образовательный курс про финансовую грамотность, критическое мышление и то, как устроены деньги и Биткойн как технология. Мы НЕ даём инвестсоветов и не учим «как заработать».' },
    { id: 'safety', label: 'А это безопасно?', keys: ['безопас', 'мошен', 'скам', 'обман', 'риск', 'потеря', 'пирамид', 'фишинг', 'деньги потер'],
      answer: 'Да. На курсе нет требований переводить реальные деньги. Наоборот — мы учим распознавать мошенников, фишинг и манипуляции, даём чек-лист цифровой безопасности.' },
    { id: 'legal', label: 'Это законно?', keys: ['закон', 'легально', 'рф', 'росси', 'запрещ', 'нельзя ли'],
      answer: 'Курс образовательный. Мы объясняем правила и ограничения, говорим об ответственности и важности соблюдения законодательства. Никаких схем обхода закона.' },
    { id: 'result', label: 'Что получит ребёнок?', keys: ['что получит', 'что даст', 'результат', 'навык', 'чему научит', 'польза', 'зачем'],
      answer: 'Понимание денег и ценности, защиту от мошенников, основы цифровой гигиены, умение проверять информацию и принимать ответственные решения — навыки на всю жизнь.' },
    { id: 'program', label: 'Программа курса', keys: ['программа', 'план', 'темы', 'что изуч', 'уроки', 'содержан', 'из чего состоит'],
      answer: 'За 10 недель: деньги и ценность → история денег → инфляция → децентрализация → введение в Биткойн → кошельки → как работают транзакции → майнинг → безопасность → итоговый мини-проект. Полную программу смотрите в разделе «Программа».', scrollTo: 'program' },
    { id: 'signup', label: 'Как записаться?', keys: ['записа', 'запис', 'заявк', 'как попасть', 'регистрац', 'связат', 'контакт', 'начать'],
      answer: 'Очень просто: заполните короткую форму — имя, контакт и возраст ребёнка. Мы свяжемся с вами в течение рабочего дня. Открыть форму?', cta: true },
    { id: 'teacher', label: 'Кто ведёт курс?', keys: ['кто вед', 'преподават', 'учител', 'кто учит', 'довер', 'кто провод'],
      answer: 'Занятия ведут педагоги, которые заранее описывают цели, формат и правила безопасности. Программа по неделям и примеры заданий доступны для ознакомления.' },
  ];

  const GREETING = 'Привет! Я Сатоши 🤖 Помогу разобраться с курсом «Мой первый Биткоин Kids». Спросите о цене, формате, программе или безопасности — или выберите вопрос ниже.';
  const FALLBACK = 'Хороший вопрос! Я лучше всего отвечаю на темы: стоимость, длительность, возраст, формат, безопасность, программа и запись. Или оставьте заявку — менеджер ответит на любой вопрос лично.';

  let opened = false;

  function scrollBottom() { messages.scrollTop = messages.scrollHeight; }

  function addMsg(text, who) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + who;
    el.textContent = text;
    messages.appendChild(el);
    scrollBottom();
    return el;
  }

  function addCta() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg bot';
    wrap.style.background = 'transparent';
    wrap.style.border = 'none';
    wrap.style.padding = '0';
    const btn = document.createElement('button');
    btn.className = 'inline-flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 btn';
    btn.setAttribute('data-testid', 'chat-cta-signup');
    btn.textContent = 'Записаться на курс';
    btn.addEventListener('click', () => {
      document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
      closePanel();
      setTimeout(() => document.getElementById('lead-name-input')?.focus(), 700);
    });
    wrap.appendChild(btn);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = '<span class="chat-typing"><i></i><i></i><i></i></span>';
    messages.appendChild(el);
    scrollBottom();
    return el;
  }

  function normalize(s) { return s.toLowerCase().replace(/ё/g, 'е'); }

  function findAnswer(text) {
    const t = normalize(text);
    let best = null, bestScore = 0;
    for (const item of KB) {
      let score = 0;
      for (const k of item.keys) if (t.includes(normalize(k))) score++;
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return bestScore > 0 ? best : null;
  }

  function botRespond(item) {
    const t = typing();
    setTimeout(() => {
      t.remove();
      if (!item) { addMsg(FALLBACK, 'bot'); addCta(); return; }
      addMsg(item.answer, 'bot');
      if (item.cta) addCta();
      if (item.scrollTo) {
        const b = document.createElement('div');
        b.className = 'chat-msg bot';
        b.style.cssText = 'background:transparent;border:none;padding:0';
        const link = document.createElement('button');
        link.className = 'text-sm font-bold text-orange-600 underline';
        link.textContent = 'Открыть раздел «Программа» →';
        link.addEventListener('click', () => { document.getElementById(item.scrollTo)?.scrollIntoView({ behavior: 'smooth' }); closePanel(); });
        b.appendChild(link);
        messages.appendChild(b);
        scrollBottom();
      }
    }, 550);
  }

  function renderChips() {
    chips.innerHTML = '';
    ['price', 'duration', 'age', 'format', 'safety', 'signup'].forEach((id) => {
      const item = KB.find((k) => k.id === id);
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chat-chip';
      c.textContent = item.label;
      c.setAttribute('data-testid', 'chat-chip-' + id);
      c.addEventListener('click', () => { addMsg(item.label, 'user'); botRespond(item); });
      chips.appendChild(c);
    });
  }

  function openPanel() {
    panel.classList.remove('hidden');
    launcher.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (!opened) {
      opened = true;
      const t = typing();
      setTimeout(() => { t.remove(); addMsg(GREETING, 'bot'); renderChips(); }, 500);
    }
    setTimeout(() => input.focus(), 300);
  }
  function closePanel() {
    panel.classList.add('hidden');
    launcher.style.display = '';
  }

  launcher.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    botRespond(findAnswer(text));
  });
})();
