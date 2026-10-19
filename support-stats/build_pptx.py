#!/usr/bin/env python3
"""Слайды к встрече по сопровождению брокерского обслуживания."""

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt
import os

OUT = os.path.join(os.path.dirname(__file__), "brokerage_support_stats.pptx")

NAVY = RGBColor(0x1B, 0x3A, 0x5F)
NAVY2 = RGBColor(0x2E, 0x5A, 0x88)
ACCENT = RGBColor(0xC0, 0x4A, 0x1A)
TEAL = RGBColor(0x1F, 0x7A, 0x6B)
GOLD = RGBColor(0xB5, 0x86, 0x2A)
SLATE = RGBColor(0x5A, 0x67, 0x74)
INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x5C, 0x5C, 0x5C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PAPER = RGBColor(0xF4, 0xF6, 0xF8)
LINE = RGBColor(0xD0, 0xD7, 0xDE)
RED = RGBColor(0xB4, 0x23, 0x18)

W = Inches(13.333)
H = Inches(7.5)

MONTHS = ["Апр", "Май", "Июн", "Июл", "Авг", "Сен"]
ALL = [58, 44, 39, 42, 52, 47]
TAX = [29, 21, 19, 24, 26, 29]
INTA = [11, 14, 9, 10, 13, 8]
OPS = [16, 6, 7, 6, 11, 7]
CORE = [2, 2, 3, 2, 2, 3]
OTHER = [0, 1, 1, 0, 0, 0]
CONS = [45, 29, 36, 27, 39, 36]
DEF = [13, 14, 3, 12, 12, 11]


