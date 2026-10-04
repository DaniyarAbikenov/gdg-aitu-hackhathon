import ast
from pathlib import Path


def test_inner_layers_do_not_import_frameworks_or_adapters():
    forbidden = (
        "fastapi",
        "pydantic",
        "sqlalchemy",
        "redis",
        "httpx",
        "app.infrastructure",
        "app.presentation",
        "app.config",
        "app.contracts",
    )
    for layer in ("domain", "application"):
        for path in (Path("app") / layer).glob("*.py"):
            for node in ast.walk(ast.parse(path.read_text())):
                names = []
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    names = [node.module or ""]
                assert not any(name.startswith(forbidden) for name in names), path
