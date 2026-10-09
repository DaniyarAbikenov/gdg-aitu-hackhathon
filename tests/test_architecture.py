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


ADAPTER_ATTRIBUTES = {"state", "store", "repository", "sessions", "documents", "coach", "voice"}


def test_routers_only_call_use_cases():
    """Routers translate HTTP; persistence and providers are reached through use cases."""
    for path in (Path("app") / "presentation").glob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith("app.infrastructure"), path
        if path.name == "dependencies.py":
            continue  # The single place that reads the composed container.
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in ADAPTER_ATTRIBUTES:
                # `cases.voice` is the voice use case, not the provider adapter.
                if node.attr == "voice" and getattr(node.value, "id", "") == "cases":
                    continue
                raise AssertionError(f"{path}:{node.lineno} reaches adapter .{node.attr}")
