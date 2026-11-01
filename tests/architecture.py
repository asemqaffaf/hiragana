"""Dependency checks that do not require a browser or third-party packages."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
IMPORT = re.compile(r"^import\s+(?:[^;'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]", re.MULTILINE)


def check_architecture():
    files = {path.resolve() for path in (ROOT / 'js').rglob('*.js')}
    graph = {}
    for path in files:
        targets = []
        for spec in IMPORT.findall(path.read_text()):
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
        if path.parent.name in ('core', 'ui'):
            assert not any(target.parent.name == 'features' for target in targets), (
                f'{path.relative_to(ROOT)} imports a feature; wire screens in main.js instead'
            )
        if path.parent.name in ('features', 'ui'):
            assert not re.search(r'\bstate(?:\.\w+|\[[^\]\n]+\])+\s*(?:=(?!=)|\+=|-=|\+\+|--)', path.read_text()), (
                f'{path.relative_to(ROOT)} changes progress directly; use a core action'
            )
    storage = ROOT / 'js/core/storage.js'
    assert not graph[storage], 'Persistence must not depend on application state or UI'
    print(f'PASS architecture: {len(files)} modules, no circular imports or reverse feature dependencies')


if __name__ == '__main__':
    check_architecture()
