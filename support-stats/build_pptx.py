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
INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x5C, 0x5C, 0x5C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PAPER = RGBColor(0xF4, 0xF6, 0xF8)
LINE = RGBColor(0xD0, 0xD7, 0xDE)

W = Inches(13.333)
H = Inches(7.5)

MONTHS = ["Апр", "Май", "Июн", "Июл", "Авг", "Сен"]
ALL = [58, 44, 39, 42, 52, 47]
TAX = [29, 21, 19, 24, 26, 29]
INTA = [11, 14, 9, 10, 13, 8]
OPS = [16, 6, 7, 6, 11, 7]
CORE = [2, 2, 3, 2, 2, 3]


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
    sh = slide.shapes.add_shape(1, l, t, w, h)
    fill_solid(sh, color)
    return sh


def textbox(slide, l, t, w, h, lines, **kw):
    sh = slide.shapes.add_textbox(l, t, w, h)
    add_text(sh, lines, **kw)
    return sh


def footer(slide, page, total=9):
    textbox(
        slide, Inches(0.6), Inches(7.15), Inches(10.4), Inches(0.28),
        "Сопровождение брокерского обслуживания  ·  выгрузка на 19.10.2026  ·  регистрации апрель–сентябрь 2026",
        size=10, color=MUTED,
    )
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
            set_run(run, str(data[r][c]), size=11, bold=is_header or c == 0,
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
    textbox(s, Inches(0.8), Inches(3.7), Inches(11), Inches(0.9),
            "Ежемесячная динамика по решению и по продуктам\nвид задач: консультации, несоответствия, требования в спринте",
            size=18, color=INK)
    textbox(s, Inches(0.8), Inches(5.2), Inches(11.5), Inches(1.2),
            "Конечное состояние: консультация — «Работа завершена»; несоответствие и требование в спринте — «Доступно».\n"
            "Период регистраций: апрель — сентябрь 2026. Срез: 19 октября 2026. 282 задачи. Клиент в выгрузке: ПСБ.",
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
             "248", "в конечном состоянии", "88% контура закрыто")
    kpi_card(s, Inches(9.9), Inches(1.25), Inches(2.8), Inches(1.55),
             "34", "ещё в работе", "23 консультации, 8 дефектов, 3 требования",
             value_color=ACCENT)

    data = CategoryChartData()
    data.categories = ["Консультации", "Несоответствия", "Требования в спринте"]
    data.add_series("Задачи", (212, 65, 5))
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.DOUGHNUT, Inches(0.5), Inches(3.15), Inches(5.0), Inches(3.5), data
    ).chart
    chart.has_legend = True
    chart.legend.position = XL_LEGEND_POSITION.BOTTOM
    chart.legend.include_in_layout = False
    chart.legend.font.size = Pt(12)
    colors = [NAVY2, ACCENT, GOLD]
    for series in chart.series:
        for j, pt in enumerate(series.points):
            pt.format.fill.solid()
            pt.format.fill.fore_color.rgb = colors[j]

    box = s.shapes.add_textbox(Inches(5.6), Inches(3.25), Inches(7.2), Inches(3.4))
    tf = box.text_frame
    tf.word_wrap = True
    items = [
        ("75% потока — консультации (212).", "189 закрыты, 23 в работе, в основном ждут клиента."),
        ("23% — несоответствия (65).", "57 в конечном «Доступно», 8 ещё уточняются."),
        ("5 требований в спринте.", "2 закрыты, 3 в работе — все открытые на налоге."),
        ("Поток стабилен: 47 задач в месяц.", "Полугодия совпали по 141 задаче."),
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
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.4), Inches(1.15), Inches(12.5), Inches(4.7), data
    ).chart
    style_chart(chart, [NAVY2])
    chart.has_legend = False
    plot = chart.plots[0]
    plot.has_data_labels = True
    plot.data_labels.font.size = Pt(12)
    plot.data_labels.font.bold = True
    plot.data_labels.font.color.rgb = NAVY
    textbox(
        s, Inches(0.6), Inches(5.95), Inches(12), Inches(1.0),
        "Ось X — месяц регистрации, ось Y — число задач, шт. Среднее 47. Пик в апреле (58), минимум в июне (39).\n"
        "Последняя регистрация в выгрузке — 29.09.2026, октябрь на график не ставим.",
        size=13, color=MUTED,
    )
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
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.BAR_CLUSTERED, Inches(0.4), Inches(1.15), Inches(8.2), Inches(4.6), data
    ).chart
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

    textbox(
        s, Inches(0.6), Inches(5.9), Inches(12.2), Inches(1.05),
        "В группы включены смежные коды той же части: налог — TaxFMExt, IncDed; внутренний учёт — API_FMIAcc, AccFMRule;\n"
        "операции — BrTrMnCore, SM, TrustManag, API_Broker; ядро — API_FCore, API_BTCore. Шесть названных продуктов — 255 из 282 (90%).",
        size=13, color=MUTED,
    )
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
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.COLUMN_STACKED, Inches(0.35), Inches(1.1), Inches(12.6), Inches(4.55), data
    ).chart
    style_chart(chart, [NAVY, TEAL, GOLD, NAVY2])
    textbox(
        s, Inches(0.6), Inches(5.75), Inches(12.2), Inches(1.2),
        "Ось X — месяц, ось Y — число зарегистрированных задач, шт. Налог каждый месяц самая большая доля (19–29).\n"
        "Внутренний учёт 8–14. Операции после апреля (16) держатся на 6–11. Ядро стабильно малое: 2–3 в месяц.",
        size=13, color=MUTED,
    )
    footer(s, 5)


