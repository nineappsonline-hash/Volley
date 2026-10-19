export type RosterImportRow = { name: string; email: string; phone: string; branch: string };
/** Small RFC 4180 reader: quotes, escaped quotes, BOM and multiline fields. */
export function parseRosterCsv(text: string): RosterImportRow[] {
 if (text.length > 512000) throw new Error('Maximum CSV size is 500 KB');
 const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++) {
  const c=source[i];
  if(quoted) { if(c==='"') { if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;} }else cell+=c; }
  else if(c==='"'){if(cell||closed)throw new Error('Unexpected quote in CSV');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell.trim());cell='';closed=false;if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];}}
  else {if(closed&&!/\s/.test(c))throw new Error('Unexpected text after closing quote');cell+=c;}
 }
 if(quoted)throw new Error('Unclosed CSV quote');
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(!rows.length)throw new Error('CSV is empty');
 const headers=rows.shift()!.map(h=>h.toLowerCase());
 if(!headers.includes('name')||new Set(headers).size!==headers.length||headers.some(h=>!['name','email','phone','branch'].includes(h)))throw new Error('Use name,email,phone,branch headers (name is required)');
 if(rows.length<1||rows.length>500)throw new Error('Import between 1 and 500 rows');
 return rows.map((cells,index)=>{if(cells.length!==headers.length)throw new Error(`Row ${index+2}: column count does not match`);const obj=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));return {name:obj.name??'',email:obj.email?.toLowerCase()??'',phone:obj.phone??'',branch:obj.branch??''};});
}
/** Spreadsheet exports never execute user-entered formulas. */
export function safeCsvCell(value: unknown) {
 let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function csvText(headers: string[],rows: unknown[][]) {return '\uFEFF'+[headers,...rows].map(row=>row.map(safeCsvCell).join(',')).join('\r\n');}
