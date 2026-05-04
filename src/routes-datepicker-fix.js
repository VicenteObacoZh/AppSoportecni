(function () {
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function parseDateTime(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        0,
        0
      );
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const fallback = new Date();
    fallback.setSeconds(0, 0);
    return fallback;
  }

  function formatValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatLabel(date) {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function fillSelect(select, items, selectedValue) {
    select.innerHTML = items.map((item) => {
      const selected = String(item.value) === String(selectedValue) ? ' selected' : '';
      return `<option value="${item.value}"${selected}>${item.label}</option>`;
    }).join('');
  }

  function buildDateTimeControls(input, title) {
    if (!input || input.dataset.routeDateFix === '1') {
      return;
    }

    input.dataset.routeDateFix = '1';
    input.type = 'text';
    input.readOnly = true;
    input.classList.add('route-datetime-text');

    const wrapper = document.createElement('div');
    wrapper.className = 'route-datetime-native-free';
    wrapper.innerHTML = `
      <div class="route-datetime-native-free__title">${title}</div>
      <div class="route-datetime-native-free__grid">
        <select data-part="day" aria-label="Dia"></select>
        <select data-part="month" aria-label="Mes"></select>
        <select data-part="year" aria-label="Anio"></select>
      </div>
      <div class="route-datetime-native-free__grid route-datetime-native-free__grid--time">
        <select data-part="hour" aria-label="Hora"></select>
        <select data-part="minute" aria-label="Minuto"></select>
      </div>
    `;

    input.insertAdjacentElement('afterend', wrapper);

    const daySelect = wrapper.querySelector('[data-part="day"]');
    const monthSelect = wrapper.querySelector('[data-part="month"]');
    const yearSelect = wrapper.querySelector('[data-part="year"]');
    const hourSelect = wrapper.querySelector('[data-part="hour"]');
    const minuteSelect = wrapper.querySelector('[data-part="minute"]');

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
      years.push({ value: year, label: String(year) });
    }

    fillSelect(monthSelect, MONTHS.map((label, index) => ({ value: index + 1, label })), 1);
    fillSelect(yearSelect, years, currentYear);
    fillSelect(hourSelect, Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: pad(hour) })), 0);
    fillSelect(minuteSelect, Array.from({ length: 60 }, (_, minute) => ({ value: minute, label: pad(minute) })), 0);

    function renderFromInput() {
      const date = parseDateTime(input.value);
      const year = date.getFullYear();
      if (![...yearSelect.options].some((option) => Number(option.value) === year)) {
        yearSelect.insertAdjacentHTML('beforeend', `<option value="${year}">${year}</option>`);
      }

      yearSelect.value = String(year);
      monthSelect.value = String(date.getMonth() + 1);
      const totalDays = daysInMonth(year, date.getMonth());
      fillSelect(daySelect, Array.from({ length: totalDays }, (_, index) => ({
        value: index + 1,
        label: pad(index + 1)
      })), date.getDate());
      hourSelect.value = String(date.getHours());
      minuteSelect.value = String(date.getMinutes());
      input.value = formatValue(date);
      input.setAttribute('data-label', formatLabel(date));
    }

    function updateInputFromControls() {
      const year = Number(yearSelect.value);
      const monthIndex = Number(monthSelect.value) - 1;
      const maxDay = daysInMonth(year, monthIndex);
      const day = Math.min(Number(daySelect.value || 1), maxDay);
      const hour = Number(hourSelect.value || 0);
      const minute = Number(minuteSelect.value || 0);
      const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
      input.value = formatValue(date);
      input.setAttribute('data-label', formatLabel(date));
      renderFromInput();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    [daySelect, monthSelect, yearSelect, hourSelect, minuteSelect].forEach((select) => {
      select.addEventListener('change', updateInputFromControls);
    });

    const observer = new MutationObserver(renderFromInput);
    observer.observe(input, { attributes: true, attributeFilter: ['value'] });

    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.configurable) {
      const nativeSetter = descriptor.set;
      const nativeGetter = descriptor.get;
      Object.defineProperty(input, 'value', {
        configurable: true,
        get() {
          return nativeGetter.call(input);
        },
        set(nextValue) {
          nativeSetter.call(input, nextValue);
          window.setTimeout(renderFromInput, 0);
        }
      });
    }

    renderFromInput();
  }

  function init() {
    buildDateTimeControls(document.getElementById('routeFrom'), 'Fecha desde');
    buildDateTimeControls(document.getElementById('routeTo'), 'Fecha hasta');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
