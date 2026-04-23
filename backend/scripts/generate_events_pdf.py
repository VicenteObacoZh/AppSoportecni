import json
import sys
import base64
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def main():
    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8-sig") as handle:
        payload = json.load(handle)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    title_style.fontName = "Helvetica-Bold"
    title_style.fontSize = 16
    title_style.leading = 18
    title_style.spaceAfter = 4

    heading_style = styles["Heading2"]
    heading_style.fontName = "Helvetica-Bold"
    heading_style.fontSize = 12
    heading_style.leading = 14
    heading_style.spaceAfter = 8
    heading_style.spaceBefore = 12

    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#4b5563"),
    )

    cell_style = ParagraphStyle(
        "Cell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
    )

    story = []

    logo_cell = ""
    logo_bytes = None
    logo_base64 = payload.get("logoBase64")
    if logo_base64:
        try:
            logo_bytes = base64.b64decode(str(logo_base64))
        except Exception:
            logo_bytes = None

    if logo_bytes:
        try:
            logo = Image(io.BytesIO(logo_bytes), width=24 * mm, height=24 * mm)
            logo.hAlign = "LEFT"
            logo_cell = logo
        except Exception:
            logo_cell = ""

    header_text = [
        Paragraph(str(payload.get("companyName") or "Empresa Tecnologica Soportecni"), title_style),
        Paragraph(str(payload.get("title") or "Reporte de Eventos"), heading_style),
        Paragraph(f"Generado: {payload.get('generatedAt') or '-'}", meta_style),
        Paragraph(str(payload.get("dateRangeLabel") or f"{payload.get('fromLabel') or payload.get('from') or '-'} - {payload.get('toLabel') or payload.get('to') or '-'}"), meta_style),
    ]
    header_table = Table([[logo_cell, header_text]], colWidths=[30 * mm, 235 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 8))

    summary_headers = [
        "Dispositivos seleccionados",
        "Dispositivos con eventos",
        "Eventos",
        "Tipos distintos",
    ]
    summary_values = [str(item.get("value") or "0") for item in payload.get("summary", [])]
    summary_table = Table([summary_headers, summary_values], colWidths=[65 * mm, 65 * mm, 45 * mm, 45 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 10))

    for report in payload.get("reports", []):
        story.append(Paragraph(str(report.get("deviceName") or "Unidad"), heading_style))

        detail_headers = ["Eventos", "Primer evento", "Ultimo evento"]
        detail_values = [
            str(report.get("eventCount") or "0"),
            str(report.get("firstEvent") or "-"),
            str(report.get("lastEvent") or "-"),
        ]
        detail_table = Table([detail_headers, detail_values], colWidths=[40 * mm, 55 * mm, 55 * mm])
        detail_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(detail_table)
        story.append(Spacer(1, 8))

        table_rows = [[
            Paragraph("Fecha y hora", cell_style),
            Paragraph("Tipo", cell_style),
            Paragraph("Mensaje", cell_style),
            Paragraph("Velocidad", cell_style),
            Paragraph("Ubicacion", cell_style),
        ]]

        report_rows = report.get("rows") or []
        if report_rows:
            for row in report_rows:
                table_rows.append([
                    Paragraph(str(row.get("eventTime") or "-"), cell_style),
                    Paragraph(str(row.get("eventType") or "-"), cell_style),
                    Paragraph(str(row.get("message") or "-"), cell_style),
                    Paragraph(str(row.get("speedLabel") or "-"), cell_style),
                    Paragraph(str(row.get("address") or "-"), cell_style),
                ])
        else:
            table_rows.append([
                Paragraph("Sin eventos para este dispositivo en el rango seleccionado.", cell_style),
                "",
                "",
                "",
                "",
            ])

        event_table = Table(
            table_rows,
            repeatRows=1,
            colWidths=[34 * mm, 26 * mm, 82 * mm, 24 * mm, 86 * mm],
        )
        event_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(event_table)
        story.append(Spacer(1, 10))

    doc.build(story)


if __name__ == "__main__":
    main()
