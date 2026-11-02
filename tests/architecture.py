"""Dependency checks that do not require a browser or third-party packages."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
IMPORT = re.compile(
    r"(?:^import\s+(?:[^;'\"]+?\s+from\s+)?|^export\s+[^;'\"]+?\s+from\s+)['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)
DYNAMIC_IMPORT = re.compile(r"\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")


def strip_comments(text):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'//.*', '', text)
    return text


def check_architecture():
    files = {path.resolve() for path in (ROOT / 'js').rglob('*.js')}
    graph = {}
    for path in sorted(files):
        targets = []
        code = strip_comments(path.read_text())
        specs = IMPORT.findall(code) + DYNAMIC_IMPORT.findall(code)
        for spec in specs:
            assert spec.startswith('.'), f'Unexpected external import in {path}: {spec}'
            target = (path.parent / spec).resolve()
            assert target in files, f'Missing module: {path.relative_to(ROOT)} -> {spec}'
            targets.append(target)
        graph[path] = targets

    visited, active, stack = set(), set(), []

    def visit(path):
        if path in active:
            cycle = stack[stack.index(path):] + [path]
            raise AssertionError('Circular imports: ' + ' -> '.join(str(p.relative_to(ROOT)) for p in cycle))
        if path in visited:
            return
        active.add(path)
        stack.append(path)
        for target in graph[path]:
            visit(target)
        stack.pop()
        active.remove(path)
        visited.add(path)

    for path in sorted(files):
        visit(path)

    for path, targets in graph.items():
        # Only main.js and feature modules may import from features/
        if path.parent.name != 'features' and path.name != 'main.js':
            assert not any(target.parent.name == 'features' for target in targets), (
                f'{path.relative_to(ROOT)} imports a feature; wire screens in main.js instead'
            )
        # Static curriculum and data modules must remain purely self-contained
        if path.parent.name == 'data':
            assert not any(target.parent.name in ('core', 'ui', 'features', 'strokes') for target in targets), (
                f'Data module {path.relative_to(ROOT)} must not depend on application logic or UI'
            )
        # Direct state mutation is strictly prohibited outside core/
        if path.parent.name != 'core':
            code = strip_comments(path.read_text())
            assert not re.search(r'\bstate(?:\.\w+|\[[^\]\n]+\])+\s*(?:=(?!=)|\+=|-=|\+\+|--)', code), (
                f'{path.relative_to(ROOT)} changes progress directly; use a core action'
            )
    storage = ROOT / 'js/core/storage.js'
    assert not graph[storage], 'Persistence must not depend on application state or UI'
    print(f'PASS architecture: {len(files)} modules, no circular imports or reverse feature dependencies')


if __name__ == '__main__':
    check_architecture()
