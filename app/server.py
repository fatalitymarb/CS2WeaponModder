"""
CS2WeaponModder - Python Server
No external dependencies required. Uses only Python standard library.
Run: python server.py
"""

import http.server
import json
import os
import sys
import re
import copy
import urllib.parse

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
PANORAMA_DIR = os.path.join(BASE_DIR, '..', 'panorama', 'images', 'icons', 'equipment')

# ─── Global State ──────────────────────────────────────────────

current_data = None
current_file_path = None
header_comment = '<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->'


# ─── VDATA Parser ──────────────────────────────────────────────

def parse_vdata(content):
    lines = content.split('\n')
    state = {'idx': 0}

    def skip_whitespace():
        while state['idx'] < len(lines):
            trimmed = lines[state['idx']].strip()
            if trimmed == '' or trimmed.startswith('//') or trimmed.startswith('<!--'):
                state['idx'] += 1
            else:
                break

    def parse_value(line):
        line = line.strip()
        if line == '':
            return ''
        if line == 'true':
            return True
        if line == 'false':
            return False
        if line.startswith('"') and line.endswith('"'):
            return line[1:-1]
        if line.startswith('resource_name:') or line.startswith('soundevent:'):
            return line
        if re.match(r'^-?\d+$', line):
            return int(line)
        if re.match(r'^-?\d+\.\d+$', line):
            return float(line)
        return line

    def parse_block():
        obj = {}
        ordered_keys = []

        while state['idx'] < len(lines):
            skip_whitespace()
            if state['idx'] >= len(lines):
                break

            trimmed = lines[state['idx']].strip()

            if trimmed in ('}', '},'):
                state['idx'] += 1
                break

            if trimmed in (']', '],'):
                state['idx'] += 1
                break

            eq_match = re.match(r'^("?[^"=]+"?|[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)', trimmed)
            if eq_match:
                key = eq_match.group(1).strip()
                if key.startswith('"') and key.endswith('"'):
                    key = key[1:-1]
                rest = eq_match.group(2).strip()

                if rest == '' or rest == '\r':
                    state['idx'] += 1
                    skip_whitespace()
                    if state['idx'] >= len(lines):
                        break
                    nxt = lines[state['idx']].strip()
                    if nxt == '{':
                        state['idx'] += 1
                        obj[key] = parse_block()
                        ordered_keys.append(key)
                    elif nxt == '[':
                        state['idx'] += 1
                        obj[key] = parse_array()
                        ordered_keys.append(key)
                elif rest == '{':
                    state['idx'] += 1
                    obj[key] = parse_block()
                    ordered_keys.append(key)
                elif rest == '[':
                    state['idx'] += 1
                    obj[key] = parse_array()
                    ordered_keys.append(key)
                else:
                    obj[key] = parse_value(rest)
                    ordered_keys.append(key)
                    state['idx'] += 1
            else:
                state['idx'] += 1

        obj['__orderedKeys'] = ordered_keys
        return obj

    def parse_array():
        arr = []
        while state['idx'] < len(lines):
            skip_whitespace()
            if state['idx'] >= len(lines):
                break
            trimmed = lines[state['idx']].strip()

            if trimmed in (']', '],'):
                state['idx'] += 1
                break

            if trimmed == '{':
                state['idx'] += 1
                arr.append(parse_block())
            else:
                val = trimmed
                if val.endswith(','):
                    val = val[:-1]
                arr.append(parse_value(val))
                state['idx'] += 1

        return arr

    skip_whitespace()
    skip_whitespace()
    if state['idx'] < len(lines) and lines[state['idx']].strip() == '{':
        state['idx'] += 1

    result = parse_block()
    return result


# ─── VDATA Serializer ─────────────────────────────────────────

def serialize_vdata(data, hdr_comment):
    lines = []
    if hdr_comment:
        lines.append(hdr_comment)
    lines.append('{')
    serialize_block(data, lines, 1)
    lines.append('}')
    return '\n'.join(lines)


