let currentLanguage = 'es';
let translations = {};
const localeCache = new Map();
const SUPPORTED_LANGUAGES = ['es', 'en'];

function escapeHtml(value) {
  const escapedCharacters = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(value).replace(/[&<>"']/g, character => escapedCharacters[character]);
}

export function getLanguage() {
  return currentLanguage;
}

export function getTranslation(key) {
  return translations[key];
}

export function getTranslations() {
  return { ...translations };
}

export function tr(key, values = {}, rawValues = []) {
  const message = getTranslation(key);
  if (typeof message !== 'string') {
    throw new Error(`Missing translation "${key}" for ${currentLanguage}`);
  }

  return message.replace(/\{(\w+)\}/g, (_, name) => {
    const value = values[name] ?? '';
    return rawValues.includes(name) ? String(value) : escapeHtml(value);
  });
}

export function getSavedLanguage() {
  try {
    const savedLanguage = localStorage.getItem('solar-language');
    return SUPPORTED_LANGUAGES.includes(savedLanguage) ? savedLanguage : 'es';
  } catch (error) {
    console.warn('Could not read language preference.', error);
    return 'es';
  }
}

export async function setLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (!localeCache.has(language)) {
    const response = await fetch(`locales/${language}.json`);
    if (!response.ok) {
      throw new Error(`Could not load locales/${language}.json (${response.status})`);
    }

    const dictionary = await response.json();
    if (!dictionary || Array.isArray(dictionary) || typeof dictionary !== 'object') {
      throw new Error(`Invalid locale file: locales/${language}.json`);
    }
    localeCache.set(language, dictionary);
  }

  const dictionary = localeCache.get(language);
  const keys = [
    ...[...document.querySelectorAll('[data-i18n]')].map(node => node.dataset.i18n),
    ...[...document.querySelectorAll('[data-i18n-aria-label]')].map(
      node => node.dataset.i18nAriaLabel
    ),
    ...[...document.querySelectorAll('[data-i18n-content]')].map(
      node => node.dataset.i18nContent
    ),
    ...[...document.querySelectorAll('[data-i18n-alt]')].map(node => node.dataset.i18nAlt)
  ];
  const missing = keys.filter(key => typeof dictionary[key] !== 'string');

  if (missing.length) {
    throw new Error(`Missing translations in locales/${language}.json: ${missing.join(', ')}`);
  }

  currentLanguage = language;
  translations = dictionary;
  document.documentElement.lang = language;

  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = tr(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(node => {
    node.setAttribute('aria-label', tr(node.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-content]').forEach(node => {
    node.setAttribute('content', tr(node.dataset.i18nContent));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(node => {
    node.setAttribute('alt', tr(node.dataset.i18nAlt));
  });

  const languagePicker = document.getElementById('language');
  if (languagePicker) {
    languagePicker.value = language;
  }

  const status = document.getElementById('status');
  if (status) {
    status.hidden = true;
  }

  try {
    localStorage.setItem('solar-language', language);
  } catch (error) {
    console.warn('Could not save language preference.', error);
  }

  return dictionary;
}
