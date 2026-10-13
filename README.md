# Work

Проектные скилы для агентов Cursor.

## Продуктовый маркетинг «Диасофт»

Скил [`diasoft-marketing-copywriter`](.cursor/skills/diasoft-marketing-copywriter/SKILL.md) пишет и правит русские B2B-тексты компании «Диасофт» и совместные материалы с заказчиками: пресс-релиз, проектную и продуктовую новость Digital Q, экспертную колонку, кейс, лендинг, карточку для продаж, пост и письмо журналисту.

В чате его вызывают как `/diasoft-marketing-copywriter`. Агент подключает скил и сам, когда в запросе есть пресс-релиз, новость о продукте, кейс внедрения, лендинг, цитата спикера или формулировка «в стилистике Диасофт».

Рядом со скилом лежат шаблоны, стайлгайд по корпусу релизов 2021–2026 и проверка лексики:

```bash
python .cursor/skills/diasoft-marketing-copywriter/scripts/check_copy.py --self-test
python .cursor/skills/diasoft-marketing-copywriter/scripts/check_copy.py черновик.md
```