def set_run(run, text, size=18, bold=False, color=INK, font="Calibri"):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def add_text(shape, lines, size=16, bold=False, color=INK, align=PP_ALIGN.LEFT):
    tf = shape.text_frame
    tf.word_wrap = True
    tf.clear()
    for i, line in enumerate(lines if isinstance(lines, list) else [lines]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        set_run(run, line, size=size, bold=bold, color=color)


def fill_solid(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def rect(slide, l, t, w, h, color):
    sh = slide.shapes.add_shape(1, l, t, w, h)  # rectangle
    fill_solid(sh, color)
    return sh


def textbox(slide, l, t, w, h, lines, **kw):
    sh = slide.shapes.add_textbox(l, t, w, h)
    add_text(sh, lines, **kw)
    return sh


def footer(slide, page, total=9):
    textbox(slide, Inches(0.6), Inches(7.15), Inches(10), Inches(0.28),
            "Сопровождение брокерского обслуживания  ·  выгрузка задач на 19.10.2026  ·  период регистраций апрель–сентябрь 2026",
            size=10, color=MUTED)
    textbox(slide, Inches(12.2), Inches(7.15), Inches(0.7), Inches(0.28),
            f"{page}/{total}", size=10, color=MUTED, align=PP_ALIGN.RIGHT)


def header_bar(slide, kicker, title):
    rect(slide, Inches(0), Inches(0), W, Inches(0.12), NAVY)
    textbox(slide, Inches(0.6), Inches(0.28), Inches(12), Inches(0.28),
            kicker, size=12, color=NAVY2, bold=True)
    textbox(slide, Inches(0.6), Inches(0.5), Inches(12), Inches(0.5),
            title, size=28, color=NAVY, bold=True)


def style_chart(chart, colors):
    chart.has_legend = True
    chart.legend.include_in_layout = False
    chart.legend.position = XL_LEGEND_POSITION.BOTTOM
    chart.legend.font.size = Pt(11)
    plot = chart.plots[0]
    plot.has_data_labels = False
    chart.category_axis.tick_labels.font.size = Pt(11)
    chart.value_axis.tick_labels.font.size = Pt(11)
    chart.value_axis.has_major_gridlines = True
    chart.category_axis.has_major_gridlines = False
    try:
        chart.value_axis.major_gridlines.format.line.color.rgb = LINE
    except Exception:
        pass
    for i, series in enumerate(chart.series):
        if i < len(colors):
            series.format.fill.solid()
            series.format.fill.fore_color.rgb = colors[i]
            series.format.line.color.rgb = colors[i]


def kpi_card(slide, l, t, w, h, value, label, sub, value_color=NAVY):
    sh = slide.shapes.add_shape(1, l, t, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = PAPER
    sh.line.color.rgb = LINE
    tf = sh.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run()
    set_run(r, value, size=32, bold=True, color=value_color)
    p2 = tf.add_paragraph()
    r2 = p2.add_run()
    set_run(r2, label, size=13, bold=True, color=INK)
    p3 = tf.add_paragraph()
    r3 = p3.add_run()
    set_run(r3, sub, size=11, color=MUTED)


def add_table(slide, l, t, w, h, data, col_w=None, header=True):
    rows, cols = len(data), len(data[0])
    table_shape = slide.shapes.add_table(rows, cols, l, t, w, h)
    table = table_shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            table.columns[i].width = cw
    for r in range(rows):
        for c in range(cols):
            cell = table.cell(r, c)
            cell.text = ""
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER if c else PP_ALIGN.LEFT
            run = p.add_run()
            is_header = header and r == 0
            set_run(run, str(data[r][c]), size=12, bold=is_header or c == 0,
                    color=WHITE if is_header else INK)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            fill = NAVY if is_header else (PAPER if r % 2 == 0 else WHITE)
            cell.fill.solid()
            cell.fill.fore_color.rgb = fill
    return table_shape


def slide1(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, Inches(0), Inches(0), Inches(0.22), H, NAVY)
    rect(s, Inches(0), Inches(0), W, Inches(0.12), NAVY)
    textbox(s, Inches(0.8), Inches(1.7), Inches(11), Inches(0.4),
            "ВСТРЕЧА ПО СОПРОВОЖДЕНИЮ", size=14, color=NAVY2, bold=True)
    textbox(s, Inches(0.8), Inches(2.1), Inches(11.5), Inches(1.4),
            "Брокерское обслуживание:\nстатистика задач сопровождения",
            size=36, color=NAVY, bold=True)
    textbox(s, Inches(0.8), Inches(3.7), Inches(11), Inches(0.8),
            "Ежемесячная динамика по решению и по продуктам\nFMIntAcc  ·  TMN / TaxFM  ·  Brokerage / OTCSM  ·  FICore",
            size=18, color=INK)
    textbox(s, Inches(0.8), Inches(5.4), Inches(11), Inches(0.9),
            "Период регистраций: апрель — сентябрь 2026\nСрез статусов: 19 октября 2026  ·  282 задачи  ·  клиент в выгрузке: ПСБ",
            size=14, color=MUTED)
    footer(s, 1)


def slide2(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ВСЁ РЕШЕНИЕ", "Шесть месяцев одним взглядом")
    kpi_card(s, Inches(0.6), Inches(1.25), Inches(2.9), Inches(1.55),
             "282", "задачи всего", "апрель–сентябрь 2026")
    kpi_card(s, Inches(3.7), Inches(1.25), Inches(2.9), Inches(1.55),
             "47", "в месяц в среднем", "141 в апр–июн и 141 в июл–сен")
    kpi_card(s, Inches(6.8), Inches(1.25), Inches(2.9), Inches(1.55),
             "93", "открыто сейчас", "33% контура, срез 19.10", value_color=ACCENT)
    kpi_card(s, Inches(9.9), Inches(1.25), Inches(2.8), Inches(1.55),
             "0", "закрытых несоответствий", "все 65 дефектов ещё открыты", value_color=RED)

    textbox(s, Inches(0.6), Inches(3.05), Inches(12), Inches(0.4),
            "Состав потока", size=18, color=NAVY, bold=True)

    data = CategoryChartData()
    data.categories = ["Консультации", "Несоответствия", "Требования в спринте"]
    data.add_series("Задачи", (212, 65, 5))
    chart = s.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, Inches(0.5), Inches(3.4),
                               Inches(5.2), Inches(3.4), data).chart
    chart.has_legend = True
    chart.legend.position = XL_LEGEND_POSITION.RIGHT
    chart.legend.include_in_layout = False
    chart.legend.font.size = Pt(12)
    colors = [NAVY2, ACCENT, GOLD]
    for i, series in enumerate(chart.series):
        for j, pt in enumerate(series.points):
            pt.format.fill.solid()
            pt.format.fill.fore_color.rgb = colors[j]

    bullets = s.shapes.add_textbox(Inches(6.0), Inches(3.5), Inches(6.7), Inches(3.2))
    tf = bullets.text_frame
    tf.word_wrap = True
    items = [
        ("75% потока — консультации.", "189 из 212 уже закрыты, медиана 33 дня."),
        ("23% потока — несоответствия.", "65 штук, ни одно не закрыто за полгода."),
        ("Поток стабилен.", "Первые и вторые три месяца дали одинаково по 141 задаче."),
        ("Налог держит половину решения.", "TMN + TaxFM и смежные — 148 задач, 52%."),
    ]
    for i, (a, b) in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(10)
        r = p.add_run()
        set_run(r, a + " ", size=15, bold=True, color=NAVY)
        r2 = p.add_run()
        set_run(r2, b, size=15, color=INK)
    footer(s, 2)


def slide3(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ВСЁ РЕШЕНИЕ", "Как меняется число новых задач по месяцам")
    data = CategoryChartData()
    data.categories = MONTHS
    data.add_series("Зарегистрировано, шт.", ALL)
    chart = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED,
                               Inches(0.4), Inches(1.15), Inches(12.5), Inches(4.7), data).chart
    style_chart(chart, [NAVY2])
    chart.has_legend = False
    plot = chart.plots[0]
    plot.has_data_labels = True
    plot.data_labels.font.size = Pt(12)
    plot.data_labels.font.bold = True
    plot.data_labels.font.color.rgb = NAVY
    textbox(s, Inches(0.6), Inches(5.95), Inches(12), Inches(1.0),
            "Ось X — месяц регистрации, ось Y — число задач, шт. Среднее 47. Пик в апреле (58), минимум в июне (39), к осени поток вернулся к среднему.\n"
            "Последняя регистрация в выгрузке — 29.09.2026, поэтому октябрь на график не ставим: отсутствие октября — свойство среза, а не вывод о нулевом потоке.",
            size=13, color=MUTED)
    footer(s, 3)


def slide4(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "РАЗРЕЗ ПО ЧАСТЯМ РЕШЕНИЯ", "Куда приходится сопровождение")
    data = CategoryChartData()
    data.categories = [
        "Налоговый учёт\nTMN, TaxFM",
        "Внутренний учёт\nFMIntAcc",
        "Торговые и неторговые\nBrokerage, OTCSM",
        "Ядро по ЦБ\nFICore",
        "Прочие",
    ]
    data.add_series("Задачи", (148, 65, 53, 14, 2))
    chart = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED,
                               Inches(0.4), Inches(1.15), Inches(8.2), Inches(4.6), data).chart
    style_chart(chart, [NAVY2])
    chart.has_legend = False
    plot = chart.plots[0]
    plot.has_data_labels = True
    plot.data_labels.font.size = Pt(12)

    add_table(s, Inches(8.6), Inches(1.4), Inches(4.2), Inches(3.6), [
        ["Часть решения", "Задач", "Доля"],
        ["Налоговый учёт", "148", "52%"],
        ["Внутренний учёт", "65", "23%"],
        ["Операции", "53", "19%"],
        ["Ядро по ЦБ", "14", "5%"],
        ["Прочие", "2", "1%"],
    ], col_w=[Inches(2.2), Inches(1.0), Inches(1.0)])

    textbox(s, Inches(0.6), Inches(5.9), Inches(12.2), Inches(1.05),
            "В группы включены смежные коды той же части решения: у налога — TaxFMExt и IncDed; у внутреннего учёта — API_FMIAcc и AccFMRule;\n"
            "у операций — BrTrMnCore, SM, TrustManag, API_Broker; у ядра — API_FCore и API_BTCore. Без них шесть названных продуктов дают 255 из 282 задач (90%).",
            size=13, color=MUTED)
    footer(s, 4)


def slide5(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "РАЗРЕЗ ПО ЧАСТЯМ РЕШЕНИЯ", "Ежемесячный поток по частям")
    data = CategoryChartData()
    data.categories = MONTHS
    data.add_series("Налоговый учёт", TAX)
    data.add_series("Внутренний учёт", INTA)
    data.add_series("Операции", OPS)
    data.add_series("Ядро по ЦБ", CORE)
    chart = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_STACKED,
                               Inches(0.35), Inches(1.1), Inches(12.6), Inches(4.55), data).chart
    style_chart(chart, [NAVY, TEAL, GOLD, NAVY2])
    textbox(s, Inches(0.6), Inches(5.75), Inches(12.2), Inches(1.2),
            "Ось X — месяц, ось Y — число зарегистрированных задач, шт. Налог каждый месяц — самая большая доля (19–29 задач).\n"
            "Внутренний учёт колеблется 8–14. Операции были высокими в апреле (16), затем 6–11. Ядро стабильно малое: 2–3 задачи в месяц.\n"
            "Итог по полугодиям совпал: 141 задача в апреле–июне и 141 в июле–сентябре.",
            size=13, color=MUTED)
    footer(s, 5)


def slide6(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ПРОДУКТЫ", "Ежемесячно по названным продуктам")
    add_table(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(3.7), [
        ["Продукт", "Часть решения", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Итого", "Открыто"],
        ["TMN", "Налоговый учёт", "24", "19", "18", "19", "23", "23", "126", "39"],
        ["FMIntAcc", "Внутренний учёт", "10", "13", "9", "9", "13", "7", "61", "24"],
        ["Brokerage", "Операции", "9", "4", "7", "4", "5", "5", "34", "8"],
        ["TaxFM", "Налоговый учёт", "3", "1", "0", "3", "3", "3", "13", "6"],
        ["FICore", "Ядро по ЦБ", "0", "2", "3", "1", "2", "3", "11", "3"],
        ["OTCSM", "Операции", "3", "0", "0", "2", "4", "1", "10", "3"],
    ], col_w=[Inches(1.5), Inches(2.2), Inches(0.85), Inches(0.85), Inches(0.85),
              Inches(0.85), Inches(0.85), Inches(0.85), Inches(1.0), Inches(1.15)])
    textbox(s, Inches(0.6), Inches(5.15), Inches(12.2), Inches(1.7),
            "TMN — ядро нагрузки: 23–24 задачи в апреле, августе и сентябре, провал только в июне (18). На конец среза открыто 39.\n"
            "FMIntAcc держит 7–13 в месяц, открыто 24. Brokerage после апрельского всплеска (9) вышел на 4–7. FICore растёт слабо, но стабильно: с нуля в апреле до 3 в сентябре.\n"
            "OTCSM точечный: в мае–июне нули, в августе 4. TaxFM — 0–3 в месяц, без тренда вниз.",
            size=14, color=INK)
    footer(s, 6)


def slide7(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ЧТО ЗАКРЫВАЕТСЯ", "Консультации уходят, несоответствия копятся")
    data = CategoryChartData()
    data.categories = MONTHS
    data.add_series("Консультации", CONS)
    data.add_series("Несоответствия", DEF)
    chart = s.shapes.add_chart(XL_CHART_TYPE.LINE_MARKERS,
                               Inches(0.4), Inches(1.15), Inches(7.6), Inches(4.5), data).chart
    style_chart(chart, [NAVY2, ACCENT])

    box = s.shapes.add_shape(1, Inches(8.2), Inches(1.35), Inches(4.5), Inches(4.2))
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0xFD, 0xF2, 0xEE)
    box.line.color.rgb = ACCENT
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    set_run(r, "Главный факт среза", size=16, bold=True, color=ACCENT)
    facts = [
        "Закрыто 189 задач — все консультации.",
        "Несоответствий закрыто 0 из 65.",
        "57 дефектов стоят в статусе «Доступно».",
        "5 требований в спринте тоже открыты.",
        "Открытые дефекты — 70% текущего контура.",
        "1 октября массово закрыты 76 старых консультаций (в т.ч. 43 апрельских) — это событие среза, не органический отток октября.",
    ]
    for f in facts:
        p = tf.add_paragraph()
        p.space_before = Pt(8)
        r = p.add_run()
        set_run(r, f, size=13, color=INK)
    textbox(s, Inches(0.6), Inches(5.8), Inches(12.2), Inches(1.1),
            "Ось X — месяц регистрации, ось Y — число задач, шт. Несоответствия приходят ровно: 11–14 в месяц, кроме июня (3).\n"
            "Пока закрывается только консультационный контур, дефектный хвост растёт линейно — примерно на десяток в месяц.",
            size=13, color=MUTED)
    footer(s, 7)


def slide8(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ОТКРЫТЫЙ КОНТУР", "93 задачи на 19 октября")
    add_table(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(2.55), [
        ["Часть решения", "Всего", "Открыто", "Из них дефекты", "Консультации открыты", "Средний возраст открытых, дни"],
        ["Налоговый учёт", "148", "48", "35", "9", "108"],
        ["Внутренний учёт", "65", "26", "20", "6", "98"],
        ["Операции", "53", "15", "10", "4", "94"],
        ["Ядро по ЦБ", "14", "3", "0", "3", "60"],
        ["Прочие", "2", "1", "0", "1", "138"],
    ], col_w=[Inches(2.4), Inches(1.3), Inches(1.5), Inches(2.1), Inches(2.5), Inches(2.5)])

    textbox(s, Inches(0.6), Inches(4.0), Inches(12.2), Inches(2.8),
            "Где сидит открытое\n"
            "• Налог: 39 открытых TMN + 6 TaxFM. Это и основной поток, и основной хвост.\n"
            "• Внутренний учёт: 24 открытых FMIntAcc, из них большая часть — несоответствия в статусе «Доступно».\n"
            "• Операции: 8 Brokerage и 3 OTCSM открыты; плюс три открытых BrTrMnCore, включая приоритет 1 по производительности API_Counter_SaveLockFlag.\n"
            "• Три открытых приоритета 4 — все несоответствия по замедлениям (OTCSM, Brokerage, FMIntAcc).\n"
            "• Ядро по ЦБ дефектов в выгрузке не копит: 3 открытых — консультации.",
            size=14, color=INK)
    footer(s, 8)


def slide9(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "К ВСТРЕЧЕ", "Что важно сказать по сопровождению")
    items = [
        ("Поток не растёт.",
         "47 задач в месяц, полугодия совпали по 141. Сопровождение по объёму входа стабильно."),
        ("Растёт не вход, а хвост дефектов.",
         "Консультации закрываются (89%). Несоответствия за полгода не закрывались ни разу. При 11–14 новых в месяц это управляемый, но накопленный риск."),
        ("Половину решения держит налоговый учёт.",
         "TMN — 126 задач и 39 открытых. Любой разговор про мощность сопровождения начинается с TMN, затем FMIntAcc (61 / 24 открытых)."),
        ("Операции и ядро — меньший, но не нулевой контур.",
         "Brokerage+OTCSM дают 44 задачи названных продуктов; FICore — 11, без дефектного хвоста. Производительность API — отдельная тема (prio 1 и три prio 4)."),
        ("Октябрь в динамике не интерпретировать.",
         "В выгрузке нет регистраций после 29.09. 1 октября массово закрыты 76 консультаций — это событие данных, не «рекорд закрытий»."),
    ]
    box = s.shapes.add_textbox(Inches(0.7), Inches(1.2), Inches(12), Inches(5.6))
    tf = box.text_frame
    tf.word_wrap = True
    for i, (a, b) in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(14)
        r = p.add_run()
        set_run(r, f"{i+1}. {a}  ", size=16, bold=True, color=NAVY)
        r2 = p.add_run()
        set_run(r2, b, size=16, color=INK)
    footer(s, 9)


def main():
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H
    slide1(prs)
    slide2(prs)
    slide3(prs)
    slide4(prs)
    slide5(prs)
    slide6(prs)
    slide7(prs)
    slide8(prs)
    slide9(prs)
    prs.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
