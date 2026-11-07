"""Generate the Spanish manual as A4 PDF. Requires reportlab (no portal dependency)."""
from pathlib import Path
import html
import re
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'docs/MANUAL-USUARIO-UPOST.pdf'
FONTS = Path('C:/Windows/Fonts')
for name, filename in [('Portal', 'arial.ttf'), ('Portal-Bold', 'arialbd.ttf'), ('Portal-Italic', 'ariali.ttf'), ('Editorial', 'georgiab.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Portal', normal='Portal', bold='Portal-Bold', italic='Portal-Italic', boldItalic='Portal-Bold')
RED = colors.HexColor('#B91C1C')
INK = colors.HexColor('#171717')
GRAY = colors.HexColor('#626262')
PAGE_W, PAGE_H = A4
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyPortal', fontName='Portal', fontSize=9.5, leading=14, spaceAfter=7, textColor=INK))
styles.add(ParagraphStyle(name='Chapter', fontName='Editorial', fontSize=18, leading=23, spaceBefore=17, spaceAfter=11, keepWithNext=True, textColor=INK))
styles.add(ParagraphStyle(name='SubPortal', fontName='Portal-Bold', fontSize=11, leading=15, spaceBefore=13, spaceAfter=7, keepWithNext=True, textColor=RED))
styles.add(ParagraphStyle(name='ListPortal', parent=styles['BodyPortal'], leftIndent=15, firstLineIndent=-12, spaceAfter=5))
styles.add(ParagraphStyle(name='CellPortal', parent=styles['BodyPortal'], fontSize=8.5, leading=12, spaceAfter=0))
styles.add(ParagraphStyle(name='CoverTitle', fontName='Editorial', fontSize=34, leading=40, textColor=INK, spaceAfter=22))
styles.add(ParagraphStyle(name='CoverSub', fontName='Portal', fontSize=14, leading=21, textColor=GRAY, spaceAfter=16))
styles.add(ParagraphStyle(name='IndexPortal', fontName='Portal', fontSize=9.5, leading=14, textColor=INK, leftIndent=0, rightIndent=20, spaceBefore=1))

def inline(text):
    text = text.replace('—', '-').replace('–', '-').replace('\u2011', '-')
    text = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', text)
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<font color="#626262">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    return text

def footer(canvas, doc):
    if doc.page == 1:
        return
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#E5E5E5'))
    canvas.line(50, 43, PAGE_W - 50, 43)
    canvas.setFont('Portal', 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(50, 29, 'UPOST.uy | Manual del usuario')
    canvas.drawRightString(PAGE_W - 50, 29, f'Página {doc.page}')
    canvas.restoreState()

class ManualDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Chapter' and hasattr(flowable, '_bookmark'):
            self.canv.bookmarkPage(flowable._bookmark)
            self.canv.addOutlineEntry(flowable.getPlainText(), flowable._bookmark, level=0)
            self.notify('TOCEntry', (0, flowable.getPlainText(), self.page, flowable._bookmark))

doc = ManualDoc(str(TARGET), pagesize=A4, leftMargin=50, rightMargin=50, topMargin=48, bottomMargin=59,
                title='Manual del usuario - UPOST.uy', author='UPOST.uy - Periodistas en Red', allowSplitting=True)
frame = Frame(50, 59, PAGE_W - 100, PAGE_H - 107, leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0)
doc.addPageTemplates(PageTemplate(id='Manual', frames=[frame], onPage=footer))
logo = Image(str(ROOT / 'public/brand/upost-logo.png'))
ratio = logo.imageWidth / logo.imageHeight
logo.drawWidth = 320
logo.drawHeight = 320 / ratio
logo.hAlign = 'LEFT'
story = [Spacer(1, 65), logo, Spacer(1, 60), Paragraph('Manual del usuario', styles['CoverTitle']),
         Paragraph('Portal periodístico UPOST.uy', styles['CoverSub']),
         Paragraph('Guía práctica para periodistas, editores y administradores', styles['CoverSub']),
         Spacer(1, 27), Paragraph('Edición de entrega · 6 de noviembre de 2026', styles['BodyPortal']),
         Paragraph('Periodistas en Red', styles['SubPortal']), PageBreak(), Paragraph('Índice', styles['Chapter'])]
toc = TableOfContents()
toc.levelStyles = [styles['IndexPortal']]
toc.dotsMinLevel = 0
story += [toc, PageBreak()]

lines = (ROOT / 'docs/MANUAL-USUARIO-UPOST.md').read_text(encoding='utf-8').splitlines()
index = 0
chapter = 0
while index < len(lines):
    line = lines[index].strip()
    index += 1
    if not line or line.startswith('# ') or (chapter == 0 and not line.startswith('## ')):
        continue
    if line.startswith('## '):
        chapter += 1
        title = line[3:]
        para = Paragraph(inline(title), styles['Chapter'])
        para._bookmark = f'chapter-{chapter}'
        story.append(para)
    elif line.startswith('### '):
        story.append(Paragraph(inline(line[4:]), styles['SubPortal']))
    elif line.startswith('|'):
        rows = []
        while True:
            if not re.match(r'^\|[\s:|\-]+\|$', line):
                rows.append([Paragraph(inline(cell.strip()), styles['CellPortal']) for cell in line.strip('|').split('|')])
            if index >= len(lines) or not lines[index].strip().startswith('|'):
                break
            line = lines[index].strip()
            index += 1
        widths = [125, PAGE_W - 225] if len(rows[0]) == 2 else None
        table = Table(rows, colWidths=widths, repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F4F4F4')),
                                  ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 9),
                                  ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 8),
                                  ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                                  ('LINEBELOW', (0, 0), (-1, 0), .7, RED),
                                  ('LINEBELOW', (0, 1), (-1, -1), .3, colors.HexColor('#E5E5E5'))]))
        story += [table, Spacer(1, 11)]
    else:
        is_list = bool(re.match(r'^(\d+\.|-)\s', line))
        if line.startswith('- '):
            line = '• ' + line[2:]
        if not is_list:
            while index < len(lines) and lines[index].strip() and not re.match(r'^(#|\||\d+\.|-)\s?', lines[index].strip()):
                line += ' ' + lines[index].strip()
                index += 1
        story.append(Paragraph(inline(line), styles['ListPortal' if is_list else 'BodyPortal']))

doc.multiBuild(story)
print(f'Generated {TARGET.name}; {chapter} chapters; {TARGET.stat().st_size} bytes.')
