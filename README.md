# BitPrint Label Editor

Перенос `print.html` в модульный проект на Vue 3 + TypeScript + SCSS + Pug.

## Стек

- Vue 3 (`script setup`)
- TypeScript
- Vite
- SCSS
- Pug templates
- `bwip-js` для штрихкодов
- `papaparse` для CSV

## Запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Парсер пресетов

Скрипт парсит страницу:

- `https://www.label.kr/Goods/a4label/ByMaterials/MPL`

И формирует пресеты только для товаров, которые отображаются на странице по умолчанию (212 позиций).
Товары с кодом, начинающимся с `SL`, автоматически исключаются.

Что собирает скрипт:

- `name` без корейских слов в формате `W x H mm [CODE]`
- параметры листа и сетки из таблицы `p-specs-table`
- цены и тиражи из блока `select-qty-section`

Запуск:

```bash
npm run parse:label-presets
```

Результат:

- обновляется `public/presets/index.json`
- создаются/обновляются JSON-файлы пресетов в `public/presets/*.json`

Основной скрипт: `scripts/parse-label-presets.mjs`.

## Архитектура

- `src/composables/useLabelEditor.ts` — состояние редактора и действия
- `src/domain/` — типы, фабрики элементов, утилиты, растеризация
- `src/components/layout/ToolbarHeader.vue` — верхний тулбар
- `src/components/panels/LeftSidebar.vue` — CSV и слои
- `src/components/editor/CanvasWorkspace.vue` — рабочее полотно и drag/resize
- `src/components/panels/PropertiesPanel.vue` — свойства выбранного элемента
