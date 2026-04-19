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

## Архитектура

- `src/composables/useLabelEditor.ts` — состояние редактора и действия
- `src/domain/` — типы, фабрики элементов, утилиты, растеризация, thermal-font
- `src/domain/thermal-font/glyphs/*.glyph.txt` — редактирование матричных символов построчно через `.` и `#`
- `src/components/layout/ToolbarHeader.vue` — верхний тулбар
- `src/components/panels/LeftSidebar.vue` — CSV и слои
- `src/components/editor/CanvasWorkspace.vue` — рабочее полотно и drag/resize
- `src/components/panels/PropertiesPanel.vue` — свойства выбранного элемента
