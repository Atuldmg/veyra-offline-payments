#!/usr/bin/env python3
import os
import re
import subprocess

def strip_php(file_path):
    php_script = '''
    $code = file_get_contents($argv[1]);
    $tokens = token_get_all($code);
    $out = "";
    foreach ($tokens as $t) {
        if (is_array($t)) {
            if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) {
                if (str_ends_with($t[1], "\n")) $out .= "\n";
                continue;
            }
            $out .= $t[1];
        } else {
            $out .= $t;
        }
    }
    // Clean up excessive blank lines (more than 2 blank lines -> 1)
    $out = preg_replace("/(\\r?\\n){3,}/", "\n\n", $out);
    file_put_contents($argv[1], $out);
    '''
    subprocess.run(['php', '-r', php_script, file_path], check=True)

def strip_html_xml(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Remove <!-- ... -->
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
    # Collapse multiple blank lines
    content = re.sub(r'(\r?\n\s*){3,}\n', '\n\n', content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

def strip_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # In CSS, comments are /* ... */. We must avoid removing inside strings.
    res = []
    i = 0
    n = len(content)
    while i < n:
        if content[i] == '"' or content[i] == "'":
            quote = content[i]
            res.append(quote)
            i += 1
            while i < n and content[i] != quote:
                if content[i] == '\\' and i + 1 < n:
                    res.append(content[i:i+2])
                    i += 2
                else:
                    res.append(content[i])
                    i += 1
            if i < n:
                res.append(content[i])
                i += 1
        elif i + 1 < n and content[i:i+2] == '/*':
            end = content.find('*/', i + 2)
            if end == -1:
                break
            i = end + 2
        else:
            res.append(content[i])
            i += 1
    cleaned = ''.join(res)
    cleaned = re.sub(r'(\r?\n\s*){3,}\n', '\n\n', cleaned)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

def strip_c_like(file_path, is_js=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    res = []
    i = 0
    n = len(content)
    while i < n:
        # String literals
        if content[i] == '"' or (is_js and content[i] == "'") or (is_js and content[i] == '`'):
            quote = content[i]
            # Check triple quote in Java
            if not is_js and i + 2 < n and content[i:i+3] == '"""':
                res.append('"""')
                i += 3
                while i < n and content[i:i+3] != '"""':
                    if content[i] == '\\' and i + 1 < n:
                        res.append(content[i:i+2])
                        i += 2
                    else:
                        res.append(content[i])
                        i += 1
                if i < n:
                    res.append('"""')
                    i += 3
                continue

            res.append(quote)
            i += 1
            while i < n and content[i] != quote:
                if content[i] == '\\' and i + 1 < n:
                    res.append(content[i:i+2])
                    i += 2
                else:
                    res.append(content[i])
                    i += 1
            if i < n:
                res.append(content[i])
                i += 1
        elif not is_js and content[i] == "'":
            # Char literal in Java
            res.append("'")
            i += 1
            while i < n and content[i] != "'":
                if content[i] == '\\' and i + 1 < n:
                    res.append(content[i:i+2])
                    i += 2
                else:
                    res.append(content[i])
                    i += 1
            if i < n:
                res.append("'")
                i += 1
        elif i + 1 < n and content[i:i+2] == '//':
            end = content.find('\n', i + 2)
            if end == -1:
                break
            i = end  # keep the newline
        elif i + 1 < n and content[i:i+2] == '/*':
            end = content.find('*/', i + 2)
            if end == -1:
                break
            i = end + 2
        else:
            res.append(content[i])
            i += 1
    cleaned = ''.join(res)
    cleaned = re.sub(r'(\r?\n\s*){3,}\n', '\n\n', cleaned)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

def strip_sql(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('--'):
            continue
        # If line has inline comment e.g. "something -- comment"
        if '-- ' in line:
            # check if inside quotes
            idx = line.find('-- ')
            quotes = line[:idx].count("'")
            if quotes % 2 == 0:
                line = line[:idx].rstrip() + '\n'
        cleaned_lines.append(line)
    cleaned = ''.join(cleaned_lines)
    cleaned = re.sub(r'(\r?\n\s*){3,}\n', '\n\n', cleaned)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

def strip_properties(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    cleaned_lines = [l for l in lines if not l.strip().startswith('#') and not l.strip().startswith('!')]
    cleaned = ''.join(cleaned_lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"Stripping comments in {root_dir}...")

    # 1. backend-php
    for dirpath, _, filenames in os.walk(os.path.join(root_dir, 'backend-php')):
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            if fname.endswith('.php'):
                strip_php(fpath)
                print(f"Stripped PHP: {fpath}")
            elif fname.endswith('.html'):
                strip_html_xml(fpath)
                print(f"Stripped HTML: {fpath}")
            elif fname.endswith('.css'):
                strip_css(fpath)
                print(f"Stripped CSS: {fpath}")
            elif fname.endswith('.js'):
                strip_c_like(fpath, is_js=True)
                print(f"Stripped JS: {fpath}")

    # 2. database
    schema_path = os.path.join(root_dir, 'database', 'schema.sql')
    if os.path.exists(schema_path):
        strip_sql(schema_path)
        print(f"Stripped SQL: {schema_path}")

    # 3. tests
    test_path = os.path.join(root_dir, 'tests', 'verify_redesign.php')
    if os.path.exists(test_path):
        strip_php(test_path)
        print(f"Stripped test PHP: {test_path}")

    # 4. Java project: UPI_Without_Internet-main
    java_root = os.path.join(root_dir, 'UPI_Without_Internet-main')
    if os.path.exists(java_root):
        for dirpath, _, filenames in os.walk(java_root):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                if fname.endswith('.java'):
                    strip_c_like(fpath, is_js=False)
                    print(f"Stripped Java: {fpath}")
                elif fname.endswith('.xml'):
                    strip_html_xml(fpath)
                    print(f"Stripped XML: {fpath}")
                elif fname.endswith('.properties'):
                    strip_properties(fpath)
                    print(f"Stripped properties: {fpath}")

    print("Done stripping comments!")

if __name__ == '__main__':
    main()
