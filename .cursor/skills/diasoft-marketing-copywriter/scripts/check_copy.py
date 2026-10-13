#!/usr/bin/env python3
"""Check a Diasoft marketing draft for lexicon and punctuation.

Run on the draft only. Do not point this at SKILL.md or the style guide:
those files mention the banned words on purpose.

Exit 1 — hard findings, fix the draft.
Exit 0 — clean, or only soft warnings. Justify any remaining warning
in the cover note (for example «штраф» as the subject of the product,
not as a judgment of the client's past).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

HARD_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"революцион", "оценка «революционный»"),
    (r"уникальн", "оценка «уникальный»"),
    (r"инновацион", "оценка «инновационный»"),
    (r"лучший на рынке", "оценка «лучший на рынке»"),
    (r"лидер рынка", "оценка «лидер рынка»"),
    (r"мы гордимся", "формула «мы гордимся»"),
    (r"инсайт", "слово «инсайт»"),
    (r"стайлгайд", "служебное слово «стайлгайд» в тексте для читателя"),
    (r"белый список", "служебное слово «белый список» в тексте для читателя"),
    (r"стал[аи]? обязательн", "«стал обязательным» без формулы соответствия"),
    (r"(?<![A-Za-zА-Яа-яЁё])IT(?![A-Za-z])", "латинское IT — пиши «ИТ»"),
    (r"[«\"][^»\"]*[!]", "восклицательный знак"),
    (r"!", "восклицательный знак"),
    (r'"', "прямые кавычки \"...\" — нужны «...», внутри цитаты „...“"),
    (
        r",\s-\s(?=отметил|отметила|рассказал|рассказала|прокомментировал|говорит|сообщил)",
        "перед атрибуцией нужно тире «–», не дефис",
    ),
)

SOFT_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"ошибк", "«ошибк»: оставь, только если это предмет автоматизации, а не оценка прошлого заказчика"),
    (r"штраф", "«штраф»: оставь, только если это предмет автоматизации, а не оценка прошлого заказчика"),
    (r"хаос", "«хаос»: убери оценку прошлого заказчика"),
    (r"\bExcel\b", "Excel: убери, если так описано прошлое заказчика"),
)

HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def findings(text: str) -> tuple[list[str], list[str]]:
    hard: list[str] = []
    soft: list[str] = []
    for pattern, message in HARD_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            hard.append(message)
    for pattern, message in SOFT_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            soft.append(message)
    heading = HEADING_RE.search(text)
    if heading:
        title = heading.group(1)
        if ":" in title or "：" in title:
            hard.append("в заголовке двоеточие")
        if re.search(r"\d", title):
            hard.append(
                "в заголовке цифра: оставь только если цифра и есть новость и она есть в брифе"
            )
    # Deduplicate while keeping order.
    return list(dict.fromkeys(hard)), list(dict.fromkeys(soft))


GOOD_SAMPLE = """# Банк автоматизировал депозитарный учет вместе с «Диасофт»

Банк и компания «Диасофт» в марте 2026 года запустили в опытно-промышленную эксплуатацию учет ценных бумаг. Для этой задачи выбран продукт «Депозитарий».

«Мы получили единый учет операций», – отметила Анна Иванова, директор департамента банка.

Специалисты «Диасофт» развернули решение на импортонезависимом стеке.

Банк и «Диасофт» планируют продолжить развитие решения.
"""

BAD_SAMPLE = """# Революционный депозитарий: ошибки сократились на 40%!

Уникальный лидер рынка стал обязательным. Мы гордимся IT-прорывом по стайлгайду.

«Это инсайт», - отметил Иван.
"""


def self_test() -> int:
    good_hard, good_soft = findings(GOOD_SAMPLE)
    bad_hard, _bad_soft = findings(BAD_SAMPLE)
    errors: list[str] = []
    if good_hard or good_soft:
        errors.append(f"good sample flagged: hard={good_hard} soft={good_soft}")
    needed = {
        "оценка «революционный»",
        "в заголовке двоеточие",
        "в заголовке цифра: оставь только если цифра и есть новость и она есть в брифе",
        "восклицательный знак",
        "оценка «уникальный»",
        "оценка «лидер рынка»",
        "«стал обязательным» без формулы соответствия",
        "формула «мы гордимся»",
        "латинское IT — пиши «ИТ»",
        "слово «инсайт»",
        "перед атрибуцией нужно тире «–», не дефис",
        "служебное слово «стайлгайд» в тексте для читателя",
    }
    missing = needed.difference(bad_hard)
    if missing:
        errors.append(f"bad sample missed: {sorted(missing)}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("self-test passed")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[1] == "--self-test":
        return self_test()
    if len(argv) == 2 and argv[1] not in {"-h", "--help"}:
        text = Path(argv[1]).read_text(encoding="utf-8")
    elif len(argv) == 1:
        text = sys.stdin.read()
    else:
        print(f"usage: {argv[0]} [draft.md | --self-test]", file=sys.stderr)
        return 2
    hard, soft = findings(text)
    for item in hard:
        print(f"hard: {item}")
    for item in soft:
        print(f"soft: {item}")
    if not hard and not soft:
        print("ok")
    return 1 if hard else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
