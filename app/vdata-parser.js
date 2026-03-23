/**
 * VDATA Parser & Serializer — ported from server.py
 */

'use strict';

const HEADER_COMMENT =
  '<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->';

/* ─── Parser ──────────────────────────────────────────────────── */

function parseVdata(content) {
  const lines = content.split('\n');
  const state = { idx: 0 };

  function skipWhitespace() {
    while (state.idx < lines.length) {
      const trimmed = lines[state.idx].trim();
      if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('<!--')) {
        state.idx++;
      } else {
        break;
      }
    }
  }

  function parseValue(line) {
    line = line.trim();
    if (line === '') return '';
    if (line === 'true') return true;
    if (line === 'false') return false;
    if (line.startsWith('"') && line.endsWith('"')) return line.slice(1, -1);
    if (line.startsWith('resource_name:') || line.startsWith('soundevent:')) return line;
    if (/^-?\d+$/.test(line)) return parseInt(line, 10);
    if (/^-?\d+\.\d+$/.test(line)) return parseFloat(line);
    return line;
  }

  function parseBlock() {
    const obj = {};
    const orderedKeys = [];

    while (state.idx < lines.length) {
      skipWhitespace();
      if (state.idx >= lines.length) break;

      const trimmed = lines[state.idx].trim();

      if (trimmed === '}' || trimmed === '},') { state.idx++; break; }
      if (trimmed === ']' || trimmed === '],') { state.idx++; break; }

      const eqMatch = trimmed.match(/^("?[^"=]+"?|[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)/);
      if (eqMatch) {
        let key = eqMatch[1].trim();
        if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
        let rest = eqMatch[2].trim();

        if (rest === '' || rest === '\r') {
          state.idx++;
          skipWhitespace();
          if (state.idx >= lines.length) break;
          const nxt = lines[state.idx].trim();
          if (nxt === '{') {
            state.idx++;
            obj[key] = parseBlock();
            orderedKeys.push(key);
          } else if (nxt === '[') {
            state.idx++;
            obj[key] = parseArray();
            orderedKeys.push(key);
          }
        } else if (rest === '{') {
          state.idx++;
          obj[key] = parseBlock();
          orderedKeys.push(key);
        } else if (rest === '[') {
          state.idx++;
          obj[key] = parseArray();
          orderedKeys.push(key);
        } else {
          obj[key] = parseValue(rest);
          orderedKeys.push(key);
          state.idx++;
        }
      } else {
        state.idx++;
      }
    }

    obj.__orderedKeys = orderedKeys;
    return obj;
  }

  function parseArray() {
    const arr = [];
    while (state.idx < lines.length) {
      skipWhitespace();
      if (state.idx >= lines.length) break;
      const trimmed = lines[state.idx].trim();

      if (trimmed === ']' || trimmed === '],') { state.idx++; break; }

      if (trimmed === '{') {
        state.idx++;
        arr.push(parseBlock());
      } else {
        let val = trimmed;
        if (val.endsWith(',')) val = val.slice(0, -1);
        arr.push(parseValue(val));
        state.idx++;
      }
    }
    return arr;
  }

  skipWhitespace();
  skipWhitespace();
  if (state.idx < lines.length && lines[state.idx].trim() === '{') {
    state.idx++;
  }

  return parseBlock();
}

/* ─── Serializer ──────────────────────────────────────────────── */

function serializeValue(val) {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') {
    if (val.startsWith('resource_name:') || val.startsWith('soundevent:')) return val;
    return `"${val}"`;
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(6);
  }
  return String(val);
}

function serializeBlock(obj, lines, depth) {
  const indent = '\t'.repeat(depth);
  const keys = obj.__orderedKeys || Object.keys(obj).filter(k => k !== '__orderedKeys');

  for (const key of keys) {
    if (key === '__orderedKeys') continue;
    const val = obj[key];
    const quotedKey = /^\d+$/.test(String(key)) ? `"${key}"` : key;

    if (Array.isArray(val)) {
      lines.push(`${indent}${quotedKey} = `);
      lines.push(`${indent}[`);
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${indent}\t{`);
          serializeBlock(item, lines, depth + 2);
          lines.push(`${indent}\t},`);
        } else {
          lines.push(`${indent}\t${serializeValue(item)},`);
        }
      }
      lines.push(`${indent}]`);
    } else if (typeof val === 'object' && val !== null) {
      lines.push(`${indent}${quotedKey} = `);
      lines.push(`${indent}{`);
      serializeBlock(val, lines, depth + 1);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}${quotedKey} = ${serializeValue(val)}`);
    }
  }
}

function serializeVdata(data, headerComment) {
  const lines = [];
  if (headerComment) lines.push(headerComment);
  lines.push('{');
  serializeBlock(data, lines, 1);
  lines.push('}');
  return lines.join('\n');
}

module.exports = { parseVdata, serializeVdata, HEADER_COMMENT };
