const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/ui', name + '.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  new Function('require', 'exports', output)((id) => {
    if (id === '@/store/useLanguage') return { useLanguage: () => 'en' };
    if (id === '@/lib/utils') return { cn: () => '' };
    if (id === './sorted-options') return load('sorted-options');
    return require(id);
  }, exports);
  return exports;
}
const { sortOptions } = load('sorted-options');
const { SelectItem } = load('select');
const { DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } = load('dropdown-menu');
const h = React.createElement;
const option = (type, label, value = label) => h(type, { key: value, value }, label);
const values = (nodes) => nodes.map(n => n.props.value);
assert.deepEqual(values(sortOptions([option(SelectItem, 'Zebra'), [option(SelectItem, 'apple'), option(SelectItem, 'Banana')]], 'en')), ['apple', 'Banana', 'Zebra']);
const fragment = h(React.Fragment, { key: 'group' }, option('option', 'Zulu'), option('option', 'Alpha'));
assert.deepEqual(values(sortOptions([fragment, option('option', 'Bravo')], 'en')), ['Alpha', 'Bravo', 'Zulu']);
const header = h(DropdownMenuLabel, {}, 'Account');
const separator = h(DropdownMenuSeparator);
const click = () => {};
const action = h(DropdownMenuItem, { value: 'a', onClick: click }, h('a', {}, h('svg'), 'Alpha'));
const sorted = sortOptions([header, option(DropdownMenuCheckboxItem, 'Zulu'), separator, action], 'en');
assert.equal(sorted[0].type, DropdownMenuLabel);
assert.equal(sorted[2].type, DropdownMenuSeparator);
assert.equal(sorted[1].props.onClick, click);
assert.deepEqual(values(sorted.filter(n => n.props.value)), ['a', 'Zulu']);
assert.deepEqual(values(sortOptions(['100', '25', '0'].map(v => option('option', v + '%', v)), 'en')), ['0', '25', '100']);
const arabic = ['ياسمين', 'أحمد', 'باسم'];
assert.deepEqual(values(sortOptions(arabic.map(v => option('button', v)), 'ar')), ['أحمد', 'باسم', 'ياسمين']);
const input = [option(SelectItem, 'Zulu'), h(SelectItem, { value: 'explicit', textValue: 'Alpha', disabled: true }, 'Other')];
assert.equal(sortOptions(input, 'en')[0].props.disabled, true);
assert.equal(input[0].props.value, 'Zulu');
console.log('PASS: shared selects, action menus, native options, searchable buttons, fragments, translated labels, numeric labels, and preserved handlers');

const { renderToString } = require('react-dom/server');
const { Select, SelectContent, SelectItem: Item, SelectTrigger, SelectValue } = load('select');
function selectMarkup(props, valueProps = {}) {
  return renderToString(h(Select, props,
    h(SelectTrigger, {}, h(SelectValue, valueProps)),
    h(SelectContent, {}, h(Item, { value: 'all' }, 'All sports'), h(Item, { value: 'football' }, 'Football'))
  ));
}
assert.match(selectMarkup({ value: 'all' }), /<span[^>]*>All sports<\/span>/);
assert.match(selectMarkup({ defaultValue: 'football' }), /<span[^>]*>Football<\/span>/);
assert.match(selectMarkup({ value: '' }, { placeholder: 'Choose a sport' }), /Choose a sport/);
assert.match(selectMarkup({ value: 'all' }, { children: 'Custom label' }), /Custom label/);
console.log('PASS: controlled/default selected labels render before the menu mounts; placeholders and custom labels remain supported');