def slide6(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ВИД ЗАДАЧ", "Консультации, несоответствия и требования по частям")
    data = CategoryChartData()
    data.categories = ["Налоговый учёт", "Внутренний учёт", "Операции", "Ядро по ЦБ"]
    data.add_series("Консультации", (109, 45, 42, 14))
    data.add_series("Несоответствия", (35, 20, 10, 0))
    data.add_series("Требования в спринте", (4, 0, 1, 0))
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.COLUMN_STACKED, Inches(0.35), Inches(1.1), Inches(7.6), Inches(4.5), data
    ).chart
    style_chart(chart, [NAVY2, ACCENT, GOLD])

    add_table(s, Inches(8.1), Inches(1.25), Inches(4.7), Inches(3.5), [
        ["Часть", "Конс.", "Несоотв.", "Треб.", "Итого"],
        ["Налог", "109", "35", "4", "148"],
        ["Внутр. учёт", "45", "20", "0", "65"],
        ["Операции", "42", "10", "1", "53"],
        ["Ядро ЦБ", "14", "0", "0", "14"],
        ["Прочие", "2", "0", "0", "2"],
        ["Всё решение", "212", "65", "5", "282"],
    ], col_w=[Inches(1.35), Inches(0.85), Inches(1.0), Inches(0.7), Inches(0.8)])

    textbox(
        s, Inches(0.6), Inches(5.75), Inches(12.2), Inches(1.2),
        "Ось X — часть решения, ось Y — число задач, шт. Несоответствия сосредоточены в налоге (35) и внутреннем учёте (20).\n"
        "Ядро по ЦБ — только консультации. Все 5 требований в спринте: 4 на налоге, 1 на операциях.",
        size=13, color=MUTED,
    )
    footer(s, 6)


