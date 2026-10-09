"""Write the API schema the frontend client is generated from.

python scripts/export_openapi.py            # refresh frontend/openapi.json
python scripts/export_openapi.py --check    # fail if the committed schema is stale
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import create_app  # noqa: E402

TARGET = ROOT / "frontend" / "openapi.json"


def main() -> int:
    schema = json.dumps(create_app().openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text() != schema:
            print("frontend/openapi.json is stale; run `npm run api:generate` in frontend/")
            return 1
        return 0
    TARGET.write_text(schema)
    return 0


if __name__ == "__main__":
    sys.exit(main())
