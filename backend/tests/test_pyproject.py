"""Test pyproject.toml structure and dependencies."""

import tomllib
from pathlib import Path


def test_pyproject_toml_exists_and_parsable():
    """Verify pyproject.toml exists and is valid TOML."""
    toml_path = Path(__file__).parent.parent / "pyproject.toml"
    assert toml_path.exists(), "pyproject.toml must exist"

    with open(toml_path, "rb") as f:
        data = tomllib.load(f)

    assert data, "pyproject.toml must not be empty"
    assert "project" in data, "pyproject.toml must have [project] section"


def test_project_metadata():
    """Verify project section has correct metadata."""
    toml_path = Path(__file__).parent.parent / "pyproject.toml"
    with open(toml_path, "rb") as f:
        data = tomllib.load(f)

    project = data["project"]
    assert project["name"] == "nordicpump-backend"
    assert project["requires-python"] == ">=3.14"
    assert project["version"] == "0.1.0"


def test_runtime_dependencies():
    """Verify runtime dependencies are declared."""
    toml_path = Path(__file__).parent.parent / "pyproject.toml"
    with open(toml_path, "rb") as f:
        data = tomllib.load(f)

    deps = data["project"]["dependencies"]
    assert any("litestar" in d for d in deps), "litestar missing"
    assert any("httpx" in d for d in deps), "httpx missing"
    assert any("pydantic-settings" in d for d in deps), (
        "pydantic-settings missing"
    )


def test_dev_dependencies():
    """Verify dev dependencies include pytest and tooling."""
    toml_path = Path(__file__).parent.parent / "pyproject.toml"
    with open(toml_path, "rb") as f:
        data = tomllib.load(f)

    dev_deps = data["project"]["optional-dependencies"]["dev"]
    assert any("pytest" in d for d in dev_deps), "pytest missing"
    assert any("pytest-asyncio" in d for d in dev_deps), (
        "pytest-asyncio missing"
    )
    assert any("respx" in d for d in dev_deps), "respx missing"
    assert any("pytest-cov" in d for d in dev_deps), "pytest-cov missing"
    assert any("ruff" in d for d in dev_deps), "ruff missing"
    assert any("mypy" in d for d in dev_deps), "mypy missing"


def test_pytest_config():
    """Verify [tool.pytest.ini_options] section exists with test paths."""
    toml_path = Path(__file__).parent.parent / "pyproject.toml"
    with open(toml_path, "rb") as f:
        data = tomllib.load(f)

    pytest_config = data["tool"]["pytest"]["ini_options"]
    assert pytest_config["testpaths"] == ["tests"]