def serialize_block(obj, lines, depth):
    indent = '\t' * depth
    keys = obj.get('__orderedKeys', [k for k in obj if k != '__orderedKeys'])

    for key in keys:
        if key == '__orderedKeys':
            continue
        val = obj[key]
        quoted_key = f'"{key}"' if re.match(r'^\d+$', str(key)) else key

        if isinstance(val, list):
            lines.append(f'{indent}{quoted_key} = ')
            lines.append(f'{indent}[')
            for item in val:
                if isinstance(item, dict):
                    lines.append(f'{indent}\t{{')
                    serialize_block(item, lines, depth + 2)
                    lines.append(f'{indent}\t}},')
                else:
                    lines.append(f'{indent}\t{serialize_value(item)},')
            lines.append(f'{indent}]')
        elif isinstance(val, dict):
            lines.append(f'{indent}{quoted_key} = ')
            lines.append(f'{indent}{{')
            serialize_block(val, lines, depth + 1)
            lines.append(f'{indent}}}')
        else:
            lines.append(f'{indent}{quoted_key} = {serialize_value(val)}')


def serialize_value(val):
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, str):
        if val.startswith('resource_name:') or val.startswith('soundevent:'):
            return val
        return f'"{val}"'
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return f'{val:.6f}'
    return str(val)


# ─── HTTP Handler ──────────────────────────────────────────────

class WeaponEditorHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def log_message(self, format, *args):
        pass  # Suppress default logging

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length)

    def read_json(self):
        return json.loads(self.read_body().decode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/data':
            self.handle_get_data()
        elif path == '/api/load-default':
            self.handle_load_default()
        elif path.startswith('/api/weapon/'):
            key = urllib.parse.unquote(path[len('/api/weapon/'):])
            self.handle_get_weapon(key)
        elif path.startswith('/api/icon/'):
            name = urllib.parse.unquote(path[len('/api/icon/'):])
            self.handle_get_icon(name)
        elif path == '/api/icons':
            self.handle_get_icons()
        elif path == '/api/download':
            self.handle_download()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/load':
            self.handle_load_upload()
        elif path == '/api/load-path':
            self.handle_load_path()
        elif path == '/api/weapon':
            self.handle_add_weapon()
        elif path == '/api/save':
            self.handle_save()
        elif path == '/api/parse-models':
            self.handle_parse_models()
        elif path == '/api/batch-add':
            self.handle_batch_add()
        else:
            self.send_json({'error': 'Not found'}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/weapon/') and path.endswith('/full'):
            key = urllib.parse.unquote(path[len('/api/weapon/'):-len('/full')])
            self.handle_update_weapon_full(key)
        elif path.startswith('/api/weapon/'):
            key = urllib.parse.unquote(path[len('/api/weapon/'):])
            self.handle_update_weapon(key)
        else:
            self.send_json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/weapon/'):
            key = urllib.parse.unquote(path[len('/api/weapon/'):])
            self.handle_delete_weapon(key)
        else:
            self.send_json({'error': 'Not found'}, 404)

    # ─── GET handlers ─────────────────────────────────────────

    def handle_get_data(self):
        global current_data, current_file_path
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        self.send_json({'data': current_data, 'filePath': current_file_path})

    def handle_get_weapon(self, key):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        weapon = current_data.get(key)
        if weapon is None:
            return self.send_json({'error': 'Weapon not found'}, 404)
        self.send_json({'key': key, 'data': weapon})

    def handle_get_icon(self, name):
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '', name)
        icon_path = os.path.join(PANORAMA_DIR, f'{safe_name}.svg')
        if os.path.isfile(icon_path):
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            with open(icon_path, 'rb') as f:
                data = f.read()
            self.send_header('Content-Length', len(data))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    def handle_get_icons(self):
        icons = []
        if os.path.isdir(PANORAMA_DIR):
            for f in os.listdir(PANORAMA_DIR):
                if f.endswith('.svg'):
                    icons.append(f[:-4])
        self.send_json({'icons': icons})

    def handle_download(self):
        global current_data, header_comment
        if current_data is None:
            return self.send_json({'error': 'No data'}, 404)
        content = serialize_vdata(current_data, header_comment).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Disposition', 'attachment; filename="weapons.vdata"')
        self.send_header('Content-Length', len(content))
        self.end_headers()
        self.wfile.write(content)

    # ─── POST handlers ────────────────────────────────────────

    def handle_load_upload(self):
        global current_data, current_file_path, header_comment
        try:
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' in content_type:
                body = self.read_body()
                boundary = content_type.split('boundary=')[1].strip()
                file_content = self._extract_multipart_file(body, boundary)
                if not file_content:
                    return self.send_json({'error': 'No file in upload'}, 400)
            else:
                file_content = self.read_body().decode('utf-8')

            first_line = file_content.split('\n')[0].strip()
            if first_line.startswith('<!--'):
                header_comment = first_line

            current_data = parse_vdata(file_content)
            current_file_path = 'uploaded_file'
            self.send_json({'success': True, 'data': current_data, 'filePath': current_file_path})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def _extract_multipart_file(self, body, boundary):
        """Extract file content from multipart form data."""
        boundary_bytes = boundary.encode('utf-8')
        parts = body.split(b'--' + boundary_bytes)

        for part in parts:
            if b'filename=' in part:
                # Find the blank line separating headers from content
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                content = part[header_end + 4:]
                # Remove trailing \r\n-- if present
                if content.endswith(b'\r\n'):
                    content = content[:-2]
                if content.endswith(b'--'):
                    content = content[:-2]
                if content.endswith(b'\r\n'):
                    content = content[:-2]
                return content.decode('utf-8', errors='replace')
        return None

    def handle_load_default(self):
        global current_data, current_file_path, header_comment
        try:
            default_path = os.path.join(BASE_DIR, '..', 'weapons.vdata')
            default_path = os.path.normpath(default_path)

            if not os.path.isfile(default_path):
                return self.send_json({'error': 'Default weapons.vdata not found'}, 404)

            with open(default_path, 'r', encoding='utf-8') as f:
                content = f.read()

            first_line = content.split('\n')[0].strip()
            if first_line.startswith('<!--'):
                header_comment = first_line

            current_data = parse_vdata(content)
            current_file_path = default_path
            self.send_json({'success': True, 'data': current_data, 'filePath': current_file_path})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_load_path(self):
        global current_data, current_file_path, header_comment
        try:
            data = self.read_json()
            file_path = data.get('filePath', '')

            if not file_path:
                return self.send_json({'error': 'No path provided'}, 400)

            # Security: Only allow reading files with expected extensions
            if not os.path.isfile(file_path):
                return self.send_json({'error': 'File not found'}, 404)

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            first_line = content.split('\n')[0].strip()
            if first_line.startswith('<!--'):
                header_comment = first_line

            current_data = parse_vdata(content)
            current_file_path = file_path
            self.send_json({'success': True, 'data': current_data, 'filePath': current_file_path})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_add_weapon(self):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        try:
            data = self.read_json()
            key = data.get('key', '')
            base_key = data.get('baseKey', '')
            resource_name = data.get('resourceName', '')

            if not key or not base_key:
                return self.send_json({'error': 'Missing key or baseKey'}, 400)
            if key in current_data:
                return self.send_json({'error': 'Weapon already exists'}, 409)

            base = current_data.get(base_key)
            if base is None:
                return self.send_json({'error': 'Base weapon not found'}, 404)

            new_weapon = copy.deepcopy(base)
            if resource_name:
                new_weapon['m_szWorldModel'] = f'resource_name:"{resource_name}"'

            current_data[key] = new_weapon
            if '__orderedKeys' in current_data:
                current_data['__orderedKeys'].append(key)

            self.send_json({'success': True, 'data': new_weapon})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_save(self):
        global current_data, current_file_path, header_comment
        if current_data is None:
            return self.send_json({'error': 'No data to save'}, 404)
        try:
            data = self.read_json()
            target = data.get('filePath') or current_file_path
            if not target:
                return self.send_json({'error': 'No file path specified'}, 400)

            content = serialize_vdata(current_data, header_comment)
            with open(target, 'w', encoding='utf-8') as f:
                f.write(content)
            current_file_path = target

            self.send_json({'success': True, 'filePath': target})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_parse_models(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' in content_type:
                body = self.read_body()
                boundary = content_type.split('boundary=')[1].strip()
                file_content = self._extract_multipart_file(body, boundary)
            else:
                file_content = self.read_body().decode('utf-8')

            if not file_content:
                return self.send_json({'error': 'No file content'}, 400)

            models = [l.strip() for l in file_content.split('\n')
                      if l.strip().endswith('.vmdl')]
            self.send_json({'models': models})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_batch_add(self):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        try:
            data = self.read_json()
            weapons = data.get('weapons', [])
            results = []

            for w in weapons:
                key = w.get('key', '')
                base_key = w.get('baseKey', '')
                model_path = w.get('modelPath', '')
                name = w.get('name', '')

                if not key or not base_key:
                    results.append({'key': key, 'success': False, 'error': 'Missing key or baseKey'})
                    continue
                if key in current_data:
                    results.append({'key': key, 'success': False, 'error': 'Already exists'})
                    continue

                base = current_data.get(base_key)
                if base is None:
                    results.append({'key': key, 'success': False, 'error': 'Base not found'})
                    continue

                new_weapon = copy.deepcopy(base)
                if model_path:
                    new_weapon['m_szWorldModel'] = f'resource_name:"{model_path}"'
                if name:
                    new_weapon['m_szName'] = name

                current_data[key] = new_weapon
                if '__orderedKeys' in current_data:
                    current_data['__orderedKeys'].append(key)
                results.append({'key': key, 'success': True})

            self.send_json({'results': results})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    # ─── PUT handlers ─────────────────────────────────────────

    def handle_update_weapon(self, key):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        if key not in current_data:
            return self.send_json({'error': 'Weapon not found'}, 404)
        try:
            data = self.read_json()
            prop = data.get('property')
            value = data.get('value')
            current_data[key][prop] = value
            self.send_json({'success': True})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_update_weapon_full(self, key):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        if key not in current_data:
            return self.send_json({'error': 'Weapon not found'}, 404)
        try:
            data = self.read_json()
            current_data[key] = data.get('data', {})
            self.send_json({'success': True})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    # ─── DELETE handlers ──────────────────────────────────────

    def handle_delete_weapon(self, key):
        global current_data
        if current_data is None:
            return self.send_json({'error': 'No file loaded'}, 404)
        if key not in current_data:
            return self.send_json({'error': 'Weapon not found'}, 404)

        del current_data[key]
        if '__orderedKeys' in current_data:
            current_data['__orderedKeys'] = [k for k in current_data['__orderedKeys'] if k != key]

        self.send_json({'success': True})


# ─── Main ──────────────────────────────────────────────────────

def main():
    import webbrowser

    os.makedirs(PUBLIC_DIR, exist_ok=True)

    server = http.server.HTTPServer(('127.0.0.1', PORT), WeaponEditorHandler)
    url = f'http://localhost:{PORT}'

    print(f'\n  ╔══════════════════════════════════════╗')
    print(f'  ║       CS2WeaponModder v1.0           ║')
    print(f'  ║                                      ║')
    print(f'  ║  Running at {url:<24s}║')
    print(f'  ║  Press Ctrl+C to stop                ║')
    print(f'  ╚══════════════════════════════════════╝\n')

    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.')
        server.server_close()


if __name__ == '__main__':
    main()