def slide7(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "ВИД ЗАДАЧ", "На каком продукте сколько задач каждого вида")
    data = CategoryChartData()
    data.categories = ["TMN", "FMIntAcc", "Brokerage", "TaxFM", "FICore", "OTCSM"]
    data.add_series("Консультации", (96, 43, 30, 7, 11, 7))
    data.add_series("Несоответствия", (28, 18, 4, 4, 0, 3))
    data.add_series("Требования в спринте", (2, 0, 0, 2, 0, 0))
    chart = s.shapes.add_chart(
        XL_CHART_TYPE.COLUMN_STACKED, Inches(0.3), Inches(1.1), Inches(12.7), Inches(3.55), data
    ).chart
    style_chart(chart, [NAVY2, ACCENT, GOLD])

    add_table(s, Inches(0.5), Inches(4.75), Inches(12.3), Inches(2.15), [
        ["Продукт", "Часть", "Консультации", "Несоответствия", "Требования", "Итого", "В работе"],
        ["TMN", "Налог", "96", "28", "2", "126", "13"],
        ["FMIntAcc", "Внутр. учёт", "43", "18", "0", "61", "8"],
        ["Brokerage", "Операции", "30", "4", "0", "34", "6"],
        ["TaxFM", "Налог", "7", "4", "2", "13", "1"],
        ["FICore", "Ядро ЦБ", "11", "0", "0", "11", "3"],
        ["OTCSM", "Операции", "7", "3", "0", "10", "1"],
    ], col_w=[Inches(1.6), Inches(1.7), Inches(1.9), Inches(2.1), Inches(1.7), Inches(1.3), Inches(1.5)])
    footer(s, 7)


def slide8(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "В РАБОТЕ", "34 задачи не в конечном состоянии")
    add_table(s, Inches(0.5), Inches(1.2), Inches(12.3), Inches(2.55), [
        ["Часть / продукт", "Всего", "Закрыто", "В работе", "из них конс.", "из них несоотв.", "из них треб."],
        ["Налоговый учёт", "148", "134", "14", "9", "2", "3"],
        ["  TMN", "126", "113", "13", "9", "2", "2"],
        ["  TaxFM", "13", "12", "1", "0", "0", "1"],
        ["Внутренний учёт / FMIntAcc", "61", "53", "8", "6", "2", "0"],
        ["Операции / Brokerage", "34", "28", "6", "4", "2", "0"],
        ["Операции / OTCSM", "10", "9", "1", "0", "1", "0"],
        ["Ядро ЦБ / FICore", "11", "8", "3", "3", "0", "0"],
    ], col_w=[Inches(3.2), Inches(1.2), Inches(1.3), Inches(1.5), Inches(1.7), Inches(1.9), Inches(1.5)])

    textbox(
        s, Inches(0.6), Inches(4.0), Inches(12.2), Inches(2.8),
        "Где висит открытое\n"
        "• 23 консультации: 17 «уточняется у клиента», 4 «обращение в УА», 2 «уточняется у автора».\n"
        "• 8 несоответствий: 6 «уточняется у клиента», 2 «уточняется в УА». В конечном «Доступно» уже 57 из 65.\n"
        "• 3 требования в спринте: 2 «зарегистрировано», 1 «готов к демо» — TMN и TaxFM.\n"
        "• Несоответствия в работе точечные: TMN 2, FMIntAcc 2, Brokerage 2, OTCSM 1 (плюс 1 на SM).",
        size=15, color=INK,
    )
    footer(s, 8)


def slide9(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header_bar(s, "К ВСТРЕЧЕ", "Что важно сказать по сопровождению")
    items = [
        ("Поток не растёт.",
         "47 задач в месяц, полугодия совпали по 141. Вход стабилен."),
        ("Три четверти потока — консультации.",
         "212 консультаций, 65 несоответствий, 5 требований. Закрытие консультаций и дефектов почти одинаковое: 89% и 88%."),
        ("Несоответствия сидят на налоге и внутреннем учёте.",
         "TMN 28 дефектов, FMIntAcc 18. На операциях их мало (Brokerage 4, OTCSM 3), у FICore дефектов нет — только 11 консультаций."),
        ("В работе 34 задачи, не накопленный дефектный хвост.",
         "13 из них на TMN. Большая часть открытого — ожидание клиента, не очередь «Доступно»."),
        ("Октябрь в динамике входа не интерпретировать.",
         "Регистраций после 29.09 в выгрузке нет."),
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
