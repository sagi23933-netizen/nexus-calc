/**
 * Minimal ExcelJS replacement for Cloudflare: writes a real .xlsx (single sheet, header row
 * styled, RTL view, frozen header, auto-filter) using fflate. Implements only the subset the
 * admin export uses.
 */
import { strToU8, zipSync } from 'fflate';

const esc = (v) => String(v).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // eslint-disable-line no-control-regex -- XML forbids these characters
const colName = (n) => {
  let s = '';
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

class Worksheet {
  constructor(name, opts = {}) {
    this.name = String(name).slice(0, 31).replace(/[\\/*?:[\]]/g, ' ');
    this.rtl = !!opts.views?.[0]?.rightToLeft;
    this.frozen = opts.views?.[0]?.state === 'frozen' ? opts.views[0].ySplit || 1 : 0;
    this.cols = [];
    this.rows = [];
    this.headerStyled = false;
    this.autoFilter = null;
  }
  set columns(cols) {
    this.cols = cols;
  }
  get columns() {
    return this.cols;
  }
  addRows(rows) {
    this.rows.push(...rows);
  }
  getRow() {
    const ws = this;
    return {
      set font(_v) {
        ws.headerStyled = true;
      },
      set fill(_v) {
        ws.headerStyled = true;
      },
    };
  }
  toXml() {
    const cell = (ref, v, style = '') => {
      if (v == null || v === '') return '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    };
    const header = `<row r="1">${this.cols.map((c, i) => cell(`${colName(i)}1`, c.header, this.headerStyled ? ' s="1"' : '')).join('')}</row>`;
    const body = this.rows
      .map((r, ri) => `<row r="${ri + 2}">${this.cols.map((c, ci) => cell(`${colName(ci)}${ri + 2}`, r[c.key])).join('')}</row>`)
      .join('');
    const widths = this.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`).join('');
    const pane = this.frozen ? `<pane ySplit="${this.frozen}" topLeftCell="A${this.frozen + 1}" activePane="bottomLeft" state="frozen"/>` : '';
    const last = `${colName(Math.max(0, this.cols.length - 1))}${this.rows.length + 1}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${this.rtl ? ' rightToLeft="1"' : ''}>${pane}</sheetView></sheetViews>${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${header}${body}</sheetData>${this.autoFilter ? `<autoFilter ref="A1:${last}"/>` : ''}</worksheet>`;
  }
}

class Workbook {
  constructor() {
    this.creator = '';
    this.sheets = [];
    this.xlsx = { write: async (res) => res.write(this.build()), writeBuffer: async () => this.build() };
  }
  addWorksheet(name, opts) {
    const ws = new Worksheet(name, opts);
    this.sheets.push(ws);
    return ws;
  }
  build() {
    const files = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${this.sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${this.sheets
        .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets>${this.sheets
        .map((s, i) => (s.autoFilter ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name)}'!$A$1:$${colName(Math.max(0, s.cols.length - 1))}$${s.rows.length + 1}</definedName></definedNames>` : ''))
        .join('')}</workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E5C2E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    };
    this.sheets.forEach((s, i) => {
      files[`xl/worksheets/sheet${i + 1}.xml`] = s.toXml();
    });
    return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
  }
}

export default { Workbook };
export { Workbook };
